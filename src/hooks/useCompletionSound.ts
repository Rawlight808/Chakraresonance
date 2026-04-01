import { useCallback, useRef } from 'react'

export function useCompletionSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  const playCheck = useCallback(() => {
    const ctx = getCtx()
    const now = ctx.currentTime
    const notes = [523.25, 659.25]
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = notes[i]
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = now + i * 0.08
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      osc.start(t)
      osc.stop(t + 0.25)
    }
  }, [getCtx])

  const playUncheck = useCallback(() => {
    const ctx = getCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, now)
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    osc.start(now)
    osc.stop(now + 0.25)
  }, [getCtx])

  const playAllComplete = useCallback(() => {
    const ctx = getCtx()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = notes[i]
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = now + i * 0.1
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.start(t)
      osc.stop(t + 0.6)
    }
  }, [getCtx])

  return { playCheck, playUncheck, playAllComplete }
}
