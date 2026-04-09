import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { journeySteps, totalSteps } from '../data/chakras'
import type { ChakraId } from '../data/chakras'
import { useTonePlayer } from '../audio/useTonePlayer'
import { useMusicPlayer } from '../audio/useMusicPlayer'
import { chakraSongs } from '../data/chakraSongs'
import type { ChakraSong } from '../data/chakraSongs'
import { chakraScreensavers } from '../data/chakraScreensavers'
import { BodySilhouette } from './BodySilhouette'
import './ChakraJourney.css'

type JourneyMode = 'auto' | 'manual' | null
type AudioMode = 'tone' | 'music' | 'both'

function shuffleSongs(songs: ChakraSong[]) {
  const nextSongs = [...songs]

  for (let index = nextSongs.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[nextSongs[index], nextSongs[swapIndex]] = [nextSongs[swapIndex], nextSongs[index]]
  }

  return nextSongs
}

export function ChakraJourney() {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<JourneyMode>(null)
  const [elapsed, setElapsed] = useState(0)
  const [journeyComplete, setJourneyComplete] = useState(false)
  const [audioMode, setAudioMode] = useState<AudioMode>('both')
  const [showPlaylist, setShowPlaylist] = useState(true)
  const [isScreensaverOpen, setIsScreensaverOpen] = useState(false)
  const [isScreensaverHintVisible, setIsScreensaverHintVisible] = useState(false)
  const timerRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const prevStepRef = useRef<string | null>(null)
  const autoSongQueueRef = useRef<Record<string, ChakraSong[]>>({})
  const autoSongIndexRef = useRef<Record<string, number>>({})
  const handleSongEndRef = useRef<() => void>(() => {})
  const manualSongIndexRef = useRef<Record<string, number>>({})

  const {
    playTone,
    stopTone,
    crossfadeTo,
    setVolume: setToneVolume,
    isPlaying: toneIsPlaying,
    volume: toneVolume,
  } = useTonePlayer()
  const {
    playSong,
    pauseSong,
    resumeSong,
    seekTo,
    stopSong,
    setVolume: setMusicVolume,
    isPlaying: musicIsPlaying,
    isLoading: musicIsLoading,
    error: musicError,
    currentSong,
    progress: musicProgress,
    duration: musicDuration,
    volume: musicVolume,
  } = useMusicPlayer()

  const step = useMemo(() => journeySteps[currentIndex], [currentIndex])
  const songs = useMemo(
    () => (chakraSongs[step.chakraId] ?? []).filter((song) => song.note === step.note),
    [step.chakraId, step.note],
  )
  const screensaverSrc = chakraScreensavers[step.chakraId]

  const wantsTone = audioMode === 'tone' || audioMode === 'both'
  const wantsMusic = audioMode === 'music' || audioMode === 'both'
  const hasSongs = songs.length > 0

  const getNextAutoSong = useCallback((chakraId: ChakraId, note: string) => {
    const availableSongs = (chakraSongs[chakraId] ?? []).filter((song) => song.note === note)
    if (availableSongs.length === 0) return null

    const queueKey = `${chakraId}:${note}`

    let queue = autoSongQueueRef.current[queueKey] ?? []
    let index = autoSongIndexRef.current[queueKey] ?? 0

    if (queue.length !== availableSongs.length || index >= queue.length) {
      queue = shuffleSongs(availableSongs)
      autoSongQueueRef.current[queueKey] = queue
      index = 0
    }

    const selectedSong = queue[index] ?? null
    autoSongIndexRef.current[queueKey] = index + 1
    return selectedSong
  }, [])

  const handleAudioModeChange = useCallback((newMode: AudioMode) => {
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
      stopSong()
    }
    if (!oldWantsMusic && newWantsMusic && mode) {
      if (currentSong) {
        resumeSong()
      } else {
        const selectedSong = mode === 'auto'
          ? getNextAutoSong(step.chakraId, step.note)
          : (songs[0] ?? null)

        if (selectedSong) {
          playSong(
            selectedSong.file,
            { onEnded: handleSongEndRef.current },
          )
        }
      }
    }

    setAudioMode(newMode)
  }, [
    audioMode,
    currentSong,
    getNextAutoSong,
    mode,
    playSong,
    playTone,
    resumeSong,
    songs,
    step.chakraId,
    step.frequencyHz,
    step.note,
    stopSong,
    stopTone,
  ])

  const goToStep = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= totalSteps) return
      setCurrentIndex(nextIndex)
      setElapsed(0)

      const wantsToneNow = audioMode === 'tone' || audioMode === 'both'
      if (wantsToneNow && toneIsPlaying) {
        void crossfadeTo(journeySteps[nextIndex].frequencyHz)
      } else if (wantsToneNow && mode === 'auto') {
        void crossfadeTo(journeySteps[nextIndex].frequencyHz)
      }
    },
    [mode, audioMode, crossfadeTo, toneIsPlaying],
  )

  const handleAutoSongEnd = useCallback(() => {
    if (currentIndex < totalSteps - 1) {
      goToStep(currentIndex + 1)
      return
    }

    stopTone()
    stopSong()
    setJourneyComplete(true)
  }, [currentIndex, goToStep, stopSong, stopTone])

  const handleManualSongEnd = useCallback(() => {
    const queueKey = `${step.chakraId}:${step.note}`
    const currentManualIdx = manualSongIndexRef.current[queueKey] ?? 0
    const nextManualIdx = currentManualIdx + 1

    if (nextManualIdx < songs.length) {
      manualSongIndexRef.current[queueKey] = nextManualIdx
      playSong(songs[nextManualIdx].file, { onEnded: handleSongEndRef.current })
    } else {
      manualSongIndexRef.current[queueKey] = 0
      if (currentIndex < totalSteps - 1) {
        goToStep(currentIndex + 1)
      } else {
        stopTone()
        stopSong()
        setJourneyComplete(true)
      }
    }
  }, [currentIndex, goToStep, playSong, songs, step.chakraId, step.note, stopSong, stopTone])

  useEffect(() => {
    handleSongEndRef.current = mode === 'auto' ? handleAutoSongEnd : handleManualSongEnd
  }, [mode, handleAutoSongEnd, handleManualSongEnd])

  useEffect(() => {
    const prev = prevStepRef.current
    prevStepRef.current = step.id

    const isStepChanged = prev !== null && prev !== step.id
    const isFirstAutoStep = mode === 'auto' && currentIndex === 0 && prev === step.id

    if (isStepChanged || isFirstAutoStep) {
      stopSong()
      manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = 0

      if (!wantsMusic) return

      const selectedSong = mode === 'auto'
        ? getNextAutoSong(step.chakraId, step.note)
        : (songs[0] ?? null)

      if (selectedSong) {
        if (mode === 'manual') {
          const songIdx = songs.findIndex((s) => s.file === selectedSong.file)
          manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = songIdx >= 0 ? songIdx : 0
        }
        playSong(
          selectedSong.file,
          { onEnded: handleSongEndRef.current },
        )
      }
    }
  }, [
    currentIndex,
    getNextAutoSong,
    handleAutoSongEnd,
    handleManualSongEnd,
    mode,
    playSong,
    songs,
    step.chakraId,
    step.id,
    step.note,
    stopSong,
    wantsMusic,
  ])

  const startJourney = (selectedMode: JourneyMode) => {
    if (selectedMode === 'auto') {
      autoSongQueueRef.current = {}
      autoSongIndexRef.current = {}
      setAudioMode('both')
    }

    manualSongIndexRef.current = {}
    setMode(selectedMode)
    setCurrentIndex(0)
    setElapsed(0)
    setJourneyComplete(false)
    setShowPlaylist(true)
    prevStepRef.current = journeySteps[0].id
    setIsScreensaverOpen(false)
    setIsScreensaverHintVisible(false)

    if (selectedMode === 'auto') {
      void playTone(journeySteps[0].frequencyHz)
    }
  }

  const exitJourney = useCallback(() => {
    stopTone()
    stopSong()
    setIsScreensaverOpen(false)
    setIsScreensaverHintVisible(false)
    setMode(null)
    setCurrentIndex(0)
    setElapsed(0)
    setJourneyComplete(false)
    setShowPlaylist(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [stopSong, stopTone])

  useEffect(() => {
    if (mode !== 'auto' || journeyComplete || wantsMusic) return

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
          stopSong()
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
  }, [mode, currentIndex, step.durationSeconds, goToStep, stopSong, stopTone, journeyComplete, wantsMusic])

  useEffect(() => {
    if (!isScreensaverOpen) return

    const hintTimer = window.setTimeout(() => {
      setIsScreensaverHintVisible(false)
    }, 2000)

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsScreensaverOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.clearTimeout(hintTimer)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isScreensaverOpen])

  const openScreensaver = useCallback(() => {
    setIsScreensaverHintVisible(true)
    setIsScreensaverOpen(true)
  }, [])

  const closeScreensaver = useCallback(() => {
    setIsScreensaverHintVisible(false)
    setIsScreensaverOpen(false)
  }, [])

  const handleToneToggle = () => {
    if (!wantsTone) return
    if (toneIsPlaying) {
      stopTone()
    } else {
      void playTone(step.frequencyHz)
    }
  }

  const enableMusicMode = () => {
    if (wantsMusic) return
    handleAudioModeChange(toneIsPlaying ? 'both' : 'music')
  }

  const handleSongSelect = (file: string) => {
    enableMusicMode()
    if (file === currentSong && musicIsPlaying) {
      pauseSong()
    } else if (file === currentSong && !musicIsPlaying) {
      resumeSong()
    } else {
      const songIdx = songs.findIndex((s) => s.file === file)
      if (songIdx >= 0) {
        manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = songIdx
      }
      playSong(file, { onEnded: handleSongEndRef.current })
    }
  }

  const handleNextSong = () => {
    if (songs.length === 0) return
    enableMusicMode()
    const currentIdx = songs.findIndex((song) => song.file === currentSong)
    const nextIdx = (currentIdx + 1) % songs.length
    manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = nextIdx
    playSong(songs[nextIdx].file, { onEnded: handleSongEndRef.current })
  }

  const handlePrevSong = () => {
    if (songs.length === 0) return
    enableMusicMode()
    const currentIdx = songs.findIndex((song) => song.file === currentSong)
    const prevIdx = currentIdx <= 0 ? songs.length - 1 : currentIdx - 1
    manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = prevIdx
    playSong(songs[prevIdx].file, { onEnded: handleSongEndRef.current })
  }

  const handleMusicPlayPause = () => {
    if (songs.length === 0) return

    enableMusicMode()

    if (!currentSong) {
      manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = 0
      playSong(songs[0].file, { onEnded: handleSongEndRef.current })
      return
    }

    if (musicIsPlaying) {
      pauseSong()
    } else {
      resumeSong()
    }
  }

  useEffect(() => {
    if (mode === null) return

    const handleKeyboardShortcuts = (event: globalThis.KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.closest('input, button, textarea, select, [role="slider"]')) {
          return
        }
      }

      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()

        if (songs.length === 0) return

        if (!wantsMusic) {
          handleAudioModeChange(toneIsPlaying ? 'both' : 'music')
        }

        if (!currentSong) {
          manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = 0
          playSong(songs[0].file, { onEnded: handleSongEndRef.current })
          return
        }

        if (musicIsPlaying) {
          pauseSong()
        } else {
          resumeSong()
        }
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (songs.length === 0) return
        if (!wantsMusic) {
          handleAudioModeChange(toneIsPlaying ? 'both' : 'music')
        }
        const currentIdx = songs.findIndex((song) => song.file === currentSong)
        const nextIdx = (currentIdx + 1) % songs.length
        manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = nextIdx
        playSong(songs[nextIdx].file, { onEnded: handleSongEndRef.current })
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (songs.length === 0) return
        if (!wantsMusic) {
          handleAudioModeChange(toneIsPlaying ? 'both' : 'music')
        }
        const currentIdx = songs.findIndex((song) => song.file === currentSong)
        const prevIdx = currentIdx <= 0 ? songs.length - 1 : currentIdx - 1
        manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = prevIdx
        playSong(songs[prevIdx].file, { onEnded: handleSongEndRef.current })
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcuts)
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts)
    }
  }, [
    currentSong,
    handleAudioModeChange,
    mode,
    musicIsPlaying,
    pauseSong,
    playSong,
    resumeSong,
    songs,
    step.chakraId,
    step.note,
    toneIsPlaying,
    wantsMusic,
  ])

  const handleSeek = (event: MouseEvent<HTMLButtonElement>) => {
    if (musicDuration <= 0) return

    const rect = event.currentTarget.getBoundingClientRect()
    const clickRatio = (event.clientX - rect.left) / rect.width
    seekTo(clickRatio * musicDuration)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleToneVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setToneVolume(Number(event.target.value))
  }

  const handleMusicVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMusicVolume(Number(event.target.value))
  }

  const progress = mode === 'auto' && wantsMusic && musicDuration > 0
    ? musicProgress / musicDuration
    : step.durationSeconds > 0
      ? elapsed / step.durationSeconds
      : 0
  const directionLabel = step.direction === 'ascending' ? 'Ascending' : 'Descending'
  const directionSymbol = step.direction === 'ascending' ? '↑' : '↓'

  const currentSongTitle = useMemo(() => {
    if (!currentSong) return null
    const found = songs.find((song) => song.file === currentSong)
    return found?.title ?? null
  }, [currentSong, songs])

  if (mode === null) {
    return (
      <div className="journey-select">
        <button
          type="button"
          className="journey-select__back"
          onClick={() => navigate('/')}
          aria-label="Return to home page"
        >
          &larr; Home
        </button>
        <div className="journey-select__content">
          <h1 className="journey-select__title">Choose Your Path</h1>
          <p className="journey-select__desc">
            Auto mode starts tone and music automatically, then advances when each song ends.<br />
            Manual mode lets you control the pace.
          </p>
          <div className="journey-select__buttons">
            <button
              type="button"
              className="journey-select__btn"
              onClick={() => startJourney('auto')}
            >
              <span className="journey-select__btn-icon" aria-hidden="true">∞</span>
              <span className="journey-select__btn-label">Auto Journey</span>
              <span className="journey-select__btn-sub">Guided song-based experience</span>
            </button>
            <button
              type="button"
              className="journey-select__btn"
              onClick={() => startJourney('manual')}
            >
              <span className="journey-select__btn-icon" aria-hidden="true">◈</span>
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
          <div className="journey-complete__orb" aria-hidden="true" />
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
      {/* Journey progress dots */}
      <div className="journey-progress" aria-label={`Step ${currentIndex + 1} of ${totalSteps}`}>
        {journeySteps.map((s, i) => (
          <div
            key={s.id}
            className={[
              'journey-progress__dot',
              i === currentIndex ? 'journey-progress__dot--active' : '',
              i < currentIndex ? 'journey-progress__dot--done' : '',
            ].join(' ').trim()}
            style={{ backgroundColor: i <= currentIndex ? s.color : undefined }}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="chakra-journey__content">
        {/* Sidebar */}
        <aside className="chakra-journey__sidebar" aria-label="Journey progress">
          <div className="sidebar-header">
            <button type="button" className="sidebar-exit" onClick={exitJourney} aria-label="Exit journey">
              &larr; Exit
            </button>
            <span className="sidebar-mode">{mode === 'auto' ? 'Auto' : 'Manual'}</span>
          </div>
          <div className="chakra-list" role="list">
            {journeySteps.map((s, i) => {
              const isCurrent = i === currentIndex
              const isPast = i < currentIndex
              return (
                <button
                  key={s.id}
                  type="button"
                  role="listitem"
                  className={[
                    'chakra-list__item',
                    isCurrent ? 'chakra-list__item--active' : '',
                    isPast ? 'chakra-list__item--done' : '',
                  ].join(' ').trim()}
                  onClick={() => {
                    if (mode === 'manual' || isCurrent) {
                      goToStep(i)
                      if (mode === 'manual' && toneIsPlaying) {
                        void crossfadeTo(journeySteps[i].frequencyHz)
                      }
                    }
                  }}
                  disabled={mode === 'auto' && !isCurrent}
                  aria-current={isCurrent ? 'step' : undefined}
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
                  <span className="chakra-list__dir" aria-hidden="true">
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
            <div className="chakra-timer" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
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
                {mode === 'auto' && wantsMusic && musicDuration > 0
                  ? `${formatTime(musicProgress)} / ${formatTime(musicDuration)}`
                  : `${formatTime(elapsed)} / ${formatTime(step.durationSeconds)}`}
              </span>
            </div>
          )}

          <section className="chakra-layout">
            {/* Left column: orb + body */}
            <div className="chakra-visual">
              <button
                type="button"
                className="chakra-visual__glow"
                onClick={handleToneToggle}
                aria-label={toneIsPlaying ? `Mute ${step.name} tone` : `Play ${step.name} tone`}
                aria-pressed={toneIsPlaying}
                style={{ boxShadow: `0 0 40px ${step.color}40, 0 0 80px ${step.color}20` }}
              >
                <div
                  className="chakra-visual__core"
                  style={{
                    backgroundColor: step.color,
                    boxShadow: `0 0 30px ${step.color}cc, 0 0 70px ${step.color}66`,
                    transition: 'background-color 1s ease, box-shadow 1s ease',
                  }}
                />
              </button>

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
                  &ldquo;{step.affirmation}&rdquo;
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

              <button
                type="button"
                className="btn btn--color-screen"
                onClick={openScreensaver}
                style={{ borderColor: `${step.color}44`, color: step.color }}
              >
                View Full-Screen {step.name} Screensaver
              </button>

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
                    {m === 'tone' ? 'Tone Only' : m === 'music' ? 'Music Only' : 'Music and Tone'}
                  </button>
                ))}
              </div>

              {/* Tone control (when tone is active) */}
              {(wantsTone || wantsMusic) && (
                <div className="tone-controls">
                  {wantsTone && (
                    <>
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

                      <label className="tone-volume">
                        <span className="tone-volume__label">Tone Volume</span>
                        <div className="tone-volume__row">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={toneVolume}
                            onChange={handleToneVolumeChange}
                            className="tone-volume__slider"
                            style={{ accentColor: step.color }}
                            aria-label="Tone volume"
                          />
                          <span className="tone-volume__value" aria-live="polite">
                            {Math.round(toneVolume * 100)}%
                          </span>
                        </div>
                      </label>
                    </>
                  )}

                  {wantsMusic && (
                    <label className="tone-volume">
                      <span className="tone-volume__label">Music Volume</span>
                      <div className="tone-volume__row">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={musicVolume}
                          onChange={handleMusicVolumeChange}
                          className="tone-volume__slider"
                          style={{ accentColor: step.color }}
                          aria-label="Music volume"
                        />
                        <span className="tone-volume__value" aria-live="polite">
                          {Math.round(musicVolume * 100)}%
                        </span>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {/* Now playing bar */}
              {hasSongs && (
                <div className="now-playing" style={{ borderColor: `${step.color}33`, background: `${step.color}0c` }}>
                  <div className="now-playing__info">
                    <span className="now-playing__label">Now Playing</span>
                    <span className="now-playing__title">
                      {musicIsLoading ? 'Loading...' :
                       musicError ? musicError :
                       currentSongTitle ?? `Select a song from the ${step.name.toLowerCase()} playlist`}
                    </span>
                  </div>
                  <div className="now-playing__controls">
                    <button
                      type="button"
                      className="now-playing__btn"
                      style={{ color: step.color }}
                      onClick={handlePrevSong}
                      aria-label="Previous song"
                    >
                      ◀◀
                    </button>
                    <button
                      type="button"
                      className="now-playing__btn"
                      style={{ color: step.color }}
                      onClick={handleMusicPlayPause}
                      aria-label={musicIsPlaying ? 'Pause' : 'Play'}
                    >
                      {musicIsPlaying ? '▮▮' : '▶'}
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
                    aria-label={musicDuration > 0 ? 'Seek within song' : 'Song progress'}
                    disabled={musicDuration <= 0}
                  >
                    <div
                      className="now-playing__progress-fill"
                      style={{
                        width: musicDuration > 0 ? `${(musicProgress / musicDuration) * 100}%` : '0%',
                        backgroundColor: step.color,
                      }}
                    />
                  </button>
                  <div className="now-playing__time">
                    {formatTime(musicProgress)} / {formatTime(musicDuration)}
                  </div>
                </div>
              )}

              {/* Music playlist toggle */}
              {hasSongs && (
                <button
                  type="button"
                  className="btn btn--playlist-toggle"
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  style={{ borderColor: `${step.color}33` }}
                  aria-expanded={showPlaylist}
                >
                  {showPlaylist ? `Hide ${step.name} Playlist` : `${step.name} Playlist (${songs.length} songs)`}
                </button>
              )}

              {/* Collapsible playlist */}
              {showPlaylist && hasSongs && (
                <div className="music-playlist" style={{ borderColor: `${step.color}22` }}>
                  <div className="music-playlist__header">
                    <span className="music-playlist__title">{step.name} Songs</span>
                  </div>
                  <div className="music-playlist__list" role="list">
                    {songs.map((song) => {
                      const isActive = currentSong === song.file
                      return (
                        <button
                          key={song.file}
                          type="button"
                          role="listitem"
                          className={`music-playlist__item ${isActive ? 'music-playlist__item--active' : ''}`}
                          style={isActive ? { background: `${step.color}22`, borderColor: `${step.color}44` } : {}}
                          onClick={() => handleSongSelect(song.file)}
                          aria-current={isActive ? 'true' : undefined}
                        >
                          <span className="music-playlist__item-icon" style={isActive ? { color: step.color } : {}} aria-hidden="true">
                            {isActive && musicIsPlaying ? '▮▮' : '▶'}
                          </span>
                          <span className="music-playlist__item-title">{song.title}</span>
                        </button>
                      )
                    })}
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
                      void crossfadeTo(journeySteps[Math.max(0, currentIndex - 1)].frequencyHz)
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
                        void crossfadeTo(journeySteps[currentIndex + 1].frequencyHz)
                      }
                    } else {
                      stopTone()
                      stopSong()
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

      {isScreensaverOpen && (
        <button
          type="button"
          className="journey-color-immersion"
          onClick={closeScreensaver}
          aria-label={`Close ${step.name} full-screen screensaver`}
        >
          <video
            key={screensaverSrc}
            className="journey-color-immersion__video"
            src={screensaverSrc}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <span
            className={[
              'journey-color-immersion__hint',
              isScreensaverHintVisible ? 'journey-color-immersion__hint--visible' : '',
            ].join(' ').trim()}
          >
            Tap or click anywhere to close
          </span>
        </button>
      )}
    </div>
  )
}
