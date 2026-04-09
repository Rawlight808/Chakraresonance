import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { ChakraVisualizer } from '../components/ChakraVisualizer'
import './LandingPage.css'

const chakraEndocrineMap = [
  { chakra: 'Root', gland: 'Adrenal Glands', color: '#E53935', role: 'Survival, fight-or-flight response, energy regulation' },
  { chakra: 'Sacral', gland: 'Gonads (Ovaries / Testes)', color: '#FF7043', role: 'Creativity, emotions, reproductive health' },
  { chakra: 'Solar Plexus', gland: 'Pancreas', color: '#FBC02D', role: 'Digestion, personal power, metabolism' },
  { chakra: 'Heart', gland: 'Thymus', color: '#43A047', role: 'Immune system, love, compassion' },
  { chakra: 'Throat', gland: 'Thyroid & Parathyroid', color: '#1E88E5', role: 'Communication, metabolism, self-expression' },
  { chakra: 'Third Eye', gland: 'Pituitary Gland', color: '#5E35B1', role: 'Intuition, hormonal balance, inner vision' },
  { chakra: 'Crown', gland: 'Pineal Gland', color: '#AB47BC', role: 'Spiritual connection, sleep cycles, consciousness' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    document.title = 'Chakra Resonance'
  }, [])

  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null
    if (state?.scrollTo === 'learn') {
      setTimeout(() => {
        document.getElementById('learn')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [location.state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let animId: number
    let t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    if (prefersReducedMotion) {
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const cy = h / 2

      for (let i = 6; i >= 0; i--) {
        const radius = 120 + i * 70
        const alpha = 0.04
        const hue = 260 + i * 15
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        gradient.addColorStop(0, `hsla(${hue}, 40%, 60%, ${alpha + 0.03})`)
        gradient.addColorStop(0.6, `hsla(${hue}, 35%, 45%, ${alpha})`)
        gradient.addColorStop(1, `hsla(${hue}, 30%, 30%, 0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      return () => {
        window.removeEventListener('resize', resize)
      }
    }

    let isVisible = true

    const handleVisibility = () => {
      isVisible = !document.hidden
      if (isVisible) {
        animId = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const draw = () => {
      if (!isVisible) return
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
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <div className="landing">
      <canvas ref={canvasRef} className="landing__canvas" />

      <div className="landing__hero">
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
            onClick={() => {
              document.getElementById('learn')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Learn
          </button>
        </div>
      </div>

      <div className="landing__learn" id="learn">
        <div className="learn__content">
          <header className="learn__header">
            <h2>Understanding Your Chakras</h2>
            <p className="learn__intro">
              Your body is more than physical matter. Running along your spine are
              seven major energy centers — called <strong>chakras</strong> — that
              influence how you feel, think, and connect with the world around you.
            </p>
          </header>

          <section className="learn__visualizer">
            <ChakraVisualizer showScreensaverOption={false} />
          </section>

          <section className="learn__section">
            <h3>What Are Chakras?</h3>
            <p>
              The word &ldquo;chakra&rdquo; comes from Sanskrit and means &ldquo;wheel&rdquo; or &ldquo;disc.&rdquo;
              Think of each chakra as a spinning wheel of energy located at a
              specific point along your spine — from the base all the way up to the
              top of your head.
            </p>
            <p>
              When these energy centers are open and balanced, energy flows freely
              through your body and you feel vibrant, grounded, and connected. When
              one or more chakras become blocked or out of balance, you might
              experience physical discomfort, emotional turbulence, or a sense of
              being &ldquo;off.&rdquo;
            </p>
          </section>

          <section className="learn__section">
            <h3>Chakras &amp; Your Endocrine System</h3>
            <p>
              Each chakra aligns with a major gland in your endocrine system — the
              network of glands that produce hormones regulating everything from
              your mood to your metabolism.
            </p>

            <div className="learn__map">
              {chakraEndocrineMap.map((item) => (
                <div key={item.chakra} className="learn__map-row">
                  <span
                    className="learn__map-dot"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <div className="learn__map-info">
                    <span className="learn__map-chakra">{item.chakra}</span>
                    <span className="learn__map-gland">{item.gland}</span>
                    <span className="learn__map-role">{item.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="learn__section">
            <h3>The Principle of Resonance</h3>
            <p>
              Everything in the universe vibrates at a specific frequency —
              including your body&apos;s energy centers. When a chakra falls out of
              alignment, its natural frequency becomes disrupted.
            </p>
            <p>
              <strong>Resonance</strong> is the principle that one vibrating object
              can cause another to vibrate at the same frequency. When you expose a
              misaligned chakra to its correct frequency through sound, the chakra
              naturally begins to &ldquo;tune&rdquo; back to its balanced state — much like how
              a tuning fork can cause a nearby string to vibrate in harmony.
            </p>

            <div className="learn__methods">
              <div className="learn__method">
                <div className="learn__method-icon" aria-hidden="true">♫</div>
                <h4>Sound</h4>
                <p>
                  Each chakra responds to a specific musical note and frequency.
                  Singing a vowel sound at the right pitch directly activates
                  and balances the corresponding energy center.
                </p>
              </div>
              <div className="learn__method">
                <div className="learn__method-icon" aria-hidden="true">◉</div>
                <h4>Visual</h4>
                <p>
                  Colors carry frequency too. Each chakra has a color that
                  resonates with its energy. Simply focusing on the right color
                  supports the tuning process.
                </p>
              </div>
              <div className="learn__method">
                <div className="learn__method-icon" aria-hidden="true">∿</div>
                <h4>Movement</h4>
                <p>
                  Gentle movement, breath, and intention direct your body&apos;s
                  energy toward the chakra being tuned, amplifying the effect
                  of sound and color.
                </p>
              </div>
            </div>
          </section>

          <section className="learn__section">
            <h3>How Chakra Tuning Works</h3>
            <p>
              During a tuning session, you&apos;ll move through each of the seven
              chakras — starting at the root and ascending to the crown, then
              descending back down. This follows the natural energy pathways of
              the body: up the front and down the back.
            </p>
            <p>
              For each chakra, you&apos;ll hear its specific tone, see its color, and
              be guided with an affirmation and a vowel sound you can sing along
              with. The combination of listening, seeing, vocalizing, and
              breathing creates a powerful resonance that helps restore balance.
            </p>
          </section>

          <div className="learn__cta">
            <p>Ready to experience it for yourself?</p>
            <button
              type="button"
              className="learn__cta-btn"
              onClick={() => navigate('/journey')}
            >
              Begin Chakra Tuning
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
