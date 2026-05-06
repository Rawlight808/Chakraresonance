import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { journeySteps, totalSteps } from '../data/chakras'
import type { ChakraId } from '../data/chakras'
import { useTonePlayer } from '../audio/useTonePlayer'
import { useMusicPlayer } from '../audio/useMusicPlayer'
import { chakraSongs } from '../data/chakraSongs'
import type { ChakraSong } from '../data/chakraSongs'
import { chakraScreensavers } from '../data/chakraScreensavers'
import { mediaUrl } from '../lib/media'
import { setStatusBarVisible } from '../lib/native'
import { BodySilhouette } from './BodySilhouette'
import './ChakraJourney.css'

type JourneyMode = 'auto' | 'manual' | null
type AudioMode = 'tone' | 'music' | 'both'
/**
 * In manual mode, how many songs play before auto-advancing to the next
 * chakra. 'all' plays through every song in the chakra's playlist (the
 * legacy "Full Playlist" behavior). The count resets whenever the chakra
 * step changes (manual nav or auto-advance).
 */
type ManualSongLimit = 1 | 3 | 'all'
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

/** Speaker + wave arcs in the style of Apple Music / SF Symbols (outline). */
function JourneyVolumeIcon({ volume, className }: { volume: number; className?: string }) {
  const muted = volume <= 0
  const waves = muted ? 0 : volume < 1 / 3 ? 1 : volume < 2 / 3 ? 2 : 3

  return (
    <svg
      className={['journey-volume-icon', className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M3 9v6h3l5 5V4L6 9H3Z" />
      {!muted && waves >= 1 && (
        <path d="M13.807 10.943a2.25 2.25 0 0 1 0 3.182" />
      )}
      {!muted && waves >= 2 && (
        <path d="M16.463 8.288a5.25 5.25 0 0 1 0 7.424" />
      )}
      {!muted && waves >= 3 && (
        <path d="M19.114 5.636a9 9 0 0 1 0 12.728" />
      )}
      {muted && <path d="M14.25 8.25 21.75 17.75" />}
    </svg>
  )
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
  // Track which song's share button was most recently clicked so the row can
  // show a brief "Copied!" pill. null when no recent share is being indicated.
  const [shareCopiedFile, setShareCopiedFile] = useState<string | null>(null)
  const [selectedSongFile, setSelectedSongFile] = useState<string | null>(null)
  const [isPageFading, setIsPageFading] = useState(false)
  const [manualSongLimit, setManualSongLimit] = useState<ManualSongLimit>('all')
  // Counts how many songs have ended in the current manual-mode chakra. Reset
  // to 0 whenever the journey step changes so a manual jump always gets the
  // full song-limit budget on the new chakra.
  const manualSongsEndedRef = useRef(0)
  const prevStepRef = useRef<string | null>(null)
  const autoSongQueueRef = useRef<Record<string, ChakraSong[]>>({})
  const autoSongIndexRef = useRef<Record<string, number>>({})
  const autoAdvanceInFlightRef = useRef(false)
  const handleSongEndRef = useRef<() => void>(() => {})
  const onSongEnded = useCallback(() => { handleSongEndRef.current() }, [])
  const manualSongIndexRef = useRef<Record<string, number>>({})
  const manualResumePlaybackRef = useRef<{ tone: boolean; music: boolean }>({ tone: false, music: false })
  const toneMutedByUserRef = useRef(false)
  // When a visitor lands on /journey?song=..., this ref holds the requested
  // song file across the synchronous startJourney → step-change-effect chain
  // so the effect plays the requested song instead of a random one. The ref
  // is consumed (cleared) by the step-change effect on first read.
  const pendingShareSongRef = useRef<string | null>(null)
  // Two stable video slots for the fullscreen screensaver crossfade. Each slot
  // is a persistent <video> element (stable React key) so the previously-
  // playing video keeps decoding while we load the next chakra into the other
  // slot. Toggling `activeSlot` swaps which slot has the --active CSS class,
  // and CSS handles the opacity crossfade. Initial values are identical so
  // both elements pre-warm to the journey's first chakra.
  const [slotASrc, setSlotASrc] = useState(() => chakraScreensavers[journeySteps[0].chakraId])
  const [slotBSrc, setSlotBSrc] = useState(() => chakraScreensavers[journeySteps[0].chakraId])
  const [activeSlot, setActiveSlot] = useState<'a' | 'b'>('a')
  const slotARef = useRef<HTMLVideoElement>(null)
  const slotBRef = useRef<HTMLVideoElement>(null)
  const screensaverRef = useRef<HTMLDivElement>(null)

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
    loadSongAt,
    pauseSong,
    resumeSong,
    seekTo,
    stopSong,
    setVolume: setMusicVolume,
    toggleLoop: toggleMusicLoop,
    isLooping: musicIsLooping,
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
      toneMutedByUserRef.current = false
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

      if (mode === 'manual') {
        // Tone is handled live via crossfadeTo below, so keep tone=false here.
        // Music auto-starts on the new chakra only if it was actively playing;
        // this preserves paused / never-started states.
        manualResumePlaybackRef.current = {
          tone: false,
          music: musicIsPlaying,
        }
      }

      setCurrentIndex(nextIndex)

      const wantsToneNow = audioMode === 'tone' || audioMode === 'both'
      if (wantsToneNow && toneIsPlaying) {
        void crossfadeTo(journeySteps[nextIndex].frequencyHz)
      } else if (wantsToneNow && mode === 'auto') {
        void crossfadeTo(journeySteps[nextIndex].frequencyHz)
      }
    },
    [mode, audioMode, crossfadeTo, toneIsPlaying, musicIsPlaying],
  )

  const handleAutoSongEnd = useCallback(async () => {
    if (autoAdvanceInFlightRef.current) return

    autoAdvanceInFlightRef.current = true

    setIsPageFading(true)

    const pageFade = new Promise<void>((resolve) => {
      setTimeout(resolve, 800)
    })

    await Promise.all([
      wantsTone && !toneMutedByUserRef.current ? fadeOutTone() : Promise.resolve(),
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
      tone: wantsTone && !toneMutedByUserRef.current,
      music: wantsMusic,
    }

    setIsPageFading(true)

    const pageFade = new Promise<void>((resolve) => {
      setTimeout(resolve, 800)
    })

    await Promise.all([
      wantsTone && !toneMutedByUserRef.current ? fadeOutTone() : Promise.resolve(),
      pageFade,
    ])

    manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = 0

    // Manual mode cycles continuously: when we'd run off the end of the
    // journey, wrap back to the first step instead of calling finishJourney.
    // The user stops the loop explicitly via the Exit button.
    setCurrentIndex(currentIndex < totalSteps - 1 ? currentIndex + 1 : 0)
  }, [currentIndex, fadeOutTone, step.chakraId, step.note, wantsTone, wantsMusic])

  const handleManualSongEnd = useCallback(() => {
    manualSongsEndedRef.current += 1

    // 1-song mode advances after every song.
    if (manualSongLimit === 1) {
      void advanceManualStep()
      return
    }

    // 3-song mode plays up to 3 songs, then advances.
    if (manualSongLimit === 3 && manualSongsEndedRef.current >= 3) {
      void advanceManualStep()
      return
    }

    // 'all' mode (and 3-song mode while still under the cap) queues the next
    // song from the chakra's playlist. If we hit the end of the list before
    // reaching the cap, advance to the next chakra anyway.
    const queueKey = `${step.chakraId}:${step.note}`
    const currentManualIdx = manualSongIndexRef.current[queueKey] ?? 0
    const nextManualIdx = currentManualIdx + 1

    if (nextManualIdx < songs.length) {
      manualSongIndexRef.current[queueKey] = nextManualIdx
      playSong(songs[nextManualIdx].file, { onEnded: onSongEnded })
    } else {
      void advanceManualStep()
    }
  }, [advanceManualStep, manualSongLimit, playSong, songs, step.chakraId, step.note])

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
      // Fresh chakra → fresh song-limit budget, regardless of how we got here
      // (auto-advance from a previous chakra, manual nav, share-link landing).
      manualSongsEndedRef.current = 0

      // Manual mode normally picks a random song; share-link landings inject a
      // specific song via pendingShareSongRef so the visitor lands on the song
      // someone actually shared. The ref is consumed on first use.
      let selectedSong: ChakraSong | null
      if (mode === 'auto') {
        selectedSong = getNextAutoSong(step.chakraId, step.note)
      } else {
        const pending = pendingShareSongRef.current
        if (pending) {
          pendingShareSongRef.current = null
          selectedSong = songs.find((s) => s.file === pending) ?? getRandomSong(songs)
        } else {
          selectedSong = getRandomSong(songs)
        }
      }

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
          try {
            // Kick music first so it never waits on playTone/AudioContext resume,
            // which can stall after fullscreen transitions in some browsers.
            if (resume.music && wantsMusic) {
              playSong(selectedSong.file, { onEnded: onSongEnded })
            }

            if (isCancelled) return

            if (resume.tone && wantsTone && !toneMutedByUserRef.current) {
              await playTone(step.frequencyHz)
            }
          } finally {
            // Always unlock: if React Strict Mode or deps re-run cancels this effect,
            // early returns above skip the old tail assignment and would otherwise leave
            // autoAdvanceInFlightRef stuck true — blocking the next song-end advance.
            autoAdvanceInFlightRef.current = false
          }
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
        try {
          if (isCancelled) return

          if (wantsTone && !toneMutedByUserRef.current) {
            await playTone(step.frequencyHz)
          }

          if (isCancelled) return

          if (!selectedSong) {
            return
          }

          setSelectedSongFile(selectedSong.file)

          if (wantsMusic) {
            playSong(
              selectedSong.file,
              { onEnded: onSongEnded },
            )
          }
        } finally {
          autoAdvanceInFlightRef.current = false
        }
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
      // Auto mode used to also start the chakra tone alongside music; some
      // users find that overwhelming on first listen. Default to music-only
      // and let the user opt into 'both' (or 'tone') via the audio toggle.
      setAudioMode('music')
    }

    autoAdvanceInFlightRef.current = false
    toneMutedByUserRef.current = false
    manualSongIndexRef.current = {}
    setMode(selectedMode)
    setCurrentIndex(0)
    setCompletedCycles(0)
    setJourneyComplete(false)
    setIsPageFading(false)
    setManualSongLimit('all')
    manualSongsEndedRef.current = 0
    manualResumePlaybackRef.current = { tone: false, music: false }
    prevStepRef.current = journeySteps[0].id
    setIsScreensaverOpen(false)
    setIsScreensaverHintVisible(false)
    setSelectedSongFile(null)
  }

  // Variant of startJourney used when a visitor opens a /journey?song=… link.
  // Drops them straight into manual mode at the song's chakra in 1-song mode,
  // with auto-play primed (manualResumePlaybackRef), tone off so the focus is
  // the shared track, and pendingShareSongRef set so the step-change effect
  // plays the requested song instead of a random pick from the playlist.
  const startJourneyFromShareLink = useCallback(
    (stepIndex: number, songFile: string) => {
      autoAdvanceInFlightRef.current = false
      toneMutedByUserRef.current = false
      manualSongIndexRef.current = {}
      manualSongsEndedRef.current = 0
      pendingShareSongRef.current = songFile
      manualResumePlaybackRef.current = { tone: false, music: true }
      setAudioMode('music')
      setMode('manual')
      setCurrentIndex(stepIndex)
      setCompletedCycles(0)
      setJourneyComplete(false)
      setIsPageFading(false)
      setManualSongLimit(1)
      // Force the step-change effect to treat this as a real transition. If
      // the share link points at step 0 the isFirstStep branch covers it; for
      // any other index, isStepChanged fires because prev !== step.id.
      prevStepRef.current = journeySteps[0].id
      setIsScreensaverOpen(false)
      setIsScreensaverHintVisible(false)
      setSelectedSongFile(songFile)
    },
    [],
  )

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
    setManualSongLimit('all')
    manualSongsEndedRef.current = 0
    manualResumePlaybackRef.current = { tone: false, music: false }
    setSelectedSongFile(null)
    prevStepRef.current = null
  }, [stopSong, stopTone])

  // Swipe-from-left-edge to exit. Mirrors the iOS system back gesture: a
  // touch that starts within ~24px of the left edge and travels >80px to the
  // right (without going more than ~50px vertically — that would be a scroll)
  // triggers exitJourney. Active only while the journey is running and the
  // screensaver isn't open (the screensaver has its own touch handling and
  // we don't want a swipe out of the immersive view to land on the chooser).
  useEffect(() => {
    if (!mode) return
    if (isScreensaverOpen) return

    const EDGE_ZONE_PX = 24
    const TRIGGER_DX_PX = 80
    const ABORT_DY_PX = 50

    let startX = 0
    let startY = 0
    let tracking = false

    const handleStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      if (t.clientX > EDGE_ZONE_PX) return
      startX = t.clientX
      startY = t.clientY
      tracking = true
    }

    const handleMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      if (!t) return
      const dy = Math.abs(t.clientY - startY)
      if (dy > ABORT_DY_PX) tracking = false
    }

    const handleEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (dx >= TRIGGER_DX_PX && dy <= ABORT_DY_PX) {
        exitJourney()
      }
    }

    const handleCancel = () => {
      tracking = false
    }

    document.addEventListener('touchstart', handleStart, { passive: true })
    document.addEventListener('touchmove', handleMove, { passive: true })
    document.addEventListener('touchend', handleEnd, { passive: true })
    document.addEventListener('touchcancel', handleCancel, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleStart)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
      document.removeEventListener('touchcancel', handleCancel)
    }
  }, [mode, isScreensaverOpen, exitJourney])

  // Detect /journey?song=… on first mount and route the visitor straight to
  // the shared song in manual mode. Runs once per component instance; the
  // search param is cleared after handling so a refresh starts fresh.
  const [searchParams, setSearchParams] = useSearchParams()
  const handledShareLinkRef = useRef(false)

  useEffect(() => {
    if (handledShareLinkRef.current) return
    const songParam = searchParams.get('song')
    if (!songParam) return
    handledShareLinkRef.current = true

    // Restore the leading /audio/ that buildSongShareUrl strips for brevity.
    const fullPath = songParam.startsWith('/audio/') ? songParam : `/audio/${songParam}`

    let foundChakraId: ChakraId | null = null
    let foundSong: ChakraSong | null = null
    for (const id of Object.keys(chakraSongs) as ChakraId[]) {
      const match = chakraSongs[id].find((s) => s.file === fullPath)
      if (match) {
        foundChakraId = id
        foundSong = match
        break
      }
    }

    if (!foundChakraId || !foundSong) {
      // Unknown song — clear the param so refresh doesn't keep retrying and
      // let the visitor pick a journey mode normally.
      setSearchParams({}, { replace: true })
      return
    }

    // Prefer the ascending journey step that matches both chakra and note;
    // fall back to any step on that chakra if the note doesn't line up.
    const ascendingIdx = journeySteps.findIndex(
      (s) => s.chakraId === foundChakraId && s.note === foundSong!.note && s.direction === 'ascending',
    )
    const targetIdx = ascendingIdx >= 0
      ? ascendingIdx
      : journeySteps.findIndex((s) => s.chakraId === foundChakraId)

    if (targetIdx < 0) {
      setSearchParams({}, { replace: true })
      return
    }

    startJourneyFromShareLink(targetIdx, foundSong.file)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, startJourneyFromShareLink])

  useEffect(() => {
    if (!isScreensaverOpen) return

    const hintTimer = window.setTimeout(() => {
      setIsScreensaverHintVisible(false)
    }, 2000)

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsScreensaverHintVisible(false)
        setIsScreensaverOpen(false)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.clearTimeout(hintTimer)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [isScreensaverOpen])

  // Native iOS: hide the system status bar when the screensaver enters
  // immersive fullscreen so the chakra video reaches edge-to-edge with no
  // bezel of carrier/clock/battery glyphs at the top. Restored on close.
  // No-ops on web (the helper short-circuits when not on a native platform).
  useEffect(() => {
    setStatusBarVisible(!isScreensaverOpen)
  }, [isScreensaverOpen])

  // When the chakra changes, fade the screensaver across to the new clip.
  // Strategy: load the new src into the *inactive* video slot, wait for its
  // first frame to decode (loadeddata), then toggle activeSlot. The active
  // slot keeps playing the old chakra without remounting, so it fades out
  // smoothly even on the very first transition (when no clips are cached).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional: sync slot srcs with derived src */
    if (!isScreensaverOpen) {
      setSlotASrc(screensaverSrc)
      setSlotBSrc(screensaverSrc)
      return
    }

    const activeSrc = activeSlot === 'a' ? slotASrc : slotBSrc
    if (activeSrc === screensaverSrc) return

    const targetSlot: 'a' | 'b' = activeSlot === 'a' ? 'b' : 'a'
    const targetCurrentSrc = targetSlot === 'a' ? slotASrc : slotBSrc

    if (targetCurrentSrc !== screensaverSrc) {
      // Stage 1: load the new clip into the inactive slot. The effect re-runs
      // when the slot's src state updates and falls into stage 2 below.
      if (targetSlot === 'a') setSlotASrc(screensaverSrc)
      else setSlotBSrc(screensaverSrc)
      return
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    // Stage 2: inactive slot has the target src; wait for its first frame,
    // then swap active slots so the CSS opacity transition crossfades.
    const video = (targetSlot === 'a' ? slotARef : slotBRef).current
    if (!video) return

    let cancelled = false
    let timeoutId: number | null = null

    const triggerSwap = () => {
      if (cancelled) return
      requestAnimationFrame(() => {
        if (!cancelled) setActiveSlot(targetSlot)
      })
    }

    if (video.readyState >= 2 /* HAVE_CURRENT_DATA */) {
      triggerSwap()
      return () => { cancelled = true }
    }

    const onLoaded = () => {
      video.removeEventListener('loadeddata', onLoaded)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      triggerSwap()
    }

    video.addEventListener('loadeddata', onLoaded)
    // Safety net: if the browser delays loadeddata (some Safari paths skip
    // it for cached/short clips), fall through after a short wait so the
    // fade isn't blocked indefinitely.
    timeoutId = window.setTimeout(() => {
      video.removeEventListener('loadeddata', onLoaded)
      triggerSwap()
    }, 500)

    return () => {
      cancelled = true
      video.removeEventListener('loadeddata', onLoaded)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [screensaverSrc, isScreensaverOpen, activeSlot, slotASrc, slotBSrc])

  const openScreensaver = useCallback(() => {
    const wasMusicPlaying = musicIsPlaying

    // Pre-warm both slots with the current chakra so slot A is immediately
    // visible and slot B is decoded and ready for the first crossfade.
    setSlotASrc(screensaverSrc)
    setSlotBSrc(screensaverSrc)
    setActiveSlot('a')
    setIsScreensaverHintVisible(true)
    setIsScreensaverOpen(true)

    requestAnimationFrame(() => {
      screensaverRef.current?.requestFullscreen?.()
        .then(() => {
          // Some browsers suspend <audio> when entering element fullscreen with heavy video.
          // If music was playing before fullscreen, nudge playback back on so `ended` still fires.
          if (wasMusicPlaying) {
            resumeSong()
          }
        })
        .catch(() => {})
    })
  }, [screensaverSrc, musicIsPlaying, resumeSong])

  const closeScreensaver = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
      return
    }
    setIsScreensaverHintVisible(false)
    setIsScreensaverOpen(false)
  }, [])

  const handleToneToggle = () => {
    // Auto mode and shared-song links both start in audioMode 'music', which
    // sets wantsTone=false. In that state the user tapping the chakra glow
    // (or the small tone play button) needs to *enable* tone mode, not be a
    // no-op. Mirrors the music-side enableMusicMode() behavior.
    if (!wantsTone) {
      toneMutedByUserRef.current = false
      handleAudioModeChange(wantsMusic ? 'both' : 'tone')
      return
    }

    if (toneIsPlaying) {
      stopTone()
      toneMutedByUserRef.current = true
    } else {
      toneMutedByUserRef.current = false
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

  // Build a share URL that recipients can open to land directly on this song.
  // Format: <origin>/journey?song=<chakra>/<filename>. We strip the leading
  // /audio/ from song.file because every track lives there; the loader on
  // the receiving side adds it back.
  const buildSongShareUrl = (file: string): string => {
    const stripped = file.startsWith('/audio/') ? file.slice('/audio/'.length) : file
    const params = new URLSearchParams({ song: stripped })
    return `${window.location.origin}/journey?${params.toString()}`
  }

  const handleSongShare = async (file: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const url = buildSongShareUrl(file)
    try {
      // Prefer the native share sheet on mobile; fall back to clipboard on
      // desktop and on any platform where the share dialog is unavailable.
      if (navigator.share) {
        await navigator.share({ title: 'Chakra Resonance', url })
      } else {
        await navigator.clipboard.writeText(url)
      }
      setShareCopiedFile(file)
      window.setTimeout(() => {
        setShareCopiedFile((current) => (current === file ? null : current))
      }, 1800)
    } catch {
      // User cancelled the share sheet, or clipboard write was blocked.
    }
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
            toneMutedByUserRef.current = true
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
    const rect = event.currentTarget.getBoundingClientRect()
    const clickRatio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)

    if (musicDuration > 0) {
      seekTo(clickRatio * musicDuration)
      return
    }

    // No song loaded yet — load the selected song and move the playhead to
    // the clicked position but stay paused. User must press play to begin.
    const activeSongFile = currentSong ?? selectedSongFile ?? songs[0]?.file ?? null
    if (!activeSongFile) return

    const songIdx = songs.findIndex((s) => s.file === activeSongFile)
    if (songIdx >= 0) {
      manualSongIndexRef.current[`${step.chakraId}:${step.note}`] = songIdx
      setSelectedSongFile(activeSongFile)
    }
    loadSongAt(activeSongFile, clickRatio, { onEnded: onSongEnded })
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
      {/* Floating Exit button — phone-only. The sidebar version is hidden on
          ≤900px so this is the only Exit at that breakpoint. Always visible
          regardless of scroll, anchored to the top-left safe area so it
          clears the notch / Dynamic Island. */}
      <button
        type="button"
        className="journey-exit-floating"
        onClick={exitJourney}
        aria-label="Exit journey"
      >
        <span aria-hidden="true">&larr;</span>
        <span className="journey-exit-floating__label">Exit</span>
      </button>

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
                <JourneyVolumeIcon volume={toneVolume} className="chakra-visual__tone-vol-icon" />
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
                    </div>
                    <div className="music-player__transport audio-dock__transport">
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
                      <button
                        type="button"
                        className={`audio-dock__transport-btn audio-dock__transport-btn--loop${musicIsLooping ? ' audio-dock__transport-btn--loop-on' : ''}`}
                        style={musicIsLooping ? { color: step.color, borderColor: `${step.color}55`, background: `${step.color}1a` } : { color: step.color }}
                        onClick={toggleMusicLoop}
                        aria-label={musicIsLooping ? 'Stop looping song' : 'Loop current song'}
                        aria-pressed={musicIsLooping}
                        disabled={!currentSong && !selectedSongFile}
                      >
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="17 1 21 5 17 9" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="audio-dock__seek"
                      onClick={handleSeek}
                      aria-label={musicDuration > 0 ? 'Seek within song' : 'Start playing from this position'}
                      disabled={!currentSong && !selectedSongFile && songs.length === 0}
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
                        <JourneyVolumeIcon volume={musicVolume} className="audio-dock__vol-icon" />
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
                      <div className="playlist-zone__toggle" role="radiogroup" aria-label="Songs per chakra before advancing">
                        {([
                          { value: 1 as const, label: '1 Song' },
                          { value: 3 as const, label: '3 Songs' },
                          { value: 'all' as const, label: 'Full Playlist' },
                        ]).map(({ value, label }) => {
                          const isActive = manualSongLimit === value
                          return (
                            <button
                              key={String(value)}
                              type="button"
                              className={`playlist-zone__toggle-btn${isActive ? ' playlist-zone__toggle-btn--active' : ''}`}
                              style={isActive ? { borderColor: `${step.color}66`, background: `${step.color}22`, color: step.color } : {}}
                              onClick={() => setManualSongLimit(value)}
                              role="radio"
                              aria-checked={isActive}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="music-playlist" style={{ borderColor: `${step.color}22` }}>
                    <div className="music-playlist__list" role="list">
                      {songs.map((song) => {
                        const isActive = (currentSong ?? selectedSongFile) === song.file
                        const isShareCopied = shareCopiedFile === song.file
                        return (
                          <div
                            key={song.file}
                            role="listitem"
                            className={`music-playlist__item ${isActive ? 'music-playlist__item--active' : ''}`}
                            style={isActive ? { background: `${step.color}22`, borderColor: `${step.color}44` } : {}}
                            aria-current={isActive ? 'true' : undefined}
                          >
                            <button
                              type="button"
                              className="music-playlist__item-select"
                              onClick={() => handleSongSelect(song.file)}
                              aria-label={`Play ${song.title}`}
                            >
                              <span className="music-playlist__item-icon" style={isActive ? { color: step.color } : {}} aria-hidden="true">
                                {isActive && musicIsPlaying ? '⏸' : '▶'}
                              </span>
                              <span className="music-playlist__item-title">{song.title}</span>
                            </button>
                            <button
                              type="button"
                              className={`music-playlist__item-share${isShareCopied ? ' music-playlist__item-share--copied' : ''}`}
                              style={isShareCopied ? { color: step.color } : {}}
                              onClick={(e) => { void handleSongShare(song.file, e) }}
                              aria-label={isShareCopied ? `Link to ${song.title} copied` : `Share link to ${song.title}`}
                            >
                              {isShareCopied ? (
                                <span className="music-playlist__item-share-text">Copied</span>
                              ) : (
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <circle cx="18" cy="5" r="3" />
                                  <circle cx="6" cy="12" r="3" />
                                  <circle cx="18" cy="19" r="3" />
                                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                              )}
                            </button>
                          </div>
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
                    // Manual mode loops continuously, so Previous on step 0
                    // wraps to the final step. Auto mode keeps finite bounds.
                    const prevIndex = currentIndex === 0
                      ? (mode === 'manual' ? totalSteps - 1 : 0)
                      : currentIndex - 1
                    goToStep(prevIndex)
                    if (mode === 'manual' && toneIsPlaying) {
                      void crossfadeTo(journeySteps[prevIndex].frequencyHz)
                    }
                  }}
                  disabled={mode !== 'manual' && currentIndex === 0}
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
                    } else if (mode === 'manual') {
                      // Manual mode loops continuously: wrap back to step 0
                      // instead of ending the journey.
                      goToStep(0)
                      if (toneIsPlaying) {
                        void crossfadeTo(journeySteps[0].frequencyHz)
                      }
                    } else {
                      finishJourney()
                    }
                  }}
                >
                  {mode !== 'manual' && currentIndex === totalSteps - 1 ? 'Complete' : 'Next'} →
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {isScreensaverOpen && (
        <div
          ref={screensaverRef}
          className="journey-color-immersion"
          onClick={closeScreensaver}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === ' ') closeScreensaver() }}
          role="button"
          tabIndex={0}
          aria-label={`Close ${step.name} full-screen screensaver`}
        >
          <video
            ref={slotARef}
            key="screensaver-slot-a"
            className={[
              'journey-color-immersion__video',
              activeSlot === 'a' ? 'journey-color-immersion__video--active' : '',
            ].join(' ').trim()}
            src={mediaUrl(slotASrc)}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <video
            ref={slotBRef}
            key="screensaver-slot-b"
            className={[
              'journey-color-immersion__video',
              activeSlot === 'b' ? 'journey-color-immersion__video--active' : '',
            ].join(' ').trim()}
            src={mediaUrl(slotBSrc)}
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
        </div>
      )}
    </div>
  )
}
