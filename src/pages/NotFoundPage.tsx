import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Page Not Found | Chakra Resonance'
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #0a0a14, #12101f, #0d0f1a)',
        color: '#fdfdfd',
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 420 }}>
        <p style={{ fontSize: '4rem', fontWeight: 200, opacity: 0.3, margin: '0 0 0.5rem' }}>404</p>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 300, margin: '0 0 1rem', letterSpacing: '0.04em' }}>
          Page Not Found
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '0 0 2rem' }}>
          The page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you back on track.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            background: 'linear-gradient(135deg, rgba(192,132,252,0.85), rgba(139,92,246,0.9))',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '0.8rem 2rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Return Home
        </button>
      </div>
    </div>
  )
}
