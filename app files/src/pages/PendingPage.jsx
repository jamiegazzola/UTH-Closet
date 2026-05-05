import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function PendingPage() {
  const { user } = useAuth()

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>⏳</div>
        <h1 style={styles.title}>Access Pending</h1>
        <p style={styles.text}>
          Your account has been created successfully. A Uth administrator
          will assign your role shortly. Check back soon!
        </p>
        <p style={styles.id}>
          Your account: <strong>{user?.email?.replace('@uthcloset.app', '') || user?.email}</strong>
        </p>
        <button
          style={styles.btn}
          onClick={() => signOut(auth)}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(160deg, #002548 0%, #003865 100%)',
    padding: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '48px 40px',
    maxWidth: 420,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 8px 40px rgba(0,0,0,.2)',
  },
  icon: {
    fontSize: 48,
    marginBottom: 20,
  },
  title: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 26,
    color: '#003865',
    marginBottom: 14,
    letterSpacing: '.03em',
  },
  text: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 1.7,
    marginBottom: 20,
  },
  id: {
    fontSize: 13,
    color: '#003865',
    background: '#E6EEF5',
    padding: '8px 16px',
    borderRadius: 6,
    marginBottom: 28,
  },
  btn: {
    padding: '11px 28px',
    background: '#003865',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
}
