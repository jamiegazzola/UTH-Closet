import { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp, orderBy, limit, onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase'
import { useToast } from '../context/ToastContext'
import { SCHOOLS } from '../utils/catalog'

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_DATA = {
  all: {
    snacks: 1240, essentials: 980, clothing: 756, health: 420, supplies: 634,
    sizes: { S: 210, M: 320, L: 156, XL: 70 },
    monthly: [120, 145, 180, 210, 240, 280, 310, 345, 278, 95, 48, 30],
    monthLabels: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'],
    students: 892, items: 4030,
  },
  fall: {
    snacks: 680, essentials: 520, clothing: 390, health: 210, supplies: 310,
    sizes: { S: 110, M: 170, L: 80, XL: 30 },
    monthly: [120, 145, 180, 210],
    monthLabels: ['Sep', 'Oct', 'Nov', 'Dec'],
    students: 480, items: 2110,
  },
  spring: {
    snacks: 560, essentials: 460, clothing: 366, health: 210, supplies: 324,
    sizes: { S: 100, M: 150, L: 76, XL: 40 },
    monthly: [240, 280, 310, 345, 278],
    monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    students: 412, items: 1920,
  },
  month: {
    snacks: 148, essentials: 112, clothing: 87, health: 52, supplies: 78,
    sizes: { S: 24, M: 36, L: 18, XL: 9 },
    monthly: [278],
    monthLabels: ['May'],
    students: 87, items: 477,
  },
}

const SCHOOL_MULTIPLIERS = {
  'east-high': 0.22, 'bayside': 0.18, 'william-mckinley': 0.14,
  'west-beverly': 0.16, 'shermer': 0.12, 'hawkins': 0.10,
  'liberty': 0.05, 'sunnydale': 0.03,
}

function applySchoolFilter(d, schoolId) {
  if (!schoolId || schoolId === 'all') return d
  const mult = SCHOOL_MULTIPLIERS[schoolId] || 0.15
  return {
    ...d,
    snacks:     Math.round(d.snacks     * mult),
    essentials: Math.round(d.essentials * mult),
    clothing:   Math.round(d.clothing   * mult),
    health:     Math.round(d.health     * mult),
    supplies:   Math.round(d.supplies   * mult),
    sizes: { S: Math.round(d.sizes.S*mult), M: Math.round(d.sizes.M*mult), L: Math.round(d.sizes.L*mult), XL: Math.round(d.sizes.XL*mult) },
    monthly: d.monthly.map(v => Math.round(v * mult)),
    students: Math.round(d.students * mult),
    items:    Math.round(d.items    * mult),
  }
}

const ALERTS = [
  { type: 'crit', title: 'Deodorant critically low at Hawkins High',  body: '3 units left — restock immediately' },
  { type: 'crit', title: 'Granola Bars critically low at East High',  body: '2 units left' },
  { type: 'warn', title: 'Hygiene kits low at all schools',           body: 'Monthly restock due in 4 days' },
  { type: 'warn', title: 'Clothing (XL) low at 3 schools',            body: 'Consider ordering larger sizes' },
  { type: 'info', title: 'Q3 2026 launch approaching',               body: '3 to 5 new sites onboarding this quarter' },
]
const ALERT_STYLE = {
  crit: { bg: '#FFEBEE', dot: '#D0006F' },
  warn: { bg: '#FFF8E1', dot: '#FF9E1B' },
  info: { bg: '#E6EEF5', dot: '#32BCAD' },
}

// ── Live aggregation helper ───────────────────────────────────────────────────
function aggregateOrders(orders) {
  const cats = { snacks: 0, essentials: 0, clothing: 0, health: 0, supplies: 0 }
  const sizes = { S: 0, M: 0, L: 0, XL: 0 }
  const studentSet = new Set()
  const monthlyMap = {}
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  for (const order of orders) {
    studentSet.add(order.userId)
    for (const item of (order.items || [])) {
      const id = item.itemId || ''
      if      (id.startsWith('s')) cats.snacks++
      else if (id.startsWith('e')) cats.essentials++
      else if (id.startsWith('c')) cats.clothing++
      else if (id.startsWith('h')) cats.health++
      else if (id.startsWith('p')) cats.supplies++

      if (item.size && sizes[item.size] !== undefined) sizes[item.size]++
    }
    const ts = order.createdAt?.toDate?.()
    if (ts) {
      const key = ts.getMonth()
      monthlyMap[key] = (monthlyMap[key] || 0) + (order.items?.length || 0)
    }
  }

  const monthKeys = Object.keys(monthlyMap).map(Number).sort((a, b) => a - b)
  const monthly = monthKeys.map(k => monthlyMap[k])
  const monthLabels = monthKeys.map(k => labels[k])

  return {
    snacks: cats.snacks, essentials: cats.essentials,
    clothing: cats.clothing, health: cats.health, supplies: cats.supplies,
    sizes,
    monthly: monthly.length ? monthly : [0],
    monthLabels: monthLabels.length ? monthLabels : ['—'],
    students: studentSet.size,
    items: orders.reduce((s, o) => s + (o.items?.length || 0), 0),
  }
}

// ── BarChart: animates via direct DOM manipulation — zero React state ────
// This means no re-renders, no lag, buttery smooth like CorporatePartners.
function BarChart({ title, rows, color }) {
  const max    = Math.max(...rows.map(r => r.val), 1)
  const wrapRef  = useRef(null)
  const barRefs  = useRef([])  // fill divs
  const valRefs  = useRef([])  // value text divs
  const rafRef   = useRef(null)
  const rowsKey  = rows.map(r => r.val).join(',')

  useEffect(() => {
    // Reset bars to 0 instantly (DOM, not state)
    barRefs.current.forEach(el => { if (el) el.style.width = '0%' })
    valRefs.current.forEach(el => { if (el) el.textContent = '0' })

    const el = wrapRef.current
    if (!el) return

    cancelAnimationFrame(rafRef.current)

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()

      const duration = 1500
      const start    = performance.now()
      const targets  = rows.map(r => r.val)

      function tick(now) {
        const elapsed  = now - start
        const progress = Math.min(elapsed / duration, 1)
        const eased    = 1 - Math.pow(1 - progress, 3)

        targets.forEach((t, i) => {
          if (barRefs.current[i]) barRefs.current[i].style.width = `${(t / max) * 100 * eased}%`
          if (valRefs.current[i]) valRefs.current[i].textContent = Math.round(t * eased).toLocaleString()
        })

        if (progress < 1) rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    }, { threshold: 0.1 })

    observer.observe(el)
    return () => { observer.disconnect(); cancelAnimationFrame(rafRef.current) }
  }, [rowsKey])

  return (
    <div ref={wrapRef} style={{ marginBottom: 28 }}>
      <div style={styles.chartLabel}>{title}</div>
      {rows.map((row, i) => (
        <div key={row.name} style={styles.barRow}>
          <div style={styles.barName}>{row.name}</div>
          <div style={styles.barTrack}>
            <div
              ref={el => barRefs.current[i] = el}
              style={{ ...styles.barFill, width: '0%', background: color }}
            />
          </div>
          <div ref={el => valRefs.current[i] = el} style={styles.barVal}>0</div>
        </div>
      ))}
    </div>
  )
}

// ── AnimatedMetric: DOM-based count-up, zero React state ─────────────────
function AnimatedMetric({ target, isString }) {
  const ref    = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (isString || typeof target !== 'number') { el.textContent = target; return }

    el.textContent = '0'
    cancelAnimationFrame(rafRef.current)
    const duration = 1500
    const start    = performance.now()

    function tick(now) {
      const elapsed  = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      el.textContent = Math.round(target * eased).toLocaleString()
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return <div ref={ref} style={styles.metricVal}>0</div>
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminReports({ selectedSchoolId, mode, setMode }) {
  const [timeFilter, setTimeFilter] = useState('all')
  const { showToast } = useToast()

  // Live data
  const [liveOrders, setLiveOrders]   = useState([])
  const [liveLoading, setLiveLoading] = useState(false)

  // Subscribe to live orders when in live mode — only fulfilled orders count as "distributed"
  useEffect(() => {
    if (mode !== 'live') return
    setLiveLoading(true)

    const constraints = [where('status', '==', 'fulfilled'), orderBy('createdAt', 'desc')]
    if (selectedSchoolId) constraints.unshift(where('schoolId', '==', selectedSchoolId))

    const q = query(collection(db, 'orders'), ...constraints)
    const unsub = onSnapshot(q,
      snap => {
        setLiveOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLiveLoading(false)
      },
      err => {
        console.error('[AdminReports] live error:', err)
        setLiveLoading(false)
      }
    )
    return () => unsub()
  }, [mode, selectedSchoolId])

  const isDemo = mode === 'demo'
  const currentSchool = SCHOOLS.find(s => s.id === selectedSchoolId)

  // Demo data pipeline
  const baseData = DEMO_DATA[timeFilter]
  const demoD    = applySchoolFilter(baseData, selectedSchoolId)

  // Live data — aggregated from real orders
  const liveD    = aggregateOrders(liveOrders)

  const d = isDemo ? demoD : liveD

  async function sendRestockAll() {
    if (isDemo) { showToast('[Demo] Bulk restock sent (no data changed)', 'success'); return }
    await addDoc(collection(db, 'restock_requests'), {
      type: 'bulk', status: 'pending', createdAt: serverTimestamp(),
    }).catch(() => {})
    showToast('Bulk restock sent to all partners', 'success')
  }

  function generateReport() {
    showToast(isDemo ? '[Demo] Impact report generated' : 'Impact report generated — ready for grant submission', 'success')
  }
  function sendSurvey() {
    showToast(isDemo ? '[Demo] Readiness survey sent' : 'Readiness survey sent to new school sites', 'success')
  }

  const schoolRows = selectedSchoolId
    ? SCHOOLS.filter(s => s.id === selectedSchoolId)
    : SCHOOLS.slice(0, 5)

  return (
    <div style={styles.wrap}>

      {/* ── MODE PILL ── */}
      <div style={styles.pillRow}>
        <div style={styles.pill}>
          <button
            style={{ ...styles.pillBtn, ...(isDemo ? styles.pillBtnDemo : styles.pillBtnOff) }}
            onClick={() => setMode('demo')}
          >
            Demo
          </button>
          <button
            style={{ ...styles.pillBtn, ...(!isDemo ? styles.pillBtnLive : styles.pillBtnOff) }}
            onClick={() => setMode('live')}
          >
            <span style={!isDemo ? styles.liveDot : styles.liveDotOff} />
            Live
          </button>
        </div>
        {isDemo ? (
          <div style={styles.modeNotice}>
            Demo mode — placeholder data for illustration only
          </div>
        ) : liveLoading ? (
          <div style={{ ...styles.modeNotice, color: '#003865' }}>
            Loading live data…
          </div>
        ) : (
          <div style={{ ...styles.modeNotice, color: '#2E7D32', borderColor: 'rgba(120,190,32,.25)', background: 'rgba(120,190,32,.06)' }}>
            Live — {liveOrders.length} fulfilled order{liveOrders.length !== 1 ? 's' : ''}{currentSchool ? ` for ${currentSchool.name}` : ' across all schools'}
          </div>
        )}
      </div>

      {currentSchool && (
        <div style={styles.schoolBanner}>
          Viewing: <strong>{currentSchool.name}</strong>
          <span style={styles.schoolBannerHint}> — change school using the nav picker above</span>
        </div>
      )}

      {/* Metrics */}
      <div style={styles.metricsRow}>
        <div style={{ ...styles.metric, borderTopColor: '#32BCAD' }}>
          <div style={styles.metricLabel}>Total Items Distributed</div>
          <AnimatedMetric target={d.items} />
          <div style={styles.metricSub}>{currentSchool ? currentSchool.name : 'All schools combined'}</div>
        </div>
        <div style={{ ...styles.metric, borderTopColor: '#003865' }}>
          <div style={styles.metricLabel}>Students Served</div>
          <AnimatedMetric target={d.students} />
          <div style={styles.metricSub}>{currentSchool ? currentSchool.name : 'All schools combined'}</div>
        </div>
        <div style={{ ...styles.metric, borderTopColor: '#78BE20' }}>
          <div style={styles.metricLabel}>Schools Active</div>
          <AnimatedMetric
            target={isDemo ? (currentSchool ? 1 : 3) : new Set(liveOrders.map(o => o.schoolId).filter(Boolean)).size}
          />
          <div style={styles.metricSub}>{currentSchool ? currentSchool.name : 'All schools combined'}</div>
        </div>
        <div style={{ ...styles.metric, borderTopColor: '#642F6C' }}>
          <div style={styles.metricLabel}>Category Partners</div>
          <AnimatedMetric target={isDemo ? 7 : 0} />
          <div style={styles.metricSub}>{currentSchool ? currentSchool.name : 'All schools combined'}</div>
        </div>
      </div>

      {/* Time filter — only visible in demo mode */}
      {isDemo && (
        <div style={styles.filterRow}>
          {[
            { key: 'all',    label: 'All Time' },
            { key: 'fall',   label: 'Fall Semester' },
            { key: 'spring', label: 'Spring Semester' },
            { key: 'month',  label: 'This Month' },
          ].map(f => (
            <button
              key={f.key}
              style={{ ...styles.filterBtn, ...(timeFilter === f.key ? styles.filterBtnOn : {}) }}
              onClick={() => setTimeFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
          <button style={styles.exportBtn} onClick={generateReport}>Export Report</button>
        </div>
      )}
      {!isDemo && (
        <div style={styles.filterRow}>
          <button style={styles.exportBtn} onClick={generateReport}>Export Report</button>
        </div>
      )}

      <div style={styles.mainGrid}>
        <div style={styles.chartsCard}>
          <BarChart
            title="Items Distributed by Category"
            rows={[
              { name: 'Snacks',     val: d.snacks },
              { name: 'Essentials', val: d.essentials },
              { name: 'Clothing',   val: d.clothing },
              { name: 'Supplies',   val: d.supplies },
              { name: 'Health',     val: d.health },
            ]}
            color="#003865"
          />
          <BarChart
            title="Clothing Sizes Most Requested"
            rows={[
              { name: 'Small',  val: d.sizes.S },
              { name: 'Medium', val: d.sizes.M },
              { name: 'Large',  val: d.sizes.L },
              { name: 'XL',     val: d.sizes.XL },
            ]}
            color="#642F6C"
          />
          <BarChart
            title="Monthly Usage Trend"
            rows={d.monthLabels.map((m, i) => ({ name: m, val: d.monthly[i] || 0 }))}
            color="#32BCAD"
          />

          {isDemo && (
            <div style={{ marginTop: 8 }}>
              <div style={styles.chartLabel}>Schools at a Glance</div>
              <table style={styles.schoolTable}>
                <thead>
                  <tr>
                    {['School', 'Students Served', 'Relative Usage'].map(h => (
                      <th key={h} style={styles.schoolTh}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schoolRows.map(school => {
                    const mult = SCHOOL_MULTIPLIERS[school.id] || 0.15
                    const served = Math.round(baseData.students * mult)
                    const pct    = Math.round((mult / 0.22) * 100)
                    return (
                      <tr key={school.id}>
                        <td style={styles.schoolTd}>
                          <strong>{school.name}</strong><br />
                          <span style={{ color: '#AEAEAE', fontSize: 11 }}>{school.city}</span>
                        </td>
                        <td style={styles.schoolTd}>{served}</td>
                        <td style={styles.schoolTd}>
                          <div style={styles.miniBar}>
                            <div style={{ ...styles.miniFill, width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Live: show order list */}
          {!isDemo && (
            <div style={{ marginTop: 8 }}>
              <div style={styles.chartLabel}>Recent Orders</div>
              {liveLoading ? (
                <p style={{ fontSize: 13, color: '#AEAEAE', textAlign: 'center', padding: 16 }}>Loading…</p>
              ) : liveOrders.length === 0 ? (
                <p style={{ fontSize: 13, color: '#AEAEAE', textAlign: 'center', padding: 16 }}>
                  No orders found. Submit orders via the Student view to see data here.
                </p>
              ) : (
                <table style={styles.schoolTable}>
                  <thead>
                    <tr>
                      {['Order ID', 'School', 'Items', 'Status'].map(h => (
                        <th key={h} style={styles.schoolTh}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveOrders.slice(0, 20).map(order => (
                      <tr key={order.id}>
                        <td style={styles.schoolTd}><strong>{order.anonymousId}</strong></td>
                        <td style={styles.schoolTd}>
                          {SCHOOLS.find(s => s.id === order.schoolId)?.name || order.schoolId}
                        </td>
                        <td style={styles.schoolTd}>
                          <span style={{ fontSize: 11, color: '#6B6B6B' }}>
                            {order.items?.map(i => i.name).join(', ')}
                          </span>
                        </td>
                        <td style={styles.schoolTd}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4,
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: 10, fontWeight: 600,
                            background: order.status === 'fulfilled' ? '#E8F5E9' : '#E6EEF5',
                            color:      order.status === 'fulfilled' ? '#2E7D32' : '#003865',
                          }}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Right col */}
        <div>
          {isDemo && (
            <div style={styles.sideCard}>
              <div style={styles.sideTitle}>Alerts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ALERTS.map((a, i) => {
                  const s = ALERT_STYLE[a.type]
                  return (
                    <div key={i} style={{ ...styles.alertItem, background: s.bg }}>
                      <div style={{ ...styles.alertDot, background: s.dot }} />
                      <div>
                        <div style={styles.alertTitle}>{a.title}</div>
                        <div style={styles.alertBody}>{a.body}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ ...styles.sideCard, marginTop: isDemo ? 16 : 0 }}>
            <div style={styles.sideTitle}>Quick Actions</div>
            <button style={{ ...styles.qaBtn, background: '#003865', color: '#fff', marginBottom: 8 }} onClick={sendRestockAll}>
              Send Restock to All Partners
            </button>
            <button style={{ ...styles.qaBtn, background: '#642F6C', color: '#fff', marginBottom: 8 }} onClick={generateReport}>
              Generate Impact Report
            </button>
            <button style={{ ...styles.qaBtn, background: '#32BCAD', color: '#002548' }} onClick={sendSurvey}>
              Send Readiness Survey
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrap: { padding: 24, background: '#F5F4F1', minHeight: 'calc(100dvh - 80px)', animation: 'fadeIn .4s ease both' },

  pillRow: {
    display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap',
  },
  pill: {
    display: 'flex', background: '#E8E5E0', borderRadius: 10, padding: 3, gap: 2, flexShrink: 0,
  },
  pillBtn: {
    padding: '7px 20px', border: 'none', borderRadius: 8,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12, fontWeight: 600, letterSpacing: '.07em',
    cursor: 'pointer', transition: 'all .18s', touchAction: 'manipulation',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  pillBtnOff:  { background: 'transparent', color: '#AEAEAE' },
  pillBtnDemo: { background: '#fff', color: '#642F6C', boxShadow: '0 1px 4px rgba(0,0,0,.1)' },
  pillBtnLive: { background: '#003865', color: '#fff', boxShadow: '0 1px 6px rgba(0,56,101,.3)' },
  liveDot: {
    width: 7, height: 7, borderRadius: '50%', background: '#78BE20',
    display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite',
  },
  liveDotOff: {
    width: 7, height: 7, borderRadius: '50%', background: '#AEAEAE', display: 'inline-block',
  },
  modeNotice: {
    fontSize: 12, color: '#6B6B6B', fontFamily: "'Open Sans', sans-serif",
    padding: '7px 12px', border: '1px solid #E8E5E0', borderRadius: 7, background: '#fff',
  },

  schoolBanner: {
    background: 'rgba(50,188,173,.08)', border: '1px solid rgba(50,188,173,.2)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#003865',
    fontFamily: "'Open Sans', sans-serif", marginBottom: 20,
  },
  schoolBannerHint: { color: '#AEAEAE', fontSize: 12 },

  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 },
  metric: {
    background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12,
    padding: '16px 18px', borderTop: '3px solid #003865', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
  },
  metricLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 500,
    letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 8,
  },
  metricVal: { fontFamily: "'Oswald', sans-serif", fontSize: 32, fontWeight: 600, color: '#003865', lineHeight: 1 },
  metricSub: { fontSize: 11, color: '#AEAEAE', marginTop: 6 },

  filterRow: { display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' },
  filterBtn: {
    padding: '7px 16px', border: '1px solid #E8E5E0', borderRadius: 6, background: '#fff',
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '.06em',
    textTransform: 'uppercase', color: '#6B6B6B', cursor: 'pointer', transition: 'all .15s',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  },
  filterBtnOn: { background: '#003865', color: '#fff', borderColor: '#003865' },
  exportBtn: {
    padding: '7px 16px', background: '#642F6C', color: '#fff', border: 'none', borderRadius: 6,
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
    textTransform: 'uppercase', cursor: 'pointer', marginLeft: 'auto', touchAction: 'manipulation',
  },

  mainGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 },
  chartsCard: {
    background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12,
    padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
  },
  chartLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, letterSpacing: '.1em',
    textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 12, fontWeight: 600,
    paddingLeft: 8, borderLeft: '3px solid #32BCAD',
  },
  barRow: { display: 'grid', gridTemplateColumns: '90px 1fr 46px', gap: 10, alignItems: 'center', marginBottom: 9 },
  barName: { fontSize: 12, color: '#1A1A1A', fontWeight: 500 },
  barTrack: { height: 20, background: '#F0EDE8', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, transition: 'width .5s ease' },
  barVal: { textAlign: 'right', fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, color: '#003865' },

  schoolTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  schoolTh: {
    padding: '8px 10px', textAlign: 'left', fontFamily: "'Oswald', sans-serif",
    fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
    color: '#6B6B6B', borderBottom: '1px solid #E8E5E0', background: '#F5F4F1',
  },
  schoolTd: { padding: '10px', borderBottom: '1px solid #F0EDE8', lineHeight: 1.5 },
  miniBar: { height: 5, background: '#F0EDE8', borderRadius: 3, overflow: 'hidden', width: 100 },
  miniFill: { height: '100%', borderRadius: 3, background: '#003865' },

  sideCard: {
    background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12,
    padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
  },
  sideTitle: {
    fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600, color: '#003865',
    letterSpacing: '.04em', marginBottom: 14, paddingLeft: 8, borderLeft: '3px solid #32BCAD',
  },
  alertItem: { display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, alignItems: 'flex-start' },
  alertDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 3 },
  alertTitle: { fontSize: 12, fontWeight: 600, color: '#1A1A1A', marginBottom: 2 },
  alertBody:  { fontSize: 11, color: '#6B6B6B' },
  qaBtn: {
    width: '100%', padding: '12px 16px', border: 'none', borderRadius: 8,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.07em',
    textTransform: 'uppercase', cursor: 'pointer', display: 'block', transition: 'opacity .15s',
    textAlign: 'left', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  },
}
