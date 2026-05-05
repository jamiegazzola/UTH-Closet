import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { SCHOOLS } from '../utils/catalog'

export default function NavBar({ activeTab, setActiveTab }) {
  const { user, profile } = useAuth()
  const role = profile?.role
  const schoolName = SCHOOLS.find(s => s.id === profile?.schoolId)?.name || 'Uth Closet'
  const displayId = profile?.displayId || user?.email?.replace('@uthcloset.app','') || ''

  const tabs = []
  if (role === 'student') tabs.push({ key: 'student', label: 'My Closet' })
  if (role === 'staff')   tabs.push({ key: 'staff',   label: 'Staff Dashboard' })
  if (role === 'admin') {
    tabs.push({ key: 'admin', label: 'Admin Reports' })
    tabs.push({ key: 'staff', label: 'Staff View' })
  }

  return (
    <nav style={styles.nav}>
      {/* Logo */}
      <div style={styles.logo}>
        <LogoMark />
        <span style={styles.logoText}>UTH CLOSET</span>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div style={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t.key}
              style={{
                ...styles.tab,
                ...(activeTab === t.key ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Right side */}
      <div style={styles.right}>
        <div style={styles.schoolBadge}>
          <span style={styles.schoolName}>{schoolName}</span>
          {role && <span style={styles.roleBadge}>{role}</span>}
        </div>
        <div style={styles.idDisplay}>#{displayId}</div>
        <button style={styles.signOut} onClick={() => signOut(auth)} title="Sign out">
          ⎋
        </button>
      </div>
    </nav>
  )
}

function LogoMark() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="6" r="5" fill="#32BCAD"/>
      <circle cx="22" cy="6" r="5" fill="#32BCAD" opacity=".65"/>
      <text x="0" y="27" fontFamily="Oswald,sans-serif" fontSize="22" fontWeight="700" fill="white" letterSpacing="-1">uth</text>
    </svg>
  )
}

const styles = {
  nav: {
    background: '#003865',
    borderBottom: '3px solid #32BCAD',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    position: 'sticky',
    top: 0,
    zIndex: 200,
    gap: 24,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  logoText: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '.12em',
  },
  tabs: {
    display: 'flex',
    gap: 2,
    flex: 1,
  },
  tab: {
    padding: '8px 18px',
    background: 'none',
    border: 'none',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: '.07em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.5)',
    cursor: 'pointer',
    borderBottom: '3px solid transparent',
    marginBottom: -3,
    transition: 'all .15s',
  },
  tabActive: {
    color: '#32BCAD',
    borderBottomColor: '#32BCAD',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  schoolBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  schoolName: {
    fontSize: 11,
    color: 'rgba(255,255,255,.5)',
    fontFamily: "'Open Sans', sans-serif",
  },
  roleBadge: {
    fontSize: 9,
    fontFamily: "'Oswald', sans-serif",
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    padding: '2px 7px',
    borderRadius: 3,
    background: 'rgba(50,188,173,.2)',
    color: '#32BCAD',
    border: '1px solid rgba(50,188,173,.3)',
  },
  idDisplay: {
    fontSize: 11,
    fontFamily: "'Oswald', sans-serif",
    color: 'rgba(255,255,255,.3)',
    letterSpacing: '.05em',
  },
  signOut: {
    background: 'rgba(255,255,255,.08)',
    border: '1px solid rgba(255,255,255,.12)',
    color: 'rgba(255,255,255,.5)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all .15s',
  },
}
