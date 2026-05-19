import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '../context/ToastContext'

// ── Demo data ─────────────────────────────────────────────────────────────────
const PARTNERS = [
  {
    id: 'costco',
    name: 'Costco',
    category: 'Food & Snacks',
    since: 'October 2025',
    agreementType: 'Bulk donation partner',
    contact: 'community@costco.com',
    nextShipment: 'May 30, 2026',
    commitment: '500 snack units / month',
    metrics: { itemsShipped: 4200, schoolsReached: 3, studentsImpacted: 612, retailValue: '$18K' },
    badges: [
      { title: 'Gold Food Partner',      desc: '4000+ snack items across all 3 schools' },
      { title: 'Most Impactful Partner', desc: 'Highest student reach this school year' },
      { title: 'Renewed for 2026–27',    desc: 'Partnership extended — expanded delivery' },
    ],
    shipments: [
      { date: 'May 1, 2026',  school: 'All schools',   items: 'Granola bars · Protein bars · Oatmeal', qty: 500, status: 'Delivered', tracking: 'CC-2026-0501' },
      { date: 'Apr 1, 2026',  school: 'All schools',   items: 'Snack variety pack · Fruit packs',      qty: 480, status: 'Delivered', tracking: 'CC-2026-0401' },
      { date: 'Mar 1, 2026',  school: 'All schools',   items: 'Monthly snack bundle',                  qty: 510, status: 'Delivered', tracking: 'CC-2026-0301' },
      { date: 'May 30, 2026', school: 'All 3 schools', items: 'May snack replenishment',               qty: 500, status: 'Scheduled', tracking: 'Pending'      },
    ],
    categoryBreakdown: [
      { name: 'Granola bars',  val: 980, color: '#FF9E1B' },
      { name: 'Protein bars',  val: 820, color: '#f5780a' },
      { name: 'Fruit packs',   val: 760, color: '#78BE20' },
      { name: 'Oatmeal cups',  val: 640, color: '#003865' },
      { name: 'Yogurt cups',   val: 600, color: '#32BCAD' },
      { name: 'Snack variety', val: 400, color: '#642F6C' },
    ],
    schoolBreakdown: [
      { name: 'Monarch SD', val: 1680, color: '#003865' },
      { name: 'Syracuse',   val: 1400, color: '#642F6C' },
      { name: 'Upstate NY', val: 1120, color: '#32BCAD' },
    ],
    timeline: [
      { date: 'May 3, 2026',  label: 'May delivery confirmed',      desc: '500 snack items across all schools',    color: '#32BCAD', icon: 'check'  },
      { date: 'Apr 3, 2026',  label: 'April delivery confirmed',    desc: '480 items — full coverage all 3 sites', color: '#32BCAD', icon: 'check'  },
      { date: 'Mar 3, 2026',  label: 'March delivery confirmed',    desc: 'Monthly cadence on track',              color: '#32BCAD', icon: 'check'  },
      { date: 'Jan 20, 2026', label: 'Partnership renewed 2026–27', desc: 'Expanded to monthly bulk delivery',     color: '#003865', icon: 'star'   },
    ],
    restocks: [
      { item: 'Granola bars', school: 'Upstate NY · 12 units left', urgency: 'MEDIUM' },
      { item: 'Protein bars', school: 'Syracuse · 7 units left',    urgency: 'HIGH'   },
    ],
    quotes: [
      { text: `"Kids who used to come in hungry can focus now. The snack closet has changed the whole energy of mornings."`, attr: 'Principal, Monarch School' },
    ],
  },
  {
    id: 'cvs',
    name: 'CVS',
    category: 'Hygiene & Essentials',
    since: 'September 2025',
    agreementType: 'Annual category sponsor',
    contact: 'communitygiving@cvs.com',
    nextShipment: 'May 15, 2026',
    commitment: '400 hygiene kits / semester',
    metrics: { itemsShipped: 3840, schoolsReached: 3, studentsImpacted: 412, retailValue: '$28K' },
    badges: [
      { title: 'Gold Community Partner', desc: '500+ items shipped · 3 schools supported' },
      { title: 'Impact Partner 2025–26', desc: 'Uth Inc. annual recognition award' },
      { title: 'Featured partner story', desc: 'Published in Uth Q1 2026 newsletter' },
    ],
    shipments: [
      { date: 'Apr 28, 2026', school: 'Monarch School, SD', items: 'Hygiene kits · Deodorant · Shampoo',      qty: 180, status: 'Delivered', tracking: 'CVS-2026-0428'  },
      { date: 'Apr 28, 2026', school: 'Syracuse Pilot',     items: 'Hygiene kits · Menstrual supplies',       qty: 140, status: 'Delivered', tracking: 'CVS-2026-0428B' },
      { date: 'Mar 15, 2026', school: 'Upstate NY',         items: 'Deodorant · Body wash · Toothbrush kits', qty: 110, status: 'Delivered', tracking: 'CVS-2026-0315'  },
      { date: 'Mar 15, 2026', school: 'Monarch School, SD', items: 'Full hygiene kits · Conditioner',         qty: 165, status: 'Delivered', tracking: 'CVS-2026-0315B' },
      { date: 'Feb 1, 2026',  school: 'All schools',        items: 'Monthly replenishment — full kit',        qty: 390, status: 'Delivered', tracking: 'CVS-2026-0201'  },
      { date: 'May 15, 2026', school: 'All 3 schools',      items: 'Hygiene kits · Menstrual supplies',       qty: 420, status: 'Scheduled', tracking: 'Pending'        },
    ],
    categoryBreakdown: [
      { name: 'Hygiene kits',        val: 390, color: '#32BCAD' },
      { name: 'Deodorant',           val: 280, color: '#1a8f82' },
      { name: 'Menstrual supplies',  val: 240, color: '#D0006F' },
      { name: 'Shampoo/conditioner', val: 210, color: '#642F6C' },
      { name: 'Body wash/soap',      val: 180, color: '#3b6fb5' },
      { name: 'Toothbrush sets',     val: 160, color: '#003865' },
    ],
    schoolBreakdown: [
      { name: 'Monarch SD', val: 1680, color: '#003865' },
      { name: 'Syracuse',   val: 1260, color: '#642F6C' },
      { name: 'Upstate NY', val:  900, color: '#32BCAD' },
    ],
    timeline: [
      { date: 'Apr 30, 2026', label: 'April 2026 shipment delivered',   desc: '540 items across 2 schools · confirmed receipt',    color: '#32BCAD', icon: 'check'  },
      { date: 'Mar 18, 2026', label: 'March 2026 shipment delivered',   desc: '275 items to Upstate NY · Monarch SD restocked',    color: '#32BCAD', icon: 'check'  },
      { date: 'Feb 4, 2026',  label: 'Feb 2026 full replenishment',     desc: '390 hygiene kits distributed — all schools',        color: '#FF9E1B', icon: 'circle' },
      { date: 'Jan 10, 2026', label: 'Partnership renewed for 2026–27', desc: 'Extended agreement signed · expanded to 5 schools', color: '#003865', icon: 'star'   },
    ],
    restocks: [
      { item: 'Deodorant',          school: 'Monarch School, SD · 3 units left',  urgency: 'CRITICAL' },
      { item: 'Hygiene kits',       school: 'All 3 schools · Monthly due May 15', urgency: 'HIGH'     },
      { item: 'Menstrual supplies', school: 'Syracuse Pilot · 8 units left',      urgency: 'HIGH'     },
      { item: 'Shampoo',            school: 'Upstate NY · 12 units left',         urgency: 'MEDIUM'   },
    ],
    quotes: [
      { text: `"Before the Uth Closet, I would skip school on days I didn't have clean clothes. Now I go every day."`, attr: '8th Grader, Monarch School' },
      { text: `"My students show up more confident. They're focused on learning, not on what they're wearing or whether they've eaten."`, attr: 'School Counselor, Syracuse Pilot' },
    ],
  },
  {
    id: 'nike',
    name: 'Nike',
    category: 'Clothing & Footwear',
    since: 'February 2026',
    agreementType: 'Quarterly sponsor',
    contact: 'giving@nike.com',
    nextShipment: 'Jun 15, 2026',
    commitment: '200 apparel units / quarter',
    metrics: { itemsShipped: 680, schoolsReached: 2, studentsImpacted: 156, retailValue: '$22K' },
    badges: [
      { title: 'Clothing Partner',    desc: '600+ items shipped · 2 schools' },
      { title: 'New Partner 2025–26', desc: 'First quarter completed successfully' },
    ],
    shipments: [
      { date: 'Apr 20, 2026', school: 'Monarch School, SD', items: 'Sneakers · T-shirts · Shorts',  qty: 200, status: 'Delivered', tracking: 'NK-2026-0420' },
      { date: 'Mar 5, 2026',  school: 'Upstate NY',         items: 'Hoodies · Sweatpants · Socks',  qty: 180, status: 'Delivered', tracking: 'NK-2026-0305' },
      { date: 'Jun 15, 2026', school: 'All schools',        items: 'Sneakers · Clothing bundle',    qty: 250, status: 'Scheduled', tracking: 'Pending'      },
    ],
    categoryBreakdown: [
      { name: 'Sneakers',   val: 280, color: '#003865' },
      { name: 'Hoodies',    val: 160, color: '#642F6C' },
      { name: 'T-shirts',   val: 120, color: '#32BCAD' },
      { name: 'Sweatpants', val:  80, color: '#FF9E1B' },
      { name: 'Socks',      val:  40, color: '#78BE20' },
    ],
    schoolBreakdown: [
      { name: 'Monarch SD', val: 380, color: '#003865' },
      { name: 'Upstate NY', val: 300, color: '#32BCAD' },
    ],
    timeline: [
      { date: 'Apr 22, 2026', label: 'Spring delivery confirmed', desc: '200 apparel items + footwear to Monarch SD', color: '#32BCAD', icon: 'check' },
      { date: 'Mar 7, 2026',  label: 'Winter delivery confirmed', desc: '180 cold-weather items delivered',            color: '#32BCAD', icon: 'check' },
      { date: 'Feb 1, 2026',  label: 'Partnership launched',      desc: 'Onboarding complete · first order placed',    color: '#003865', icon: 'star'  },
    ],
    restocks: [
      { item: 'Sneakers (sizes 8–10)', school: 'Monarch SD · 6 pairs left',  urgency: 'HIGH'   },
      { item: 'Socks 3-packs',         school: 'All schools · 8 packs left', urgency: 'MEDIUM' },
    ],
    quotes: [
      { text: `"I hadn't had new shoes since 6th grade. Getting a pair that actually fit made me feel like I belonged."`, attr: '9th Grader, Monarch School' },
    ],
  },
  {
    id: 'staples',
    name: 'Staples',
    category: 'School Supplies',
    since: 'January 2026',
    agreementType: 'Semester sponsor',
    contact: 'community@staples.com',
    nextShipment: 'Jun 1, 2026',
    commitment: '300 supply kits / semester',
    metrics: { itemsShipped: 1240, schoolsReached: 2, studentsImpacted: 198, retailValue: '$14K' },
    badges: [
      { title: 'Community Partner',   desc: '1000+ items shipped · 2 schools supported' },
      { title: 'New Partner 2025–26', desc: 'First semester completed' },
    ],
    shipments: [
      { date: 'Apr 10, 2026', school: 'Monarch School, SD', items: 'Notebooks · Pens · Backpacks', qty: 120, status: 'Delivered', tracking: 'ST-2026-0410' },
      { date: 'Mar 1, 2026',  school: 'Syracuse Pilot',     items: 'Full supply kits · Folders',   qty:  95, status: 'Delivered', tracking: 'ST-2026-0301' },
      { date: 'Jun 1, 2026',  school: 'All 2 schools',      items: 'Supply kits · Folders · Pens', qty: 210, status: 'Scheduled', tracking: 'Pending'      },
    ],
    categoryBreakdown: [
      { name: 'Supply kits', val: 300, color: '#78BE20' },
      { name: 'Notebooks',   val: 320, color: '#003865' },
      { name: 'Backpacks',   val: 240, color: '#642F6C' },
      { name: 'Pen sets',    val: 200, color: '#32BCAD' },
      { name: 'Folders',     val: 180, color: '#FF9E1B' },
    ],
    schoolBreakdown: [
      { name: 'Monarch SD', val: 720, color: '#003865' },
      { name: 'Syracuse',   val: 520, color: '#642F6C' },
    ],
    timeline: [
      { date: 'Apr 12, 2026', label: 'April shipment confirmed', desc: '120 supply items delivered to Monarch SD', color: '#32BCAD', icon: 'check' },
      { date: 'Mar 3, 2026',  label: 'March delivery completed', desc: '95 items received at Syracuse Pilot',      color: '#32BCAD', icon: 'check' },
      { date: 'Jan 15, 2026', label: 'Partnership launched',     desc: 'First shipment to 2 pilot schools',        color: '#003865', icon: 'star'  },
    ],
    restocks: [
      { item: 'Backpacks', school: 'Monarch SD · 4 units left',   urgency: 'HIGH'   },
      { item: 'Notebooks', school: 'All schools · 15 units left', urgency: 'MEDIUM' },
    ],
    quotes: [
      { text: `"Having a backpack and supplies meant I could actually take my work home. It changed everything."`, attr: '10th Grader, Syracuse Pilot' },
    ],
  },
]

const URGENCY_STYLES = {
  CRITICAL: { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' },
  HIGH:     { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  MEDIUM:   { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
}

const STATUS_STYLE = {
  Delivered: { bg: '#D1FAE5', color: '#065F46' },
  Scheduled: { bg: '#DBEAFE', color: '#1E40AF' },
  Pending:   { bg: '#F3F4F6', color: '#6B7280' },
}

// ── Animated count-up hook ───────────────────────────────────────────────
function useCountUp(target, duration = 1500, active = true) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!active) { setValue(0); return }
    const start = performance.now()
    const isNum = typeof target === 'number'
    const end = isNum ? target : parseFloat(String(target).replace(/[^0-9.]/g, '')) || 0

    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(end * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, active])

  return value
}

// ── Animated bar chart — starts only when scrolled into view ─────────────
function AnimatedMiniBar({ rows }) {
  const max = Math.max(...rows.map(r => r.val), 1)
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [widths, setWidths] = useState(rows.map(() => 0))
  const [vals, setVals] = useState(rows.map(() => 0))
  const rafRef = useRef(null)

  useEffect(() => {
    setVisible(false)
    setWidths(rows.map(() => 0))
    setVals(rows.map(() => 0))
  }, [rows])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rows])

  useEffect(() => {
    if (!visible) return
    const duration = 1500
    const start = performance.now()
    const targets = rows.map(r => r.val)

    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setWidths(targets.map(t => (t / max) * 100 * eased))
      setVals(targets.map(t => Math.round(t * eased)))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [visible])

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 140, fontSize: 12, color: '#4B5563', fontFamily: "'Open Sans', sans-serif", flexShrink: 0, textAlign: 'right' }}>{r.name}</div>
          <div style={{ flex: 1, height: 16, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${widths[i] || 0}%`, background: r.color, borderRadius: 4 }} />
          </div>
          <div style={{ width: 44, fontSize: 12, fontFamily: "'Oswald', sans-serif", fontWeight: 600, color: '#003865', textAlign: 'right' }}>{vals[i]}</div>
        </div>
      ))}
    </div>
  )
}

function MiniBar({ rows }) {
  return <AnimatedMiniBar rows={rows} />
}

function TimelineIcon({ type }) {
  if (type === 'check') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
  if (type === 'star') return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
  return <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CorporatePartners({ mode, setMode }) {
  const { showToast } = useToast()
  const [activeId, setActiveId]         = useState(PARTNERS[0].id)
  const [pledgedItems, setPledgedItems] = useState({})
  const [animKey, setAnimKey]           = useState(0) // bump to re-trigger count-ups

  const isDemo = mode !== 'live'
  const p = PARTNERS.find(x => x.id === activeId) || PARTNERS[0]

  // Re-trigger animations whenever partner switches
  const prevId = useRef(activeId)
  useEffect(() => {
    if (activeId !== prevId.current) {
      prevId.current = activeId
      setAnimKey(k => k + 1)
    }
  }, [activeId])

  function handlePledge(itemName) {
    setPledgedItems(prev => ({ ...prev, [`${activeId}-${itemName}`]: true }))
    showToast(`Commitment confirmed for ${itemName}`)
  }

  // ── Live empty states ────────────────────────────────────────────────────
  const liveMetrics = { itemsShipped: 0, schoolsReached: 0, studentsImpacted: 0, retailValue: '$0' }
  const displayMetrics = isDemo ? p.metrics : liveMetrics

  // ── Animated metric values ───────────────────────────────────────────────
  const animItems    = useCountUp(displayMetrics.itemsShipped,    1500)
  const animSchools  = useCountUp(displayMetrics.schoolsReached,  1500)
  const animStudents = useCountUp(displayMetrics.studentsImpacted, 1500)

  function EmptyState({ message }) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#AEAEAE" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div style={{ fontSize: 13, color: '#AEAEAE', fontFamily: "'Open Sans', sans-serif" }}>{message}</div>
      </div>
    )
  }

  return (
    <div style={s.page}>

      {/* ── Demo / Live pill — identical to StaffDashboard ── */}
      <div style={s.pillRow}>
        <div style={s.pill}>
          <button
            style={{ ...s.pillBtn, ...(isDemo ? s.pillBtnDemo : s.pillBtnOff) }}
            onClick={() => setMode('demo')}
          >Demo</button>
          <button
            style={{ ...s.pillBtn, ...(mode === 'live' ? s.pillBtnLive : s.pillBtnOff) }}
            onClick={() => setMode('live')}
          >
            <span style={mode === 'live' ? s.liveDot : s.liveDotOff} />
            Live
          </button>
        </div>
        {isDemo
          ? <div style={s.demoNotice}>Demo mode — all data is placeholder. Switch to Live to connect Firebase.</div>
          : <div style={{ ...s.demoNotice, color: '#003865', borderColor: 'rgba(50,188,173,.2)', background: 'rgba(50,188,173,.05)' }}>Viewing live partner data — connect Firebase to populate.</div>
        }
      </div>

      {/* ── Header banner ── */}
      <div style={s.banner}>
        <div style={s.bannerLeft}>
          <h1 style={s.bannerTitle}>Corporate Partner Portal</h1>
          <p style={s.bannerSub}>
            Track shipments, monitor impact, respond to restock requests, and see exactly how your contributions are making a difference for students across every school.
          </p>
        </div>
        <div style={s.partnerTabs}>
          {PARTNERS.map(partner => (
            <button
              key={partner.id}
              style={{ ...s.partnerTab, ...(activeId === partner.id ? s.partnerTabActive : {}) }}
              onClick={() => setActiveId(partner.id)}
            >
              {partner.name.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Metrics ── */}
      <div style={s.metricsRow}>
        {[
          { val: animItems.toLocaleString(),   label: 'Items Shipped',    sub: 'This school year',  border: '#FF9E1B' },
          { val: animSchools,                  label: 'Schools Reached',   sub: 'Active locations',  border: '#32BCAD' },
          { val: animStudents,                 label: 'Students Impacted', sub: 'Direct recipients', border: '#78BE20' },
          { val: displayMetrics.retailValue,   label: 'Est. Retail Value', sub: 'Of goods donated',  border: '#003865' },
        ].map((m, i) => (
          <div key={i} style={{ ...s.metCard, borderTop: `4px solid ${m.border}` }}>
            <div style={{ ...s.metVal, color: isDemo ? '#003865' : '#AEAEAE' }}>{m.val}</div>
            <div style={s.metLabel}>{m.label}</div>
            <div style={s.metSub}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div style={s.mainGrid}>

        {/* LEFT */}
        <div style={s.leftCol}>

          {/* Shipment history */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={s.cardTitle}>Shipment history</span>
              <button style={s.exportBtn} onClick={() => showToast('CSV exported')}>Export CSV</button>
            </div>
            {!isDemo ? (
              <EmptyState message="No shipments recorded yet. Data will appear here once connected to Firebase." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>{['Date','School','Items Shipped','Qty','Status','Tracking'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {p.shipments.map((sh, i) => {
                      const ss = STATUS_STYLE[sh.status] || STATUS_STYLE.Pending
                      return (
                        <tr key={i} style={i % 2 !== 0 ? { background: '#FAFAF9' } : {}}>
                          <td style={s.td}>{sh.date}</td>
                          <td style={{ ...s.td, fontWeight: 600 }}>{sh.school}</td>
                          <td style={{ ...s.td, color: '#6B7280' }}>{sh.items}</td>
                          <td style={{ ...s.td, fontWeight: 700, color: '#003865' }}>{sh.qty}</td>
                          <td style={s.td}><span style={{ ...s.statusPill, background: ss.bg, color: ss.color }}>{sh.status}</span></td>
                          <td style={{ ...s.td, fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{sh.tracking}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Items by category */}
          <div style={s.card}>
            <div style={s.cardTitle}>Items shipped by category</div>
            <div style={{ marginTop: 16 }}>
              {!isDemo
                ? <EmptyState message="No category data yet." />
                : <MiniBar rows={p.categoryBreakdown} />
              }
            </div>
          </div>

          {/* Restock requests */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={s.cardTitle}>Open restock requests</span>
              <span style={s.cardSubNote}>Items your category partner is responsible for</span>
            </div>
            {!isDemo ? (
              <EmptyState message="No open restock requests." />
            ) : (
              p.restocks.map((r, i) => {
                const us = URGENCY_STYLES[r.urgency] || URGENCY_STYLES.MEDIUM
                const pledgeKey = `${activeId}-${r.item}`
                const pledged = pledgedItems[pledgeKey]
                return (
                  <div key={i} style={{ ...s.restockRow, borderBottom: i < p.restocks.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <div style={s.restockInfo}>
                      <div style={s.restockItem}>{r.item}</div>
                      <div style={s.restockSchool}>{r.school}</div>
                    </div>
                    <div style={s.restockRight}>
                      <span style={{ ...s.urgencyBadge, background: us.bg, color: us.color, border: `1px solid ${us.border}` }}>{r.urgency}</span>
                      <button
                        style={{ ...s.pledgeBtn, ...(pledged ? s.pledgeBtnDone : {}) }}
                        onClick={() => !pledged && handlePledge(r.item)}
                        disabled={pledged}
                      >
                        {pledged ? 'Committed' : 'Pledge to fill'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Per school */}
          <div style={s.card}>
            <div style={s.cardTitle}>Items shipped per school</div>
            <div style={{ marginTop: 16 }}>
              {!isDemo
                ? <EmptyState message="No school data yet." />
                : <MiniBar rows={p.schoolBreakdown} />
              }
            </div>
          </div>

        </div>

        {/* RIGHT */}
        <div style={s.rightCol}>

          {/* Partnership info */}
          <div style={s.card}>
            <div style={s.cardTitle}>Your partnership</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Category',       val: isDemo ? p.category      : '—' },
                { label: 'Partner since',  val: isDemo ? p.since          : '—' },
                { label: 'Agreement type', val: isDemo ? p.agreementType  : '—' },
                { label: 'Contact',        val: isDemo ? p.contact        : '—' },
                { label: 'Next shipment',  val: isDemo ? p.nextShipment   : '—' },
                { label: 'Commitment',     val: isDemo ? p.commitment     : '—' },
              ].map(row => (
                <div key={row.label} style={s.infoRow}>
                  <span style={s.infoLabel}>{row.label}</span>
                  <span style={{ ...s.infoVal, color: isDemo ? '#374151' : '#AEAEAE' }}>{row.val}</span>
                </div>
              ))}
            </div>
            {isDemo && (
              <div style={{ marginTop: 16 }}>
                <span style={s.categoryPill}>{p.category}</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div style={s.card}>
            <div style={s.cardTitle}>Shipment timeline</div>
            {!isDemo ? (
              <EmptyState message="No shipment milestones yet." />
            ) : (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
                {p.timeline.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ ...s.timelineDot, background: t.color }}>
                        <TimelineIcon type={t.icon} />
                      </div>
                      {i < p.timeline.length - 1 && <div style={s.timelineLine} />}
                    </div>
                    <div style={{ paddingBottom: i < p.timeline.length - 1 ? 20 : 0 }}>
                      <div style={{ ...s.timelineLabel, color: t.color }}>{t.label}</div>
                      <div style={s.timelineDesc}>{t.desc}</div>
                      <div style={s.timelineDate}>{t.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Impact recognition + actions */}
          <div style={s.card}>
            <div style={s.cardTitle}>Impact recognition</div>
            {!isDemo ? (
              <EmptyState message="No recognition badges yet." />
            ) : (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.badges.map((b, i) => (
                  <div key={i} style={s.badgeRow}>
                    <div style={s.badgeAward}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#642F6C" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="8" r="6"/>
                        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                      </svg>
                    </div>
                    <div>
                      <div style={s.badgeTitle}>{b.title}</div>
                      <div style={s.badgeDesc}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons inside recognition card */}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              <button style={s.actionBtnNavy} onClick={() => showToast('Impact report downloaded')}>Download Impact Report</button>
              <button style={s.actionBtnTeal} onClick={() => showToast('Certificate emailed')}>Email Certificate</button>
            </div>
            <button style={{ ...s.actionBtnOutline, marginTop: 8 }} onClick={() => showToast('Social media kit coming soon')}>Social Media Kit</button>
          </div>

        </div>
      </div>

      {/* ── WHY IT MATTERS — full width banner ─────────────────────────────── */}
      <div style={s.whyBanner}>
        <div style={s.whyBannerInner}>

          {/* Left: Big quote */}
          <div style={s.whyLeft}>
            <div style={s.whyLabel}>WHY IT MATTERS</div>
            {!isDemo ? (
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,.35)', fontStyle: 'italic', lineHeight: 1.7 }}>
                Student and staff quotes will appear here once live data is connected.
              </div>
            ) : (
              p.quotes.map((q, i) => (
                <div key={i} style={{ marginBottom: i < p.quotes.length - 1 ? 32 : 0 }}>
                  <div style={s.bigQuote}>{q.text}</div>
                  <div style={s.bigQuoteAttr}>— {q.attr.toUpperCase()}</div>
                </div>
              ))
            )}
          </div>

          {/* Right: Badges with dynamic partner name */}
          <div style={s.whyRight}>
            <div style={s.whyLabel}>{p.name.toUpperCase()}'S IMPACT</div>
            {isDemo && p.badges.map((b, i) => (
              <div key={i} style={{ ...s.whyBadgeRow, borderBottom: i < p.badges.length - 1 ? '1px solid rgba(255,255,255,.07)' : 'none' }}>
                <div style={s.whyBadgeIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#32BCAD" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="8" r="6"/>
                    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                  </svg>
                </div>
                <div>
                  <div style={s.whyBadgeTitle}>{b.title}</div>
                  <div style={s.whyBadgeDesc}>{b.desc}</div>
                </div>
              </div>
            ))}
            <div style={s.whyFooterText}>
              Your partnership directly funds the items that make these moments possible.{" "}
              <span style={{ color: '#32BCAD', fontWeight: 600 }}>Every item shipped = one student supported.</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: { background: '#F8F7F5', minHeight: '100dvh', fontFamily: "'Open Sans', sans-serif" },

  // Demo/live pill — matches StaffDashboard exactly
  pillRow:     { display: 'flex', alignItems: 'center', gap: 14, padding: '20px 32px 0', flexWrap: 'wrap' },
  pill:        { display: 'flex', background: '#E8E5E0', borderRadius: 10, padding: 3, gap: 2, flexShrink: 0 },
  pillBtn: {
    padding: '6px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600,
    letterSpacing: '.07em', textTransform: 'uppercase', transition: 'all .15s',
    display: 'flex', alignItems: 'center', gap: 6,
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  },
  pillBtnOff:  { background: 'transparent', color: '#AEAEAE' },
  pillBtnDemo: { background: '#fff', color: '#642F6C', boxShadow: '0 1px 4px rgba(0,0,0,.1)' },
  pillBtnLive: { background: '#003865', color: '#fff', boxShadow: '0 1px 6px rgba(0,56,101,.3)' },
  liveDot:    { width: 7, height: 7, borderRadius: '50%', background: '#78BE20', display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' },
  liveDotOff: { width: 7, height: 7, borderRadius: '50%', background: '#AEAEAE', display: 'inline-block' },
  demoNotice: { fontSize: 12, color: '#6B6B6B', padding: '7px 12px', border: '1px solid #E8E5E0', borderRadius: 7, background: '#fff' },

  banner: {
    background: 'linear-gradient(135deg, #002548 0%, #003865 100%)',
    padding: '28px 32px 24px', marginTop: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
  },
  bannerLeft:  { flex: 1, minWidth: 260 },
  bannerTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '.02em' },
  bannerSub:   { fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, maxWidth: 480 },
  partnerTabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  partnerTab: {
    padding: '8px 16px', background: 'rgba(255,255,255,.1)', border: '1.5px solid rgba(255,255,255,.18)',
    borderRadius: 8, fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600,
    letterSpacing: '.06em', color: 'rgba(255,255,255,.7)', cursor: 'pointer', transition: 'all .15s',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  },
  partnerTabActive: { background: '#32BCAD', border: '1.5px solid #32BCAD', color: '#fff' },

  metricsRow: { display: 'flex', gap: 16, padding: '20px 32px 0', flexWrap: 'wrap' },
  metCard: {
    flex: '1 1 140px', background: '#fff', borderRadius: 12, padding: '18px 16px',
    border: '1px solid #E8E5E0', boxShadow: '0 2px 8px rgba(0,0,0,.04)', textAlign: 'center',
  },
  metVal:   { fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, color: '#003865', letterSpacing: '.02em' },
  metLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '.09em', textTransform: 'uppercase', color: '#AEAEAE', marginTop: 4 },
  metSub:   { fontSize: 11, color: '#32BCAD', marginTop: 3 },

  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, padding: '20px 32px 24px', alignItems: 'start' },
  leftCol:  { display: 'flex', flexDirection: 'column', gap: 20 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 20 },

  card:       { background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,.04)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle:  { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, color: '#003865', letterSpacing: '.03em' },
  cardSubNote:{ fontSize: 12, color: '#AEAEAE' },
  exportBtn:  { padding: '7px 14px', background: '#003865', color: '#fff', border: 'none', borderRadius: 7, fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.08em', cursor: 'pointer', textTransform: 'uppercase' },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:    { textAlign: 'left', padding: '8px 12px', fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#AEAEAE', borderBottom: '1px solid #E8E5E0' },
  td:    { padding: '12px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 13, color: '#374151', fontFamily: "'Open Sans', sans-serif", verticalAlign: 'middle' },
  statusPill: { padding: '3px 9px', borderRadius: 5, fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '.04em' },

  restockRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', gap: 12 },
  restockInfo:  { flex: 1 },
  restockItem:  { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, color: '#003865' },
  restockSchool:{ fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  restockRight: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  urgencyBadge: { padding: '3px 9px', borderRadius: 5, fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '.06em' },
  pledgeBtn:    { padding: '8px 16px', background: '#642F6C', color: '#fff', border: 'none', borderRadius: 8, fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.05em', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' },
  pledgeBtnDone:{ background: '#D1FAE5', color: '#065F46', cursor: 'default' },

  infoRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  infoLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, color: '#32BCAD', letterSpacing: '.04em', flexShrink: 0 },
  infoVal:   { fontSize: 13, color: '#374151', textAlign: 'right' },
  categoryPill: { display: 'inline-block', padding: '5px 12px', background: 'rgba(50,188,173,.1)', color: '#32BCAD', border: '1px solid rgba(50,188,173,.25)', borderRadius: 6, fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.06em' },

  timelineDot:   { width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineLine:  { width: 2, flex: 1, background: '#E8E5E0', minHeight: 16 },
  timelineLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.02em' },
  timelineDesc:  { fontSize: 12, color: '#6B7280', marginTop: 2 },
  timelineDate:  { fontSize: 11, color: '#AEAEAE', marginTop: 2 },

  badgeRow:   { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px', background: '#FAFAF9', borderRadius: 8, border: '1px solid #F0EDE8' },
  badgeAward: { width: 32, height: 32, borderRadius: 8, background: 'rgba(100,47,108,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badgeTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, color: '#003865' },
  badgeDesc:  { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  actionBtnNavy:   { padding: '10px 16px', background: '#003865', color: '#fff', border: 'none', borderRadius: 8, fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', flex: 1 },
  actionBtnTeal:   { padding: '10px 16px', background: '#32BCAD', color: '#fff', border: 'none', borderRadius: 8, fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', flex: 1 },
  actionBtnOutline:{ width: '100%', padding: '10px 16px', background: 'none', color: '#003865', border: '1.5px solid #E8E5E0', borderRadius: 8, fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' },

  whyCard:  { background: '#002548', border: '1px solid rgba(50,188,173,.2)', borderRadius: 12, padding: '20px' },
  whyTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, color: '#32BCAD', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 },
  quoteBox: { background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: '14px 16px', border: '1px solid rgba(255,255,255,.08)' },
  quoteText:{ fontSize: 13, color: 'rgba(255,255,255,.85)', fontStyle: 'italic', lineHeight: 1.6 },
  quoteAttr:{ fontSize: 10, color: '#32BCAD', fontFamily: "'Oswald', sans-serif", letterSpacing: '.1em', marginTop: 8 },
  whyFooter:{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.6, marginTop: 14 },

  // ── Full-width Why It Matters banner ──────────────────────────────────
  whyBanner: {
    background: 'linear-gradient(135deg, #001829 0%, #002548 55%, #003865 100%)',
    borderTop: '3px solid #32BCAD',
    padding: '52px 48px',
    marginTop: 0,
  },
  whyBannerInner: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: 64,
    alignItems: 'start',
    maxWidth: 1200,
    margin: '0 auto',
  },
  whyLabel: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 11, fontWeight: 600, letterSpacing: '.14em',
    textTransform: 'uppercase', color: '#32BCAD',
    marginBottom: 20,
  },

  // Left — big quote
  whyLeft: { display: 'flex', flexDirection: 'column' },
  bigQuote: {
    fontSize: 22, fontStyle: 'italic', lineHeight: 1.65,
    color: 'rgba(255,255,255,.92)',
    fontFamily: "'Open Sans', sans-serif",
    fontWeight: 300,
    borderLeft: '4px solid #32BCAD',
    paddingLeft: 20,
    marginBottom: 14,
  },
  bigQuoteAttr: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 11, letterSpacing: '.12em',
    color: '#32BCAD', paddingLeft: 24,
  },

  whyFooterText: {
    fontSize: 13, color: 'rgba(255,255,255,.45)',
    lineHeight: 1.7, marginTop: 24,
  },

  // Right — badges
  whyRight: { display: 'flex', flexDirection: 'column' },
  whyBadgeRow: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,.07)',
  },
  whyBadgeIcon: {
    width: 32, height: 32, borderRadius: 8,
    background: 'rgba(50,188,173,.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  whyBadgeTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '.02em',
  },
  whyBadgeDesc: { fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 3 },
}
