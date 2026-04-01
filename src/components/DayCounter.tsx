import './DayCounter.css'

interface DayCounterProps {
  day: number
  totalDays: number
  completedToday: boolean
  celebrate: boolean
}

export function DayCounter({ day, totalDays, completedToday, celebrate }: DayCounterProps) {
  const cls = [
    'day-counter',
    completedToday && 'day-counter--complete',
    celebrate && 'day-counter--celebrate',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      <div className="day-counter__label">Day</div>
      <div className="day-counter__number">{day}</div>
      <div className="day-counter__of">of {totalDays}</div>
    </div>
  )
}
