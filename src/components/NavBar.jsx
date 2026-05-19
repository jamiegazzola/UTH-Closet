import { useState, useRef, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { SCHOOLS } from '../utils/catalog'
import ProfileModal from './ProfileModal'

export default function NavBar({ activeTab, setActiveTab, selectedSchoolId, setSelectedSchoolId }) {
  const { user, profile } = useAuth()
  const role = profile?.role || 'student'
  const profileSchool = SCHOOLS.find(s => s.id === profile?.schoolId)
  const roleLabel = profileSchool
    ? `${role} — ${profileSchool.name}`
    : role

  const [profileOpen, setProfileOpen] = useState(false)
  const [showModal, setShowModal]     = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayId = profile?.displayId || user?.email?.replace('@uthcloset.app', '') || '?'
  const displayLabel = displayId.toString().charAt(0).toUpperCase()

  // ── Role-filtered tabs ─────────────────────────────────────────────────────
  // Admin sees all tabs. Every other role sees only their own tab.
  const allTabs = [
    { key: 'student',   label: 'Student Closet',     roles: ['student', 'admin'] },
    { key: 'staff',     label: 'Staff Dashboard',    roles: ['staff',   'admin'] },
    { key: 'admin',     label: 'Admin Reports',      roles: ['admin']            },
    { key: 'partners',  label: 'Corporate Partners', roles: ['corporate', 'admin'] },
  ]
  const tabs = allTabs.filter(t => t.roles.includes(role))

  return (
    <>
      <nav style={s.nav}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <img
            src="/uth-logo.png"
            alt="Uth Closet"
            style={s.logo}
            onError={e => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
          <div style={{ ...s.logoFallback, display: 'none' }}>
            <UthLogoSVG />
          </div>
        </div>

        {/* Centre tabs — only the ones this role can see */}
        <div style={s.tabs}>
          {tabs.map(t => (
            <button
              key={t.key}
              style={{ ...s.tab, ...(activeTab === t.key ? s.tabActive : {}) }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {activeTab === t.key && <span style={s.tabUnderline} />}
            </button>
          ))}
        </div>

        {/* Right: school picker + profile */}
        <div style={s.right}>
          {activeTab !== 'student' && (
            <select
              style={s.schoolPicker}
              value={selectedSchoolId || ''}
              onChange={e => setSelectedSchoolId(e.target.value || null)}
            >
              <option value="">All Schools</option>
              {SCHOOLS.map(school => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          )}

          <div style={s.profileWrap} ref={dropdownRef}>
            <button
              style={{ ...s.profileBtn, ...(profileOpen ? s.profileBtnOpen : {}) }}
              onClick={() => setProfileOpen(v => !v)}
              aria-label="Profile menu"
            >
              <div style={s.avatar}>{displayLabel}</div>
              <div style={s.profileInfo}>
                <div style={s.profileId}>ID {displayId}</div>
                <div style={s.profileRole}>{roleLabel}</div>
              </div>
              <svg
                width="13" height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6B6B6B"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ transition: 'transform .2s', transform: profileOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {profileOpen && (
              <div style={s.dropdown}>
                <div style={s.dropdownHeader}>
                  <div style={s.dropAvatarLg}>{displayLabel}</div>
                  <div>
                    <div style={s.dropName}>ID: {displayId}</div>
                    <div style={s.dropRole}>{roleLabel}</div>
                  </div>
                </div>

                <div style={s.dropDivider} />

                <button
                  style={s.dropItem}
                  onClick={() => { setShowModal(true); setProfileOpen(false) }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Edit Profile
                </button>

                <div style={s.dropDivider} />

                <button
                  style={{ ...s.dropItem, color: '#D0006F' }}
                  onClick={() => signOut(auth)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {showModal && <ProfileModal onClose={() => setShowModal(false)} />}
    </>
  )
}

function UthLogoSVG() {
  return (
    <svg width="80" height="50" viewBox="0 0 68 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="4.5" r="4" fill="#32BCAD"/>
      <circle cx="24" cy="4.5" r="4" fill="#32BCAD" opacity="0.6"/>
      <path d="M5 13 L5 30 C5 35.5 8.5 38.5 14.5 38.5 C20.5 38.5 24 35.5 24 30 L24 13"
        stroke="#003865" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M24 27 Q30 27 34 27" stroke="#003865" strokeWidth="6.5" strokeLinecap="round" fill="none"/>
      <line x1="34" y1="9" x2="34" y2="39" stroke="#003865" strokeWidth="6.5" strokeLinecap="round"/>
      <line x1="28" y1="20" x2="40" y2="20" stroke="#003865" strokeWidth="6.5" strokeLinecap="round"/>
      <line x1="47" y1="9" x2="47" y2="39" stroke="#003865" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M47 25 C47 22 50 18 55 18 C60 18 63 21 63 26 L63 39"
        stroke="#003865" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

const s = {
  nav: {
    height: 80,
    background: '#ffffff',
    borderBottom: '1px solid #E8E5E0',
    boxShadow: '0 2px 12px rgba(0,0,0,.08)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 28px',
    gap: 20,
    position: 'sticky',
    top: 0,
    zIndex: 200,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  logo: {
    height: 60,
    width: 'auto',
    objectFit: 'contain',
    display: 'block',
  },
  logoFallback: { alignItems: 'center' },

  tabs: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tab: {
    position: 'relative',
    padding: '10px 24px',
    background: 'none',
    border: 'none',
    borderRadius: 10,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '.07em',
    textTransform: 'uppercase',
    color: '#AEAEAE',
    cursor: 'pointer',
    transition: 'color .15s, background .15s',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  },
  tabActive: {
    color: '#003865',
    background: '#F5F4F1',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 4, left: 24, right: 24,
    height: 2.5,
    background: '#32BCAD',
    borderRadius: 2,
    display: 'block',
  },

  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  schoolPicker: {
    padding: '9px 12px',
    border: '1.5px solid #E8E5E0',
    borderRadius: 9,
    fontSize: 13,
    fontFamily: "'Open Sans', sans-serif",
    color: '#003865',
    background: '#FAFAF9',
    cursor: 'pointer',
    maxWidth: 200,
  },

  profileWrap: { position: 'relative' },
  profileBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    background: '#F5F4F1',
    border: '1.5px solid #E8E5E0',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all .15s',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  },
  profileBtnOpen: {
    background: '#E6EEF5',
    borderColor: '#003865',
  },
  avatar: {
    width: 36, height: 36,
    borderRadius: 9,
    background: 'linear-gradient(135deg, #002548, #003865)',
    color: '#32BCAD',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  profileInfo: { textAlign: 'left', lineHeight: 1.2 },
  profileId: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 13, fontWeight: 600, color: '#003865', letterSpacing: '.03em',
  },
  profileRole: {
    fontSize: 11, color: '#AEAEAE', textTransform: 'capitalize',
    fontFamily: "'Open Sans', sans-serif", marginTop: 1,
  },

  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    width: 250,
    background: '#fff',
    border: '1px solid #E8E5E0',
    borderRadius: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,.14)',
    overflow: 'hidden',
    animation: 'slideUp .18s ease',
    zIndex: 500,
  },
  dropdownHeader: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '18px 18px 14px', background: '#F5F4F1',
  },
  dropAvatarLg: {
    width: 44, height: 44, borderRadius: 11,
    background: 'linear-gradient(135deg, #002548, #003865)',
    color: '#32BCAD', fontFamily: "'Oswald', sans-serif",
    fontSize: 20, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dropName: {
    fontFamily: "'Oswald', sans-serif", fontSize: 14,
    fontWeight: 600, color: '#003865', letterSpacing: '.02em',
  },
  dropRole: {
    fontSize: 11, color: '#AEAEAE', textTransform: 'capitalize',
    fontFamily: "'Open Sans', sans-serif", marginTop: 2,
  },
  dropDivider: { height: 1, background: '#F0EDE8' },
  dropItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '13px 18px', background: 'none', border: 'none',
    fontFamily: "'Open Sans', sans-serif", fontSize: 14, color: '#1A1A1A',
    cursor: 'pointer', transition: 'background .12s',
    touchAction: 'manipulation', textAlign: 'left',
  },
}
