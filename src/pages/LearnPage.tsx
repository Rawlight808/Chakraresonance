import { useNavigate } from 'react-router-dom'
import { ChakraVisualizer } from '../components/ChakraVisualizer'
import './LearnPage.css'

const chakraEndocrineMap = [
  { chakra: 'Root', gland: 'Adrenal Glands', color: '#E53935', role: 'Survival, fight-or-flight response, energy regulation' },
  { chakra: 'Sacral', gland: 'Gonads (Ovaries / Testes)', color: '#FB8C00', role: 'Creativity, emotions, reproductive health' },
  { chakra: 'Solar Plexus', gland: 'Pancreas', color: '#FBC02D', role: 'Digestion, personal power, metabolism' },
  { chakra: 'Heart', gland: 'Thymus', color: '#43A047', role: 'Immune system, love, compassion' },
  { chakra: 'Throat', gland: 'Thyroid & Parathyroid', color: '#1E88E5', role: 'Communication, metabolism, self-expression' },
  { chakra: 'Third Eye', gland: 'Pituitary Gland', color: '#5E35B1', role: 'Intuition, hormonal balance, inner vision' },
  { chakra: 'Crown', gland: 'Pineal Gland', color: '#AB47BC', role: 'Spiritual connection, sleep cycles, consciousness' },
]

export function LearnPage() {
  const navigate = useNavigate()

  return (
    <div className="learn">
      <nav className="learn__nav">
        <button
          type="button"
          className="learn__back"
          onClick={() => navigate('/')}
        >
          &larr; Back
        </button>
        <button
          type="button"
          className="learn__begin"
          onClick={() => navigate('/journey')}
        >
          Begin Tuning &rarr;
        </button>
      </nav>

      <div className="learn__content">
        <header className="learn__header">
          <h1>Understanding Your Chakras</h1>
          <p className="learn__intro">
            Your body is more than physical matter. Running along your spine are
            seven major energy centers — called <strong>chakras</strong> — that
            influence how you feel, think, and connect with the world around you.
          </p>
        </header>

        <section className="learn__visualizer">
          <ChakraVisualizer showScreensaverOption={false} />
        </section>

        {/* What are chakras */}
        <section className="learn__section">
          <h2>What Are Chakras?</h2>
          <p>
            The word "chakra" comes from Sanskrit and means "wheel" or "disc."
            Think of each chakra as a spinning wheel of energy located at a
            specific point along your spine — from the base all the way up to the
            top of your head.
          </p>
          <p>
            When these energy centers are open and balanced, energy flows freely
            through your body and you feel vibrant, grounded, and connected. When
            one or more chakras become blocked or out of balance, you might
            experience physical discomfort, emotional turbulence, or a sense of
            being "off."
          </p>
        </section>

        {/* Endocrine connection */}
        <section className="learn__section">
          <h2>Chakras &amp; Your Endocrine System</h2>
          <p>
            Each chakra aligns with a major gland in your endocrine system — the
            network of glands that produce hormones regulating everything from
            your mood to your metabolism. This isn't coincidence; these energy
            centers sit in the same locations as the glands that chemically
            govern your body.
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

        {/* Principle of resonance */}
        <section className="learn__section">
          <h2>The Principle of Resonance</h2>
          <p>
            Everything in the universe vibrates at a specific frequency —
            including your body's energy centers. When a chakra falls out of
            alignment, its natural frequency becomes disrupted.
          </p>
          <p>
            <strong>Resonance</strong> is the principle that one vibrating object
            can cause another to vibrate at the same frequency. When you expose a
            misaligned chakra to its correct frequency through sound, the chakra
            naturally begins to "tune" back to its balanced state — much like how
            a tuning fork can cause a nearby string to vibrate in harmony.
          </p>

          <div className="learn__methods">
            <div className="learn__method">
              <div className="learn__method-icon">♫</div>
              <h3>Sound</h3>
              <p>
                Each chakra responds to a specific musical note and frequency.
                Singing a vowel sound at the right pitch directly activates
                and balances the corresponding energy center.
              </p>
            </div>
            <div className="learn__method">
              <div className="learn__method-icon">◉</div>
              <h3>Visual</h3>
              <p>
                Colors carry frequency too. Each chakra has a color that
                resonates with its energy. Simply focusing on the right color
                supports the tuning process.
              </p>
            </div>
            <div className="learn__method">
              <div className="learn__method-icon">∿</div>
              <h3>Movement</h3>
              <p>
                Gentle movement, breath, and intention direct your body's
                energy toward the chakra being tuned, amplifying the effect
                of sound and color.
              </p>
            </div>
          </div>
        </section>

        {/* How tuning works */}
        <section className="learn__section">
          <h2>How Chakra Tuning Works</h2>
          <p>
            During a tuning session, you'll move through each of the seven
            chakras — starting at the root and ascending to the crown, then
            descending back down. This follows the natural energy pathways of
            the body: up the front and down the back.
          </p>
          <p>
            For each chakra, you'll hear its specific tone, see its color, and
            be guided with an affirmation and a vowel sound you can sing along
            with. The combination of listening, seeing, vocalizing, and
            breathing creates a powerful resonance that helps restore balance.
          </p>
          <p>
            Some chakras have two tones — one for the ascending (front) path
            and one for the descending (back) path — giving each energy center
            a complete, balanced tuning.
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
  )
}
