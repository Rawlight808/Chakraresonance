import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export const REQUIRED_ITEMS = 100
export const REQUIRED_TOP = 12
export const REQUIRED_DAYS = 100

export interface Item {
  id: string
  user_id: string
  text: string
  is_top_twelve: boolean
  position: number
}

export interface DailyLog {
  id: string
  user_id: string
  log_date: string
  completed_item_ids: string[]
  all_completed: boolean
}

export interface Streak {
  user_id: string
  current_day: number
  streak_start_date: string | null
  last_perfect_date: string | null
}

export type Phase = 'loading' | 'setup' | 'select' | 'ready'

function toDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function localToday(): string {
  return toDateStr(new Date())
}

function localYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toDateStr(d)
}

export function useChallenge() {
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null)
  const [streak, setStreak] = useState<Streak | null>(null)
  const [loading, setLoading] = useState(true)
  const [justCompleted, setJustCompleted] = useState(false)

  const todayLogRef = useRef<DailyLog | null>(null)
  const streakRef = useRef<Streak | null>(null)

  const today = localToday()
  const yesterday = localYesterday()

  const topTwelve = useMemo(() => items.filter(i => i.is_top_twelve), [items])

  const phase: Phase = useMemo(() => {
    if (loading) return 'loading'
    if (items.length < REQUIRED_ITEMS) return 'setup'
    if (topTwelve.length < REQUIRED_TOP) return 'select'
    return 'ready'
  }, [loading, items.length, topTwelve.length])

  const displayDay = useMemo((): { day: number; completedToday: boolean } => {
    if (!streak) return { day: 1, completedToday: false }
    if (streak.last_perfect_date === today)
      return { day: streak.current_day, completedToday: true }
    if (streak.last_perfect_date === yesterday)
      return { day: streak.current_day + 1, completedToday: false }
    return { day: 1, completedToday: false }
  }, [streak, today, yesterday])

  const completedIds = useMemo(
    () => new Set<string>(todayLog?.completed_item_ids ?? []),
    [todayLog],
  )

  useEffect(() => {
    todayLogRef.current = todayLog
  }, [todayLog])

  useEffect(() => {
    streakRef.current = streak
  }, [streak])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [itemsRes, logRes, streakRes] = await Promise.all([
      supabase.from('items').select('*').eq('user_id', user.id).order('position'),
      supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', today)
        .maybeSingle(),
      supabase.from('streaks').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    setItems((itemsRes.data ?? []) as Item[])

    const log = logRes.data as DailyLog | null
    setTodayLog(log)
    todayLogRef.current = log

    let s = streakRes.data as Streak | null

    if (!s) {
      const { data } = await supabase
        .from('streaks')
        .insert({ user_id: user.id, current_day: 0, streak_start_date: today })
        .select()
        .single()
      s = data as Streak
    } else if (
      s.last_perfect_date &&
      s.last_perfect_date !== today &&
      s.last_perfect_date !== yesterday
    ) {
      const { data } = await supabase
        .from('streaks')
        .update({
          current_day: 0,
          last_perfect_date: null,
          streak_start_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single()
      s = data as Streak
    }

    setStreak(s)
    streakRef.current = s
    setLoading(false)
  }, [user, today, yesterday])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveItems = useCallback(
    async (texts: string[]) => {
      if (!user) return
      await supabase.from('daily_logs').delete().eq('user_id', user.id)
      await supabase.from('items').delete().eq('user_id', user.id)

      const rows = texts.map((text, i) => ({
        user_id: user.id,
        text,
        is_top_twelve: false,
        position: i,
      }))
      const { data } = await supabase
        .from('items')
        .insert(rows)
        .select()
        .order('position')
      if (data) setItems(data as Item[])

      await supabase
        .from('streaks')
        .update({
          current_day: 0,
          last_perfect_date: null,
          streak_start_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    },
    [user, today],
  )

  const saveTopTwelve = useCallback(
    async (selectedIds: string[]) => {
      if (!user) return
      await supabase
        .from('items')
        .update({ is_top_twelve: false })
        .eq('user_id', user.id)
      await supabase
        .from('items')
        .update({ is_top_twelve: true })
        .in('id', selectedIds)

      const { data } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('position')
      if (data) setItems(data as Item[])
    },
    [user],
  )

  const toggleItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      if (!user) return false

      let log = todayLogRef.current
      if (!log) {
        const { data } = await supabase
          .from('daily_logs')
          .upsert(
            {
              user_id: user.id,
              log_date: today,
              completed_item_ids: [],
              all_completed: false,
            },
            { onConflict: 'user_id,log_date' },
          )
          .select()
          .single()
        log = data as DailyLog
        todayLogRef.current = log
      }

      const currentIds: string[] = log.completed_item_ids ?? []
      const isChecking = !currentIds.includes(itemId)
      const newIds = isChecking
        ? [...currentIds, itemId]
        : currentIds.filter(id => id !== itemId)

      const allDone =
        topTwelve.length === REQUIRED_TOP &&
        topTwelve.every(item => newIds.includes(item.id))

      const updatedLog = { ...log, completed_item_ids: newIds, all_completed: allDone }
      todayLogRef.current = updatedLog
      setTodayLog(updatedLog)

      await supabase
        .from('daily_logs')
        .update({ completed_item_ids: newIds, all_completed: allDone })
        .eq('id', log.id)

      if (allDone && streakRef.current && streakRef.current.last_perfect_date !== today) {
        const s = streakRef.current
        const newDay = s.last_perfect_date === yesterday ? s.current_day + 1 : 1

        const { data: updated } = await supabase
          .from('streaks')
          .update({
            current_day: newDay,
            last_perfect_date: today,
            streak_start_date: s.last_perfect_date === yesterday ? s.streak_start_date : today,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .select()
          .single()

        if (updated) {
          setStreak(updated as Streak)
          streakRef.current = updated as Streak
        }
        setJustCompleted(true)
      }

      return isChecking
    },
    [user, today, yesterday, topTwelve],
  )

  return {
    items,
    topTwelve,
    todayLog,
    streak,
    displayDay,
    phase,
    loading,
    completedIds,
    justCompleted,
    setJustCompleted,
    saveItems,
    saveTopTwelve,
    toggleItem,
    reload: loadData,
  }
}
