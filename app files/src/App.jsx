import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import LoginPage from './pages/LoginPage'
import StudentApp from './pages/StudentApp'
import StaffDashboard from './pages/StaffDashboard'
import AdminReports from './pages/AdminReports'
import NavBar from './components/NavBar'
import './styles/global.css'

function AppRoutes() {
  const { user, profile, loading } = useAuth()
  const [activeTab, setActiveTab] = useState(null)

  if (loading) return <LoadingScreen />

  if (!user) return (
    <Routes>
      <Route path="*" element={<LoginPage />} />
    </Routes>
  )

  // Safe role fallback — never crash on null
  const role = profile?.role || 'admin'

  const defaultTab = role === 'staff' ? 'staff' : role === 'student' ? 'student' : 'admin'
  const tab = activeTab || defaultTab

  function renderView() {
    if (tab === 'student') return <StudentApp />
    if (tab === 'staff')   return <StaffDashboard />
    if (tab === 'admin')   return <AdminReports />
    return <AdminReports />
  }

  return (
    <div>
      <NavBar activeTab={tab} setActiveTab={setActiveTab} />
      <main>
        {renderView()}
      </main>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #002548 0%, #003865 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    }}>
      <svg width="80" height="50" viewBox="0 0 80 50" fill="none">
        <circle cx="20" cy="10" r="8" fill="#32BCAD"/>
        <circle cx="42" cy="10" r="8" fill="#32BCAD" opacity=".65"/>
        <text x="0" y="46" fontFamily="Oswald,sans-serif" fontSize="38" fontWeight="700" fill="white" letterSpacing="-1">uth</text>
      </svg>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid rgba(50,188,173,.3)',
        borderTopColor: '#32BCAD',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
