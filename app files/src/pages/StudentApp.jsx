import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CATALOG, CATEGORIES, generateOrderId } from '../utils/catalog'

export default function StudentApp() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()

  const [activeCategory, setActiveCategory] = useState('snacks')
  const [cart, setCart] = useState({})      // { itemId: { item, size, qty } }
  const [sizes, setSizes] = useState({})    // { itemId: selectedSize }
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recentOrders] = useState([
    { id: '#7421', items: 'Hygiene kit · Granola bars ×2', status: 'Picked up' },
    { id: '#6803', items: 'Leggings (M) · Sweatshirt (S)', status: 'Ready' },
  ])

  const cartItems = Object.values(cart)
  const cartCount = cartItems.length

  function selectSize(itemId, size) {
    setSizes(prev => ({ ...prev, [itemId]: size }))
  }

  function toggleItem(item) {
    const key = item.id + (sizes[item.id] ? `-${sizes[item.id]}` : '')

    if (item.sizes && !sizes[item.id]) {
      // Flash error — no size selected
      showToast('Pick a size first!', 'error')
      return
    }

    setCart(prev => {
      if (prev[key]) {
        // Remove from cart
        const next = { ...prev }
        delete next[key]
        showToast(`${item.name} removed from your order`)
        return next
      } else {
        showToast(`${item.name} added to your order`, 'success')
        return {
          ...prev,
          [key]: { item, size: sizes[item.id] || null, qty: 1 }
        }
      }
    })
  }

  function isInCart(item) {
    const key = item.id + (sizes[item.id] ? `-${sizes[item.id]}` : '')
    return !!cart[key]
  }

  function openCheckout() {
    if (cartCount === 0) { showToast('Add some items first'); return }
    setShowModal(true)
  }

  async function submitOrder() {
    setSubmitting(true)
    try {
      const anonymousId = generateOrderId()
      await addDoc(collection(db, 'orders'), {
        anonymousId: `#${anonymousId}`,
        schoolId: profile?.schoolId || '',
        userId: user.uid,
        status: 'pending',
        items: cartItems.map(c => ({
          itemId: c.item.id,
          name: c.item.name,
          size: c.size || null,
          qty: c.qty,
        })),
        createdAt: serverTimestamp(),
        fulfilledAt: null,
      })
      setCart({})
      setSizes({})
      setShowModal(false)
      showToast('Order submitted! Your items will be ready soon.', 'success')
    } catch (e) {
      showToast('Failed to submit — try again', 'error')
    }
    setSubmitting(false)
  }

  const items = CATALOG[activeCategory] || []
  const activeCat = CATEGORIES.find(c => c.key === activeCategory)

  return (
    <div style={styles.wrap}>
      {/* LEFT — Phone Panel */}
      <div style={styles.phonePanel}>
        {/* Header */}
        <div style={styles.phoneHeader}>
          <div style={styles.phoneHeaderTop}>
            <span style={styles.phoneLogo}>UTH CLOSET</span>
            <button style={styles.cartBadge} onClick={openCheckout}>
              {cartCount} {cartCount === 1 ? 'ITEM' : 'ITEMS'}
            </button>
          </div>
          <div style={styles.greeting}>
            <div style={styles.greetingTitle}>Welcome back.</div>
            <div style={styles.greetingSub}>Browse and pre-order — private, no questions asked</div>
          </div>
        </div>

        {/* Category tabs */}
        <div style={styles.cats}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              style={{
                ...styles.cat,
                ...(activeCategory === cat.key ? { ...styles.catActive, borderBottomColor: cat.color } : {}),
              }}
              onClick={() => setActiveCategory(cat.key)}
            >
              <span style={styles.catEmoji}>{cat.emoji}</span>
              <span style={{
                ...styles.catLabel,
                ...(activeCategory === cat.key ? { color: cat.color } : {}),
              }}>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Items list */}
        <div style={styles.itemsList}>
          {items.map(item => {
            const inCart = isInCart(item)
            const selectedSize = sizes[item.id]
            return (
              <div key={item.id} style={{
                ...styles.itemCard,
                ...(inCart ? styles.itemCardActive : {}),
              }}>
                <div style={styles.itemInfo}>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemDesc}>{item.desc}</div>
                  {item.sizes && (
                    <div style={styles.sizeRow}>
                      {item.sizes.map(sz => (
                        <button
                          key={sz}
                          style={{
                            ...styles.sizeChip,
                            ...(selectedSize === sz ? styles.sizeChipActive : {}),
                          }}
                          onClick={() => selectSize(item.id, sz)}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  style={{
                    ...styles.addBtn,
                    ...(inCart ? styles.addBtnAdded : {}),
                  }}
                  onClick={() => toggleItem(item)}
                >
                  {inCart ? '✓ Added' : '+ Add'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={styles.phoneFooter}>
          <button style={styles.checkoutBtn} onClick={openCheckout}>
            VIEW MY ORDER {cartCount > 0 && `(${cartCount})`}
          </button>
        </div>
      </div>

      {/* RIGHT — Info Panel */}
      <div style={styles.rightPanel}>
        <div style={styles.infoGrid}>
          {/* How it works */}
          <div style={styles.infoCard}>
            <h3 style={styles.infoTitle}>How it works</h3>
            {[
              { n: 1, t: 'Browse', d: 'Choose items you need from any category.' },
              { n: 2, t: 'Pre-order', d: 'Submit privately — no one sees what you picked.' },
              { n: 3, t: 'Pick up', d: 'Collect from the Uth Closet — usually same day.' },
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

          {/* Recent orders */}
          <div style={styles.infoCard}>
            <h3 style={styles.infoTitle}>Your recent orders</h3>
            <p style={styles.infoSub}>Your history is private and only visible to you.</p>
            <div style={styles.ordersPlaceholder}>
              <span style={{ fontSize: 28 }}>📦</span>
              <p style={{ fontSize: 12, color: '#AEAEAE', marginTop: 8 }}>
                Orders you submit will appear here
              </p>
            </div>
          </div>

          {/* Tagline card */}
          <div style={styles.taglineCard}>
            <div style={styles.taglineText}>
              "Take What You Need.<br />Give What You Can."
            </div>
            <p style={styles.taglineDesc}>
              The Uth Closet exists because your community cares about you.
              Everything here is free, private, and here whenever you need it.
            </p>
            <div style={styles.pillars}>
              {[
                { label: 'Community', color: '#32BCAD', text: '#002548' },
                { label: 'Health',    color: '#D0006F', text: '#fff' },
                { label: 'Education', color: '#FF9E1B', text: '#002548' },
                { label: 'Food',      color: '#78BE20', text: '#002548' },
              ].map(p => (
                <span key={p.label} style={{ ...styles.pillar, background: p.color, color: p.text }}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* About card */}
        <div style={styles.aboutCard}>
          <h3 style={styles.infoTitle}>About the Uth Closet</h3>
          <p style={styles.aboutText}>
            Uth Inc. is a mission-driven nonprofit dedicated to ensuring every young person has access
            to the essentials that allow them to show up ready — to school, to life, to their full potential.
            Our closets operate on belonging, access, and equity. Prepared youth become empowered adults.
          </p>
          <div style={styles.tags}>
            {['Youth Equity','No Stigma','No Questions Asked','Potential Unlocked'].map(t => (
              <span key={t} style={styles.tag}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Order modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Submit your order?</h2>
            <p style={styles.modalSub}>YOUR ORDER:</p>
            <ul style={styles.modalList}>
              {cartItems.map((c, i) => (
                <li key={i} style={styles.modalItem}>
                  <span style={styles.modalDot}>•</span>
                  <strong>{c.item.name}</strong>{c.size ? ` (${c.size})` : ''}
                </li>
              ))}
            </ul>
            <p style={styles.modalNote}>
              Items will be prepared privately — usually ready same day. No questions asked.
            </p>
            <div style={styles.modalBtns}>
              <button style={styles.modalCancel} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                style={{ ...styles.modalConfirm, opacity: submitting ? .7 : 1 }}
                onClick={submitOrder}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: '360px 1fr',
    minHeight: 'calc(100vh - 60px)',
  },
  phonePanel: {
    background: '#002548',
    borderRight: '1px solid rgba(255,255,255,.07)',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 60,
    height: 'calc(100vh - 60px)',
    overflow: 'hidden',
  },
  phoneHeader: {
    background: '#003865',
    padding: '18px 20px 14px',
    flexShrink: 0,
    borderBottom: '3px solid #32BCAD',
  },
  phoneHeaderTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  phoneLogo: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '.12em',
  },
  cartBadge: {
    background: '#FF9E1B',
    color: '#002548',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 4,
    letterSpacing: '.06em',
    border: 'none',
    cursor: 'pointer',
    transition: 'all .15s',
  },
  greeting: {},
  greetingTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 20,
    fontWeight: 400,
    color: '#fff',
    marginBottom: 2,
  },
  greetingSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,.55)',
    fontFamily: "'Open Sans', sans-serif",
  },
  cats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    flexShrink: 0,
    borderBottom: '1px solid rgba(255,255,255,.07)',
  },
  cat: {
    padding: '10px 4px',
    textAlign: 'center',
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    borderRight: '1px solid rgba(255,255,255,.04)',
    transition: 'all .15s',
  },
  catActive: {
    background: 'rgba(50,188,173,.08)',
  },
  catEmoji: {
    display: 'block',
    fontSize: 17,
    marginBottom: 3,
  },
  catLabel: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 9,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.5)',
    display: 'block',
  },
  itemsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 12px',
  },
  itemCard: {
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 8,
    padding: '12px',
    marginBottom: 8,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    transition: 'border-color .15s',
  },
  itemCardActive: {
    borderColor: 'rgba(120,190,32,.4)',
    background: 'rgba(120,190,32,.05)',
  },
  itemInfo: { flex: 1 },
  itemName: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    color: '#fff',
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,.4)',
    marginBottom: 6,
  },
  sizeRow: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  sizeChip: {
    fontSize: 9,
    padding: '2px 7px',
    border: '1px solid rgba(255,255,255,.2)',
    borderRadius: 3,
    background: 'none',
    color: 'rgba(255,255,255,.55)',
    cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif",
    letterSpacing: '.04em',
    transition: 'all .12s',
  },
  sizeChipActive: {
    background: '#32BCAD',
    borderColor: '#32BCAD',
    color: '#002548',
  },
  addBtn: {
    padding: '6px 12px',
    background: '#32BCAD',
    color: '#002548',
    border: 'none',
    borderRadius: 4,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.05em',
    cursor: 'pointer',
    flexShrink: 0,
    marginLeft: 10,
    marginTop: 2,
    transition: 'all .15s',
    whiteSpace: 'nowrap',
  },
  addBtnAdded: {
    background: '#78BE20',
    color: '#002548',
  },
  phoneFooter: {
    padding: 12,
    flexShrink: 0,
    borderTop: '1px solid rgba(255,255,255,.07)',
  },
  checkoutBtn: {
    width: '100%',
    padding: '13px',
    background: '#FF9E1B',
    color: '#002548',
    border: 'none',
    borderRadius: 6,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all .15s',
  },
  rightPanel: {
    padding: '28px',
    overflowY: 'auto',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 16,
  },
  infoCard: {
    background: '#fff',
    border: '1px solid #DDD9D3',
    borderRadius: 12,
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,.05)',
  },
  infoTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 14,
    color: '#003865',
    marginBottom: 14,
    letterSpacing: '.04em',
  },
  infoSub: {
    fontSize: 11,
    color: '#AEAEAE',
    marginBottom: 12,
  },
  step: {
    display: 'flex',
    gap: 10,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepN: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#003865',
    color: '#fff',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 11,
    color: '#6B6B6B',
    lineHeight: 1.5,
  },
  ordersPlaceholder: {
    textAlign: 'center',
    padding: '20px 0',
  },
  taglineCard: {
    background: '#003865',
    borderRadius: 12,
    padding: '20px',
    boxShadow: '0 4px 16px rgba(0,56,101,.2)',
  },
  taglineText: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 17,
    fontWeight: 500,
    color: '#32BCAD',
    lineHeight: 1.3,
    marginBottom: 10,
  },
  taglineDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,.6)',
    lineHeight: 1.6,
    marginBottom: 14,
  },
  pillars: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  pillar: {
    padding: '3px 10px',
    borderRadius: 3,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
  },
  aboutCard: {
    background: '#fff',
    border: '1px solid #DDD9D3',
    borderRadius: 12,
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,.05)',
  },
  aboutText: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 1.7,
    marginBottom: 14,
  },
  tags: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: 10,
    padding: '4px 12px',
    background: '#E6EEF5',
    color: '#003865',
    borderRadius: 3,
    fontFamily: "'Oswald', sans-serif",
    letterSpacing: '.07em',
    fontWeight: 500,
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,30,60,.6)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    background: '#fff',
    borderRadius: 14,
    padding: '32px 28px',
    maxWidth: 420,
    width: '100%',
    borderTop: '4px solid #003865',
    boxShadow: '0 20px 60px rgba(0,0,0,.3)',
    animation: 'fadeIn .2s ease both',
  },
  modalTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 20,
    color: '#003865',
    marginBottom: 6,
  },
  modalSub: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    letterSpacing: '.1em',
    color: '#32BCAD',
    marginBottom: 10,
  },
  modalList: {
    listStyle: 'none',
    marginBottom: 16,
  },
  modalItem: {
    display: 'flex',
    gap: 8,
    fontSize: 14,
    color: '#003865',
    marginBottom: 6,
    fontFamily: "'Open Sans', sans-serif",
  },
  modalDot: {
    color: '#32BCAD',
    fontWeight: 700,
  },
  modalNote: {
    fontSize: 12,
    color: '#AEAEAE',
    lineHeight: 1.6,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  modalBtns: {
    display: 'flex',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    padding: '12px',
    background: '#F5F4F1',
    border: '1px solid #DDD9D3',
    borderRadius: 8,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '.06em',
    color: '#6B6B6B',
    cursor: 'pointer',
  },
  modalConfirm: {
    flex: 1,
    padding: '12px',
    background: '#003865',
    border: 'none',
    borderRadius: 8,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '.06em',
    color: '#fff',
    cursor: 'pointer',
  },
}
