import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useChallenge, REQUIRED_TOP, REQUIRED_DAYS } from '../hooks/useChallenge'
import { useCompletionSound } from '../hooks/useCompletionSound'
import { DayCounter } from '../components/DayCounter'
import { CheckItem } from '../components/CheckItem'
import './DashboardPage.css'

export function DashboardPage() {
  const { signOut } = useAuth()
  const {
    topTwelve,
    displayDay,
    phase,
    loading,
    completedIds,
    justCompleted,
    setJustCompleted,
    toggleItem,
  } = useChallenge()
  const { playCheck, playUncheck, playAllComplete } = useCompletionSound()
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    if (justCompleted) {
      setCelebrate(true)
      playAllComplete()
      const timer = setTimeout(() => {
        setCelebrate(false)
        setJustCompleted(false)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [justCompleted, playAllComplete, setJustCompleted])

  const handleToggle = useCallback(
    async (itemId: string) => {
      const isCurrentlyChecked = completedIds.has(itemId)
      if (!isCurrentlyChecked) {
        playCheck()
      } else {
        playUncheck()
      }
      await toggleItem(itemId)
    },
    [toggleItem, playCheck, playUncheck, completedIds],
  )

  if (loading) {
    return <div className="dashboard__loading">Loading…</div>
  }

  if (phase === 'setup') return <Navigate to="/setup" replace />
  if (phase === 'select') return <Navigate to="/select" replace />

  const completedCount = topTwelve.filter(item => completedIds.has(item.id)).length
  const progressPct = (completedCount / REQUIRED_TOP) * 100

  return (
    <div className="dashboard">
      <div className="dashboard__nav">
        <button className="dashboard__signout" type="button" onClick={signOut}>
          Sign Out
        </button>
      </div>

      <DayCounter
        day={displayDay.day}
        totalDays={REQUIRED_DAYS}
        completedToday={displayDay.completedToday}
        celebrate={celebrate}
      />

      <div className="dashboard__progress-section">
        <div className="dashboard__progress-label">
          {completedCount} of {REQUIRED_TOP} complete today
        </div>
        <div className="dashboard__progress-bar">
          <div
            className="dashboard__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="dashboard__items">
        {topTwelve.map((item, i) => (
          <CheckItem
            key={item.id}
            text={item.text}
            checked={completedIds.has(item.id)}
            index={i}
            disabled={displayDay.completedToday}
            onToggle={() => handleToggle(item.id)}
          />
        ))}
      </div>

      {displayDay.completedToday && (
        <div className="dashboard__complete-msg">
          <div className="dashboard__complete-title">
            {displayDay.day >= REQUIRED_DAYS
              ? 'You did it. 100 days of 100%.'
              : `Day ${displayDay.day} — Complete`}
          </div>
          <div className="dashboard__complete-text">
            {displayDay.day >= REQUIRED_DAYS
              ? 'Incredible. You committed and followed through. This is who you are now.'
              : `Come back tomorrow for Day ${displayDay.day + 1}. You're unstoppable.`}
          </div>
        </div>
      )}

      {celebrate && (
        <div className="dashboard__celebration" aria-hidden="true">
          <div className="dashboard__celebration-burst" />
        </div>
      )}
    </div>
  )
}
