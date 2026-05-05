import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'default') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 2800)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 9999, pointerEvents: 'none'
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: '#003865',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 6,
            fontFamily: "'Oswald', sans-serif",
            fontSize: 13,
            letterSpacing: '.04em',
            borderLeft: `4px solid ${t.type === 'error' ? '#D0006F' : t.type === 'success' ? '#78BE20' : '#32BCAD'}`,
            animation: 'slideUp .25s ease',
            boxShadow: '0 4px 20px rgba(0,0,0,.3)',
            maxWidth: 320,
          }}>
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
