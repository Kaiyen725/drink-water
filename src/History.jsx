import {
  GOAL_OPTIONS,
  MAX_SIPS,
  buildChart,
  formatGap,
  gapStats,
  groupSips,
  mlOnDay,
} from './lib/drinkLog.js'

export default function History({ sips, now, goal, onGoal }) {
  const todayMl = mlOnDay(sips, now)
  const filled = Math.min(100, Math.round((todayMl / goal) * 100))
  const chart = buildChart(sips)
  const days = groupSips(sips, now)
  const gaps = gapStats(sips)
  const maxCount = Math.max(...chart.bars.map((bar) => bar.count), 1)

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-baseline justify-between gap-3 pr-24">
          <h2 className="text-base font-medium">Today</h2>
          <p className="text-sm tabular-nums text-glass-muted">
            {todayMl.toLocaleString()} / {goal.toLocaleString()} ml
          </p>
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
                  <div className="flex items-baseline justify-between gap-3 pb-4">
                    <span className="text-sm tabular-nums">{drink.clock}</span>
                    <span className="text-sm tabular-nums text-glass-muted">{drink.ml} ml</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
        </>
      )}
    </div>
  )
}
