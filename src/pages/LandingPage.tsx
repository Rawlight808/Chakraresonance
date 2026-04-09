import { useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import './LandingPage.css'

export function LandingPage() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      t += 0.003
      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2

      for (let i = 6; i >= 0; i--) {
        const phase = t + i * 0.4
        const radius = 120 + i * 70 + Math.sin(phase) * 30
        const alpha = 0.04 + Math.sin(phase * 0.5) * 0.02

        const hue = 260 + i * 15 + Math.sin(t * 0.5) * 10
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        gradient.addColorStop(0, `hsla(${hue}, 40%, 60%, ${alpha + 0.03})`)
        gradient.addColorStop(0.6, `hsla(${hue}, 35%, 45%, ${alpha})`)
        gradient.addColorStop(1, `hsla(${hue}, 30%, 30%, 0)`)

        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="landing">
      <canvas ref={canvasRef} className="landing__canvas" />

      <div className="landing__content">
        <div className="landing__orb" aria-hidden="true">
          <div className="landing__orb-inner" />
        </div>

        <h1 className="landing__title">Chakra Resonance</h1>
        <p className="landing__subtitle">
          Tune your body. Restore your balance.
        </p>

        <div className="landing__actions">
          <button
            type="button"
            className="landing__btn landing__btn--begin"
            onClick={() => navigate('/journey')}
          >
            Begin Chakra Tuning
          </button>
          <button
            type="button"
            className="landing__btn landing__btn--learn"
            onClick={() => navigate('/learn')}
          >
            Learn
          </button>
        </div>
      </div>
    </div>
  )
}
