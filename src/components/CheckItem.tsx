import { useState, useCallback } from 'react'
import './CheckItem.css'

interface CheckItemProps {
  text: string
  checked: boolean
  index: number
  disabled?: boolean
  onToggle: () => void
}

export function CheckItem({ text, checked, index, disabled, onToggle }: CheckItemProps) {
  const [animating, setAnimating] = useState(false)

  const handleClick = useCallback(() => {
    if (disabled) return
    if (!checked) {
      setAnimating(true)
      setTimeout(() => setAnimating(false), 400)
    }
    onToggle()
  }, [disabled, onToggle, checked])

  const cls = [
    'check-item',
    checked && 'check-item--checked',
    animating && 'check-item--animate',
    disabled && 'check-item--disabled',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      onClick={handleClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') handleClick()
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <div className="check-item__box">
        <svg
          className="check-item__checkmark"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M3 8.5l3.5 3.5L13 5"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="check-item__text">{text}</span>
      <span className="check-item__number">{index + 1}</span>
    </div>
  )
}
