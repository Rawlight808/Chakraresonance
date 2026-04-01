import { useState, useMemo, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useChallenge, REQUIRED_ITEMS } from '../hooks/useChallenge'
import './SetupPage.css'

export function SetupPage() {
  const { items, phase, loading, saveItems } = useChallenge()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (items.length > 0) {
      setText(items.map(i => i.text).join('\n'))
    }
  }, [items])

  const lines = useMemo(
    () => text.split('\n').filter(l => l.trim().length > 0),
    [text],
  )

  if (loading) {
    return (
      <div className="setup__loading">
        Loading…
      </div>
    )
  }

  if (phase === 'select') return <Navigate to="/select" replace />
  if (phase === 'ready') return <Navigate to="/dashboard" replace />

  const pct = Math.min(100, (lines.length / REQUIRED_ITEMS) * 100)

  const handleSave = async () => {
    if (lines.length < REQUIRED_ITEMS) return
    setSaving(true)
    await saveItems(lines.slice(0, REQUIRED_ITEMS).map(l => l.trim()))
    setSaving(false)
    navigate('/select')
  }

  return (
    <div className="setup">
      <div className="setup__header">
        <h1 className="setup__title">Build Your 100 List</h1>
        <p className="setup__subtitle">
          Write 100 things that would genuinely improve your life. One per line. Be
          specific, be honest, dream big.
        </p>
      </div>

      <div className="setup__counter">
        {lines.length}
        <span className="setup__counter-dim"> / {REQUIRED_ITEMS}</span>
        <span className="setup__counter-label">items added</span>
      </div>

      <div className="setup__progress">
        <div className="setup__progress-bar" style={{ width: `${pct}%` }} />
      </div>

      <textarea
        className="setup__textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={
          '1. Wake up at 6 am every day\n2. Meditate for 10 minutes\n3. Exercise for 30 minutes\n4. Read for 20 minutes\n5. Drink 8 glasses of water\n…\n\nPaste your full list or type one item per line'
        }
        spellCheck
      />

      <div className="setup__actions">
        <button
          className="setup__btn"
          disabled={lines.length < REQUIRED_ITEMS || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>

      {lines.length > 0 && lines.length < REQUIRED_ITEMS && (
        <p className="setup__hint">
          {REQUIRED_ITEMS - lines.length} more to go — you've got this.
        </p>
      )}
      {lines.length >= REQUIRED_ITEMS && (
        <p className="setup__hint setup__hint--ready">
          Ready! Click Save &amp; Continue to proceed.
        </p>
      )}
    </div>
  )
}
