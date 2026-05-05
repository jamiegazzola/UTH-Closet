import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'
import { useToast } from '../context/ToastContext'
import { SCHOOLS } from '../utils/catalog'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [idNumber, setIdNumber] = useState('')
  const [password, setPassword] = useState('')
  const [school, setSchool] = useState('')
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()
  const navigate = useNavigate()

  // We store users by ID number — format as fake email internally
  const toEmail = (id) => `${id.trim().toLowerCase()}@uthcloset.app`

  async function handleSubmit(e) {
    e.preventDefault()
    if (!idNumber.trim() || !password.trim()) {
      showToast('Please enter your ID and password', 'error'); return
    }
    if (mode === 'signup' && !school) {
      showToast('Please select your school', 'error'); return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, toEmail(idNumber), password)
        navigate('/')
      } else {
        const cred = await createUserWithEmailAndPassword(auth, toEmail(idNumber), password)
        await setDoc(doc(db, 'users', cred.user.uid), {
          displayId: idNumber.trim(),
          role: 'student', // default — admin promotes later
          schoolId: school,
          email: toEmail(idNumber),
          createdAt: serverTimestamp(),
        })
        navigate('/')
      }
    } catch (err) {
      const msg = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
        ? 'Incorrect ID or password'
        : err.code === 'auth/email-already-in-use'
        ? 'That ID is already registered — try logging in'
        : err.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters'
        : 'Something went wrong — try again'
      showToast(msg, 'error')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      // Check if user doc exists
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (!snap.exists()) {
        await setDoc(doc(db, 'users', cred.user.uid), {
          displayId: cred.user.email,
          role: 'student',
          schoolId: '',
          email: cred.user.email,
          createdAt: serverTimestamp(),
        })
      }
      navigate('/')
    } catch (err) {
      showToast('Google sign-in failed — try again', 'error')
    }
    setLoading(false)
  }

  return (
    <div style={styles.page}>
      {/* Left panel — brand */}
      <div style={styles.brand}>
        <div style={styles.brandInner}>
          <UthLogo />
          <div style={styles.tagline}>
            <span style={styles.taglineAccent}>Take What You Need.</span>
            <br />Give What You Can.
          </div>
          <div style={styles.pillars}>
            {['Community','Health','Education','Food'].map(p => (
              <span key={p} style={styles.pillar}>{p}</span>
            ))}
          </div>
        </div>
        <div style={styles.brandFooter}>
          Private. No questions asked. No stigma.
        </div>
      </div>

      {/* Right panel — form */}
      <div style={styles.formPanel}>
        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <h1 style={styles.formTitle}>
              {mode === 'login' ? 'Welcome back' : 'Get started'}
            </h1>
            <p style={styles.formSub}>
              {mode === 'login'
                ? 'Sign in with your student ID number'
                : 'Create your private account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Student ID Number</label>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g. 48291"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {mode === 'signup' && (
              <div style={styles.field}>
                <label style={styles.label}>Your School</label>
                <select
                  style={styles.input}
                  value={school}
                  onChange={e => setSchool(e.target.value)}
                >
                  <option value="">Select your school…</option>
                  {SCHOOLS.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              style={{ ...styles.btn, ...styles.btnPrimary, opacity: loading ? .7 : 1 }}
              disabled={loading}
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>or</span>
            <span style={styles.dividerLine} />
          </div>

          <button
            onClick={handleGoogle}
            style={{ ...styles.btn, ...styles.btnGoogle }}
            disabled={loading}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p style={styles.switchText}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              style={styles.switchLink}
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              type="button"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          <p style={styles.privacy}>
            🔒 Your ID is never displayed publicly. Orders are anonymous.
          </p>
        </div>
      </div>
    </div>
  )
}

function UthLogo() {
  return (
    <div style={{ marginBottom: 32 }}>
      <svg width="180" height="80" viewBox="0 0 180 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Stylized "uth" wordmark inspired by brand guide */}
        <circle cx="38" cy="14" r="9" fill="#32BCAD"/>
        <circle cx="62" cy="14" r="9" fill="#32BCAD" opacity=".7"/>
        <text x="8" y="72" fontFamily="Oswald, sans-serif" fontSize="58" fontWeight="700" fill="white" letterSpacing="-2">uth</text>
      </svg>
      <div style={{
        fontFamily: "'Oswald', sans-serif",
        fontSize: 11,
        letterSpacing: '.2em',
        color: 'rgba(255,255,255,.5)',
        textTransform: 'uppercase',
        marginTop: -4,
      }}>
        CLOSET
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 10, flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

const styles = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'Open Sans', sans-serif",
  },
  brand: {
    width: 440,
    flexShrink: 0,
    background: `linear-gradient(160deg, #002548 0%, #003865 50%, #004d8a 100%)`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '48px 48px 40px',
    position: 'relative',
    overflow: 'hidden',
  },
  brandInner: {
    position: 'relative',
    zIndex: 1,
  },
  tagline: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 32,
    fontWeight: 300,
    color: 'rgba(255,255,255,.9)',
    lineHeight: 1.3,
    marginBottom: 32,
    letterSpacing: '.01em',
  },
  taglineAccent: {
    color: '#32BCAD',
    fontWeight: 600,
  },
  pillars: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillar: {
    padding: '5px 14px',
    borderRadius: 3,
    background: 'rgba(255,255,255,.1)',
    border: '1px solid rgba(255,255,255,.15)',
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.7)',
  },
  brandFooter: {
    fontFamily: "'Open Sans', sans-serif",
    fontSize: 12,
    color: 'rgba(255,255,255,.35)',
    letterSpacing: '.03em',
  },
  formPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    background: '#F5F4F1',
  },
  formCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 40px 32px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 8px 40px rgba(0,0,0,.10)',
    border: '1px solid #E8E5E0',
    animation: 'fadeIn .4s ease both',
  },
  formHeader: {
    marginBottom: 28,
  },
  formTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 28,
    fontWeight: 600,
    color: '#003865',
    letterSpacing: '.02em',
    marginBottom: 6,
  },
  formSub: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: '#003865',
  },
  input: {
    padding: '11px 14px',
    border: '1.5px solid #DDD9D3',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'Open Sans', sans-serif",
    color: '#1A1A1A',
    background: '#FAFAF9',
    transition: 'border-color .15s',
    width: '100%',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '13px 20px',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    transition: 'all .15s',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
  },
  btnPrimary: {
    background: '#003865',
    color: '#fff',
    marginTop: 4,
  },
  btnGoogle: {
    background: '#fff',
    color: '#1A1A1A',
    border: '1.5px solid #DDD9D3',
    fontFamily: "'Open Sans', sans-serif",
    fontWeight: 500,
    fontSize: 14,
    letterSpacing: 'normal',
    textTransform: 'none',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '20px 0',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: '#E8E5E0',
  },
  dividerText: {
    fontSize: 12,
    color: '#AEAEAE',
    fontFamily: "'Open Sans', sans-serif",
  },
  switchText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 20,
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#003865',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: "'Open Sans', sans-serif",
    textDecoration: 'underline',
    padding: 0,
  },
  privacy: {
    textAlign: 'center',
    fontSize: 11,
    color: '#AEAEAE',
    marginTop: 16,
    lineHeight: 1.5,
  },
}
