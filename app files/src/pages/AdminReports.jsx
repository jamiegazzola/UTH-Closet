import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useToast } from '../context/ToastContext'
import { SCHOOLS } from '../utils/catalog'

const DATA = {
  'all':    { snacks: 1240, essentials: 980, clothing: 756, health: 420, supplies: 634, sizes: { S: 210, M: 320, L: 156, XL: 70 }, monthly: [120,145,180,210,240,280,310,345], students: 892, items: 4030 },
  'fall':   { snacks: 680,  essentials: 520, clothing: 390, health: 210, supplies: 310, sizes: { S: 110, M: 170, L: 80,  XL: 30 }, monthly: [120,145,180,210], students: 480, items: 2110 },
  'spring': { snacks: 560,  essentials: 460, clothing: 366, health: 210, supplies: 324, sizes: { S: 100, M: 150, L: 76,  XL: 40 }, monthly: [240,280,310,345], students: 412, items: 1920 },
  'month':  { snacks: 148,  essentials: 112, clothing: 87,  health: 52,  supplies: 78,  sizes: { S: 24,  M: 36,  L: 18,  XL: 9  }, monthly: [345], students: 87,  items: 477  },
}

const ALERTS = [
  { type: 'crit', icon: '🔴', title: 'Deodorant critically low — Hawkins High', body: '3 units left — restock immediately' },
  { type: 'crit', icon: '🔴', title: 'Granola Bars critically low — East High', body: '2 units left' },
  { type: 'warn', icon: '🟡', title: 'Hygiene kits low — all schools', body: 'Monthly restock due in 4 days' },
  { type: 'warn', icon: '🟡', title: 'Clothing (XL) low — 3 schools', body: 'Consider ordering larger sizes' },
  { type: 'info', icon: '🔵', title: 'Q3 2026 launch approaching', body: '3–5 new sites onboarding this quarter' },
]

function BarChart({ title, rows, color }) {
  const max = Math.max(...rows.map(r => r.val), 1)
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={styles.chartLabel}>{title}</div>
      {rows.map(row => (
        <div key={row.name} style={styles.barRow}>
          <div style={styles.barName}>{row.name}</div>
          <div style={styles.barTrack}>
            <div style={{
              ...styles.barFill,
              width: `${(row.val / max) * 100}%`,
              background: color,
            }} />
          </div>
          <div style={styles.barVal}>{row.val.toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}

export default function AdminReports() {
  const [filter, setFilter] = useState('all')
  const { showToast } = useToast()
  const d = DATA[filter]

  async function sendRestockAll() {
    await addDoc(collection(db, 'restock_requests'), {
      type: 'bulk',
      status: 'pending',
      createdAt: serverTimestamp(),
    }).catch(() => {})
    showToast('Bulk restock sent to all partners', 'success')
  }

  function generateReport() {
    showToast('Impact report generated — ready for grant submission', 'success')
  }

  function sendSurvey() {
    showToast('Readiness survey sent to new school sites', 'success')
  }

  return (
    <div style={styles.wrap}>
      {/* Summary metrics */}
      <div style={styles.metricsRow}>
        {[
          { label: 'Total Items Distributed', val: d.items.toLocaleString(), border: '#32BCAD' },
          { label: 'Students Served',         val: d.students.toLocaleString(), border: '#003865' },
          { label: 'Attendance Impact',        val: '+12%', border: '#78BE20' },
          { label: 'Category Partners',        val: '7', border: '#642F6C' },
        ].map(m => (
          <div key={m.label} style={{ ...styles.metric, borderTopColor: m.border }}>
            <div style={styles.metricLabel}>{m.label}</div>
            <div style={styles.metricVal}>{m.val}</div>
            <div style={styles.metricSub}>All schools combined</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={styles.filterRow}>
        {[
          { key: 'all',    label: 'All Time' },
          { key: 'fall',   label: 'Fall Semester' },
          { key: 'spring', label: 'Spring Semester' },
          { key: 'month',  label: 'This Month' },
        ].map(f => (
          <button
            key={f.key}
            style={{ ...styles.filterBtn, ...(filter === f.key ? styles.filterBtnOn : {}) }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <button style={styles.exportBtn} onClick={generateReport}>
          Export Report
        </button>
      </div>

      {/* Main 2-col layout */}
      <div style={styles.mainGrid}>
        {/* Charts */}
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
            rows={['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'].slice(0, d.monthly.length).map((m, i) => ({
              name: m, val: d.monthly[i]
            }))}
            color="#32BCAD"
          />

          {/* Schools at a glance */}
          <div style={{ marginTop: 8 }}>
            <div style={styles.chartLabel}>Schools at a Glance</div>
            <table style={styles.schoolTable}>
              <thead>
                <tr>
                  {['School','Students Served','Relative Usage'].map(h => (
                    <th key={h} style={styles.schoolTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCHOOLS.slice(0,5).map((school, i) => {
                  const served = Math.floor(d.students * (.1 + Math.random() * .35))
                  const pct = Math.floor(30 + Math.random() * 70)
                  return (
                    <tr key={school.id}>
                      <td style={styles.schoolTd}><strong>{school.name}</strong><br/><span style={{ color: '#AEAEAE', fontSize: 11 }}>{school.city}</span></td>
                      <td style={styles.schoolTd}>{served}</td>
                      <td style={styles.schoolTd}>
                        <div style={styles.miniBar}>
                          <div style={{ ...styles.miniFill, width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right col: Alerts + Quick Actions */}
        <div>
          <div style={styles.sideCard}>
            <div style={styles.sideTitle}>Alerts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ALERTS.map((a, i) => (
                <div key={i} style={{
                  ...styles.alertItem,
                  background: a.type === 'crit' ? '#FFEBEE' : a.type === 'warn' ? '#FFF8E1' : '#E6EEF5',
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
                  <div>
                    <div style={styles.alertTitle}>{a.title}</div>
                    <div style={styles.alertBody}>{a.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...styles.sideCard, marginTop: 16 }}>
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
  wrap: { padding: 24, animation: 'fadeIn .4s ease both' },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,1fr)',
    gap: 14,
    marginBottom: 24,
  },
  metric: {
    background: '#fff',
    border: '1px solid #DDD9D3',
    borderRadius: 10,
    padding: '16px 18px',
    borderTop: '3px solid #003865',
    boxShadow: '0 2px 8px rgba(0,0,0,.05)',
  },
  metricLabel: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: '#6B6B6B',
    marginBottom: 8,
  },
  metricVal: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 32,
    fontWeight: 600,
    color: '#003865',
    lineHeight: 1,
  },
  metricSub: { fontSize: 11, color: '#AEAEAE', marginTop: 6 },
  filterRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '7px 16px',
    border: '1px solid #DDD9D3',
    borderRadius: 6,
    background: '#fff',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: '#6B6B6B',
    cursor: 'pointer',
    transition: 'all .15s',
  },
  filterBtnOn: { background: '#003865', color: '#fff', borderColor: '#003865' },
  exportBtn: {
    padding: '7px 16px',
    background: '#642F6C',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 20,
  },
  chartsCard: {
    background: '#fff',
    border: '1px solid #DDD9D3',
    borderRadius: 12,
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,.05)',
  },
  chartLabel: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: '#6B6B6B',
    marginBottom: 12,
  },
  barRow: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr 50px',
    gap: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  barName: { fontSize: 12, fontWeight: 500, color: '#1A1A1A' },
  barTrack: {
    height: 20,
    background: '#F5F4F1',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width .5s ease',
  },
  barVal: {
    textAlign: 'right',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    color: '#003865',
  },
  schoolTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  schoolTh: {
    padding: '8px 10px',
    textAlign: 'left',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: '#6B6B6B',
    borderBottom: '1px solid #DDD9D3',
  },
  schoolTd: { padding: '10px', borderBottom: '1px solid #F0EDE8', lineHeight: 1.5 },
  miniBar: { height: 5, background: '#F0EDE8', borderRadius: 3, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 3, background: '#003865' },
  sideCard: {
    background: '#fff',
    border: '1px solid #DDD9D3',
    borderRadius: 12,
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,.05)',
  },
  sideTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 14,
    fontWeight: 500,
    color: '#003865',
    letterSpacing: '.04em',
    marginBottom: 14,
  },
  alertItem: {
    display: 'flex',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 12,
  },
  alertTitle: { fontSize: 12, fontWeight: 600, color: '#1A1A1A', marginBottom: 2 },
  alertBody:  { fontSize: 11, color: '#6B6B6B' },
  qaBtn: {
    width: '100%',
    padding: '12px',
    border: 'none',
    borderRadius: 8,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '.07em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    display: 'block',
    transition: 'all .15s',
  },
}
