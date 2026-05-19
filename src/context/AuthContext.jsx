/**
 * context/AuthContext.jsx
 *
 * Provides:
 *   user        — raw Firebase Auth user (or null)
 *   profile     — Firestore /users/{uid} document data (or null)
 *   authLoading — true until Firebase has resolved the initial auth state
 *
 * Usage:
 *   const { user, profile, authLoading } = useAuth()
 *   profile.role      → 'student' | 'staff' | 'admin' | 'corporate' | undefined
 *   profile.schoolId  → school ID string (null for admin/corporate)
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot }   from 'firebase/firestore'
import { auth, db }          from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [profile, setProfile]         = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    let profileUnsub = null

    // onAuthStateChanged fires once immediately with the current auth state,
    // then again whenever the user signs in or out.
    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      // Cancel any previous Firestore profile listener
      if (profileUnsub) { profileUnsub(); profileUnsub = null }

      if (!firebaseUser) {
        // Signed out — clear everything
        setUser(null)
        setProfile(null)
        setAuthLoading(false)
        return
      }

      // Signed in — set the auth user immediately
      setUser(firebaseUser)

      // Then subscribe to their Firestore profile in real time.
      // This means if an admin changes their role, the UI updates
      // instantly without requiring a page refresh.
      profileUnsub = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() })
          } else {
            // User has a Firebase Auth account but no Firestore doc yet.
            // This happens briefly after Google sign-in before the doc is written,
            // or if the doc creation failed. Show loading until it appears.
            setProfile(null)
          }
          setAuthLoading(false)
        },
        (err) => {
          console.error('[AuthContext] profile listen error:', err.code, err.message)
          // On error, stop loading so the user isn't stuck on a spinner.
          // App.jsx will show PendingPage or LoginPage depending on auth state.
          setProfile(null)
          setAuthLoading(false)
        }
      )
    })

    // Cleanup both listeners when the component unmounts
    return () => {
      authUnsub()
      if (profileUnsub) profileUnsub()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, authLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
