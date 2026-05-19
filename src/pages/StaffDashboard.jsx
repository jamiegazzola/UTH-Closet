import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, addDoc, setDoc, getDoc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CATALOG, SCHOOLS } from '../utils/catalog'

// ── Demo data ─────────────────────────────────────────────────────────────────
const INVENTORY_DEMO = Object.entries(CATALOG).flatMap(([cat, items]) =>
  items.map(item => ({
    ...item,
    category: cat,
    quantity: Math.floor(Math.random() * 40) + 2,
    reorderThreshold: 10,
    criticalThreshold: 5,
    lastRestocked: '2026-04-28',
  }))
)

const DEMO_ORDERS = [
  { id: 'd1', anonymousId: '#4821', schoolId: 'monarch', status: 'pending', staffNote: '', createdAt: { toMillis: () => Date.now() - 3600000, toDate: () => new Date(Date.now() - 3600000) }, items: [{ name: 'Granola Bars', size: null, qty: 2, note: '' }, { name: 'T-Shirt', size: 'M', qty: 1, note: 'blue please' }] },
  { id: 'd2', anonymousId: '#3047', schoolId: 'monarch', status: 'pending', staffNote: '', createdAt: { toMillis: () => Date.now() - 7200000, toDate: () => new Date(Date.now() - 7200000) }, items: [{ name: 'Full Hygiene Kit', size: null, qty: 1, note: '' }] },
  { id: 'd3', anonymousId: '#7913', schoolId: 'riverside', status: 'preparing', staffNote: 'Gathering items now', createdAt: { toMillis: () => Date.now() - 1800000, toDate: () => new Date(Date.now() - 1800000) }, items: [{ name: 'Backpack', size: null, qty: 1, note: 'black preferred' }, { name: 'Notebook', size: null, qty: 1, note: '' }] },
]

const DEMO_LOG = [
  { name: 'Granola Bars', action: 'out', time: Date.now() - 120000 },
  { name: 'Deodorant',    action: 'out', time: Date.now() - 300000 },
  { name: 'Protein Bars', action: 'in',  time: Date.now() - 600000 },
]

// ─────────────────────────────────────────────────────────────────────────────

function getStatus(qty, item) {
  if (qty <= item.criticalThreshold) return 'Critical'
  if (qty <= item.reorderThreshold)  return 'Low'
  return 'OK'
}

const CAT_COLOR = {
  snacks: '#FF9E1B', essentials: '#32BCAD', health: '#D0006F',
  clothing: '#642F6C', supplies: '#003865',
}

const STATUS_STAGES = ['pending', 'preparing', 'ready', 'fulfilled']
const STATUS_LABELS = {
  pending:   'Pending',
  preparing: 'Preparing',
  ready:     'Ready for Pickup',
  fulfilled: 'Fulfilled',
  flagged:   'Flagged / Issue',
}
const STATUS_COLORS = {
  pending:   { bg: '#E6EEF5', color: '#003865' },
  preparing: { bg: '#FFF3E0', color: '#E65100' },
  ready:     { bg: '#FFF8E1', color: '#F57F17' },
  fulfilled: { bg: '#E8F5E9', color: '#2E7D32' },
  flagged:   { bg: '#FCE4EC', color: '#880E4F' },
}

const CANT_FULFILL_REASONS = ['Out of stock', 'Size not available', 'Colour not available', 'Other']

// ── FulfillmentModal ──────────────────────────────────────────────────────────
function FulfillmentModal({ order, inventory, onClose, onUpdateStatus, onRestock }) {
  const [status, setStatus]             = useState(order.status || 'pending')
  const [staffNote, setStaffNote]       = useState(order.staffNote || '')
  const [showCantFulfill, setShowCantFulfill] = useState(false)
  const [cantReason, setCantReason]     = useState('')
  const [cantOther, setCantOther]       = useState('')
  const [saving, setSaving]             = useState(false)

  const school = SCHOOLS.find(s => s.id === order.schoolId)
  const schoolName = school?.name || order.schoolId || 'Unknown School'

  function fmt(ts) {
    if (!ts?.toDate) return '—'
    return ts.toDate().toLocaleDateString('en-CA', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function getInventoryForItem(itemName) {
    return inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase()) || null
  }

  async function handleAdvance() {
    const currentIdx = STATUS_STAGES.indexOf(status)
    const next = STATUS_STAGES[currentIdx + 1]
    if (!next) return
    setSaving(true)
    await onUpdateStatus(order.id, next, staffNote)
    setStatus(next)
    setSaving(false)
  }

  async function handleSaveNote() {
    setSaving(true)
    await onUpdateStatus(order.id, status, staffNote)
    setSaving(false)
  }

  async function handleCantFulfill() {
    const reason = cantReason === 'Other' ? cantOther : cantReason
    if (!reason.trim()) return
    setSaving(true)
    const note = `Cannot fulfill: ${reason}${staffNote ? ` — ${staffNote}` : ''}`
    await onUpdateStatus(order.id, 'flagged', note)
    setStatus('flagged')
    setStaffNote(note)
    setSaving(false)
    setShowCantFulfill(false)
  }

  const currentStageIndex = STATUS_STAGES.indexOf(status)

  return (
    <div style={fm.overlay} onClick={onClose}>
      <div style={fm.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={fm.header}>
          <div>
            <div style={fm.orderId}>{order.anonymousId}</div>
            <div style={fm.schoolName}>{schoolName}</div>
          </div>
          <button style={fm.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Meta */}
        <div style={fm.metaRow}>
          <div style={fm.metaItem}>
            <span style={fm.metaLabel}>Ordered</span>
            <span style={fm.metaVal}>{fmt(order.createdAt)}</span>
          </div>
          <div style={fm.metaItem}>
            <span style={fm.metaLabel}>Status</span>
            <span style={{ ...fm.statusPill, background: STATUS_COLORS[status]?.bg, color: STATUS_COLORS[status]?.color }}>
              {STATUS_LABELS[status] || status}
            </span>
          </div>
          <div style={fm.metaItem}>
            <span style={fm.metaLabel}>Items</span>
            <span style={fm.metaVal}>{order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Progress bar */}
        {status !== 'flagged' && (
          <div style={fm.progressWrap}>
            {STATUS_STAGES.map((stage, i) => {
              const done   = i <= currentStageIndex
              const active = i === currentStageIndex
              const isLast = i === STATUS_STAGES.length - 1
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      ...fm.progressDot,
                      background: done ? '#003865' : '#E8E5E0',
                      outline: active ? '2px solid #32BCAD' : 'none',
                      outlineOffset: 2,
                    }}>
                      {done && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                    </div>
                    <div style={{ ...fm.progressLabel, color: done ? '#003865' : '#AEAEAE', fontWeight: active ? 700 : 400 }}>
                      {STATUS_LABELS[stage]}
                    </div>
                  </div>
                  {!isLast && (
                    <div style={{ ...fm.progressLine, background: i < currentStageIndex ? '#003865' : '#E8E5E0' }} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Items with inventory */}
        <div style={fm.section}>
          <div style={fm.sectionLabel}>Items Ordered</div>
          {order.items?.map((item, i) => {
            const inv = getInventoryForItem(item.name)
            const invStat = inv ? getStatus(inv.quantity, inv) : null
            const warn = invStat === 'Low' || invStat === 'Critical'
            return (
              <div key={i} style={fm.itemRow}>
                <div style={fm.itemMain}>
                  <span style={fm.itemName}>{item.name}</span>
                  {item.size && <span style={fm.itemSize}>{item.size}</span>}
                  {item.qty > 1 && <span style={fm.itemQty}>×{item.qty}</span>}
                  {item.note ? <div style={fm.itemNote}>"{item.note}"</div> : null}
                </div>
                <div style={fm.itemRight}>
                  {inv && (
                    <span style={{ ...fm.invBadge, ...(warn ? fm.invBadgeWarn : fm.invBadgeOk) }}>
                      {warn && '⚠ '}{inv.quantity} in stock
                    </span>
                  )}
                  {inv && warn && (
                    <button style={fm.restockMini} onClick={() => onRestock(item.name)}>
                      Request restock
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Staff note */}
        <div style={fm.section}>
          <div style={fm.sectionLabel}>
            Staff Note <span style={fm.sectionHint}>(visible to student)</span>
          </div>
          <textarea
            style={fm.noteArea}
            rows={3}
            placeholder="Add a note for the student (e.g. swapped item, left at front desk)…"
            value={staffNote}
            onChange={e => setStaffNote(e.target.value)}
          />
        </div>

        {/* Can't fulfill panel */}
        {showCantFulfill && (
          <div style={fm.cantBox}>
            <div style={fm.sectionLabel}>Reason for not fulfilling</div>
            <div style={fm.reasonGrid}>
              {CANT_FULFILL_REASONS.map(r => (
                <button
                  key={r}
                  style={{ ...fm.reasonBtn, ...(cantReason === r ? fm.reasonBtnActive : {}) }}
                  onClick={() => setCantReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            {cantReason === 'Other' && (
              <input
                style={fm.cantInput}
                placeholder="Describe the issue…"
                value={cantOther}
                onChange={e => setCantOther(e.target.value)}
              />
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={fm.cancelSmall} onClick={() => setShowCantFulfill(false)}>Cancel</button>
              <button
                style={{
                  ...fm.flagBtn,
                  opacity: (!cantReason || (cantReason === 'Other' && !cantOther.trim())) ? 0.5 : 1,
                }}
                onClick={handleCantFulfill}
                disabled={!cantReason || (cantReason === 'Other' && !cantOther.trim())}
              >
                {saving ? 'Flagging…' : 'Flag this order'}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={fm.actions}>
          {status !== 'fulfilled' && status !== 'flagged' && (
            <button style={fm.cantFulfillBtn} onClick={() => setShowCantFulfill(v => !v)}>
              Can't Fulfill
            </button>
          )}

          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button style={fm.saveNoteBtn} onClick={handleSaveNote} disabled={saving}>
              {saving ? 'Saving…' : 'Save Note'}
            </button>

            {status !== 'fulfilled' && status !== 'flagged' && (
              <button
                style={{ ...fm.advanceBtn, opacity: saving ? 0.6 : 1 }}
                onClick={handleAdvance}
                disabled={saving}
              >
                {saving ? 'Saving…' : (
                  currentStageIndex === 0 ? 'Mark Preparing →' :
                  currentStageIndex === 1 ? 'Mark Ready →' :
                  'Mark Fulfilled ✓'
                )}
              </button>
            )}

            {status === 'fulfilled' && (
              <div style={fm.fulfilledBadge}>✓ Fulfilled</div>
            )}
            {status === 'flagged' && (
              <div style={{ ...fm.fulfilledBadge, background: '#FCE4EC', color: '#880E4F' }}>⚠ Flagged</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StaffDashboard({ selectedSchoolId, mode, setMode }) {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [openOrder, setOpenOrder]   = useState(null) // order open in fulfillment modal

  const role = profile?.role
  const effectiveSchoolId = role === 'admin'
    ? (selectedSchoolId || null)
    : (profile?.schoolId || null)

  // Live state
  const [liveOrders, setLiveOrders]       = useState([])
  const [activityLog, setActivityLog]     = useState([])
  const [inventory, setInventory]         = useState([])
  const [manualItem, setManualItem]       = useState('')
  const [manualAction, setManualAction]   = useState('out')
  const [studentsServed, setStudentsServed] = useState(0)   // unique users with fulfilled orders
  const [todayLogCount, setTodayLogCount]   = useState(0)   // activity_log entries today

  // Demo state
  const [demoOrders, setDemoOrders]             = useState(DEMO_ORDERS)
  const [demoLog, setDemoLog]                   = useState(DEMO_LOG)
  const [demoInventory, setDemoInventory]       = useState(INVENTORY_DEMO)
  const [demoManualItem, setDemoManualItem]     = useState('')
  const [demoManualAction, setDemoManualAction] = useState('out')

  // Inventory listener — also seeds catalog items if collection is empty
  useEffect(() => {
    if (mode !== 'live') return
    const q = query(collection(db, 'inventory'), orderBy('name', 'asc'))
    const unsub = onSnapshot(q,
      async snap => {
        if (snap.empty) {
          // Seed inventory from catalog on first use
          const batch = Object.entries(CATALOG).flatMap(([cat, items]) =>
            items.map(item => ({
              id: item.id, name: item.name, category: cat,
              quantity: 0, reorderThreshold: 10, criticalThreshold: 5,
              lastRestocked: null,
            }))
          )
          await Promise.all(batch.map(item =>
            setDoc(doc(db, 'inventory', item.id), item, { merge: true })
          )).catch(err => console.error('[Staff] inventory seed error:', err))
        } else {
          setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        }
      },
      err => console.error('[Staff] inventory error:', err)
    )
    return () => unsub()
  }, [mode])

  // Orders listener (pending/preparing/ready)
  useEffect(() => {
    if (mode !== 'live') return
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'preparing', 'ready'])
    )
    const unsub = onSnapshot(q,
      snap => {
        let orders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        if (effectiveSchoolId) orders = orders.filter(o => o.schoolId === effectiveSchoolId)
        orders.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        setLiveOrders(orders)
      },
      err => console.error('[Staff] orders error:', err.code, err.message)
    )
    return () => unsub()
  }, [mode, effectiveSchoolId])

  // Students Served — unique userId count from fulfilled orders
  useEffect(() => {
    if (mode !== 'live') return
    const q = query(collection(db, 'orders'), where('status', '==', 'fulfilled'))
    const unsub = onSnapshot(q,
      snap => {
        const uids = new Set(snap.docs.map(d => d.data().userId).filter(Boolean))
        setStudentsServed(uids.size)
      },
      err => console.error('[Staff] students served error:', err)
    )
    return () => unsub()
  }, [mode])

  // Today's activity log count from Firestore
  useEffect(() => {
    if (mode !== 'live') return
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const q = query(
      collection(db, 'activity_log'),
      where('timestamp', '>=', startOfDay),
      ...(effectiveSchoolId ? [where('schoolId', '==', effectiveSchoolId)] : [])
    )
    const unsub = onSnapshot(q,
      snap => setTodayLogCount(snap.size),
      err => console.error('[Staff] activity log error:', err)
    )
    return () => unsub()
  }, [mode, effectiveSchoolId])

  // ── Status update ──────────────────────────────────────────────────────────
  async function updateOrderStatusLive(orderId, newStatus, staffNote) {
    try {
      const data = { status: newStatus, staffNote: staffNote || '', updatedAt: serverTimestamp() }
      if (newStatus === 'fulfilled') data.fulfilledAt = serverTimestamp()
      await updateDoc(doc(db, 'orders', orderId), data)
      showToast(`Order marked as ${STATUS_LABELS[newStatus] || newStatus}`, 'success')
    } catch { showToast('Failed to update order', 'error') }
  }

  function updateOrderStatusDemo(orderId, newStatus, staffNote) {
    setDemoOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: newStatus, staffNote: staffNote || '' } : o
    ))
    // Also update the openOrder state so modal reflects change immediately
    setOpenOrder(prev => prev?.id === orderId ? { ...prev, status: newStatus, staffNote: staffNote || '' } : prev)
    showToast(`[Demo] Order marked as ${STATUS_LABELS[newStatus] || newStatus}`, 'success')
    return Promise.resolve()
  }

  // ── Log items ──────────────────────────────────────────────────────────────
  function logItemLive(name, action) {
    if (!name.trim()) { showToast('Enter an item name', 'error'); return }
    setActivityLog(prev => [{ name: name.trim(), action, time: Date.now() }, ...prev].slice(0, 6))
    const existing = inventory.find(i => i.name.toLowerCase() === name.trim().toLowerCase())
    if (existing?.id) {
      updateDoc(doc(db, 'inventory', existing.id), {
        quantity: action === 'out' ? Math.max(0, (existing.quantity || 0) - 1) : (existing.quantity || 0) + 1,
        lastUpdated: serverTimestamp(),
      }).catch(() => {})
    }
    addDoc(collection(db, 'activity_log'), {
      itemName: name.trim(), action, schoolId: effectiveSchoolId || '', timestamp: serverTimestamp(),
    }).catch(() => {})
    showToast(`Logged: ${name.trim()} (${action === 'out' ? 'taken out' : 'restocked'})`, 'success')
    setManualItem('')
  }

  function logItemDemo(name, action) {
    if (!name.trim()) { showToast('Enter an item name', 'error'); return }
    setDemoLog(prev => [{ name: name.trim(), action, time: Date.now() }, ...prev].slice(0, 6))
    setDemoInventory(prev => prev.map(item =>
      item.name.toLowerCase() === name.trim().toLowerCase()
        ? { ...item, quantity: action === 'out' ? Math.max(0, item.quantity - 1) : item.quantity + 1 }
        : item
    ))
    showToast(`[Demo] Logged: ${name.trim()}`, 'success')
    setDemoManualItem('')
  }

  async function requestRestockLive(itemName) {
    addDoc(collection(db, 'restock_requests'), {
      itemName, schoolId: effectiveSchoolId || '', status: 'pending', createdAt: serverTimestamp(),
    }).catch(() => {})
    showToast(`Restock request sent to Uth HQ for ${itemName}`)
  }

  function simulateScan() {
    const allItems = Object.values(CATALOG).flat()
    const random = allItems[Math.floor(Math.random() * allItems.length)]
    if (mode === 'live') logItemLive(random.name, 'out')
    else logItemDemo(random.name, 'out')
  }

  function exportCSV(inv) {
    const header = 'Item,Category,In Stock,Status,Last Restocked\n'
    const rows = inv.map(item =>
      `"${item.name}","${item.category}",${item.quantity},${getStatus(item.quantity, item)},${item.lastRestocked}`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'uth-inventory.csv'; a.click()
    showToast('Inventory exported', 'success')
  }

  const isDemo       = mode === 'demo'
  const orders       = isDemo ? demoOrders        : liveOrders
  const log          = isDemo ? demoLog            : activityLog
  const inv          = isDemo ? demoInventory      : inventory
  const manItem      = isDemo ? demoManualItem     : manualItem
  const setManItem   = isDemo ? setDemoManualItem  : setManualItem
  const manAct       = isDemo ? demoManualAction   : manualAction
  const setManAct    = isDemo ? setDemoManualAction : setManualAction
  const logItem      = isDemo ? logItemDemo        : logItemLive
  const reqRestock   = isDemo ? (n) => showToast(`[Demo] Restock request: ${n}`) : requestRestockLive
  const doUpdateStatus = isDemo ? updateOrderStatusDemo : updateOrderStatusLive

  const lowStockCount     = inv.filter(i => getStatus(i.quantity, i) !== 'OK').length
  const currentSchoolName = SCHOOLS.find(s => s.id === effectiveSchoolId)?.name

  return (
    <div style={styles.wrap}>

      {/* Mode pill */}
      <div style={styles.pillRow}>
        <div style={styles.pill}>
          <button
            style={{ ...styles.pillBtn, ...(isDemo ? styles.pillBtnDemo : styles.pillBtnOff) }}
            onClick={() => setMode('demo')}
          >Demo</button>
          <button
            style={{ ...styles.pillBtn, ...(mode === 'live' ? styles.pillBtnLive : styles.pillBtnOff) }}
            onClick={() => setMode('live')}
          >
            <span style={mode === 'live' ? styles.liveDot : styles.liveDotOff} />
            Live
          </button>
        </div>
        {isDemo && <div style={styles.demoNotice}>Demo mode — all data is placeholder. Switch to Live to connect Firebase.</div>}
        {!isDemo && !effectiveSchoolId && <div style={{ ...styles.demoNotice, color: '#003865', borderColor: 'rgba(50,188,173,.2)', background: 'rgba(50,188,173,.05)' }}>Viewing live data for <strong>all schools</strong></div>}
        {!isDemo && effectiveSchoolId && currentSchoolName && <div style={{ ...styles.demoNotice, color: '#003865', borderColor: 'rgba(50,188,173,.2)', background: 'rgba(50,188,173,.05)' }}>Viewing live data for <strong>{currentSchoolName}</strong></div>}
      </div>

      {role === 'admin' && effectiveSchoolId && currentSchoolName && (
        <div style={styles.schoolBanner}>
          Viewing: <strong>{currentSchoolName}</strong>
          <span style={styles.schoolBannerHint}> — change school using the nav picker above.</span>
        </div>
      )}

      {/* Metrics */}
      <div style={styles.metricsRow}>
        {[
          { label: 'Items Logged Today', val: isDemo ? log.length : todayLogCount,       sub: 'This session',     border: '#78BE20' },
          { label: 'Pending Orders',     val: orders.length,                              sub: 'Need fulfillment',  border: '#FF9E1B' },
          { label: 'Low Stock Alerts',   val: lowStockCount,                              sub: 'Restock needed',    border: '#D0006F', valColor: lowStockCount > 0 ? '#D0006F' : undefined },
          { label: 'Students Served',    val: isDemo ? '87' : studentsServed,             sub: 'Fulfilled orders',  border: '#003865' },
        ].map(m => (
          <div key={m.label} style={{ ...styles.metric, borderTopColor: m.border }}>
            <div style={styles.metricLabel}>{m.label}</div>
            <div style={{ ...styles.metricVal, ...(m.valColor ? { color: m.valColor } : {}) }}>{m.val}</div>
            <div style={styles.metricSub}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={styles.twoCol}>
        {/* Log an Item */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Log an Item</div>
          <div style={styles.scanZone} onClick={simulateScan}>
            <div style={styles.scanIconWrap}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#32BCAD" strokeWidth="1.5">
                <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M15 3h4a2 2 0 012 2v4M15 21h4a2 2 0 002-2v-4"/>
                <line x1="7" y1="12" x2="7" y2="12" strokeWidth="3" strokeLinecap="round"/>
                <line x1="12" y1="12" x2="17" y2="12" strokeWidth="3" strokeLinecap="round"/>
                <line x1="10" y1="7" x2="10" y2="17" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={styles.scanTitle}>Tap to scan barcode / QR</div>
            <div style={styles.scanSub}>Tap to simulate a random item</div>
          </div>
          <div style={styles.manualRow}>
            <input style={styles.input} placeholder="Item name or SKU…" value={manItem}
              onChange={e => setManItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && logItem(manItem, manAct)} />
            <select style={styles.select} value={manAct} onChange={e => setManAct(e.target.value)}>
              <option value="out">Taken out</option>
              <option value="in">Restocked</option>
            </select>
            <button style={styles.logBtn} onClick={() => logItem(manItem, manAct)}>Log</button>
          </div>
          {log.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={styles.logLabel}>Recent Activity</div>
              {log.map((entry, i) => (
                <div key={i} style={styles.logRow}>
                  <div style={{ ...styles.logDot, background: entry.action === 'out' ? '#D0006F' : '#78BE20' }} />
                  <span style={{ color: '#1A1A1A', flex: 1, fontSize: 12 }}>{entry.name}</span>
                  <span style={{ color: '#AEAEAE', fontSize: 10, fontFamily: "'Oswald', sans-serif" }}>
                    {entry.action === 'out' ? 'taken out' : 'restocked'} · just now
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            Student Orders to Fulfill
            {orders.length > 0 && <span style={styles.ordersBadge}>{orders.length}</span>}
          </div>
          {orders.length === 0 ? (
            <div style={styles.emptyOrders}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(174,174,174,.6)" strokeWidth="1.2">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
              <p style={{ fontSize: 13, color: '#AEAEAE', marginTop: 10 }}>No pending orders right now</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.map(order => {
                const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending
                return (
                  <div key={order.id} style={styles.orderRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.orderName}>{order.anonymousId}</div>
                      <div style={styles.orderItems}>
                        {order.items?.map(i => `${i.name}${i.size ? ` (${i.size})` : ''}`).join(' · ')}
                      </div>
                      {order.staffNote ? (
                        <div style={styles.orderStaffNote}>📝 {order.staffNote}</div>
                      ) : null}
                    </div>
                    <span style={{ ...styles.statusPillSmall, background: sc.bg, color: sc.color }}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                    <button style={styles.openBtn} onClick={() => setOpenOrder(order)}>
                      Open
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      <div style={styles.invCard}>
        <div style={styles.invHeader}>
          <span style={styles.cardTitle}>{isDemo ? 'Demo Inventory' : 'Live Inventory'}</span>
          <button style={styles.exportBtn} onClick={() => exportCSV(inv)}>Export CSV</button>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={styles.table}>
            <thead>
              <tr>{['Item', 'Category', 'In Stock', 'Status', 'Last Restocked', 'Action'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {inv.map(item => {
                const s = getStatus(item.quantity, item)
                const ss = s === 'OK' ? styles.statusOk : s === 'Low' ? styles.statusLow : styles.statusCrit
                return (
                  <tr key={item.id}>
                    <td style={styles.td}><strong>{item.name}</strong></td>
                    <td style={styles.td}>
                      <span style={{ ...styles.catDot, background: CAT_COLOR[item.category] || '#003865' }} />
                      <span style={{ textTransform: 'capitalize' }}>{item.category}</span>
                    </td>
                    <td style={styles.td}><strong>{item.quantity}</strong></td>
                    <td style={styles.td}><span style={{ ...styles.statusPill, ...ss }}>{s}</span></td>
                    <td style={{ ...styles.td, color: '#AEAEAE', fontSize: 11 }}>{item.lastRestocked}</td>
                    <td style={styles.td}>
                      <button style={styles.restockBtn} onClick={() => reqRestock(item.name)}>Request restock</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fulfillment Modal */}
      {openOrder && createPortal(
        <FulfillmentModal
          order={openOrder}
          inventory={inv}
          onClose={() => setOpenOrder(null)}
          onUpdateStatus={doUpdateStatus}
          onRestock={reqRestock}
        />,
        document.body
      )}
    </div>
  )
}

// ── Fulfillment Modal Styles ───────────────────────────────────────────────────
const fm = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,20,45,.72)',
    zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: '28px 26px',
    maxWidth: 560, width: '100%', maxHeight: '88dvh', overflowY: 'auto',
    borderTop: '4px solid #003865', boxShadow: '0 24px 64px rgba(0,0,0,.35)',
    WebkitOverflowScrolling: 'touch',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  orderId: { fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700, color: '#003865', letterSpacing: '.03em' },
  schoolName: { fontSize: 13, color: '#6B6B6B', marginTop: 3 },
  closeBtn: {
    background: '#F5F4F1', border: 'none', borderRadius: 6,
    width: 30, height: 30, cursor: 'pointer', color: '#6B6B6B',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13,
  },
  metaRow: {
    display: 'flex', gap: 20, marginBottom: 22,
    padding: '14px 16px', background: '#F5F4F1', borderRadius: 10, flexWrap: 'wrap',
  },
  metaItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  metaLabel: { fontSize: 9, fontFamily: "'Oswald', sans-serif", letterSpacing: '.1em', textTransform: 'uppercase', color: '#AEAEAE' },
  metaVal: { fontSize: 13, color: '#1A1A1A' },
  statusPill: {
    display: 'inline-block', padding: '3px 9px', borderRadius: 5,
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '.05em',
  },
  progressWrap: {
    display: 'flex', alignItems: 'flex-start', marginBottom: 24,
  },
  progressDot: {
    width: 20, height: 20, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  progressLine: { flex: 1, height: 2, margin: '9px 4px 0', minWidth: 16 },
  progressLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 9, letterSpacing: '.07em',
    textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3, marginTop: 5,
    maxWidth: 60,
  },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600,
    letterSpacing: '.09em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 10,
  },
  sectionHint: { fontFamily: "'Open Sans', sans-serif", fontSize: 10, fontWeight: 400, color: '#AEAEAE', textTransform: 'none', letterSpacing: 0 },
  itemRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    padding: '10px 12px', border: '1px solid #E8E5E0', borderRadius: 8, marginBottom: 6,
  },
  itemMain: { flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  itemName: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, color: '#1A1A1A' },
  itemSize: { background: '#E6EEF5', color: '#003865', padding: '2px 7px', borderRadius: 4, fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600 },
  itemQty: { fontSize: 11, color: '#6B6B6B' },
  itemNote: { width: '100%', fontSize: 11, color: '#6B6B6B', fontStyle: 'italic', marginTop: 2 },
  itemRight: { display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 },
  invBadge: { padding: '3px 8px', borderRadius: 4, fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '.04em', whiteSpace: 'nowrap' },
  invBadgeOk: { background: '#E8F5E9', color: '#2E7D32' },
  invBadgeWarn: { background: '#FCE4EC', color: '#880E4F' },
  restockMini: {
    background: 'none', border: '1px solid rgba(208,0,111,.3)', color: '#D0006F', borderRadius: 4,
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: '.05em',
    padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  noteArea: {
    width: '100%', padding: '10px 12px', border: '1.5px solid #E8E5E0', borderRadius: 8,
    fontFamily: "'Open Sans', sans-serif", fontSize: 13, color: '#1A1A1A',
    background: '#FAFAF9', resize: 'none', lineHeight: 1.5,
  },
  cantBox: {
    background: '#FFF5F9', border: '1px solid rgba(208,0,111,.2)',
    borderRadius: 10, padding: '14px 16px', marginBottom: 16,
  },
  reasonGrid: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 4 },
  reasonBtn: {
    padding: '6px 13px', border: '1px solid #E8E5E0', borderRadius: 6, background: '#fff',
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, color: '#6B6B6B',
    cursor: 'pointer', transition: 'all .15s',
  },
  reasonBtnActive: { background: '#D0006F', color: '#fff', borderColor: '#D0006F' },
  cantInput: {
    width: '100%', padding: '9px 12px', border: '1.5px solid #E8E5E0', borderRadius: 7,
    fontSize: 13, fontFamily: "'Open Sans', sans-serif", background: '#fff', color: '#1A1A1A', marginTop: 8,
  },
  cancelSmall: {
    padding: '8px 14px', background: '#F5F4F1', border: '1px solid #E8E5E0', borderRadius: 6,
    color: '#6B6B6B', fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, cursor: 'pointer',
  },
  flagBtn: {
    flex: 1, padding: '8px 14px', background: '#D0006F', border: 'none', borderRadius: 6, color: '#fff',
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.05em', cursor: 'pointer',
  },
  actions: {
    display: 'flex', gap: 10, alignItems: 'center',
    paddingTop: 16, borderTop: '1px solid #E8E5E0', marginTop: 4, flexWrap: 'wrap',
  },
  cantFulfillBtn: {
    padding: '10px 16px', background: 'rgba(208,0,111,.07)', color: '#D0006F',
    border: '1px solid rgba(208,0,111,.25)', borderRadius: 8,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.05em',
    cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
  },
  saveNoteBtn: {
    padding: '10px 18px', background: '#F5F4F1', border: '1px solid #E8E5E0', borderRadius: 8,
    color: '#003865', fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600,
    letterSpacing: '.05em', cursor: 'pointer',
  },
  advanceBtn: {
    padding: '10px 20px', background: '#003865', border: 'none', borderRadius: 8, color: '#fff',
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer',
  },
  fulfilledBadge: {
    padding: '10px 20px', background: '#E8F5E9', borderRadius: 8,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, color: '#2E7D32', letterSpacing: '.06em',
  },
}

// ── Main styles ────────────────────────────────────────────────────────────────
const styles = {
  wrap: { padding: 24, background: '#F5F4F1', minHeight: 'calc(100dvh - 80px)', animation: 'fadeIn .4s ease both' },
  pillRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  pill: { display: 'flex', background: '#E8E5E0', borderRadius: 10, padding: 3, gap: 2, flexShrink: 0 },
  pillBtn: {
    padding: '7px 20px', border: 'none', borderRadius: 8,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.07em',
    cursor: 'pointer', transition: 'all .18s', touchAction: 'manipulation',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  pillBtnOff:  { background: 'transparent', color: '#AEAEAE' },
  pillBtnDemo: { background: '#fff', color: '#642F6C', boxShadow: '0 1px 4px rgba(0,0,0,.1)' },
  pillBtnLive: { background: '#003865', color: '#fff', boxShadow: '0 1px 6px rgba(0,56,101,.3)' },
  liveDot:    { width: 7, height: 7, borderRadius: '50%', background: '#78BE20', display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' },
  liveDotOff: { width: 7, height: 7, borderRadius: '50%', background: '#AEAEAE', display: 'inline-block' },
  demoNotice: { fontSize: 12, color: '#6B6B6B', padding: '7px 12px', border: '1px solid #E8E5E0', borderRadius: 7, background: '#fff' },
  schoolBanner: { background: 'rgba(50,188,173,.1)', border: '1px solid rgba(50,188,173,.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#003865', marginBottom: 20 },
  schoolBannerHint: { color: '#AEAEAE', fontSize: 12 },
  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 },
  metric: { background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12, padding: '16px 18px', borderTop: '3px solid #003865', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  metricLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 8 },
  metricVal: { fontFamily: "'Oswald', sans-serif", fontSize: 32, fontWeight: 600, color: '#003865', lineHeight: 1 },
  metricSub: { fontSize: 11, color: '#AEAEAE', marginTop: 6 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 },
  card: { background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  cardTitle: {
    fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600, color: '#003865', letterSpacing: '.04em',
    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, borderLeft: '3px solid #32BCAD',
  },
  ordersBadge: { background: '#FF9E1B', color: '#002548', fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 },
  scanZone: {
    border: '1.5px dashed rgba(50,188,173,.45)', borderRadius: 10, padding: '18px', textAlign: 'center',
    marginBottom: 14, background: 'rgba(50,188,173,.04)', cursor: 'pointer', transition: 'background .2s',
    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  },
  scanIconWrap: { display: 'flex', justifyContent: 'center', marginBottom: 8 },
  scanTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, color: '#003865', marginBottom: 3, letterSpacing: '.04em' },
  scanSub: { fontSize: 11, color: '#6B6B6B' },
  manualRow: { display: 'flex', gap: 8 },
  input: { flex: 1, padding: '9px 12px', border: '1.5px solid #E8E5E0', borderRadius: 7, fontSize: 16, fontFamily: "'Open Sans', sans-serif", background: '#FAFAF9', color: '#1A1A1A', minWidth: 0 },
  select: { padding: '9px 10px', border: '1.5px solid #E8E5E0', borderRadius: 7, fontSize: 16, fontFamily: "'Open Sans', sans-serif", background: '#FAFAF9', color: '#1A1A1A', flexShrink: 0 },
  logBtn: { padding: '9px 16px', background: '#003865', color: '#fff', border: 'none', borderRadius: 7, fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.06em', cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation' },
  logLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#AEAEAE', marginBottom: 8 },
  logRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#F5F4F1', borderRadius: 6, marginBottom: 4 },
  logDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  emptyOrders: { textAlign: 'center', padding: '28px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  orderRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid #E8E5E0', borderRadius: 8 },
  orderName: { fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, color: '#003865', marginBottom: 2 },
  orderItems: { fontSize: 11, color: '#6B6B6B', lineHeight: 1.5 },
  orderStaffNote: { fontSize: 10, color: '#6B6B6B', fontStyle: 'italic', marginTop: 3 },
  statusPillSmall: { padding: '3px 8px', borderRadius: 4, fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '.05em', flexShrink: 0, marginTop: 2, whiteSpace: 'nowrap' },
  openBtn: {
    padding: '6px 13px', background: '#642F6C', color: '#fff', border: 'none', borderRadius: 5,
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
    cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation', marginTop: 2,
  },
  invCard: { background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  invHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  exportBtn: { padding: '7px 16px', background: '#003865', color: '#fff', border: 'none', borderRadius: 6, fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.06em', cursor: 'pointer', touchAction: 'manipulation' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 },
  th: { padding: '9px 12px', textAlign: 'left', fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B6B6B', background: '#F5F4F1', whiteSpace: 'nowrap' },
  td: { padding: '11px 12px', borderBottom: '1px solid #F0EDE8', verticalAlign: 'middle' },
  catDot: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6, verticalAlign: 'middle', flexShrink: 0 },
  statusPill: { display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '.05em' },
  statusOk:   { background: '#E8F5E9', color: '#2E7D32' },
  statusLow:  { background: '#FFF3E0', color: '#E65100' },
  statusCrit: { background: '#FFEBEE', color: '#C62828' },
  restockBtn: { padding: '4px 10px', background: '#E6EEF5', color: '#003865', border: 'none', borderRadius: 4, fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '.05em', cursor: 'pointer', touchAction: 'manipulation' },
}
