import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'
import { useToast } from '../context/ToastContext'
import { SCHOOLS } from '../utils/catalog'

const toEmail = (id) => `${id.trim().toLowerCase()}@uthcloset.app`

export default function LoginPage() {
  const [mode, setMode]             = useState('login')
  const [idNumber, setIdNumber]     = useState('')
  const [password, setPassword]     = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [school, setSchool]         = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [loading, setLoading]       = useState(false)
  const [shake, setShake]           = useState(false)
  const [resetSent, setResetSent]   = useState(false)
  const [mounted, setMounted]       = useState(false)
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  function switchMode(next) {
    setShake(false); setResetSent(false)
    setIdNumber(''); setPassword(''); setConfirmPw('')
    setSchool(''); setResetEmail('')
    setMode(next)
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!idNumber.trim() || !password.trim()) {
      showToast('Please enter your ID and password', 'error')
      triggerShake(); return
    }
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, toEmail(idNumber), password)
      navigate('/')
    } catch (err) {
      const msg =
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
          ? 'Incorrect student ID or password'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts — try again later'
          : 'Something went wrong — try again'
      showToast(msg, 'error')
      triggerShake()
    }
    setLoading(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (!idNumber.trim() || !password.trim() || !confirmPw.trim()) {
      showToast('Please fill in all fields', 'error'); triggerShake(); return
    }
    if (password !== confirmPw) {
      showToast('Passwords do not match', 'error'); triggerShake(); return
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error'); triggerShake(); return
    }
    if (!school) {
      showToast('Please select your school', 'error'); triggerShake(); return
    }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, toEmail(idNumber), password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayId: idNumber.trim(),
        role:      'student',
        schoolId:  school,
        email:     toEmail(idNumber),
        createdAt: serverTimestamp(),
      })
      navigate('/')
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use'
          ? 'That student ID is already registered — try signing in'
          : err.code === 'auth/weak-password'
          ? 'Password must be at least 6 characters'
          : 'Something went wrong — try again'
      showToast(msg, 'error')
      triggerShake()
    }
    setLoading(false)
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!resetEmail.trim()) {
      showToast('Please enter your email address', 'error'); return
    }
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim())
      setResetSent(true)
    } catch (err) {
      const msg =
        err.code === 'auth/user-not-found' ? 'No account found with that email' :
        err.code === 'auth/invalid-email'  ? 'Please enter a valid email address' :
        'Could not send reset email — try again'
      showToast(msg, 'error')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (!snap.exists()) {
        await setDoc(doc(db, 'users', cred.user.uid), {
          displayId: cred.user.email,
          role:      'student',
          schoolId:  '',
          email:     cred.user.email,
          createdAt: serverTimestamp(),
        })
      }
      navigate('/')
    } catch {
      showToast('Google sign-in failed — try again', 'error')
    }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Open+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow-x: hidden; }

        @keyframes lp-slideLeft {
          from { opacity: 0; transform: translateX(-36px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes lp-slideRight {
          from { opacity: 0; transform: translateX(36px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes lp-fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-modeSlide {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-7px); }
          30%     { transform: translateX(7px); }
          45%     { transform: translateX(-5px); }
          60%     { transform: translateX(5px); }
          75%     { transform: translateX(-3px); }
          90%     { transform: translateX(3px); }
        }
        @keyframes lp-spin {
          to { transform: rotate(360deg); }
        }

        /* ── shell ── */
        .lp-shell {
          display: flex;
          min-height: 100dvh;
          font-family: 'Open Sans', sans-serif;
        }

        /* ════════════════════════════════
           LEFT — WHITE BRAND PANEL
        ════════════════════════════════ */
        .lp-brand {
          width: 60%;
          flex-shrink: 0;
          background: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 60px 64px;
          position: relative;
          border-right: 1px solid #EDEAE5;
          /* entrance */
          opacity: 0;
          transform: translateX(-36px);
          transition: opacity 0.8s cubic-bezier(0.22,1,0.36,1),
                      transform 0.8s cubic-bezier(0.22,1,0.36,1);
        }
        .lp-brand.lp-in { opacity: 1; transform: translateX(0); }

        /* logo */
        .lp-logo-wrap {
          margin-bottom: 44px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1) 0.2s,
                      transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.2s;
        }
        .lp-brand.lp-in .lp-logo-wrap { opacity: 1; transform: translateY(0); }
        .lp-logo {
          width: 220px;
          height: auto;
          display: block;
          margin: 0 auto;
        }

        /* tagline */
        .lp-tagline {
          margin-bottom: 24px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1) 0.32s,
                      transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.32s;
        }
        .lp-brand.lp-in .lp-tagline { opacity: 1; transform: translateY(0); }
        .lp-tagline-bold {
          font-family: 'Oswald', sans-serif;
          font-size: 44px;
          font-weight: 700;
          color: #32BCAD;
          line-height: 1.05;
          letter-spacing: -.01em;
          display: block;
        }
        .lp-tagline-light {
          font-family: 'Oswald', sans-serif;
          font-size: 44px;
          font-weight: 300;
          color: #003865;
          line-height: 1.05;
          letter-spacing: -.01em;
          display: block;
        }

        /* mission */
        .lp-mission {
          font-size: 15px;
          color: #9A9590;
          line-height: 1.7;
          max-width: 320px;
          margin: 0 auto;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1) 0.44s,
                      transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.44s;
        }
        .lp-brand.lp-in .lp-mission { opacity: 1; transform: translateY(0); }

        /* ════════════════════════════════
           RIGHT — FORM PANEL
        ════════════════════════════════ */
        .lp-right {
          flex: 1;
          background: #002548;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
          position: relative;
          /* entrance */
          opacity: 0;
          transform: translateX(36px);
          transition: opacity 0.8s cubic-bezier(0.22,1,0.36,1) 0.08s,
                      transform 0.8s cubic-bezier(0.22,1,0.36,1) 0.08s;
        }
        .lp-right.lp-in { opacity: 1; transform: translateX(0); }

        .lp-form-wrap {
          width: 100%;
          max-width: 480px;
        }

        /* form header stagger */
        .lp-form-header {
          margin-bottom: 36px;
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 0.6s cubic-bezier(0.22,1,0.36,1) 0.38s,
                      transform 0.6s cubic-bezier(0.22,1,0.36,1) 0.38s;
        }
        .lp-right.lp-in .lp-form-header { opacity: 1; transform: translateY(0); }

        .lp-form-title {
          font-family: 'Oswald', sans-serif;
          font-size: 46px;
          font-weight: 600;
          color: #ffffff;
          letter-spacing: .01em;
          line-height: 1;
          margin-bottom: 10px;
        }
        .lp-form-sub {
          font-size: 16px;
          color: rgba(255,255,255,0.55);
          line-height: 1.4;
        }

        /* form fields stagger */
        .lp-form-body {
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 0.6s cubic-bezier(0.22,1,0.36,1) 0.48s,
                      transform 0.6s cubic-bezier(0.22,1,0.36,1) 0.48s;
        }
        .lp-right.lp-in .lp-form-body { opacity: 1; transform: translateY(0); }

        .lp-mode-enter {
          animation: lp-modeSlide 0.3s cubic-bezier(0.22,1,0.36,1) both;
        }

        .lp-shake {
          animation: lp-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) both;
        }

        /* ── fields ── */
        .lp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }
        .lp-label {
          font-family: 'Oswald', sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.7);
        }
        .lp-input {
          padding: 15px 18px;
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          font-size: 16px;
          font-family: 'Open Sans', sans-serif;
          color: #111;
          background: #fff;
          outline: none;
          width: 100%;
          transition: border-color 0.2s, box-shadow 0.2s;
          appearance: none;
          -webkit-appearance: none;
          -webkit-box-shadow: 0 0 0px 1000px #fff inset;
        }
        .lp-input:focus {
          border-color: #32BCAD;
          box-shadow: 0 0 0 4px rgba(50,188,173,0.2);
          -webkit-box-shadow: 0 0 0px 1000px #fff inset, 0 0 0 4px rgba(50,188,173,0.2);
        }
        .lp-input::placeholder { color: #C5C2BB; }

        .lp-forgot-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 13px;
          font-family: 'Open Sans', sans-serif;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          text-align: right;
          align-self: flex-end;
          transition: color 0.15s;
          margin-top: 2px;
        }
        .lp-forgot-link:hover { color: #32BCAD; }

        /* ── primary button ── */
        .lp-btn-primary {
          width: 100%;
          padding: 16px 0;
          background: #4A5568;
          color: #fff;
          font-family: 'Oswald', sans-serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: .1em;
          text-transform: uppercase;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
        }
        .lp-btn-primary:hover:not(:disabled) {
          background: #5A6478;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .lp-btn-primary:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: none;
        }
        .lp-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

        .lp-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: lp-spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* ── divider ── */
        .lp-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 22px 0;
        }
        .lp-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.12); }
        .lp-divider-text { font-size: 12px; color: rgba(255,255,255,0.3); letter-spacing: .04em; }

        /* ── google button ── */
        .lp-btn-google {
          width: 100%;
          padding: 14px 0;
          background: rgba(255,255,255,0.07);
          color: #fff;
          font-family: 'Open Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          border: 1.5px solid rgba(255,255,255,0.15);
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 0.15s, border-color 0.15s, transform 0.12s, box-shadow 0.15s;
        }
        .lp-btn-google:hover:not(:disabled) {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.25);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }
        .lp-btn-google:active:not(:disabled) { transform: translateY(0); }
        .lp-btn-google:disabled { opacity: 0.55; cursor: not-allowed; }

        /* ── switch ── */
        .lp-switch {
          text-align: center;
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          margin-top: 22px;
        }
        .lp-switch-btn {
          background: none;
          border: none;
          padding: 0;
          color: #32BCAD;
          font-weight: 600;
          font-size: 14px;
          font-family: 'Open Sans', sans-serif;
          cursor: pointer;
          border-bottom: 1.5px solid rgba(50,188,173,0.3);
          transition: color 0.15s, border-color 0.15s;
        }
        .lp-switch-btn:hover { color: #52DCCD; border-color: rgba(50,188,173,0.6); }

        .lp-privacy {
          text-align: center;
          font-size: 12px;
          color: rgba(255,255,255,0.25);
          margin-top: 18px;
          line-height: 1.5;
        }

        /* ── success box ── */
        .lp-success-box {
          padding: 28px;
          background: rgba(50,188,173,0.1);
          border: 1.5px solid rgba(50,188,173,0.3);
          border-radius: 12px;
          text-align: center;
          animation: lp-modeSlide 0.35s cubic-bezier(0.22,1,0.36,1) both;
        }
        .lp-success-icon { font-size: 32px; margin-bottom: 14px; }
        .lp-success-box h3 {
          font-family: 'Oswald', sans-serif;
          font-size: 20px;
          color: #32BCAD;
          margin-bottom: 10px;
        }
        .lp-success-box p { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6; }

        /* ── responsive ── */
        @media (max-width: 860px) {
          .lp-shell { flex-direction: column; }
          .lp-brand {
            width: 100%;
            padding: 44px 32px 40px;
            border-right: none;
            border-bottom: 1px solid #EDEAE5;
            transform: translateY(-24px);
            transition: opacity 0.8s cubic-bezier(0.22,1,0.36,1),
                        transform 0.8s cubic-bezier(0.22,1,0.36,1);
          }
          .lp-brand.lp-in { opacity: 1; transform: translateY(0); }
          .lp-logo { width: 150px; }
          .lp-logo-wrap { margin-bottom: 28px; }
          .lp-tagline-bold, .lp-tagline-light { font-size: 32px; }
          .lp-right {
            transform: translateY(24px);
            transition: opacity 0.8s cubic-bezier(0.22,1,0.36,1) 0.08s,
                        transform 0.8s cubic-bezier(0.22,1,0.36,1) 0.08s;
          }
          .lp-right.lp-in { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="lp-shell">

        {/* ══════════════════
            LEFT — BRAND
        ══════════════════ */}
        <div className={`lp-brand${mounted ? ' lp-in' : ''}`}>

          <div>
            <div className="lp-logo-wrap">
              <img src="/uth-logo.png" alt="Uth Closet" className="lp-logo" />
            </div>
            <div className="lp-tagline">
              <span className="lp-tagline-bold">Take What You Need.</span>
              <span className="lp-tagline-light">Give What You Can.</span>
            </div>
            <p className="lp-mission">
              A private, stigma-free closet giving students
              access to clothing, food, hygiene, and supplies —
              no questions asked.
            </p>
          </div>

        </div>

        {/* ══════════════════
            RIGHT — FORM
        ══════════════════ */}
        <div className={`lp-right${mounted ? ' lp-in' : ''}`}>
          <div className="lp-form-wrap">

            <div className="lp-form-header">
              <div className="lp-form-title">
                {mode === 'login'  ? 'Welcome back'   :
                 mode === 'signup' ? 'Get started'    :
                                    'Reset password'}
              </div>
              <div className="lp-form-sub">
                {mode === 'login'  ? 'Sign in with your student ID number' :
                 mode === 'signup' ? 'Create your private account'         :
                                    "We'll send a reset link to your email"}
              </div>
            </div>

            <div className={`lp-form-body${shake ? ' lp-shake' : ''}`}>

              {/* ════ LOGIN ════ */}
              {mode === 'login' && (
                <div className="lp-mode-enter" key="login">
                  <form onSubmit={handleLogin} noValidate>
                    <div className="lp-field">
                      <label className="lp-label">Student ID Number</label>
                      <input className="lp-input" type="text" placeholder="e.g. 48291"
                        value={idNumber} onChange={e => setIdNumber(e.target.value)}
                        autoComplete="username" />
                    </div>
                    <div className="lp-field">
                      <label className="lp-label">Password</label>
                      <input className="lp-input" type="password" placeholder="••••••••"
                        value={password} onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password" />
                      <button type="button" className="lp-forgot-link"
                        onClick={() => switchMode('forgot')}>
                        Forgot password?
                      </button>
                    </div>
                    <button className="lp-btn-primary" type="submit" disabled={loading}>
                      {loading && <span className="lp-spinner" />}
                      {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                  </form>
                  <div className="lp-divider">
                    <div className="lp-divider-line" />
                    <span className="lp-divider-text">or</span>
                    <div className="lp-divider-line" />
                  </div>
                  <button className="lp-btn-google" onClick={handleGoogle} disabled={loading}>
                    <GoogleIcon /> Continue with Google
                  </button>
                  <div className="lp-switch">
                    Don't have an account?{' '}
                    <button className="lp-switch-btn" type="button"
                      onClick={() => switchMode('signup')}>Sign up</button>
                  </div>
                  <p className="lp-privacy">🔒 Your ID is never shown publicly. Orders are anonymous.</p>
                </div>
              )}

              {/* ════ SIGN UP ════ */}
              {mode === 'signup' && (
                <div className="lp-mode-enter" key="signup">
                  <form onSubmit={handleSignup} noValidate>
                    <div className="lp-field">
                      <label className="lp-label">Student ID Number</label>
                      <input className="lp-input" type="text" placeholder="e.g. 48291"
                        value={idNumber} onChange={e => setIdNumber(e.target.value)}
                        autoComplete="username" />
                    </div>
                    <div className="lp-field">
                      <label className="lp-label">Create Password</label>
                      <input className="lp-input" type="password" placeholder="At least 6 characters"
                        value={password} onChange={e => setPassword(e.target.value)}
                        autoComplete="new-password" />
                    </div>
                    <div className="lp-field">
                      <label className="lp-label">Confirm Password</label>
                      <input className="lp-input" type="password" placeholder="Repeat your password"
                        value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                        autoComplete="new-password" />
                    </div>
                    <div className="lp-field">
                      <label className="lp-label">Your School</label>
                      <select className="lp-input" value={school}
                        onChange={e => setSchool(e.target.value)}>
                        <option value="">Select your school…</option>
                        {SCHOOLS.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <button className="lp-btn-primary" type="submit" disabled={loading}>
                      {loading && <span className="lp-spinner" />}
                      {loading ? 'Creating account…' : 'Create Account'}
                    </button>
                  </form>
                  <div className="lp-divider">
                    <div className="lp-divider-line" />
                    <span className="lp-divider-text">or</span>
                    <div className="lp-divider-line" />
                  </div>
                  <button className="lp-btn-google" onClick={handleGoogle} disabled={loading}>
                    <GoogleIcon /> Continue with Google
                  </button>
                  <div className="lp-switch">
                    Already have an account?{' '}
                    <button className="lp-switch-btn" type="button"
                      onClick={() => switchMode('login')}>Sign in</button>
                  </div>
                  <p className="lp-privacy">🔒 Your ID is never shown publicly. Orders are anonymous.</p>
                </div>
              )}

              {/* ════ FORGOT ════ */}
              {mode === 'forgot' && (
                <div className="lp-mode-enter" key="forgot">
                  {resetSent ? (
                    <div className="lp-success-box">
                      <div className="lp-success-icon">✉️</div>
                      <h3>Check your inbox</h3>
                      <p>We sent a password reset link to your email. It may take a minute to arrive.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} noValidate>
                      <div className="lp-field">
                        <label className="lp-label">Email Address</label>
                        <input className="lp-input" type="email" placeholder="you@example.com"
                          value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                          autoComplete="email" />
                      </div>
                      <button className="lp-btn-primary" type="submit" disabled={loading}>
                        {loading && <span className="lp-spinner" />}
                        {loading ? 'Sending…' : 'Send Reset Link'}
                      </button>
                    </form>
                  )}
                  <div className="lp-switch" style={{ marginTop: 24 }}>
                    <button className="lp-switch-btn" type="button"
                      onClick={() => switchMode('login')}>← Back to sign in</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
