import { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, addDoc, serverTimestamp, orderBy, limit
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CATALOG, CATEGORIES } from '../utils/catalog'

// Flatten catalog into inventory list with fake quantities
const INVENTORY_ITEMS = Object.entries(CATALOG).flatMap(([cat, items]) =>
  items.map(item => ({
    ...item,
    category: cat,
    quantity: Math.floor(Math.random() * 40) + 2,
    reorderThreshold: 10,
    criticalThreshold: 5,
    lastRestocked: '2026-04-28',
  }))
)

function getStatus(qty, item) {
  if (qty <= item.criticalThreshold) return 'Critical'
  if (qty <= item.reorderThreshold) return 'Low'
  return 'OK'
}

export default function StaffDashboard() {
  const { profile } = useAuth()
  const { showToast } = useToast()

  const [orders, setOrders] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [inventory, setInventory] = useState(INVENTORY_ITEMS)
  const [manualItem, setManualItem] = useState('')
  const [manualAction, setManualAction] = useState('out')
  const [scanning, setScanning] = useState(false)
  const scanRef = useRef(null)

  // Live orders from Firestore
  useEffect(() => {
    if (!profile?.schoolId) return
    const q = query(
      collection(db, 'orders'),
      where('schoolId', '==', profile.schoolId),
      where('status', 'in', ['pending', 'preparing']),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [profile?.schoolId])

  async function fulfillOrder(orderId) {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'fulfilled',
        fulfilledAt: serverTimestamp(),
      })
      showToast('Order marked as fulfilled', 'success')
    } catch {
      showToast('Failed to update order', 'error')
    }
  }

  function logItem(name, action) {
    if (!name.trim()) { showToast('Enter an item name', 'error'); return }
    const entry = {
      name: name.trim(),
      action,
      time: Date.now(),
    }
    setActivityLog(prev => [entry, ...prev].slice(0, 6))

    // Update inventory quantity
    setInventory(prev => prev.map(item =>
      item.name.toLowerCase() === name.trim().toLowerCase()
        ? { ...item, quantity: action === 'out' ? Math.max(0, item.quantity - 1) : item.quantity + 1 }
        : item
    ))

    // Write to Firestore
    addDoc(collection(db, 'activity_log'), {
      itemName: name.trim(),
      action,
      schoolId: profile?.schoolId || '',
      timestamp: serverTimestamp(),
    }).catch(() => {})

    showToast(`Logged: ${name.trim()} — ${action === 'out' ? 'taken out' : 'restocked'}`, 'success')
    setManualItem('')
  }

  function simulateScan() {
    const allItems = Object.values(CATALOG).flat()
    const random = allItems[Math.floor(Math.random() * allItems.length)]
    logItem(random.name, 'out')
    showToast(`Scanned: ${random.name} logged as taken out`, 'success')
  }

  function requestRestock(itemName) {
    addDoc(collection(db, 'restock_requests'), {
      itemName,
      schoolId: profile?.schoolId || '',
      status: 'pending',
      createdAt: serverTimestamp(),
    }).catch(() => {})
    showToast(`Restock request sent to Uth HQ for ${itemName}`)
  }

  function exportCSV() {
    const header = 'Item,Category,In Stock,Status,Last Restocked\n'
    const rows = inventory.map(item =>
      `"${item.name}","${item.category}",${item.quantity},${getStatus(item.quantity, item)},${item.lastRestocked}`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'uth-inventory.csv'; a.click()
    showToast('Inventory exported to CSV', 'success')
  }

  const lowStockCount = inventory.filter(i => getStatus(i.quantity, i) !== 'OK').length
  const catColor = { snacks: '#FF9E1B', essentials: '#32BCAD', health: '#D0006F', clothing: '#642F6C', supplies: '#003865' }

  return (
    <div style={styles.wrap}>
      {/* Metrics */}
      <div style={styles.metricsRow}>
        {[
          { label: 'Items Logged Today', val: activityLog.length, sub: 'This session', border: '#78BE20' },
          { label: 'Pending Orders',     val: orders.length,      sub: `${orders.length} need fulfillment`, border: '#FF9E1B' },
          { label: 'Low Stock Alerts',   val: lowStockCount,      sub: 'Restock needed', border: '#D0006F', valColor: '#D0006F' },
          { label: 'Students Served',    val: '—',                sub: 'All time (loading)', border: '#003865' },
        ].map(m => (
          <div key={m.label} style={{ ...styles.metric, borderTopColor: m.border }}>
            <div style={styles.metricLabel}>{m.label}</div>
            <div style={{ ...styles.metricVal, ...(m.valColor ? { color: m.valColor } : {}) }}>{m.val}</div>
            <div style={styles.metricSub}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column grid */}
      <div style={styles.twoCol}>
        {/* Log an Item */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Log an Item</div>

          <div style={styles.scanZone} onClick={simulateScan}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <div style={styles.scanTitle}>Tap to scan barcode / QR</div>
            <div style={styles.scanSub}>Camera scanning — tap to simulate</div>
          </div>

          <div style={styles.manualRow}>
            <input
              style={styles.input}
              placeholder="Item name or SKU…"
              value={manualItem}
              onChange={e => setManualItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && logItem(manualItem, manualAction)}
            />
            <select
              style={styles.select}
              value={manualAction}
              onChange={e => setManualAction(e.target.value)}
            >
              <option value="out">Taken out</option>
              <option value="in">Restocked</option>
            </select>
            <button style={styles.logBtn} onClick={() => logItem(manualItem, manualAction)}>
              Log
            </button>
          </div>

          {activityLog.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={styles.logLabel}>Recent Activity</div>
              {activityLog.map((entry, i) => (
                <div key={i} style={styles.logRow}>
                  <div style={{
                    ...styles.logDot,
                    background: entry.action === 'out' ? '#D0006F' : '#78BE20',
                  }} />
                  <span style={{ color: '#1A1A1A', flex: 1 }}>{entry.name}</span>
                  <span style={{ color: '#AEAEAE', fontSize: 10, fontFamily: "'Oswald', sans-serif" }}>
                    {entry.action === 'out' ? 'taken out' : 'restocked'} · just now
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Student Orders */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            Student Orders to Fulfill
            {orders.length > 0 && (
              <span style={styles.ordersBadge}>{orders.length}</span>
            )}
          </div>

          {orders.length === 0 ? (
            <div style={styles.emptyOrders}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 13, color: '#AEAEAE' }}>No pending orders right now</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.map(order => (
                <div key={order.id} style={styles.orderRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.orderName}>{order.anonymousId}</div>
                    <div style={styles.orderItems}>
                      {order.items?.map(i => `${i.name}${i.size ? ` (${i.size})` : ''}`).join(' · ')}
                    </div>
                  </div>
                  <span style={styles.pillPending}>Pending</span>
                  <button
                    style={styles.fulfillBtn}
                    onClick={() => fulfillOrder(order.id)}
                  >
                    Fulfill
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      <div style={styles.invCard}>
        <div style={styles.invHeader}>
          <span style={styles.cardTitle}>Live Inventory</span>
          <button style={styles.exportBtn} onClick={exportCSV}>Export CSV</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Item','Category','In Stock','Status','Last Restocked','Action'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => {
                const status = getStatus(item.quantity, item)
                return (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}><strong>{item.name}</strong></td>
                    <td style={styles.td}>
                      <span style={{ ...styles.catDot, background: catColor[item.category] || '#003865' }} />
                      {item.category}
                    </td>
                    <td style={styles.td}>{item.quantity}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusPill,
                        ...(status === 'OK' ? styles.statusOk : status === 'Low' ? styles.statusLow : styles.statusCrit),
                      }}>
                        {status}
                      </span>
                    </td>
                    <td style={styles.td}>{item.lastRestocked}</td>
                    <td style={styles.td}>
                      <button style={styles.restockBtn} onClick={() => requestRestock(item.name)}>
                        Request Restock
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
  metricSub: {
    fontSize: 11,
    color: '#AEAEAE',
    marginTop: 6,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
    marginBottom: 20,
  },
  card: {
    background: '#fff',
    border: '1px solid #DDD9D3',
    borderRadius: 12,
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,.05)',
  },
  cardTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 15,
    fontWeight: 500,
    color: '#003865',
    letterSpacing: '.03em',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  ordersBadge: {
    background: '#FF9E1B',
    color: '#002548',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 10,
  },
  scanZone: {
    border: '2px dashed #32BCAD',
    borderRadius: 10,
    padding: '20px',
    textAlign: 'center',
    marginBottom: 16,
    background: '#E6F8F7',
    cursor: 'pointer',
    transition: 'all .2s',
  },
  scanTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 13,
    color: '#003865',
    marginBottom: 4,
  },
  scanSub: { fontSize: 11, color: '#6B6B6B' },
  manualRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '9px 12px',
    border: '1.5px solid #DDD9D3',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "'Open Sans', sans-serif",
    background: '#FAFAF9',
  },
  select: {
    padding: '9px 10px',
    border: '1.5px solid #DDD9D3',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "'Open Sans', sans-serif",
    width: 120,
    background: '#FAFAF9',
  },
  logBtn: {
    padding: '9px 16px',
    background: '#003865',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '.06em',
    cursor: 'pointer',
  },
  logLabel: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: '#AEAEAE',
    marginBottom: 8,
  },
  logRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: '#F5F4F1',
    borderRadius: 6,
    fontSize: 12,
    marginBottom: 4,
  },
  logDot: {
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
  },
  emptyOrders: {
    textAlign: 'center',
    padding: '32px 0',
  },
  orderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    border: '1px solid #DDD9D3',
    borderRadius: 8,
  },
  orderName: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    color: '#003865',
    marginBottom: 2,
  },
  orderItems: { fontSize: 11, color: '#6B6B6B' },
  pillPending: {
    padding: '3px 8px',
    background: '#E6EEF5',
    color: '#003865',
    borderRadius: 4,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '.05em',
    flexShrink: 0,
  },
  fulfillBtn: {
    padding: '5px 12px',
    background: '#642F6C',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '.06em',
    cursor: 'pointer',
    flexShrink: 0,
  },
  invCard: {
    background: '#fff',
    border: '1px solid #DDD9D3',
    borderRadius: 12,
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,.05)',
  },
  invHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exportBtn: {
    padding: '7px 16px',
    background: '#003865',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.06em',
    cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    padding: '9px 12px',
    textAlign: 'left',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: '#6B6B6B',
    borderBottom: '1px solid #DDD9D3',
  },
  tr: { transition: 'background .1s' },
  td: {
    padding: '11px 12px',
    borderBottom: '1px solid #F0EDE8',
    verticalAlign: 'middle',
  },
  catDot: {
    display: 'inline-block',
    width: 8, height: 8,
    borderRadius: '50%',
    marginRight: 6,
    verticalAlign: 'middle',
  },
  statusPill: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 4,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '.05em',
  },
  statusOk:   { background: '#E8F5E9', color: '#2E7D32' },
  statusLow:  { background: '#FFF3E0', color: '#E65100' },
  statusCrit: { background: '#FFEBEE', color: '#C62828' },
  restockBtn: {
    padding: '4px 10px',
    background: '#E6EEF5',
    color: '#003865',
    border: 'none',
    borderRadius: 4,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '.05em',
    cursor: 'pointer',
    transition: 'all .15s',
  },
}
