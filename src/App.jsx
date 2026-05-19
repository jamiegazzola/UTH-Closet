import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import NavBar            from './components/NavBar'
import LoginPage         from './pages/LoginPage'
import StudentApp        from './pages/StudentApp'
import StaffDashboard    from './pages/StaffDashboard'
import AdminReports      from './pages/AdminReports'
import CorporatePartners from './pages/CorporatePartners'
import PendingPage       from './pages/PendingPage'

// Default tab per role — where each role lands when they first log in
const DEFAULT_TAB = {
  student:   'student',
  staff:     'staff',
  admin:     'admin',
  corporate: 'partners',
}

// Which tabs each role is allowed to visit
const ALLOWED_TABS = {
  student:   ['student'],
  staff:     ['staff'],
  admin:     ['student', 'staff', 'admin', 'partners'],
  corporate: ['partners'],
}

function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(160deg, #002548 0%, #003865 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <svg width="80" height="50" viewBox="0 0 80 50" fill="none">
        <circle cx="20" cy="10" r="8" fill="#32BCAD"/>
        <circle cx="42" cy="10" r="8" fill="#32BCAD" opacity=".65"/>
        <text x="0" y="46" fontFamily="sans-serif" fontSize="38"
              fontWeight="700" fill="white">uth</text>
      </svg>
      <div style={{
        width: 32, height: 32,
        border: '3px solid rgba(50,188,173,.3)',
        borderTopColor: '#32BCAD',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function App() {
  const { user, profile, authLoading } = useAuth()

  const role = profile?.role || 'student'
  const [activeTab, setActiveTab]               = useState(null)
  const [selectedSchoolId, setSelectedSchoolId] = useState(null)

  // ── Still loading ──────────────────────────────────────────────────────────
  if (authLoading) return <LoadingScreen />

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!user) return <LoginPage />

  // ── Profile not loaded yet ─────────────────────────────────────────────────
  if (!profile) return <LoadingScreen />

  // ── No role assigned yet ───────────────────────────────────────────────────
  if (!profile.role) return <PendingPage />

  // ── Resolve the current tab ───────────────────────────────────────────────
  // Use the saved tab if allowed for this role, otherwise fall back to default
  const allowed    = ALLOWED_TABS[role] || [DEFAULT_TAB[role]]
  const currentTab = activeTab && allowed.includes(activeTab)
    ? activeTab
    : DEFAULT_TAB[role]

  // Safe tab setter — silently ignores tabs this role can't access
  function handleSetTab(tab) {
    if (allowed.includes(tab)) setActiveTab(tab)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F5' }}>
      <NavBar
        activeTab={currentTab}
        setActiveTab={handleSetTab}
        selectedSchoolId={selectedSchoolId}
        setSelectedSchoolId={setSelectedSchoolId}
      />

      {currentTab === 'student'  && <StudentApp />}
      {currentTab === 'staff'    && <StaffDashboard selectedSchoolId={selectedSchoolId} />}
      {currentTab === 'admin'    && <AdminReports   selectedSchoolId={selectedSchoolId} />}
      {currentTab === 'partners' && <CorporatePartners />}
    </div>
  )
}
