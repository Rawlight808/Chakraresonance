import { useCallback, useEffect, useRef, useState } from 'react'

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext: typeof AudioContext
}

type TonePlayer = {
  playTone: (frequencyHz: number) => Promise<void>
  stopTone: () => void
  crossfadeTo: (frequencyHz: number) => Promise<void>
  setVolume: (nextVolume: number) => void
  isPlaying: boolean
  currentFrequency: number | null
  volume: number
}

const FADE_IN = 0.4
const FADE_OUT = 0.3
const CROSSFADE = 0.8
const MAX_GAIN = 0.35
const DEFAULT_VOLUME = 0.75

export function useTonePlayer(): TonePlayer {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFrequency, setCurrentFrequency] = useState<number | null>(null)
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME)
  const volumeRef = useRef(DEFAULT_VOLUME)

  const getTargetGain = useCallback((v: number) => MAX_GAIN * v, [])

  const getContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContextClass =
        window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext
      audioContextRef.current = new AudioContextClass()
    }

    if (audioContextRef.current.state !== 'running') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
  }, [])

  const stopTone = useCallback(() => {
    const ctx = audioContextRef.current
    const oscillator = oscillatorRef.current
    const gainNode = gainNodeRef.current

    if (ctx && oscillator && gainNode) {
      const now = ctx.currentTime
      gainNode.gain.cancelScheduledValues(now)
      gainNode.gain.setValueAtTime(gainNode.gain.value, now)
      gainNode.gain.linearRampToValueAtTime(0, now + FADE_OUT)
      oscillator.stop(now + FADE_OUT + 0.05)
    }

    oscillatorRef.current = null
    gainNodeRef.current = null
    setIsPlaying(false)
    setCurrentFrequency(null)
  }, [])

  const setVolume = useCallback(
    (nextVolume: number) => {
      const normalizedVolume = Math.max(0, Math.min(1, nextVolume))
      volumeRef.current = normalizedVolume
      setVolumeState(normalizedVolume)

      const ctx = audioContextRef.current
      const gainNode = gainNodeRef.current

      if (ctx && gainNode) {
        const now = ctx.currentTime
        gainNode.gain.cancelScheduledValues(now)
        gainNode.gain.setValueAtTime(gainNode.gain.value, now)
        gainNode.gain.linearRampToValueAtTime(getTargetGain(normalizedVolume), now + 0.12)
      }
    },
    [getTargetGain],
  )

  const playTone = useCallback(
    async (frequencyHz: number) => {
      const ctx = await getContext()

      if (oscillatorRef.current) {
        stopTone()
      }

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = frequencyHz

      gainNode.gain.value = 0
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      const now = ctx.currentTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(getTargetGain(volumeRef.current), now + FADE_IN)

      oscillator.start(now)

      oscillatorRef.current = oscillator
      gainNodeRef.current = gainNode

      setIsPlaying(true)
      setCurrentFrequency(frequencyHz)
    },
    [getContext, getTargetGain, stopTone],
  )

  const crossfadeTo = useCallback(
    async (frequencyHz: number) => {
      const ctx = await getContext()
      const oldOsc = oscillatorRef.current
      const oldGain = gainNodeRef.current

      const newOsc = ctx.createOscillator()
      const newGain = ctx.createGain()

      newOsc.type = 'sine'
      newOsc.frequency.value = frequencyHz
      newGain.gain.value = 0
      newOsc.connect(newGain)
      newGain.connect(ctx.destination)

      const now = ctx.currentTime

      if (oldOsc && oldGain) {
        oldGain.gain.cancelScheduledValues(now)
        oldGain.gain.setValueAtTime(oldGain.gain.value, now)
        oldGain.gain.linearRampToValueAtTime(0, now + CROSSFADE)
        oldOsc.stop(now + CROSSFADE + 0.05)
      }

      newGain.gain.setValueAtTime(0, now)
      newGain.gain.linearRampToValueAtTime(getTargetGain(volumeRef.current), now + CROSSFADE)
      newOsc.start(now)

      oscillatorRef.current = newOsc
      gainNodeRef.current = newGain

      setIsPlaying(true)
      setCurrentFrequency(frequencyHz)
    },
    [getContext, getTargetGain],
  )

  useEffect(() => {
    return () => {
      stopTone()
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [stopTone])

  return { playTone, stopTone, crossfadeTo, setVolume, isPlaying, currentFrequency, volume }
}
