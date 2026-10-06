import { useState } from 'react'
import {
  GOAL_OPTIONS,
  MAX_SIPS,
  buildChart,
  formatGap,
  gapStats,
  groupSips,
  mlOnDay,
} from './lib/drinkLog.js'

export default function History({ sips, now, goal, onGoal, onRemove, onClear, onClose }) {
  const [confirmingClear, setConfirmingClear] = useState(false)
  if (sips.length === 0 && confirmingClear) setConfirmingClear(false)
  const todayMl = mlOnDay(sips, now)
  const filled = Math.min(100, Math.round((todayMl / goal) * 100))
  const chart = buildChart(sips)
  const days = groupSips(sips, now)
  const gaps = gapStats(sips)
  const maxCount = Math.max(...chart.bars.map((bar) => bar.count), 1)

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-3 bg-glass/95 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
          <h2 className="text-base font-medium">Today</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm whitespace-nowrap tabular-nums text-glass-muted">
              {todayMl.toLocaleString()} / {goal.toLocaleString()} ml
            </p>
            <button
              id="close-history"
              type="button"
              onClick={onClose}
              aria-label="Close history"
              className="grid size-11 shrink-0 place-items-center rounded-full text-glass-ink shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)] transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glass-ink"
            >
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(todayMl, goal)}
          aria-label="Today's water toward the daily goal"
        >
          <div className="h-full rounded-full bg-glass-bar" style={{ width: `${filled}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {GOAL_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === goal}
              aria-label={`${option.toLocaleString()} ml daily goal`}
              onClick={() => onGoal(option)}
              className={`min-h-9 rounded-full px-1 text-sm tabular-nums shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)] ${
                option === goal ? 'bg-white/16 text-glass-ink' : 'bg-white/8 text-glass-muted'
              }`}
            >
              {(option / 1000).toLocaleString()} L
            </button>
          ))}
        </div>
      </section>

      {sips.length === 0 ? (
        <p className="text-base text-pretty text-glass-muted">
          No drinks yet. Tap the water to log one.
        </p>
      ) : (
        <>
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-sm text-glass-muted">Drinks</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{sips.length}</dd>
        </div>
        {gaps && (
          <>
            <div>
              <dt className="text-sm text-glass-muted">Avg gap</dt>
              <dd className="mt-1 text-lg font-medium tabular-nums">
                {formatGap(gaps.average)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-glass-muted">Longest</dt>
              <dd className="mt-1 text-lg font-medium tabular-nums">
                {formatGap(gaps.longest)}
              </dd>
            </div>
          </>
        )}
      </dl>

      {sips.length === MAX_SIPS && (
        <p className="-mt-4 text-sm text-pretty text-glass-muted">
          Latest 50 drinks
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">
          {chart.unit === 'hour' ? 'By hour' : 'By day'}
        </h2>
        <div className="overflow-x-auto">
          <div
            className="grid w-max gap-2"
            style={{
              gridTemplateColumns: `repeat(${chart.bars.length}, 2.75rem)`,
            }}
          >
            {chart.bars.map((bar) => (
              <div key={bar.key} className="flex flex-col justify-end gap-2">
                <span className="text-center text-xs tabular-nums">
                  {bar.count > 0 ? bar.count : '\u00a0'}
                </span>
                <div className="border-b border-white/20">
                  <div
                    className="rounded-t-md bg-glass-bar"
                    style={{
                      height: bar.count
                        ? `${Math.max(0.5, (bar.count / maxCount) * 5.5)}rem`
                        : 0,
                    }}
                  />
                </div>
                <span className="text-center text-xs text-pretty text-glass-muted">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-base font-medium">Timeline</h2>
        {days.map((day) => (
          <div key={day.key} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm text-glass-muted">{day.label}</h3>
              <p className="text-sm tabular-nums text-glass-muted">{day.ml} ml</p>
            </div>
            <ol className="flex flex-col">
              {day.drinks.map((drink, index) => (
                <li key={`${day.key}-${drink.at}`} className="relative pl-5">
                  {index < day.drinks.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-3 bottom-0 left-[3px] w-px bg-white/20"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 left-0 size-2 rounded-full bg-glass-bar"
                  />
                  {drink.gap != null && (
                    <p className="pb-2 text-xs text-glass-muted tabular-nums">
                      {formatGap(drink.gap)} later
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3 pb-3">
                    <span className="text-sm tabular-nums">{drink.clock}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm tabular-nums text-glass-muted">{drink.ml} ml</span>
                      <button
                        type="button"
                        onClick={() => onRemove(drink.at)}
                        aria-label={`Delete ${day.label} ${drink.clock}, ${drink.ml} ml`}
                        className="min-h-11 rounded-full px-3 text-sm text-glass-muted shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]"
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 border-t border-white/10 pt-6">
        {confirmingClear ? (
          <>
            <p className="text-sm text-pretty text-glass-muted">
              This removes every drink on this device.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingClear(false)
                  onClear()
                }}
                className="min-h-11 flex-1 rounded-full bg-white/16 px-4 text-sm text-glass-ink shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="min-h-11 flex-1 rounded-full bg-white/8 px-4 text-sm text-glass-muted shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            className="min-h-11 rounded-full bg-white/8 px-4 text-sm text-glass-ink shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]"
          >
            Clear all
          </button>
        )}
      </section>
        </>
      )}
    </div>
  )
}
