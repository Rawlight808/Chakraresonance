import { useCallback, useEffect, useRef, useState } from 'react'

export interface MusicPlayerState {
  playSong: (url: string, options?: { onEnded?: () => void }) => void
  pauseSong: () => void
  resumeSong: () => void
  seekTo: (timeSeconds: number) => void
  stopSong: () => void
  setVolume: (nextVolume: number) => void
  isPlaying: boolean
  isLoading: boolean
  error: string | null
  currentSong: string | null
  progress: number
  duration: number
  volume: number
}

export function useMusicPlayer(): MusicPlayerState {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const onEndedRef = useRef<(() => void) | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSong, setCurrentSong] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.85)
  const volumeRef = useRef(0.85)
  const rafRef = useRef<number | null>(null)
  const updateProgressRef = useRef<() => void>(() => {})

  const updateProgress = useCallback(() => {
    const audio = audioRef.current
    if (audio && !audio.paused) {
      setProgress(audio.currentTime)
      setDuration(audio.duration || 0)
      rafRef.current = requestAnimationFrame(updateProgressRef.current)
    }
  }, [])

  useEffect(() => {
    updateProgressRef.current = updateProgress
  }, [updateProgress])

  const stopProgressLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // Reuse one <audio> element across all tracks. Safari ties the user-gesture
  // unlock to a specific HTMLAudioElement; creating a new Audio() inside an
  // 'ended' callback (especially right after a fullscreen transition) drops
  // that token and .play() gets blocked. Reusing the element preserves it.
  const getAudioEl = useCallback(() => {
    if (audioRef.current) return audioRef.current

    const audio = new Audio()
    audio.preload = 'auto'
    audio.volume = volumeRef.current

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setProgress(0)
      stopProgressLoop()
      onEndedRef.current?.()
    })

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration)
      setIsLoading(false)
    })

    audio.addEventListener('error', () => {
      setIsLoading(false)
      setIsPlaying(false)
      setError('Unable to load this track')
      stopProgressLoop()
    })

    audioRef.current = audio
    return audio
  }, [stopProgressLoop])

  const playSong = useCallback(
    (url: string, options?: { onEnded?: () => void }) => {
      const audio = getAudioEl()

      // Swap handler per-call without rebinding listeners (preserves gesture).
      onEndedRef.current = options?.onEnded ?? null

      stopProgressLoop()

      setIsLoading(true)
      setError(null)
      setCurrentSong(url)
      setProgress(0)

      if (audio.src !== url) {
        audio.src = url
      } else {
        audio.currentTime = 0
      }

      audio.play().then(() => {
        setIsPlaying(true)
        rafRef.current = requestAnimationFrame(updateProgress)
      }).catch(() => {
        setIsLoading(false)
        setIsPlaying(false)
        setError('Playback was blocked — tap anywhere and try again')
      })
    },
    [getAudioEl, updateProgress, stopProgressLoop],
  )

  const pauseSong = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsPlaying(false)
      stopProgressLoop()
    }
  }, [stopProgressLoop])

  const resumeSong = useCallback(() => {
    if (audioRef.current && audioRef.current.paused && currentSong) {
      audioRef.current.play().then(() => {
        setIsPlaying(true)
        rafRef.current = requestAnimationFrame(updateProgress)
      }).catch(() => {
        setError('Playback was blocked — tap anywhere and try again')
      })
    }
  }, [currentSong, updateProgress])

  const seekTo = useCallback((timeSeconds: number) => {
    const audio = audioRef.current
    if (!audio) return

    const nextTime = Math.min(Math.max(timeSeconds, 0), audio.duration || 0)
    audio.currentTime = nextTime
    setProgress(nextTime)
    setDuration(audio.duration || 0)
  }, [])

  const stopSong = useCallback(() => {
    // Keep the audio element alive so Safari retains its user-gesture unlock;
    // just pause and reset state. The element is only torn down on unmount.
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      } catch {
        // Safari can throw if currentTime is set before metadata — ignore.
      }
    }
    onEndedRef.current = null
    setIsPlaying(false)
    setCurrentSong(null)
    setProgress(0)
    setDuration(0)
    setError(null)
    stopProgressLoop()
  }, [stopProgressLoop])

  const setVolume = useCallback((nextVolume: number) => {
    const normalizedVolume = Math.max(0, Math.min(1, nextVolume))
    volumeRef.current = normalizedVolume
    setVolumeState(normalizedVolume)

    if (audioRef.current) {
      audioRef.current.volume = normalizedVolume
    }
  }, [])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      stopProgressLoop()
    }
  }, [stopProgressLoop])

  return {
    playSong, pauseSong, resumeSong, seekTo, stopSong, setVolume,
    isPlaying, isLoading, error, currentSong, progress, duration, volume,
  }
}
