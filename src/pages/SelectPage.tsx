import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useChallenge, REQUIRED_TOP } from '../hooks/useChallenge'
import './SelectPage.css'

export function SelectPage() {
  const { items, phase, loading, saveTopTwelve } = useChallenge()
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const existing = items.filter(i => i.is_top_twelve).map(i => i.id)
    if (existing.length > 0) setSelectedIds(new Set(existing))
  }, [items])

  if (loading) {
    return <div className="select__loading">Loading…</div>
  }

  if (phase === 'setup') return <Navigate to="/setup" replace />
  if (phase === 'ready') return <Navigate to="/dashboard" replace />

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < REQUIRED_TOP) {
        next.add(id)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (selectedIds.size !== REQUIRED_TOP) return
    setSaving(true)
    await saveTopTwelve(Array.from(selectedIds))
    setSaving(false)
    navigate('/dashboard')
  }

  return (
    <div className="select">
      <div className="select__header">
        <h1 className="select__title">Choose Your Top 12</h1>
        <p className="select__subtitle">
          These 12 habits will be your daily commitment for 100 days. Choose the ones
          that matter most.
        </p>
      </div>

      <div className="select__counter">
        {selectedIds.size}
        <span className="select__counter-dim"> / {REQUIRED_TOP}</span>
      </div>

      <div className="select__grid">
        {items.map((item, i) => {
          const selected = selectedIds.has(item.id)
          return (
            <div
              key={item.id}
              className={`select__item ${selected ? 'select__item--selected' : ''}`}
              onClick={() => toggle(item.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') toggle(item.id)
              }}
              role="button"
              tabIndex={0}
            >
              <span className="select__item-num">{i + 1}</span>
              <span className="select__item-text">{item.text}</span>
              <div className="select__item-check">
                {selected && (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8.5l3.5 3.5L13 5"
                      stroke="#000"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="select__actions">
        <button
          className="select__btn"
          disabled={selectedIds.size !== REQUIRED_TOP || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Lock In & Start'}
        </button>
      </div>
    </div>
  )
}
