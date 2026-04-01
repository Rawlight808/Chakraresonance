import { useCallback, useEffect, useRef, useState } from 'react'

export interface MusicPlayerState {
  playSong: (url: string) => void
  pauseSong: () => void
  resumeSong: () => void
  stopSong: () => void
  isPlaying: boolean
  currentSong: string | null
  progress: number
  duration: number
}

export function useMusicPlayer(): MusicPlayerState {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSong, setCurrentSong] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const rafRef = useRef<number | null>(null)

  const updateProgress = useCallback(() => {
    const audio = audioRef.current
    if (audio && !audio.paused) {
      setProgress(audio.currentTime)
      setDuration(audio.duration || 0)
      rafRef.current = requestAnimationFrame(updateProgress)
    }
  }, [])

  const stopProgressLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const playSong = useCallback(
    (url: string) => {
      if (audioRef.current) {
        audioRef.current.pause()
        stopProgressLoop()
      }

      const audio = new Audio(url)
      audio.volume = 0.85

      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setProgress(0)
        stopProgressLoop()
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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      stopProgressLoop()
    }
  }, [stopProgressLoop])

  return { playSong, pauseSong, resumeSong, stopSong, isPlaying, currentSong, progress, duration }
}
