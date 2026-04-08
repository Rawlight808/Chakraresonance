import { useCallback, useEffect, useRef, useState } from 'react'

export interface MusicPlayerState {
  playSong: (url: string, options?: { onEnded?: () => void }) => void
  pauseSong: () => void
  resumeSong: () => void
  seekTo: (timeSeconds: number) => void
  stopSong: () => void
  setVolume: (nextVolume: number) => void
  isPlaying: boolean
  currentSong: string | null
  progress: number
  duration: number
  volume: number
}

export function useMusicPlayer(): MusicPlayerState {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
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

  const playSong = useCallback(
    (url: string, options?: { onEnded?: () => void }) => {
      if (audioRef.current) {
        audioRef.current.pause()
        stopProgressLoop()
      }

      const audio = new Audio(url)
      audio.volume = volumeRef.current

      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setProgress(0)
        stopProgressLoop()
        options?.onEnded?.()
      })

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
      })

      audioRef.current = audio
      setCurrentSong(url)
      setProgress(0)

      audio.play().then(() => {
        setIsPlaying(true)
        rafRef.current = requestAnimationFrame(updateProgress)
      })
    },
    [updateProgress, stopProgressLoop],
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
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setIsPlaying(false)
    setCurrentSong(null)
    setProgress(0)
    setDuration(0)
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

  return { playSong, pauseSong, resumeSong, seekTo, stopSong, setVolume, isPlaying, currentSong, progress, duration, volume }
}
