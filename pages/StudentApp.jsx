import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  collection, addDoc, query, where, onSnapshot,
  serverTimestamp, doc, updateDoc, deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CATALOG, CATEGORIES, SCHOOLS, generateOrderId } from '../utils/catalog'
import ProfileModal from '../components/ProfileModal'

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

export default function StudentApp() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()

  const [activeCategory, setActiveCategory] = useState('snacks')
  const [cart, setCart]             = useState({})
  const [sizes, setSizes]           = useState({})
  const [itemNotes, setItemNotes]   = useState({})
  const [showModal, setShowModal]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recentOrders, setRecentOrders]   = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orderFilter, setOrderFilter]     = useState('all')
  const [cancellingId, setCancellingId]   = useState(null)
  const [detailOrder, setDetailOrder]     = useState(null) // order open in See Details modal
  const [editingOrderId, setEditingOrderId] = useState(null) // pending order being edited
  const [editCart, setEditCart]           = useState({}) // items in edit mode
  const [savingEdit, setSavingEdit]       = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const noSchool = !profile?.schoolId
  const profileSchool = SCHOOLS.find(s => s.id === profile?.schoolId)

  async function cancelOrder(orderId) {
    setCancellingId(orderId)
    try {
      await deleteDoc(doc(db, 'orders', orderId))
      showToast('Order cancelled', 'success')
      if (detailOrder?.id === orderId) setDetailOrder(null)
    } catch (err) {
      console.error('Cancel failed:', err)
      showToast('Failed to cancel — try again', 'error')
    }
    setCancellingId(null)
  }

  useEffect(() => {
    if (!user?.uid) { setOrdersLoading(false); return }
    const q = query(collection(db, 'orders'), where('userId', '==', user.uid))
    const unsub = onSnapshot(q,
      snap => {
        const orders = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        setRecentOrders(orders)
        // Keep detailOrder in sync
        setDetailOrder(prev => {
          if (!prev) return null
          const updated = orders.find(o => o.id === prev.id)
          return updated || prev
        })
        setOrdersLoading(false)
      },
      err => { console.error('[StudentApp] orders error:', err.code, err.message); setOrdersLoading(false) }
    )
    return () => unsub()
  }, [user?.uid])

  const cartItems = Object.values(cart)
  const cartCount = cartItems.length

  function selectSize(itemId, size) { setSizes(prev => ({ ...prev, [itemId]: size })) }
  function updateNote(itemId, val)  { setItemNotes(prev => ({ ...prev, [itemId]: val })) }

  function toggleItem(item) {
    const key = item.id + (sizes[item.id] ? `-${sizes[item.id]}` : '')
    if (item.sizes?.length > 0 && !sizes[item.id]) { showToast('Pick a size first!', 'error'); return }
    const alreadyIn = !!cart[key]
    if (alreadyIn) {
      setCart(prev => { const next = { ...prev }; delete next[key]; return next })
      showToast(`${item.name} removed`)
    } else {
      setCart(prev => ({ ...prev, [key]: { item, size: sizes[item.id] || null, qty: 1, note: itemNotes[item.id] || '' } }))
      showToast(`${item.name} added`, 'success')
    }
  }

  function isInCart(item) {
    const key = item.id + (sizes[item.id] ? `-${sizes[item.id]}` : '')
    return !!cart[key]
  }

  function openCheckout() {
    if (cartCount === 0) { showToast('Add some items first'); return }
    if (noSchool) { showToast('Set up your school in your profile first', 'error'); setShowProfileModal(true); return }
    setShowModal(true)
  }

  async function submitOrder() {
    if (!user?.uid) { showToast('Not signed in — please refresh', 'error'); return }
    setSubmitting(true)
    try {
      const anonymousId = generateOrderId()
      const orderData = {
        anonymousId: `#${anonymousId}`,
        schoolId:    profile?.schoolId || '',
        userId:      user.uid,
        status:      'pending',
        items: cartItems.map(c => ({
          itemId: c.item.id, name: c.item.name,
          size: c.size || null, qty: c.qty, note: c.note || '',
        })),
        createdAt:   serverTimestamp(),
        fulfilledAt: null,
        staffNote:   '',
      }
      await addDoc(collection(db, 'orders'), orderData)
      setCart({}); setSizes({}); setItemNotes({})
      setShowModal(false)
      showToast('Order submitted! Your items will be ready soon.', 'success')
    } catch (err) {
      console.error('[StudentApp] submit failed:', err.code, err.message, err)
      const msg = err.code === 'permission-denied' ? 'Permission denied — check Firestore rules'
        : err.code === 'unavailable' ? 'Offline — check your connection and try again'
        : `Failed to submit (${err.code || 'unknown'}) — try again`
      showToast(msg, 'error')
    }
    setSubmitting(false)
  }

  // ── Edit pending order ─────────────────────────────────────────────────────
  function startEdit(order) {
    // Convert order items back to an editCart map
    const ec = {}
    order.items?.forEach(item => {
      const key = `${item.itemId || item.name}-${item.size || 'none'}`
      ec[key] = { name: item.name, size: item.size, qty: item.qty, note: item.note || '', itemId: item.itemId }
    })
    setEditCart(ec)
    setEditingOrderId(order.id)
  }

  function toggleEditItem(itemObj) {
    const key = `${itemObj.id}-${sizes[itemObj.id] || 'none'}`
    if (itemObj.sizes?.length > 0 && !sizes[itemObj.id]) { showToast('Pick a size first!', 'error'); return }
    setEditCart(prev => {
      if (prev[key]) {
        const next = { ...prev }; delete next[key]; return next
      }
      return {
        ...prev,
        [key]: { name: itemObj.name, size: sizes[itemObj.id] || null, qty: 1, note: '', itemId: itemObj.id }
      }
    })
  }

  function isInEditCart(itemObj) {
    const key = `${itemObj.id}-${sizes[itemObj.id] || 'none'}`
    return !!editCart[key]
  }

  async function saveEdit() {
    if (Object.keys(editCart).length === 0) { showToast('Order must have at least one item', 'error'); return }
    setSavingEdit(true)
    try {
      const items = Object.values(editCart).map(e => ({
        itemId: e.itemId || '', name: e.name,
        size: e.size || null, qty: e.qty, note: e.note || '',
      }))
      await updateDoc(doc(db, 'orders', editingOrderId), { items, updatedAt: serverTimestamp() })
      showToast('Order updated!', 'success')
      setEditingOrderId(null)
      setEditCart({})
    } catch (err) {
      console.error('Edit failed:', err)
      showToast('Failed to save changes', 'error')
    }
    setSavingEdit(false)
  }

  const items = CATALOG[activeCategory] || []

  return (
    <div style={styles.wrap}>

      {/* ── LEFT: Phone panel ── */}
      <div style={styles.phonePanel}>
        <div style={styles.phoneHeader}>
          <div style={styles.phoneHeaderTop}>
            <button style={styles.cartBadge} onClick={openCheckout}>
              {cartCount} {cartCount === 1 ? 'ITEM' : 'ITEMS'}
            </button>
          </div>
          <div style={styles.greetingTitle}>Welcome back.</div>
          <div style={styles.greetingSub}>Browse and order — private, no questions asked</div>
        </div>

        <div style={styles.cats}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              style={{
                ...styles.cat,
                borderBottomColor: activeCategory === cat.key ? cat.color : 'transparent',
                background: activeCategory === cat.key ? `${cat.color}15` : 'none',
              }}
              onClick={() => setActiveCategory(cat.key)}
            >
              <span style={{ ...styles.catLabel, color: activeCategory === cat.key ? cat.color : 'rgba(255,255,255,.48)' }}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        <div style={styles.itemsList}>
          {items.map(item => {
            const inCart       = isInCart(item)
            const selectedSize = sizes[item.id]
            const note         = itemNotes[item.id] || ''
            const hasNotes     = item.sizes || item.notePlaceholder

            return (
              <div key={item.id} style={{ ...styles.itemCard, ...(inCart ? styles.itemCardActive : {}) }}>
                <div style={styles.itemInfo}>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemDesc}>{item.desc}</div>
                  {item.sizes?.length > 0 && (
                    <div style={styles.sizeRow}>
                      {item.sizes.map(sz => (
                        <button
                          key={sz}
                          style={{ ...styles.sizeChip, ...(selectedSize === sz ? styles.sizeChipActive : {}) }}
                          onClick={() => selectSize(item.id, sz)}
                        >{sz}</button>
                      ))}
                    </div>
                  )}
                  {hasNotes && (
                    <textarea
                      style={styles.noteField} rows={2}
                      placeholder={item.notePlaceholder || 'Add a note (optional)...'}
                      value={note} onChange={e => updateNote(item.id, e.target.value)}
                    />
                  )}
                </div>
                <button
                  style={{ ...styles.addBtn, ...(inCart ? styles.addBtnAdded : {}) }}
                  onClick={() => toggleItem(item)}
                >
                  {inCart ? 'Added' : 'Add'}
                </button>
              </div>
            )
          })}
        </div>

        <div style={styles.phoneFooter}>
          <button style={styles.checkoutBtn} onClick={openCheckout}>
            VIEW MY ORDER {cartCount > 0 && `(${cartCount})`}
          </button>
        </div>
      </div>

      {/* ── RIGHT: Info panel ── */}
      <div style={styles.rightPanel}>

        {/* No school prompt */}
        {noSchool && (
          <div style={styles.setupBanner}>
            <div style={styles.setupBannerIcon}>🏫</div>
            <div style={{ flex: 1 }}>
              <div style={styles.setupBannerTitle}>Set up your profile to place orders</div>
              <div style={styles.setupBannerSub}>Select your school so staff know where to prepare your order.</div>
            </div>
            <button style={styles.setupBannerBtn} onClick={() => setShowProfileModal(true)}>
              Set Up Profile
            </button>
          </div>
        )}

        <div style={styles.topRow}>
          <div style={styles.infoCard}>
            <div style={styles.infoTitle}>How it works</div>
            {[
              { n: 1, t: 'Browse',    d: 'Choose items you need from any category.' },
              { n: 2, t: 'Order',     d: 'Submit privately — no one sees what you picked.' },
              { n: 3, t: 'Pick up',   d: 'Collect from the Uth Closet.' },
            ].map(step => (
              <div key={step.n} style={styles.step}>
                <div style={styles.stepN}>{step.n}</div>
                <div>
                  <div style={styles.stepTitle}>{step.t}</div>
                  <div style={styles.stepDesc}>{step.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.taglineCard}>
            <div style={styles.taglineText}>"Take What You Need.<br />Give What You Can."</div>
            <p style={styles.taglineDesc}>
              The Uth Closet exists because your community cares about you.
              Everything here is free, private, and here whenever you need it.
            </p>
            <div style={styles.pillars}>
              {[
                { label: 'Community', bg: '#32BCAD', color: '#002548' },
                { label: 'Health',    bg: '#D0006F', color: '#fff' },
                { label: 'Education', bg: '#FF9E1B', color: '#002548' },
                { label: 'Food',      bg: '#78BE20', color: '#002548' },
              ].map(p => (
                <span key={p.label} style={{ ...styles.pillar, background: p.bg, color: p.color }}>{p.label}</span>
              ))}
            </div>
          </div>
        </div>

        <RecentOrders
          orders={recentOrders}
          loading={ordersLoading}
          filter={orderFilter}
          setFilter={setOrderFilter}
          onCancel={cancelOrder}
          cancellingId={cancellingId}
          onSeeDetails={order => setDetailOrder(order)}
        />

        <div style={styles.aboutCard}>
          <div style={styles.infoTitle}>About the Uth Closet</div>
          <p style={styles.aboutText}>
            Uth Inc. is a mission-driven nonprofit dedicated to ensuring every young person has access
            to the essentials that allow them to show up ready — to school, to life, to their full potential.
            Our closets operate on belonging, access, and equity. Prepared youth become empowered adults.
          </p>
          <div style={styles.tags}>
            {['Youth Equity', 'No Stigma', 'No Questions Asked', 'Potential Unlocked'].map(t => (
              <span key={t} style={styles.tag}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Order submit modal ── */}
      {showModal && createPortal(
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>Submit your order?</div>
            <div style={styles.modalSectionLabel}>YOUR ORDER</div>
            <ul style={styles.modalList}>
              {cartItems.map((c, i) => (
                <li key={i} style={styles.modalItem}>
                  <span style={styles.modalDot} />
                  <div>
                    <span style={{ fontWeight: 600 }}>{c.item.name}</span>
                    {c.size ? ` (${c.size})` : ''}
                    {c.note ? <div style={styles.modalItemNote}>{c.note}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
            <div style={styles.modalNote}>
              Items will be prepared privately. You will be notified when your order is ready for pickup.
            </div>
            <div style={styles.modalBtns}>
              <button style={styles.modalCancel} onClick={() => setShowModal(false)}>Cancel</button>
              <button
                style={{ ...styles.modalConfirm, opacity: submitting ? .6 : 1 }}
                onClick={submitOrder} disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Order'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── See Details modal ── */}
      {detailOrder && createPortal(
        <OrderDetailModal
          order={detailOrder}
          onClose={() => { setDetailOrder(null); setEditingOrderId(null); setEditCart({}) }}
          onCancel={cancelOrder}
          cancellingId={cancellingId}
          editingOrderId={editingOrderId}
          editCart={editCart}
          onStartEdit={startEdit}
          onToggleEditItem={toggleEditItem}
          isInEditCart={isInEditCart}
          onSaveEdit={saveEdit}
          savingEdit={savingEdit}
          onCancelEdit={() => { setEditingOrderId(null); setEditCart({}) }}
          catalog={CATALOG}
          categories={CATEGORIES}
          sizes={sizes}
          selectSize={selectSize}
        />,
        document.body
      )}

      {/* ── Profile setup modal ── */}
      {showProfileModal && createPortal(
        <ProfileModal onClose={() => setShowProfileModal(false)} />,
        document.body
      )}
    </div>
  )
}

// ── Order Detail Modal ────────────────────────────────────────────────────────
function OrderDetailModal({
  order, onClose, onCancel, cancellingId,
  editingOrderId, editCart, onStartEdit, onToggleEditItem, isInEditCart,
  onSaveEdit, savingEdit, onCancelEdit,
  catalog, categories, sizes, selectSize,
}) {
  const [editCategory, setEditCategory] = useState('snacks')
  const isEditing = editingOrderId === order.id
  const canEdit   = order.status === 'pending'

  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending

  function fmt(ts) {
    if (!ts?.toDate) return '—'
    return ts.toDate().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={od.overlay} onClick={onClose}>
      <div style={od.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={od.header}>
          <div>
            <div style={od.orderId}>{order.anonymousId}</div>
            <div style={od.submitted}>Submitted {fmt(order.createdAt)}</div>
          </div>
          <button style={od.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Status */}
        <div style={od.statusRow}>
          <span style={{ ...od.statusPill, background: sc.bg, color: sc.color }}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
          {order.status === 'fulfilled' && order.fulfilledAt && (
            <span style={od.fulfilledAt}>Fulfilled {fmt(order.fulfilledAt)}</span>
          )}
        </div>

        {/* Staff note / flagged reason */}
        {order.staffNote && (
          <div style={{
            ...od.staffNote,
            background: order.status === 'flagged' ? '#FFF5F9' : '#F5F8FF',
            borderColor: order.status === 'flagged' ? 'rgba(208,0,111,.2)' : 'rgba(50,100,200,.12)',
          }}>
            <span style={od.staffNoteLabel}>
              {order.status === 'flagged' ? '⚠ Staff note' : '📝 Staff note'}
            </span>
            <div style={od.staffNoteText}>{order.staffNote}</div>
          </div>
        )}

        {/* Items — view mode */}
        {!isEditing && (
          <div style={od.section}>
            <div style={od.sectionLabel}>Items in your order</div>
            {order.items?.map((item, i) => (
              <div key={i} style={od.itemRow}>
                <span style={od.itemName}>{item.name}</span>
                {item.size && <span style={od.itemSize}>{item.size}</span>}
                {item.qty > 1 && <span style={od.itemQty}>×{item.qty}</span>}
                {item.note && <span style={od.itemNote}> — {item.note}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Edit mode — only for pending */}
        {isEditing && (
          <div style={od.editWrap}>
            <div style={od.editHeader}>
              <div style={od.sectionLabel}>Edit your order</div>
              <div style={od.editHint}>Tap items to add or remove them</div>
            </div>

            {/* Current edit cart */}
            {Object.keys(editCart).length > 0 && (
              <div style={od.editCartPreview}>
                <div style={od.editCartLabel}>Currently in order:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {Object.values(editCart).map((e, i) => (
                    <span key={i} style={od.editCartChip}>
                      {e.name}{e.size ? ` (${e.size})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Category picker */}
            <div style={od.editCats}>
              {categories.map(cat => (
                <button
                  key={cat.key}
                  style={{ ...od.editCatBtn, ...(editCategory === cat.key ? { background: '#003865', color: '#fff', borderColor: '#003865' } : {}) }}
                  onClick={() => setEditCategory(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Item list */}
            <div style={od.editItems}>
              {(catalog[editCategory] || []).map(item => {
                const inCart = isInEditCart(item)
                const selSz  = sizes[item.id]
                return (
                  <div key={item.id} style={{ ...od.editItemRow, ...(inCart ? od.editItemRowActive : {}) }}>
                    <div style={{ flex: 1 }}>
                      <div style={od.editItemName}>{item.name}</div>
                      {item.sizes?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                          {item.sizes.map(sz => (
                            <button
                              key={sz}
                              style={{ ...od.editSizeChip, ...(selSz === sz ? od.editSizeChipActive : {}) }}
                              onClick={() => selectSize(item.id, sz)}
                            >{sz}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      style={{ ...od.editToggleBtn, ...(inCart ? od.editToggleBtnAdded : {}) }}
                      onClick={() => onToggleEditItem(item)}
                    >
                      {inCart ? 'Remove' : 'Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={od.actions}>
          {!isEditing && canEdit && (
            <>
              <button style={od.editBtn} onClick={() => onStartEdit(order)}>Edit Order</button>
              <button
                style={{ ...od.cancelOrderBtn, opacity: cancellingId === order.id ? 0.5 : 1 }}
                onClick={() => onCancel(order.id)}
                disabled={cancellingId === order.id}
              >
                {cancellingId === order.id ? 'Cancelling…' : 'Cancel Order'}
              </button>
            </>
          )}

          {isEditing && (
            <>
              <button style={od.discardBtn} onClick={onCancelEdit}>Discard Changes</button>
              <button
                style={{ ...od.saveBtn, opacity: savingEdit ? 0.6 : 1 }}
                onClick={onSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          )}

          {!isEditing && !canEdit && (
            <div style={od.lockedNote}>
              {order.status === 'fulfilled'
                ? '✓ This order has been fulfilled.'
                : order.status === 'flagged'
                ? '⚠ This order has been flagged. See staff note above.'
                : 'This order is being prepared and can no longer be edited.'}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Recent Orders component ───────────────────────────────────────────────────
function RecentOrders({ orders, loading, filter, setFilter, onCancel, cancellingId, onSeeDetails }) {
  const now = Date.now()
  const filtered = orders.filter(o => {
    const ts = o.createdAt?.toMillis?.() || 0
    if (filter === 'month') return now - ts < 30 * 24 * 60 * 60 * 1000
    if (filter === 'year')  return now - ts < 365 * 24 * 60 * 60 * 1000
    return true
  })

  function fmt(ts) {
    if (!ts?.toDate) return '—'
    return ts.toDate().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={ro.card}>
      <div style={ro.header}>
        <div style={ro.title}>Your Recent Orders</div>
        <div style={ro.filters}>
          {[
            { key: 'month', label: 'Last Month' },
            { key: 'year',  label: 'Last Year' },
            { key: 'all',   label: 'All Time' },
          ].map(f => (
            <button
              key={f.key}
              style={{ ...ro.filterBtn, ...(filter === f.key ? ro.filterBtnOn : {}) }}
              onClick={() => setFilter(f.key)}
            >{f.label}</button>
          ))}
        </div>
      </div>
      <p style={ro.sub}>Your history is private and only visible to you.</p>

      {loading ? (
        <div style={ro.empty}>
          <div style={ro.spinner} />
          <span style={ro.emptyText}>Loading your orders…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={ro.empty}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(174,174,174,.5)" strokeWidth="1.2">
            <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
          </svg>
          <span style={ro.emptyText}>
            {orders.length > 0 ? 'No orders in this time period' : 'Orders you submit will appear here'}
          </span>
        </div>
      ) : (
        <div style={ro.table}>
          <div style={ro.tableHead}>
            <span>Order ID</span>
            <span>Items</span>
            <span>Submitted</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {filtered.map(order => {
            const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending
            return (
              <div key={order.id} style={ro.tableRow}>
                <span style={ro.orderId}>{order.anonymousId}</span>
                <div style={ro.itemsList}>
                  {order.items?.map((item, i) => (
                    <span key={i} style={ro.itemChip}>
                      {item.name}{item.size ? ` (${item.size})` : ''}
                    </span>
                  ))}
                </div>
                <span style={ro.date}>{fmt(order.createdAt)}</span>
                <span style={{ ...ro.statusPill, background: sc.bg, color: sc.color }}>
                  {STATUS_LABELS[order.status] || order.status}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <button style={ro.detailsBtn} onClick={() => onSeeDetails(order)}>
                    See Details
                  </button>
                  {order.status === 'pending' && (
                    <button
                      style={{ ...ro.cancelBtn, opacity: cancellingId === order.id ? 0.5 : 1 }}
                      onClick={() => onCancel(order.id)}
                      disabled={cancellingId === order.id}
                    >
                      {cancellingId === order.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Order Detail Modal Styles ─────────────────────────────────────────────────
const od = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,20,45,.7)',
    zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: '28px 26px',
    maxWidth: 520, width: '100%', maxHeight: '88dvh', overflowY: 'auto',
    borderTop: '4px solid #32BCAD', boxShadow: '0 24px 64px rgba(0,0,0,.35)',
    WebkitOverflowScrolling: 'touch',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  orderId: { fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700, color: '#003865', letterSpacing: '.03em' },
  submitted: { fontSize: 12, color: '#AEAEAE', marginTop: 3 },
  closeBtn: {
    background: '#F5F4F1', border: 'none', borderRadius: 6,
    width: 30, height: 30, cursor: 'pointer', color: '#6B6B6B', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  statusPill: {
    display: 'inline-block', padding: '5px 12px', borderRadius: 6,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '.05em',
  },
  fulfilledAt: { fontSize: 11, color: '#AEAEAE' },
  staffNote: {
    borderRadius: 8, padding: '12px 14px', marginBottom: 18,
    border: '1px solid transparent',
  },
  staffNoteLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600,
    letterSpacing: '.07em', textTransform: 'uppercase', color: '#6B6B6B', display: 'block', marginBottom: 6,
  },
  staffNoteText: { fontSize: 13, color: '#1A1A1A', lineHeight: 1.5 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600,
    letterSpacing: '.09em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 10,
  },
  itemRow: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    padding: '9px 12px', border: '1px solid #E8E5E0', borderRadius: 7, marginBottom: 6,
  },
  itemName: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, color: '#1A1A1A' },
  itemSize: { background: '#E6EEF5', color: '#003865', padding: '2px 7px', borderRadius: 4, fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600 },
  itemQty: { fontSize: 11, color: '#6B6B6B' },
  itemNote: { fontSize: 11, color: '#6B6B6B', fontStyle: 'italic' },

  // Edit mode
  editWrap: { marginBottom: 16 },
  editHeader: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 },
  editHint: { fontSize: 11, color: '#AEAEAE' },
  editCartPreview: {
    background: 'rgba(50,188,173,.06)', border: '1px solid rgba(50,188,173,.2)',
    borderRadius: 8, padding: '10px 12px', marginBottom: 12,
  },
  editCartLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#32BCAD', marginBottom: 7 },
  editCartChip: { background: '#E6F8F7', color: '#003865', borderRadius: 4, padding: '3px 9px', fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600 },
  editCats: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  editCatBtn: {
    padding: '5px 12px', border: '1px solid #E8E5E0', borderRadius: 5, background: '#fff',
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
    color: '#6B6B6B', cursor: 'pointer', transition: 'all .15s',
  },
  editItems: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' },
  editItemRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', border: '1px solid #E8E5E0', borderRadius: 7,
    transition: 'all .15s',
  },
  editItemRowActive: { background: 'rgba(50,188,173,.06)', borderColor: 'rgba(50,188,173,.3)' },
  editItemName: { fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, color: '#1A1A1A' },
  editSizeChip: {
    fontSize: 9, padding: '2px 7px', border: '1px solid rgba(0,0,0,.15)', borderRadius: 3,
    background: 'none', color: '#6B6B6B', cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", letterSpacing: '.04em',
  },
  editSizeChipActive: { background: '#32BCAD', borderColor: '#32BCAD', color: '#002548', fontWeight: 700 },
  editToggleBtn: {
    padding: '6px 12px', background: '#32BCAD', color: '#002548', border: 'none', borderRadius: 5,
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '.05em',
    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
  },
  editToggleBtnAdded: { background: '#FCE4EC', color: '#880E4F' },

  actions: {
    display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end',
    paddingTop: 16, borderTop: '1px solid #E8E5E0', marginTop: 8, flexWrap: 'wrap',
  },
  editBtn: {
    padding: '10px 18px', background: '#E6EEF5', color: '#003865', border: '1px solid rgba(0,56,101,.2)',
    borderRadius: 8, fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.05em', cursor: 'pointer',
  },
  cancelOrderBtn: {
    padding: '10px 18px', background: 'rgba(208,0,111,.07)', color: '#D0006F',
    border: '1px solid rgba(208,0,111,.25)', borderRadius: 8,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.05em', cursor: 'pointer',
  },
  discardBtn: {
    padding: '10px 18px', background: '#F5F4F1', border: '1px solid #E8E5E0', borderRadius: 8,
    color: '#6B6B6B', fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 22px', background: '#003865', border: 'none', borderRadius: 8, color: '#fff',
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer',
  },
  lockedNote: { fontSize: 12, color: '#AEAEAE', fontStyle: 'italic' },
}

// ── Recent Orders Styles ──────────────────────────────────────────────────────
const ro = {
  card: {
    background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12,
    padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 14,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 10 },
  title: {
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600,
    color: '#003865', letterSpacing: '.06em', textTransform: 'uppercase',
    paddingLeft: 8, borderLeft: '3px solid #32BCAD',
  },
  filters: { display: 'flex', gap: 6 },
  filterBtn: {
    padding: '5px 13px', border: '1px solid #E8E5E0', borderRadius: 6,
    background: '#fff', fontFamily: "'Oswald', sans-serif",
    fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
    textTransform: 'uppercase', color: '#AEAEAE', cursor: 'pointer', transition: 'all .15s',
  },
  filterBtnOn: { background: '#003865', color: '#fff', borderColor: '#003865' },
  sub: { fontSize: 11, color: '#AEAEAE', marginBottom: 14, lineHeight: 1.5 },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '28px 0', flexDirection: 'column' },
  emptyText: { fontSize: 13, color: '#AEAEAE' },
  spinner: { width: 24, height: 24, border: '2px solid rgba(0,56,101,.12)', borderTopColor: '#003865', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  table: { display: 'flex', flexDirection: 'column', gap: 0 },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 110px 120px 110px',
    gap: 10, padding: '7px 12px',
    background: '#F5F4F1', borderRadius: 7,
    fontFamily: "'Oswald', sans-serif", fontSize: 9,
    fontWeight: 600, letterSpacing: '.1em',
    textTransform: 'uppercase', color: '#AEAEAE', marginBottom: 4,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 110px 120px 110px',
    gap: 10, padding: '11px 12px',
    borderBottom: '1px solid #F5F4F1', alignItems: 'start',
  },
  orderId: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: '#003865' },
  itemsList: { display: 'flex', flexDirection: 'column', gap: 3 },
  itemChip: { fontSize: 12, color: '#1A1A1A', lineHeight: 1.4 },
  date: { fontSize: 11, color: '#6B6B6B', paddingTop: 2 },
  statusPill: {
    display: 'inline-block', padding: '3px 9px', borderRadius: 5,
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '.05em', whiteSpace: 'nowrap',
  },
  detailsBtn: {
    padding: '4px 12px', background: '#003865', color: '#fff', border: 'none', borderRadius: 5,
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '.05em',
    cursor: 'pointer', touchAction: 'manipulation', transition: 'all .15s',
  },
  cancelBtn: {
    padding: '4px 12px', background: 'rgba(208,0,111,.08)', color: '#D0006F',
    border: '1px solid rgba(208,0,111,.2)', borderRadius: 5,
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '.05em',
    cursor: 'pointer', touchAction: 'manipulation', transition: 'all .15s',
  },
}

// ── Main styles ────────────────────────────────────────────────────────────────
const styles = {
  wrap: { display: 'flex', height: 'calc(100dvh - 80px)', overflow: 'hidden', background: '#F5F4F1' },
  phonePanel: { width: '45%', flexShrink: 0, background: '#002548', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: '3px 0 20px rgba(0,0,0,.22)' },
  phoneHeader: { background: 'linear-gradient(160deg, #001929 0%, #003865 100%)', padding: '10px 24px 12px', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 },
  phoneHeaderTop: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10 },
  phoneLogo: { fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '.1em' },
  cartBadge: { background: '#FF9E1B', color: '#002548', fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.06em', padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(255,158,27,.4)', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' },
  greetingTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 30, fontWeight: 700, color: '#fff', marginBottom: 4, letterSpacing: '.02em' },
  greetingSub: { fontSize: 14, color: 'rgba(255,255,255,.5)', lineHeight: 1.5 },
  cats: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', background: '#001e38', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 },
  cat: { padding: '13px 4px 12px', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', transition: 'all .15s', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', transition: 'color .15s', userSelect: 'none' },
  itemsList: { flex: 1, overflowY: 'auto', padding: '14px 18px', WebkitOverflowScrolling: 'touch' },
  itemCard: { background: 'rgba(255,255,255,.055)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'all .15s' },
  itemCardActive: { background: 'rgba(50,188,173,.1)', borderColor: 'rgba(50,188,173,.35)' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, color: '#fff', letterSpacing: '.02em', marginBottom: 4 },
  itemDesc: { fontSize: 13, color: 'rgba(255,255,255,.42)', lineHeight: 1.5 },
  sizeRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  sizeChip: { fontSize: 12, padding: '5px 12px', border: '1px solid rgba(255,255,255,.2)', borderRadius: 4, background: 'none', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontFamily: "'Oswald', sans-serif", letterSpacing: '.04em', transition: 'all .12s', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' },
  sizeChipActive: { background: '#32BCAD', borderColor: '#32BCAD', color: '#002548', fontWeight: 700 },
  noteField: { marginTop: 10, width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '8px 12px', color: 'rgba(255,255,255,.8)', fontSize: 13, fontFamily: "'Open Sans', sans-serif", resize: 'none', lineHeight: 1.5, transition: 'border-color .15s', WebkitAppearance: 'none' },
  addBtn: { padding: '9px 16px', background: '#32BCAD', color: '#002548', border: 'none', borderRadius: 6, fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer', flexShrink: 0, marginLeft: 10, marginTop: 2, transition: 'all .15s', whiteSpace: 'nowrap', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', boxShadow: '0 2px 8px rgba(50,188,173,.3)' },
  addBtnAdded: { background: '#78BE20', color: '#002548', boxShadow: '0 2px 8px rgba(120,190,32,.3)' },
  phoneFooter: { padding: '16px 18px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,.07)', background: '#001929', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' },
  checkoutBtn: { width: '100%', padding: '16px', background: '#FF9E1B', color: '#002548', border: 'none', borderRadius: 8, fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', boxShadow: '0 3px 12px rgba(255,158,27,.35)' },
  rightPanel: { flex: 1, padding: '14px 28px 28px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: '#F5F4F1' },
  setupBanner: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: '#FFF8E1', border: '1px solid rgba(255,158,27,.3)',
    borderRadius: 12, padding: '16px 18px', marginBottom: 16,
    borderLeft: '4px solid #FF9E1B',
  },
  setupBannerIcon: { fontSize: 22, flexShrink: 0 },
  setupBannerTitle: {
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600,
    color: '#003865', letterSpacing: '.02em', marginBottom: 3,
  },
  setupBannerSub: { fontSize: 12, color: '#6B6B6B', lineHeight: 1.4 },
  setupBannerBtn: {
    padding: '9px 16px', background: '#003865', color: '#fff',
    border: 'none', borderRadius: 8, fontFamily: "'Oswald', sans-serif",
    fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
  },
  topRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  infoCard: { background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12, padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  infoTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, color: '#003865', marginBottom: 14, letterSpacing: '.06em', textTransform: 'uppercase', paddingLeft: 8, borderLeft: '3px solid #32BCAD' },
  step: { display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepN: { width: 22, height: 22, borderRadius: '50%', background: '#003865', color: '#fff', fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, color: '#1A1A1A', marginBottom: 2 },
  stepDesc: { fontSize: 11, color: '#6B6B6B', lineHeight: 1.5 },
  taglineCard: { background: '#003865', borderRadius: 12, padding: '18px', boxShadow: '0 4px 16px rgba(0,56,101,.2)' },
  taglineText: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, color: '#32BCAD', lineHeight: 1.3, marginBottom: 10 },
  taglineDesc: { fontSize: 11, color: 'rgba(255,255,255,.58)', lineHeight: 1.6, marginBottom: 14 },
  pillars: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  pillar: { padding: '3px 9px', borderRadius: 3, fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' },
  aboutCard: { background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12, padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  aboutText: { fontSize: 13, color: '#6B6B6B', lineHeight: 1.7, marginBottom: 14 },
  tags: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  tag: { fontSize: 10, padding: '4px 11px', background: '#E6EEF5', color: '#003865', borderRadius: 4, fontFamily: "'Oswald', sans-serif", letterSpacing: '.07em', fontWeight: 500 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,20,45,.65)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))' },
  modalBox: { background: '#fff', borderRadius: 18, padding: '36px 32px', maxWidth: 560, width: '100%', maxHeight: '88dvh', overflowY: 'auto', borderTop: '4px solid #003865', boxShadow: '0 24px 64px rgba(0,0,0,.35)', WebkitOverflowScrolling: 'touch' },
  modalTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 600, color: '#003865', marginBottom: 8 },
  modalSectionLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 12, letterSpacing: '.1em', color: '#32BCAD', marginBottom: 14 },
  modalList: { listStyle: 'none', marginBottom: 16 },
  modalItem: { display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 16, color: '#003865', marginBottom: 10, fontFamily: "'Open Sans', sans-serif" },
  modalDot: { width: 7, height: 7, borderRadius: '50%', background: '#32BCAD', flexShrink: 0, marginTop: 5, display: 'block' },
  modalItemNote: { fontSize: 13, color: '#6B6B6B', marginTop: 3, fontStyle: 'italic' },
  modalNote: { fontSize: 14, color: '#AEAEAE', lineHeight: 1.6, marginBottom: 24, fontStyle: 'italic', padding: '12px 16px', background: '#F5F4F1', borderRadius: 7, borderLeft: '3px solid rgba(50,188,173,.4)' },
  modalBtns: { display: 'flex', gap: 10 },
  modalCancel: { flex: 1, padding: '14px', background: '#F5F4F1', border: '1px solid #DDD9D3', borderRadius: 8, fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: '.06em', color: '#6B6B6B', cursor: 'pointer', touchAction: 'manipulation' },
  modalConfirm: { flex: 1, padding: '14px', background: '#003865', border: 'none', borderRadius: 8, fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: '.06em', color: '#fff', cursor: 'pointer', transition: 'opacity .15s', touchAction: 'manipulation' },
}
