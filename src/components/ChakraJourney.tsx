import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { journeySteps, totalSteps } from '../data/chakras'
import { useTonePlayer } from '../audio/useTonePlayer'
import './ChakraJourney.css'

type JourneyMode = 'auto' | 'manual' | null

export function ChakraJourney() {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<JourneyMode>(null)
  const [elapsed, setElapsed] = useState(0)
  const [journeyComplete, setJourneyComplete] = useState(false)
  const timerRef = useRef<number | null>(null)

  const { playTone, stopTone, crossfadeTo, isPlaying } = useTonePlayer()

  const step = useMemo(() => journeySteps[currentIndex], [currentIndex])

  const goToStep = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= totalSteps) return
      setCurrentIndex(nextIndex)
      setElapsed(0)

      if (mode === 'auto') {
        crossfadeTo(journeySteps[nextIndex].frequencyHz)
      }
    },
    [mode, crossfadeTo],
  )

  const startJourney = (selectedMode: JourneyMode) => {
    setMode(selectedMode)
    setCurrentIndex(0)
    setElapsed(0)
    setJourneyComplete(false)

    if (selectedMode === 'auto') {
      playTone(journeySteps[0].frequencyHz)
    }
  }

  const exitJourney = useCallback(() => {
    stopTone()
    setMode(null)
    setCurrentIndex(0)
    setElapsed(0)
    setJourneyComplete(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [stopTone])

  // Auto-advance timer
  useEffect(() => {
    if (mode !== 'auto' || journeyComplete) return

    timerRef.current = window.setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1
        if (next >= step.durationSeconds) {
          if (currentIndex < totalSteps - 1) {
            goToStep(currentIndex + 1)
          } else {
            stopTone()
            setJourneyComplete(true)
          }
          return 0
        }
        return next
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [mode, currentIndex, step.durationSeconds, goToStep, stopTone, journeyComplete])

  const handlePlayPause = () => {
    if (isPlaying) {
      stopTone()
    } else {
      playTone(step.frequencyHz)
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = step.durationSeconds > 0 ? elapsed / step.durationSeconds : 0
  const directionLabel = step.direction === 'ascending' ? 'Ascending' : 'Descending'
  const directionSymbol = step.direction === 'ascending' ? '↑' : '↓'

  // Mode selection screen
  if (mode === null) {
    return (
      <div className="journey-select">
        <button
          type="button"
          className="journey-select__back"
          onClick={() => navigate('/')}
        >
          &larr; Home
        </button>
        <div className="journey-select__content">
          <h1 className="journey-select__title">Choose Your Path</h1>
          <p className="journey-select__desc">
            Auto mode plays each tone and advances every 4 minutes.<br />
            Manual mode lets you control the pace.
          </p>
          <div className="journey-select__buttons">
            <button
              type="button"
              className="journey-select__btn"
              onClick={() => startJourney('auto')}
            >
              <span className="journey-select__btn-icon">∞</span>
              <span className="journey-select__btn-label">Auto Journey</span>
              <span className="journey-select__btn-sub">~52 min guided experience</span>
            </button>
            <button
              type="button"
              className="journey-select__btn"
              onClick={() => startJourney('manual')}
            >
              <span className="journey-select__btn-icon">◈</span>
              <span className="journey-select__btn-label">Manual</span>
              <span className="journey-select__btn-sub">Move at your own pace</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Journey complete screen
  if (journeyComplete) {
    return (
      <div
        className="journey-complete"
        style={{ background: `radial-gradient(ellipse at center, #1a0a2a, #0a0a14)` }}
      >
        <div className="journey-complete__content">
          <div className="journey-complete__orb" />
          <h1>Journey Complete</h1>
          <p>
            You have traveled the full circle — ascending through the front of
            your body and descending down the back, tuning each energy center
            along the way.
          </p>
          <div className="journey-complete__actions">
            <button type="button" className="btn btn--primary" onClick={() => startJourney(mode)}>
              Begin Again
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
              Return Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="chakra-journey"
      style={{
        background: `radial-gradient(ellipse at top, ${step.gradientTo}44, ${step.gradientFrom})`,
        transition: 'background 1.2s ease',
      }}
    >
      <div className="chakra-journey__content">
        {/* Sidebar with all steps */}
        <aside className="chakra-journey__sidebar" aria-label="Journey progress">
          <div className="sidebar-header">
            <button type="button" className="sidebar-exit" onClick={exitJourney}>
              &larr; Exit
            </button>
            <span className="sidebar-mode">{mode === 'auto' ? 'Auto' : 'Manual'}</span>
          </div>
          <div className="chakra-list">
            {journeySteps.map((s, i) => {
              const isCurrent = i === currentIndex
              const isPast = i < currentIndex
              return (
                <button
                  key={s.id}
                  type="button"
                  className={[
                    'chakra-list__item',
                    isCurrent ? 'chakra-list__item--active' : '',
                    isPast ? 'chakra-list__item--done' : '',
                  ].join(' ').trim()}
                  onClick={() => {
                    if (mode === 'manual' || isCurrent) {
                      goToStep(i)
                      if (mode === 'manual' && isPlaying) {
                        playTone(journeySteps[i].frequencyHz)
                      }
                    }
                  }}
                  disabled={mode === 'auto' && !isCurrent}
                >
                  <span
                    className="chakra-list__dot"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  <span className="chakra-list__label">
                    {s.name}
                    <span className="chakra-list__note">{s.note}</span>
                  </span>
                  <span className="chakra-list__dir">
                    {s.direction === 'ascending' ? '↑' : '↓'}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Main content */}
        <main className="chakra-journey__main">
          <header className="chakra-header">
            <p className="chakra-header__eyebrow">
              Step {currentIndex + 1} of {totalSteps} &middot; {directionSymbol} {directionLabel} &middot; {step.sanskritName}
            </p>
            <h1 className="chakra-header__title">{step.name}</h1>
            <p className="chakra-header__location">{step.location}</p>
          </header>

          {/* Timer bar (auto mode) */}
          {mode === 'auto' && (
            <div className="chakra-timer">
              <div className="chakra-timer__bar">
                <div
                  className="chakra-timer__fill"
                  style={{
                    width: `${progress * 100}%`,
                    backgroundColor: step.color,
                    transition: 'width 1s linear',
                  }}
                />
              </div>
              <span className="chakra-timer__label">
                {formatTime(elapsed)} / {formatTime(step.durationSeconds)}
              </span>
            </div>
          )}

          <section className="chakra-layout">
            {/* Visual orb */}
            <div className="chakra-visual">
              <div className="chakra-visual__glow">
                <div
                  className="chakra-visual__core"
                  style={{
                    backgroundColor: step.color,
                    transition: 'background-color 1s ease',
                  }}
                />
              </div>

              {/* Vowel sound */}
              <div className="chakra-vowel">
                <span className="chakra-vowel__label">Sing</span>
                <span className="chakra-vowel__sound">{step.vowelSound}</span>
              </div>
            </div>

            {/* Info panel */}
            <div className="chakra-info">
              {/* Note + Frequency */}
              <div className="chakra-note">
                <span className="chakra-note__label">Note</span>
                <span className="chakra-note__value">{step.note}</span>
                <span className="chakra-note__frequency">
                  {Math.round(step.frequencyHz)} Hz
                </span>
              </div>

              <p className="chakra-description">{step.description}</p>

              {/* Affirmation */}
              <div className="chakra-affirmation">
                <span className="chakra-affirmation__label">Affirmation</span>
                <span className="chakra-affirmation__text">
                  "{step.affirmation}"
                </span>
              </div>

              {/* Essential Oils */}
              <div className="chakra-oils">
                <span className="chakra-oils__label">Essential Oils</span>
                <div className="chakra-oils__list">
                  {step.essentialOils.map((oil) => (
                    <span key={oil} className="chakra-oil-pill">{oil}</span>
                  ))}
                </div>
              </div>

              {/* Themes */}
              <div className="chakra-themes" aria-label="Chakra themes">
                {step.themes.map((theme) => (
                  <span key={theme} className="chakra-theme-pill">
                    {theme}
                  </span>
                ))}
              </div>

              {/* Controls */}
              <div className="chakra-controls">
                {mode === 'manual' && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handlePlayPause}
                    aria-pressed={isPlaying}
                  >
                    {isPlaying ? 'Pause Tone' : 'Play Tone'}
                  </button>
                )}

                {mode === 'auto' && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handlePlayPause}
                    aria-pressed={isPlaying}
                  >
                    {isPlaying ? 'Mute' : 'Unmute'}
                  </button>
                )}

                <div className="chakra-controls__nav">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      goToStep(currentIndex - 1)
                      if (mode === 'manual' && isPlaying) {
                        playTone(journeySteps[Math.max(0, currentIndex - 1)].frequencyHz)
                      }
                    }}
                    disabled={currentIndex === 0}
                  >
                    &larr; Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      if (currentIndex < totalSteps - 1) {
                        goToStep(currentIndex + 1)
                        if (mode === 'manual' && isPlaying) {
                          playTone(journeySteps[currentIndex + 1].frequencyHz)
                        }
                      } else {
                        stopTone()
                        setJourneyComplete(true)
                      }
                    }}
                  >
                    {currentIndex === totalSteps - 1 ? 'Complete' : 'Next'} &rarr;
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
