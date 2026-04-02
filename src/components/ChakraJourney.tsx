import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { journeySteps, totalSteps } from '../data/chakras'
import type { ChakraId } from '../data/chakras'
import { useTonePlayer } from '../audio/useTonePlayer'
import { useMusicPlayer } from '../audio/useMusicPlayer'
import { chakraSongs } from '../data/chakraSongs'
import { BodySilhouette } from './BodySilhouette'
import './ChakraJourney.css'

type JourneyMode = 'auto' | 'manual' | null
type AudioMode = 'tone' | 'music' | 'both'

export function ChakraJourney() {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<JourneyMode>(null)
  const [elapsed, setElapsed] = useState(0)
  const [journeyComplete, setJourneyComplete] = useState(false)
  const [audioMode, setAudioMode] = useState<AudioMode>('tone')
  const [showPlaylist, setShowPlaylist] = useState(false)
  const timerRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const prevChakraRef = useRef<ChakraId | null>(null)

  const { playTone, stopTone, crossfadeTo, isPlaying: toneIsPlaying } = useTonePlayer()
  const music = useMusicPlayer()

  const step = useMemo(() => journeySteps[currentIndex], [currentIndex])
  const songs = useMemo(() => chakraSongs[step.chakraId] ?? [], [step.chakraId])

  const wantsTone = audioMode === 'tone' || audioMode === 'both'
  const wantsMusic = audioMode === 'music' || audioMode === 'both'

  useEffect(() => {
    const prev = prevChakraRef.current
    prevChakraRef.current = step.chakraId

    if (prev !== null && prev !== step.chakraId) {
      music.stopSong()
      if (wantsMusic && songs.length > 0) {
        music.playSong(songs[0].file)
      }
    }
  }, [step.chakraId, songs, wantsMusic])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleAudioModeChange = (newMode: AudioMode) => {
    const oldWantsTone = audioMode === 'tone' || audioMode === 'both'
    const oldWantsMusic = audioMode === 'music' || audioMode === 'both'
    const newWantsTone = newMode === 'tone' || newMode === 'both'
    const newWantsMusic = newMode === 'music' || newMode === 'both'

    if (oldWantsTone && !newWantsTone) {
      stopTone()
    }
    if (!oldWantsTone && newWantsTone && mode) {
      void playTone(step.frequencyHz)
    }

    if (oldWantsMusic && !newWantsMusic) {
      music.stopSong()
    }
    if (!oldWantsMusic && newWantsMusic && mode) {
      if (music.currentSong) {
        music.resumeSong()
      } else if (songs.length > 0) {
        music.playSong(songs[0].file)
      }
    }

    setAudioMode(newMode)
  }

  const goToStep = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= totalSteps) return
      setCurrentIndex(nextIndex)
      setElapsed(0)

      if (mode === 'auto' && (audioMode === 'tone' || audioMode === 'both')) {
        void crossfadeTo(journeySteps[nextIndex].frequencyHz)
      }
    },
    [mode, audioMode, crossfadeTo],
  )

  const startJourney = (selectedMode: JourneyMode) => {
    setMode(selectedMode)
    setCurrentIndex(0)
    setElapsed(0)
    setJourneyComplete(false)
    prevChakraRef.current = journeySteps[0].chakraId

    if (selectedMode === 'auto' && wantsTone) {
      void playTone(journeySteps[0].frequencyHz)
    }
  }

  const exitJourney = useCallback(() => {
    stopTone()
    music.stopSong()
    setMode(null)
    setCurrentIndex(0)
    setElapsed(0)
    setJourneyComplete(false)
    setShowPlaylist(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [stopTone, music])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'auto' || journeyComplete) return

    elapsedRef.current = 0

    timerRef.current = window.setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)

      if (elapsedRef.current >= step.durationSeconds) {
        elapsedRef.current = 0
        if (currentIndex < totalSteps - 1) {
          goToStep(currentIndex + 1)
        } else {
          stopTone()
          music.stopSong()
          setJourneyComplete(true)
        }
      }
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [mode, currentIndex, step.durationSeconds, goToStep, stopTone, journeyComplete])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleToneToggle = () => {
    if (!wantsTone) return
    if (toneIsPlaying) {
      stopTone()
    } else {
      void playTone(step.frequencyHz)
    }
  }

  const handleSongSelect = (file: string) => {
    if (file === music.currentSong && music.isPlaying) {
      music.pauseSong()
    } else if (file === music.currentSong && !music.isPlaying) {
      music.resumeSong()
    } else {
      music.playSong(file)
    }
  }

  const handleNextSong = () => {
    if (songs.length === 0) return
    const currentIdx = songs.findIndex((song) => song.file === music.currentSong)
    const nextIdx = (currentIdx + 1) % songs.length
    music.playSong(songs[nextIdx].file)
  }

  const handleSeek = (event: MouseEvent<HTMLButtonElement>) => {
    if (music.duration <= 0) return

    const rect = event.currentTarget.getBoundingClientRect()
    const clickRatio = (event.clientX - rect.left) / rect.width
    music.seekTo(clickRatio * music.duration)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = step.durationSeconds > 0 ? elapsed / step.durationSeconds : 0
  const directionLabel = step.direction === 'ascending' ? 'Ascending' : 'Descending'
  const directionSymbol = step.direction === 'ascending' ? '↑' : '↓'

  const currentSongTitle = useMemo(() => {
    if (!music.currentSong) return null
    const found = songs.find((song) => song.file === music.currentSong)
    return found?.title ?? null
  }, [music.currentSong, songs])

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
        background: `
          radial-gradient(ellipse at 30% 20%, ${step.color}55 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, ${step.color}33 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, ${step.gradientFrom} 0%, #060608 100%)
        `,
        transition: 'background 1.5s ease',
      }}
    >
      <div className="chakra-journey__content">
        {/* Sidebar */}
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
                      if (mode === 'manual' && toneIsPlaying) {
                        void playTone(journeySteps[i].frequencyHz)
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
        <main
          className="chakra-journey__main"
          style={{
            background: `
              linear-gradient(
                145deg,
                ${step.gradientFrom}ee,
                ${step.color}18,
                ${step.gradientFrom}dd
              )
            `,
            borderColor: `${step.color}22`,
            transition: 'background 1.2s ease, border-color 1.2s ease',
          }}
        >
          <header className="chakra-header">
            <p className="chakra-header__eyebrow">
              Step {currentIndex + 1} of {totalSteps} &middot; {directionSymbol} {directionLabel} &middot; {step.sanskritName}
            </p>
            <h1 className="chakra-header__title">{step.name}</h1>
            <p className="chakra-header__location">{step.location}</p>
          </header>

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
            {/* Left column: orb + body */}
            <div className="chakra-visual">
              <div className="chakra-visual__glow" style={{ boxShadow: `0 0 40px ${step.color}40, 0 0 80px ${step.color}20` }}>
                <div
                  className="chakra-visual__core"
                  style={{
                    backgroundColor: step.color,
                    boxShadow: `0 0 30px ${step.color}cc, 0 0 70px ${step.color}66`,
                    transition: 'background-color 1s ease, box-shadow 1s ease',
                  }}
                />
              </div>

              <div className="chakra-vowel">
                <span className="chakra-vowel__label">Sing</span>
                <span className="chakra-vowel__sound">{step.vowelSound}</span>
              </div>

              <BodySilhouette activeChakraId={step.chakraId} activeColor={step.color} />
            </div>

            {/* Right column: info */}
            <div className="chakra-info">
              <div className="chakra-note">
                <span className="chakra-note__label">Note</span>
                <span className="chakra-note__value" style={{ color: step.colorLight }}>{step.note}</span>
                <span className="chakra-note__frequency">
                  {Math.round(step.frequencyHz)} Hz
                </span>
              </div>

              <p className="chakra-description">{step.description}</p>

              <div className="chakra-affirmation">
                <span className="chakra-affirmation__label">Affirmation</span>
                <span className="chakra-affirmation__text">
                  "{step.affirmation}"
                </span>
              </div>

              <div className="chakra-oils">
                <span className="chakra-oils__label">Essential Oils</span>
                <div className="chakra-oils__list">
                  {step.essentialOils.map((oil) => (
                    <span
                      key={oil}
                      className="chakra-oil-pill"
                      style={{ borderColor: `${step.color}33`, background: `${step.color}12` }}
                    >
                      {oil}
                    </span>
                  ))}
                </div>
              </div>

              <div className="chakra-themes" aria-label="Chakra themes">
                {step.themes.map((theme) => (
                  <span
                    key={theme}
                    className="chakra-theme-pill"
                    style={{ borderColor: `${step.color}22`, background: `${step.color}0a` }}
                  >
                    {theme}
                  </span>
                ))}
              </div>

              {/* Audio mode toggle */}
              <div className="audio-mode-toggle" role="radiogroup" aria-label="Audio mode">
                {(['tone', 'music', 'both'] as AudioMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={audioMode === m}
                    className={`audio-mode-toggle__btn ${audioMode === m ? 'audio-mode-toggle__btn--active' : ''}`}
                    style={audioMode === m ? { background: step.color, boxShadow: `0 4px 16px ${step.color}66` } : {}}
                    onClick={() => handleAudioModeChange(m)}
                  >
                    {m === 'tone' ? 'Tone Only' : m === 'music' ? 'Music Only' : 'Both'}
                  </button>
                ))}
              </div>

              {/* Tone control (when tone is active) */}
              {wantsTone && (
                <button
                  type="button"
                  className="btn btn--tone"
                  onClick={handleToneToggle}
                  aria-pressed={toneIsPlaying}
                  style={{
                    borderColor: `${step.color}44`,
                    color: step.color,
                  }}
                >
                  {toneIsPlaying ? 'Mute Tone' : 'Play Tone'}
                </button>
              )}

              {/* Music playlist toggle */}
              {wantsMusic && songs.length > 0 && (
                <button
                  type="button"
                  className="btn btn--playlist-toggle"
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  style={{ borderColor: `${step.color}33` }}
                >
                  {showPlaylist ? 'Hide Playlist' : `${step.name} Playlist (${songs.length} songs)`}
                </button>
              )}

              {/* Collapsible playlist */}
              {wantsMusic && showPlaylist && songs.length > 0 && (
                <div className="music-playlist" style={{ borderColor: `${step.color}22` }}>
                  <div className="music-playlist__header">
                    <span className="music-playlist__title">{step.name} Songs</span>
                  </div>
                  <div className="music-playlist__list">
                    {songs.map((song) => {
                      const isActive = music.currentSong === song.file
                      return (
                        <button
                          key={song.file}
                          type="button"
                          className={`music-playlist__item ${isActive ? 'music-playlist__item--active' : ''}`}
                          style={isActive ? { background: `${step.color}22`, borderColor: `${step.color}44` } : {}}
                          onClick={() => handleSongSelect(song.file)}
                        >
                          <span className="music-playlist__item-icon" style={isActive ? { color: step.color } : {}}>
                            {isActive && music.isPlaying ? '▮▮' : '▶'}
                          </span>
                          <span className="music-playlist__item-title">{song.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Now playing bar */}
              {wantsMusic && currentSongTitle && (
                <div className="now-playing" style={{ borderColor: `${step.color}33`, background: `${step.color}0c` }}>
                  <div className="now-playing__info">
                    <span className="now-playing__label">Now Playing</span>
                    <span className="now-playing__title">{currentSongTitle}</span>
                  </div>
                  <div className="now-playing__controls">
                    <button
                      type="button"
                      className="now-playing__btn"
                      style={{ color: step.color }}
                      onClick={() => music.isPlaying ? music.pauseSong() : music.resumeSong()}
                      aria-label={music.isPlaying ? 'Pause' : 'Play'}
                    >
                      {music.isPlaying ? '▮▮' : '▶'}
                    </button>
                    <button
                      type="button"
                      className="now-playing__btn"
                      style={{ color: step.color }}
                      onClick={handleNextSong}
                      aria-label="Next song"
                    >
                      ▶▶
                    </button>
                  </div>
                  <button
                    type="button"
                    className="now-playing__progress"
                    onClick={handleSeek}
                    aria-label="Seek within song"
                  >
                    <div
                      className="now-playing__progress-fill"
                      style={{
                        width: music.duration > 0 ? `${(music.progress / music.duration) * 100}%` : '0%',
                        backgroundColor: step.color,
                      }}
                    />
                  </button>
                  <div className="now-playing__time">
                    {formatTime(music.progress)} / {formatTime(music.duration)}
                  </div>
                </div>
              )}

              <div className="chakra-controls__nav">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    goToStep(currentIndex - 1)
                    if (mode === 'manual' && toneIsPlaying) {
                      void playTone(journeySteps[Math.max(0, currentIndex - 1)].frequencyHz)
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
                      if (mode === 'manual' && toneIsPlaying) {
                        void playTone(journeySteps[currentIndex + 1].frequencyHz)
                      }
                    } else {
                      stopTone()
                      music.stopSong()
                      setJourneyComplete(true)
                    }
                  }}
                >
                  {currentIndex === totalSteps - 1 ? 'Complete' : 'Next'} &rarr;
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
