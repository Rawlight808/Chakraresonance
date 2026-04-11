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
const AUTO_CYCLE_TARGET = 3

function shuffleSongs(songs: ChakraSong[]) {
  const nextSongs = [...songs]

  for (let index = nextSongs.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[nextSongs[index], nextSongs[swapIndex]] = [nextSongs[swapIndex], nextSongs[index]]
  }

  return nextSongs
}

function getRandomSong(songs: ChakraSong[]) {
  if (songs.length === 0) return null
  const randomIndex = Math.floor(Math.random() * songs.length)
  return songs[randomIndex] ?? null
}

export function ChakraJourney() {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<JourneyMode>(null)
  const [completedCycles, setCompletedCycles] = useState(0)
  const [journeyComplete, setJourneyComplete] = useState(false)
  const [audioMode, setAudioMode] = useState<AudioMode>('both')
  const [isScreensaverOpen, setIsScreensaverOpen] = useState(false)
  const [isScreensaverHintVisible, setIsScreensaverHintVisible] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [selectedSongFile, setSelectedSongFile] = useState<string | null>(null)
  const [isPageFading, setIsPageFading] = useState(false)
  const [manualPlayFullPlaylist, setManualPlayFullPlaylist] = useState(true)
  const prevStepRef = useRef<string | null>(null)
  const autoSongQueueRef = useRef<Record<string, ChakraSong[]>>({})
  const autoSongIndexRef = useRef<Record<string, number>>({})
  const autoAdvanceInFlightRef = useRef(false)
  const handleSongEndRef = useRef<() => void>(() => {})
  const onSongEnded = useCallback(() => { handleSongEndRef.current() }, [])
  const manualSongIndexRef = useRef<Record<string, number>>({})
  const manualResumePlaybackRef = useRef<{ tone: boolean; music: boolean }>({ tone: false, music: false })
  const autoToneMutedRef = useRef(false)
  const [displayedScreensaverSrc, setDisplayedScreensaverSrc] = useState(() => chakraScreensavers[journeySteps[0].chakraId])
  const [exitingScreensaverSrc, setExitingScreensaverSrc] = useState<string | null>(null)
  const [crossfadePhase, setCrossfadePhase] = useState<'idle' | 'mounted' | 'fading'>('idle')

  const {
    playTone,
    startTone,
    fadeOutTone,
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
  const currentAutoCycle = Math.min(completedCycles + 1, AUTO_CYCLE_TARGET)
  const autoProgress = ((completedCycles * totalSteps) + currentIndex + 1) / (AUTO_CYCLE_TARGET * totalSteps)

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
      autoToneMutedRef.current = false
      void startTone(step.frequencyHz)
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
            { onEnded: onSongEnded },
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
    startTone,
    resumeSong,
    songs,
    step.chakraId,
    step.frequencyHz,
    step.note,
    stopSong,
    stopTone,
  ])

  const finishJourney = useCallback(() => {
    autoAdvanceInFlightRef.current = false
    stopTone()
    stopSong()
    setJourneyComplete(true)
  }, [stopSong, stopTone])

  const goToStep = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= totalSteps) return
      setCurrentIndex(nextIndex)

      const wantsToneNow = audioMode === 'tone' || audioMode === 'both'
      if (wantsToneNow && toneIsPlaying) {
        void crossfadeTo(journeySteps[nextIndex].frequencyHz)
      } else if (wantsToneNow && mode === 'auto') {
        void crossfadeTo(journeySteps[nextIndex].frequencyHz)
      }
    },
    [mode, audioMode, crossfadeTo, toneIsPlaying],
  )

  const handleAutoSongEnd = useCallback(async () => {
    if (autoAdvanceInFlightRef.current) return

    autoAdvanceInFlightRef.current = true

    setIsPageFading(true)

    const pageFade = new Promise<void>((resolve) => {
      setTimeout(resolve, 800)
    })

    await Promise.all([
      wantsTone ? fadeOutTone() : Promise.resolve(),
      pageFade,
    ])

    if (currentIndex === totalSteps - 1) {
      const nextCompletedCycles = completedCycles + 1

      if (nextCompletedCycles >= AUTO_CYCLE_TARGET) {
        setCompletedCycles(AUTO_CYCLE_TARGET)
        setIsPageFading(false)
        finishJourney()
        return
      }

      setCompletedCycles(nextCompletedCycles)
      setCurrentIndex(0)
      return
    }

    setCurrentIndex(currentIndex + 1)
  }, [completedCycles, currentIndex, fadeOutTone, finishJourney, wantsTone])

  const advanceManualStep = useCallback(async () => {
    if (autoAdvanceInFlightRef.current) return

    autoAdvanceInFlightRef.current = true

    manualResumePlaybackRef.current = {
      tone: wantsTone,
      music: wantsMusic,
    }

    setIsPageFading(true)

    const pageFade = new Promise<void>((resolve) => {
      setTimeout(resolve, 800)
    })

    await Promise.all([
      wantsTone ? fadeOutTone() : Promise.resolve(),
      pageFade,
    ])

    manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = 0

    if (currentIndex < totalSteps - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      manualResumePlaybackRef.current = { tone: false, music: false }
      setIsPageFading(false)
      finishJourney()
    }
  }, [currentIndex, fadeOutTone, finishJourney, step.chakraId, step.note, wantsTone, wantsMusic])

  const handleManualSongEnd = useCallback(() => {
    if (!manualPlayFullPlaylist) {
      void advanceManualStep()
      return
    }

    const queueKey = `${step.chakraId}:${step.note}`
    const currentManualIdx = manualSongIndexRef.current[queueKey] ?? 0
    const nextManualIdx = currentManualIdx + 1

    if (nextManualIdx < songs.length) {
      manualSongIndexRef.current[queueKey] = nextManualIdx
      playSong(songs[nextManualIdx].file, { onEnded: onSongEnded })
    } else {
      void advanceManualStep()
    }
  }, [advanceManualStep, manualPlayFullPlaylist, playSong, songs, step.chakraId, step.note])

  useEffect(() => {
    handleSongEndRef.current = mode === 'auto'
      ? () => { void handleAutoSongEnd() }
      : () => { handleManualSongEnd() }
  }, [mode, handleAutoSongEnd, handleManualSongEnd])

  useEffect(() => {
    const prev = prevStepRef.current
    prevStepRef.current = step.id

    const isStepChanged = prev !== null && prev !== step.id
    const isFirstStep = prev === step.id && currentIndex === 0 && mode !== null

    if (isStepChanged || isFirstStep) {
      stopSong()
      manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = 0

      const selectedSong = mode === 'auto'
        ? getNextAutoSong(step.chakraId, step.note)
        : getRandomSong(songs)

      /* eslint-disable react-hooks/set-state-in-effect -- intentional: sync UI with step transition */
      if (mode === 'manual') {
        setIsPageFading(false)

        const resume = manualResumePlaybackRef.current
        manualResumePlaybackRef.current = { tone: false, music: false }

        if (!selectedSong) {
          autoAdvanceInFlightRef.current = false
          return
        }

        setSelectedSongFile(selectedSong.file)

        const songIdx = songs.findIndex((s) => s.file === selectedSong.file)
        manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = songIdx >= 0 ? songIdx : 0

        if (!resume.tone && !resume.music) {
          autoAdvanceInFlightRef.current = false
          return
        }

        let isCancelled = false

        const startManualResume = async () => {
          if (isCancelled) return

          if (resume.tone && wantsTone) {
            await playTone(step.frequencyHz)
          }

          if (isCancelled) return

          if (resume.music && wantsMusic) {
            playSong(selectedSong.file, { onEnded: onSongEnded })
          }

          autoAdvanceInFlightRef.current = false
        }

        void startManualResume()

        return () => {
          isCancelled = true
        }
      }
      /* eslint-enable react-hooks/set-state-in-effect */

      let isCancelled = false

      setIsPageFading(false)

      const startAutoStep = async () => {
        if (wantsTone && !autoToneMutedRef.current) {
          await playTone(step.frequencyHz)
        }

        if (isCancelled) return

        if (!selectedSong) {
          autoAdvanceInFlightRef.current = false
          return
        }

        setSelectedSongFile(selectedSong.file)

        if (wantsMusic) {
          playSong(
            selectedSong.file,
            { onEnded: onSongEnded },
          )
        }

        autoAdvanceInFlightRef.current = false
      }

      void startAutoStep()

      return () => {
        isCancelled = true
      }
    }
  }, [
    currentIndex,
    getNextAutoSong,
    mode,
    playTone,
    playSong,
    songs,
    step.chakraId,
    step.frequencyHz,
    step.id,
    step.note,
    stopSong,
    wantsTone,
    wantsMusic,
  ])

  const startJourney = (selectedMode: JourneyMode) => {
    if (selectedMode === 'auto') {
      autoSongQueueRef.current = {}
      autoSongIndexRef.current = {}
      setAudioMode('both')
    }

    autoAdvanceInFlightRef.current = false
    autoToneMutedRef.current = false
    manualSongIndexRef.current = {}
    setMode(selectedMode)
    setCurrentIndex(0)
    setCompletedCycles(0)
    setJourneyComplete(false)
    setIsPageFading(false)
    setManualPlayFullPlaylist(true)
    manualResumePlaybackRef.current = { tone: false, music: false }
    prevStepRef.current = journeySteps[0].id
    setIsScreensaverOpen(false)
    setIsScreensaverHintVisible(false)
    setSelectedSongFile(null)
  }

  const exitJourney = useCallback(() => {
    autoAdvanceInFlightRef.current = false
    stopTone()
    stopSong()
    setIsScreensaverOpen(false)
    setIsScreensaverHintVisible(false)
    setMode(null)
    setCurrentIndex(0)
    setCompletedCycles(0)
    setJourneyComplete(false)
    setIsPageFading(false)
    setManualPlayFullPlaylist(true)
    manualResumePlaybackRef.current = { tone: false, music: false }
    setSelectedSongFile(null)
    prevStepRef.current = null
  }, [stopSong, stopTone])

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

  useEffect(() => {
    if (displayedScreensaverSrc === screensaverSrc) return

    if (!isScreensaverOpen) {
      setDisplayedScreensaverSrc(screensaverSrc)
      setExitingScreensaverSrc(null)
      setCrossfadePhase('idle')
      return
    }

    /* eslint-disable react-hooks/set-state-in-effect -- intentional: sync displayed src with derived src */
    setExitingScreensaverSrc(displayedScreensaverSrc)
    setDisplayedScreensaverSrc(screensaverSrc)
    setCrossfadePhase('mounted')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [screensaverSrc, displayedScreensaverSrc, isScreensaverOpen])

  useEffect(() => {
    if (crossfadePhase !== 'mounted') return

    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCrossfadePhase('fading')
      })
    })

    const timerId = window.setTimeout(() => {
      setExitingScreensaverSrc(null)
      setCrossfadePhase('idle')
    }, 1300)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(timerId)
    }
  }, [crossfadePhase])

  const openScreensaver = useCallback(() => {
    setDisplayedScreensaverSrc(screensaverSrc)
    setExitingScreensaverSrc(null)
    setCrossfadePhase('idle')
    setIsScreensaverHintVisible(true)
    setIsScreensaverOpen(true)
  }, [screensaverSrc])

  const closeScreensaver = useCallback(() => {
    setIsScreensaverHintVisible(false)
    setIsScreensaverOpen(false)
    setExitingScreensaverSrc(null)
    setCrossfadePhase('idle')
  }, [])

  const handleToneToggle = () => {
    if (!wantsTone) return
    if (toneIsPlaying) {
      stopTone()
      autoToneMutedRef.current = true
    } else {
      autoToneMutedRef.current = false
      void startTone(step.frequencyHz)
    }
  }

  const enableMusicMode = () => {
    if (wantsMusic) return
    handleAudioModeChange(toneIsPlaying ? 'both' : 'music')
  }

  const handleSongSelect = (file: string) => {
    setSelectedSongFile(file)
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
      playSong(file, { onEnded: onSongEnded })
    }
  }

  const handleNextSong = () => {
    if (songs.length === 0) return
    enableMusicMode()
    const activeSong = currentSong ?? selectedSongFile
    const currentIdx = songs.findIndex((song) => song.file === activeSong)
    const nextIdx = (currentIdx + 1) % songs.length
    manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = nextIdx
    setSelectedSongFile(songs[nextIdx].file)
    playSong(songs[nextIdx].file, { onEnded: onSongEnded })
  }

  const handlePrevSong = () => {
    if (songs.length === 0) return
    enableMusicMode()
    const activeSong = currentSong ?? selectedSongFile
    const currentIdx = songs.findIndex((song) => song.file === activeSong)
    const prevIdx = currentIdx <= 0 ? songs.length - 1 : currentIdx - 1
    manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = prevIdx
    setSelectedSongFile(songs[prevIdx].file)
    playSong(songs[prevIdx].file, { onEnded: onSongEnded })
  }

  const handleMusicPlayPause = () => {
    if (songs.length === 0) return

    enableMusicMode()

    if (!currentSong) {
      const fallbackSong = selectedSongFile
        ? songs.find((song) => song.file === selectedSongFile) ?? songs[0]
        : songs[0]
      const fallbackIdx = songs.findIndex((song) => song.file === fallbackSong.file)
      manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = fallbackIdx >= 0 ? fallbackIdx : 0
      setSelectedSongFile(fallbackSong.file)
      playSong(fallbackSong.file, { onEnded: onSongEnded })
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
      const isTextInput = target instanceof HTMLElement &&
        target.closest('input, textarea, select, [role="slider"]')

      if (event.key === ' ' || event.key === 'Spacebar') {
        if (isTextInput) return
        event.preventDefault()

        const anythingPlaying = toneIsPlaying || musicIsPlaying

        if (anythingPlaying) {
          if (toneIsPlaying) {
            stopTone()
            autoToneMutedRef.current = true
          }
          if (musicIsPlaying) pauseSong()
          return
        }

        if (songs.length === 0) return

        if (!wantsMusic) {
          handleAudioModeChange('music')
        }

        if (currentSong) {
          resumeSong()
        } else {
          const fallbackSong = selectedSongFile
            ? songs.find((song) => song.file === selectedSongFile) ?? songs[0]
            : songs[0]
          const fallbackIdx = songs.findIndex((song) => song.file === fallbackSong.file)
          manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = fallbackIdx >= 0 ? fallbackIdx : 0
          setSelectedSongFile(fallbackSong.file)
          playSong(fallbackSong.file, { onEnded: onSongEnded })
        }
        return
      }

      if (target instanceof HTMLElement && target.closest('button')) return

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (songs.length === 0) return
        if (!wantsMusic) {
          handleAudioModeChange(toneIsPlaying ? 'both' : 'music')
        }
        const activeSong = currentSong ?? selectedSongFile
        const currentIdx = songs.findIndex((song) => song.file === activeSong)
        const nextIdx = (currentIdx + 1) % songs.length
        manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = nextIdx
        setSelectedSongFile(songs[nextIdx].file)
        playSong(songs[nextIdx].file, { onEnded: onSongEnded })
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (songs.length === 0) return
        if (!wantsMusic) {
          handleAudioModeChange(toneIsPlaying ? 'both' : 'music')
        }
        const activeSong = currentSong ?? selectedSongFile
        const currentIdx = songs.findIndex((song) => song.file === activeSong)
        const prevIdx = currentIdx <= 0 ? songs.length - 1 : currentIdx - 1
        manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = prevIdx
        setSelectedSongFile(songs[prevIdx].file)
        playSong(songs[prevIdx].file, { onEnded: onSongEnded })
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
    selectedSongFile,
    stopTone,
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

  const directionLabel = step.direction === 'ascending' ? 'Ascending' : 'Descending'
  const directionSymbol = step.direction === 'ascending' ? '↑' : '↓'

  const currentSongTitle = useMemo(() => {
    const activeSongFile = currentSong ?? selectedSongFile
    if (!activeSongFile) return null
    const found = songs.find((song) => song.file === activeSongFile)
    return found?.title ?? null
  }, [currentSong, selectedSongFile, songs])

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
    const shareText = 'I just completed three full chakra tuning journeys on Chakra Resonance — root to crown and back, three times. ✨'
    const shareUrl = window.location.origin

    const handleShare = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Chakra Resonance', text: shareText, url: shareUrl })
        } catch { /* user cancelled */ }
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      }
    }

    return (
      <div
        className="journey-complete"
        style={{ background: `radial-gradient(ellipse at center, #1a0a2a, #0a0a14)` }}
      >
        <div className="journey-complete__content">
          <div className="journey-complete__orb" aria-hidden="true" />
          <h1>Journey Complete</h1>
          <p>
            You have traveled the full circle three times, ascending through the
            front of your body and descending down the back until the journey
            came to rest at the root.
          </p>
          <p className="journey-complete__date">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <div className="journey-complete__actions">
            <button type="button" className="btn btn--primary" onClick={() => startJourney(mode)}>
              Begin Again
            </button>
            <button type="button" className="btn btn--share" onClick={handleShare}>
              {shareCopied ? 'Link Copied!' : 'Share Your Journey'}
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
          className={`chakra-journey__main${isPageFading ? ' chakra-journey__main--fading' : ''}`}
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
          }}
        >
          <header className="chakra-header">
            <div className="chakra-header__content">
              <p className="chakra-header__eyebrow">
                Step {currentIndex + 1} of {totalSteps} &middot; {directionSymbol} {directionLabel} &middot; {step.sanskritName}
              </p>
              <h1 className="chakra-header__title">{step.name}</h1>
              <p className="chakra-header__location">{step.location}</p>
            </div>
            <button
              type="button"
              className="visual-zone__btn chakra-header__visual-btn"
              onClick={openScreensaver}
              style={{ borderColor: `${step.color}44`, color: step.color }}
            >
              <span className="visual-zone__icon" aria-hidden="true">⛶</span>
              Full-Screen Visual
            </button>
          </header>

          {mode === 'auto' && (
            <div className="chakra-timer" role="progressbar" aria-valuenow={Math.round(autoProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="chakra-timer__bar">
                <div
                  className="chakra-timer__fill"
                  style={{
                    width: `${autoProgress * 100}%`,
                    backgroundColor: step.color,
                    transition: 'width 1s linear',
                  }}
                />
              </div>
              <span className="chakra-timer__label">
                Cycle {currentAutoCycle} of {AUTO_CYCLE_TARGET} · Step {currentIndex + 1} of {totalSteps}
              </span>
            </div>
          )}

          <section className="chakra-layout">
            {/* Left column: orb + body */}
            <div className="chakra-visual">
              <button
                type="button"
                className={`chakra-visual__glow ${toneIsPlaying ? 'chakra-visual__glow--active' : ''}`}
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
              <span className="chakra-visual__orb-caption" aria-hidden="true">
                {toneIsPlaying ? 'Stop Chakra Tone' : 'Play Chakra Tone'}
              </span>
              <div className="chakra-visual__tone-volume">
                <button
                  type="button"
                  className={`chakra-visual__tone-toggle ${toneIsPlaying ? 'chakra-visual__tone-toggle--active' : ''}`}
                  onClick={handleToneToggle}
                  aria-label={toneIsPlaying ? 'Stop chakra tone' : 'Play chakra tone'}
                  aria-pressed={toneIsPlaying}
                  style={{ color: toneIsPlaying ? step.color : undefined }}
                >
                  {toneIsPlaying ? '⏹' : '▶'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={toneVolume}
                  onChange={handleToneVolumeChange}
                  className="chakra-visual__tone-volume-slider"
                  style={{ accentColor: step.color }}
                  aria-label="Tone volume"
                />
                <span className="chakra-visual__tone-volume-value" aria-live="polite">
                  {Math.round(toneVolume * 100)}%
                </span>
              </div>

              <div className="chakra-vowel">
                <span className="chakra-vowel__label">Sing</span>
                <span className="chakra-vowel__sound">{step.vowelSound}</span>
              </div>

              <BodySilhouette activeChakraId={step.chakraId} activeColor={step.color} />
            </div>

            {/* Right column: info + controls */}
            <div className="chakra-info">
              {/* ── Info zone ── */}
              <div className="chakra-info__zone">
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
              </div>

              {/* ── Audio dock ── */}
              <div className="audio-dock" style={{ borderColor: `${step.color}22` }}>
                <div className="audio-dock__header">
                  <span className="audio-dock__icon" aria-hidden="true">♫</span>
                  <span className="audio-dock__title">Sound</span>
                </div>

                {/* Music player */}
                {wantsMusic && (
                  <div className="music-player" style={{ borderColor: `${step.color}22`, background: `${step.color}0a` }}>
                    <div className="music-player__top">
                      <span className="music-player__title">
                        {musicIsLoading ? 'Loading...' :
                         musicError ? musicError :
                         currentSongTitle ?? 'No track selected'}
                      </span>
                      <div className="audio-dock__transport">
                        <button
                          type="button"
                          className="audio-dock__transport-btn"
                          style={{ color: step.color }}
                          onClick={handlePrevSong}
                          aria-label="Previous song"
                        >
                          ⏮
                        </button>
                        <button
                          type="button"
                          className="audio-dock__transport-btn audio-dock__transport-btn--main"
                          style={{ color: step.color, borderColor: `${step.color}55` }}
                          onClick={handleMusicPlayPause}
                          aria-label={musicIsPlaying ? 'Pause music' : 'Play music'}
                        >
                          {musicIsPlaying ? '⏸' : '▶'}
                        </button>
                        <button
                          type="button"
                          className="audio-dock__transport-btn"
                          style={{ color: step.color }}
                          onClick={handleNextSong}
                          aria-label="Next song"
                        >
                          ⏭
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="audio-dock__seek"
                      onClick={handleSeek}
                      aria-label={musicDuration > 0 ? 'Seek within song' : 'Song progress'}
                      disabled={musicDuration <= 0}
                    >
                      <div
                        className="audio-dock__seek-fill"
                        style={{
                          width: musicDuration > 0 ? `${(musicProgress / musicDuration) * 100}%` : '0%',
                          backgroundColor: step.color,
                        }}
                      />
                    </button>
                    <div className="music-player__bottom">
                      <div className="audio-dock__volume">
                        <span className="audio-dock__vol-icon" aria-hidden="true">♫</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={musicVolume}
                          onChange={handleMusicVolumeChange}
                          className="audio-dock__slider"
                          style={{ accentColor: step.color }}
                          aria-label="Music volume"
                        />
                        <span className="audio-dock__vol-value" aria-live="polite">
                          {Math.round(musicVolume * 100)}%
                        </span>
                      </div>
                      <span className="audio-dock__time">
                        {formatTime(musicProgress)} / {formatTime(musicDuration)}
                      </span>
                    </div>
                  </div>
                )}

                {mode === 'auto' && wantsMusic && (
                  <p className="audio-dock__hint">Each song ends the current stop, then the journey fades into the next chakra</p>
                )}

                <p className="audio-dock__shortcuts">
                  Space stop all / play music &middot; &larr;&rarr; change track
                </p>
              </div>

              {/* ── Playlist ── */}
              {hasSongs && (
                <div className="playlist-zone">
                  <div className="playlist-zone__header">
                    <div className="playlist-zone__label">
                      {step.name} Playlist
                    </div>
                    {mode === 'manual' && (
                      <div className="playlist-zone__toggle" role="radiogroup" aria-label="Playlist advance mode">
                        <button
                          type="button"
                          className={`playlist-zone__toggle-btn${manualPlayFullPlaylist ? ' playlist-zone__toggle-btn--active' : ''}`}
                          style={manualPlayFullPlaylist ? { borderColor: `${step.color}66`, background: `${step.color}22`, color: step.color } : {}}
                          onClick={() => setManualPlayFullPlaylist(true)}
                          role="radio"
                          aria-checked={manualPlayFullPlaylist}
                        >
                          Full Playlist
                        </button>
                        <button
                          type="button"
                          className={`playlist-zone__toggle-btn${!manualPlayFullPlaylist ? ' playlist-zone__toggle-btn--active' : ''}`}
                          style={!manualPlayFullPlaylist ? { borderColor: `${step.color}66`, background: `${step.color}22`, color: step.color } : {}}
                          onClick={() => setManualPlayFullPlaylist(false)}
                          role="radio"
                          aria-checked={!manualPlayFullPlaylist}
                        >
                          Single Song
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="music-playlist" style={{ borderColor: `${step.color}22` }}>
                    <div className="music-playlist__list" role="list">
                      {songs.map((song) => {
                        const isActive = (currentSong ?? selectedSongFile) === song.file
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
                              {isActive && musicIsPlaying ? '⏸' : '▶'}
                            </span>
                            <span className="music-playlist__item-title">{song.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Details zone ── */}
              <div className="details-zone">
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
              </div>

              {/* ── Step navigation ── */}
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
                  ← Previous
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
                      finishJourney()
                    }
                  }}
                >
                  {currentIndex === totalSteps - 1 ? 'Complete' : 'Next'} →
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
          {exitingScreensaverSrc && (
            <video
              key={exitingScreensaverSrc}
              className={[
                'journey-color-immersion__video',
                crossfadePhase === 'fading' ? 'journey-color-immersion__video--exiting' : '',
              ].join(' ').trim()}
              src={exitingScreensaverSrc}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
            />
          )}
          <video
            key={displayedScreensaverSrc}
            className={[
              'journey-color-immersion__video',
              crossfadePhase === 'mounted' ? 'journey-color-immersion__video--entering' : '',
            ].join(' ').trim()}
            src={displayedScreensaverSrc}
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
