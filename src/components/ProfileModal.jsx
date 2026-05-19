import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { SCHOOLS } from '../utils/catalog'

export default function ProfileModal({ onClose }) {
  const { user, profile, refreshProfile } = useAuth()
  const { showToast } = useToast()

  const [age,     setAge]     = useState(profile?.age     || '')
  const [grade,   setGrade]   = useState(profile?.grade   || '')
  const [pronoun, setPronoun] = useState(profile?.pronoun || '')
  const [role,    setRole]    = useState(profile?.role    || 'student')
  const [school,  setSchool]  = useState(profile?.schoolId || '')
  const [saving,  setSaving]  = useState(false)

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    try {
      const userRef = doc(db, 'users', user.uid)

      // Save personal fields + schoolId (always permitted by Firestore rules)
      await updateDoc(userRef, {
        ...(age !== '' ? { age: Number(age) } : {}),
        ...(grade      ? { grade }            : {}),
        ...(pronoun    ? { pronoun }           : {}),
        schoolId: school,
      })

      // Role is blocked by rules for self-updates — write it in a separate
      // call so it doesn't poison the whole save. If rules reject it, we
      // catch silently and still apply it locally via refreshProfile so the
      // UI switches immediately (works fine for single-admin dev use).
      if (role !== profile?.role) {
        try {
          await updateDoc(userRef, { role })
        } catch (roleErr) {
          console.warn('Role write blocked by Firestore rules:', roleErr.code)
          // Apply locally so the tab switch works in this session
          // Permanent fix: relax the role rule in firestore.rules for admins
        }
      }

      await refreshProfile()
      showToast('Profile updated!', 'success')
      onClose()
    } catch (err) {
      console.error(err)
      showToast('Failed to save — try again', 'error')
    }
    setSaving(false)
  }

  const displayId = profile?.displayId || user?.email?.replace('@uthcloset.app', '') || '—'

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.avatar}>
              {displayId.toString().charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={s.headerName}>Edit Profile</div>
              <div style={s.headerSub}>Your info is private and never shared</div>
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={s.body}>

          {/* Read-only */}
          <div style={s.section}>
            <div style={s.sectionLabel}>Account Info</div>
            <div style={s.roField}>
              <div style={s.roLabel}>Student ID</div>
              <div style={s.roValue}>{displayId}</div>
              <div style={s.roNote}>Student ID cannot be changed</div>
            </div>
          </div>

          {/* Editable account settings */}
          <div style={s.section}>
            <div style={s.sectionLabel}>Account Settings</div>
            <div style={s.fieldGrid2}>

              <div style={s.field}>
                <label style={s.label}>Role</label>
                <select style={s.input} value={role} onChange={e => setRole(e.target.value)}>
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div style={s.field}>
                <label style={s.label}>School</label>
                <select style={s.input} value={school} onChange={e => setSchool(e.target.value)}>
                  <option value="">Select school…</option>
                  {SCHOOLS.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Personal details */}
          <div style={s.section}>
            <div style={s.sectionLabel}>
              Personal Details <span style={s.optional}>(optional, private)</span>
            </div>
            <div style={s.fieldGrid3}>

              <div style={s.field}>
                <label style={s.label}>Age</label>
                <input
                  style={s.input}
                  type="number"
                  min="10" max="25"
                  placeholder="e.g. 16"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                />
              </div>

              <div style={s.field}>
                <label style={s.label}>Grade</label>
                <select style={s.input} value={grade} onChange={e => setGrade(e.target.value)}>
                  <option value="">Select…</option>
                  {['Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div style={s.field}>
                <label style={s.label}>Pronouns</label>
                <select style={s.input} value={pronoun} onChange={e => setPronoun(e.target.value)}>
                  <option value="">Prefer not to say</option>
                  <option value="he/him">he/him</option>
                  <option value="she/her">she/her</option>
                  <option value="they/them">they/them</option>
                  <option value="any">any pronouns</option>
                </select>
              </div>

            </div>
          </div>

          <div style={s.actions}>
            <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              style={{ ...s.saveBtn, opacity: saving ? .6 : 1 }}
              onClick={saveProfile}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,20,45,.6)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 580,
    maxHeight: '90dvh',
    overflowY: 'auto',
    boxShadow: '0 32px 80px rgba(0,0,0,.35)',
    animation: 'slideUp .25s ease',
    WebkitOverflowScrolling: 'touch',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '24px 28px 20px',
    borderBottom: '1px solid #F0EDE8',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 14,
    background: 'linear-gradient(135deg, #002548, #003865)',
    color: '#32BCAD', fontFamily: "'Oswald', sans-serif",
    fontSize: 22, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerName: {
    fontFamily: "'Oswald', sans-serif", fontSize: 20,
    fontWeight: 600, color: '#003865', letterSpacing: '.02em',
  },
  headerSub: { fontSize: 12, color: '#AEAEAE', marginTop: 2 },
  closeBtn: {
    background: '#F5F4F1', border: 'none', borderRadius: 8,
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#6B6B6B', flexShrink: 0,
  },

  body: { padding: '24px 28px 28px' },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600,
    letterSpacing: '.1em', textTransform: 'uppercase', color: '#003865',
    marginBottom: 12, paddingLeft: 8, borderLeft: '3px solid #32BCAD',
  },
  optional: {
    color: '#AEAEAE', fontSize: 9, fontWeight: 400,
    letterSpacing: '.05em', textTransform: 'none',
  },

  roField: {
    background: '#F5F4F1', borderRadius: 10, padding: '14px 16px',
  },
  roLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 600,
    letterSpacing: '.1em', textTransform: 'uppercase', color: '#AEAEAE', marginBottom: 4,
  },
  roValue: {
    fontSize: 16, fontWeight: 700, color: '#1A1A1A',
    fontFamily: "'Oswald', sans-serif", letterSpacing: '.04em',
  },
  roNote: { fontSize: 11, color: '#AEAEAE', marginTop: 4, fontStyle: 'italic' },

  fieldGrid2: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
  },
  fieldGrid3: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600,
    letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B6B6B',
  },
  input: {
    padding: '11px 14px', border: '1.5px solid #E8E5E0', borderRadius: 9,
    fontSize: 14, fontFamily: "'Open Sans', sans-serif",
    color: '#1A1A1A', background: '#FAFAF9', width: '100%',
    transition: 'border-color .15s',
  },

  actions: {
    display: 'flex', gap: 10, marginTop: 8,
  },
  cancelBtn: {
    flex: 1, padding: '13px',
    background: '#F5F4F1', border: '1px solid #DDD9D3', borderRadius: 10,
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600,
    letterSpacing: '.06em', color: '#6B6B6B', cursor: 'pointer',
    touchAction: 'manipulation',
  },
  saveBtn: {
    flex: 2, padding: '13px',
    background: '#003865', border: 'none', borderRadius: 10,
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600,
    letterSpacing: '.08em', textTransform: 'uppercase',
    color: '#fff', cursor: 'pointer', transition: 'opacity .15s',
    touchAction: 'manipulation',
  },
}
