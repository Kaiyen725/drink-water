import { useEffect, useRef, useState } from 'react'
import History from './History.jsx'
import WaterBackground from './WaterBackground.jsx'
import {
  DEFAULT_ML_KEY,
  GOAL_KEY,
  MAX_SIPS,
  QUICK_DRINKS,
  SIP_KEY,
  addSip,
  clearSips,
  enforceCap,
  formatElapsed,
  formatWhen,
  hydrationReminder,
  mlOnDay,
  readDefaultMl,
  readGoal,
  readSips,
  removeSip,
  saveDefaultMl,
  saveGoal,
  speakElapsed,
  tideLevel,
} from './lib/drinkLog.js'

export default function App() {
  const [sips, setSips] = useState(enforceCap)
  const [goal, setGoal] = useState(readGoal)
  const [defaultMl, setDefaultMl] = useState(readDefaultMl)
  const [now, setNow] = useState(() => Date.now())
  const [saveError, setSaveError] = useState(false)
  const [notice, setNotice] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [splash, setSplash] = useState(null)
  const tapXRef = useRef(null)
  const historyButtonRef = useRef(null)
  const historyWasOpen = useRef(false)

  useEffect(() => {
    let id = 0

    const tick = () => setNow(Date.now())
    const start = () => {
      window.clearInterval(id)
      tick()
      id = window.setInterval(tick, 1000)
    }
    const stop = () => window.clearInterval(id)
    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!historyOpen) return
    const onKey = (event) => {
      if (event.key === 'Escape') setHistoryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyOpen])

  useEffect(() => {
    if (historyOpen) {
      historyWasOpen.current = true
      document.getElementById('close-history')?.focus()
      return
    }
    if (historyWasOpen.current) historyButtonRef.current?.focus()
  }, [historyOpen])

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === SIP_KEY) setSips(readSips())
      if (event.key === GOAL_KEY) setGoal(readGoal())
      if (event.key === DEFAULT_ML_KEY) setDefaultMl(readDefaultMl())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const last = sips.at(-1) ?? null
  const elapsed = last == null ? null : Math.max(0, now - last.at)
  const fresh = elapsed != null && elapsed < 5000
  const reminder = fresh ? null : hydrationReminder(sips, now)
  const todayMl = mlOnDay(sips, now)
  const level = tideLevel(todayMl / goal)

  function rememberTap(event) {
    tapXRef.current = event.clientX / Math.max(window.innerWidth, 1)
  }

  function logDrink(ml, at, x) {
    setSplash({ id: at, x })
    navigator.vibrate?.(12)
    try {
      setSips(addSip(at, ml))
      setSaveError(false)
    } catch {
      setSips((current) => [...current, { at, ml }].slice(-MAX_SIPS))
      setSaveError(true)
    }
    setNow(at)
    setNotice(`Logged ${ml} ml at ${formatWhen(at, at)}.`)
  }

  function changeGoal(ml) {
    try {
      setGoal(saveGoal(ml))
    } catch {
      setGoal(ml)
    }
  }

  function changeDefault(ml) {
    try {
      setDefaultMl(saveDefaultMl(ml))
    } catch {
      setDefaultMl(ml)
    }
  }

  function removeDrink(at) {
    try {
      setSips(removeSip(at))
      setSaveError(false)
      setNotice('Drink removed.')
    } catch {
      setSips((current) => {
        const index = current.findIndex((sip) => sip.at === at)
        if (index < 0) return current
        return current.filter((_, position) => position !== index)
      })
      setSaveError(true)
    }
  }

  function clearDrinks() {
    try {
      setSips(clearSips())
      setSaveError(false)
      setNotice('All drinks cleared.')
    } catch {
      setSips([])
      setSaveError(true)
    }
  }

  const label =
    last == null
      ? `Log a ${defaultMl} ml glass. Daily goal ${goal} ml.`
      : `${reminder ?? `${speakElapsed(elapsed)} since last drink.`} Logged ${formatWhen(last.at, now)}. ${todayMl} of ${goal} ml today. Tap to log ${defaultMl} ml.${
          saveError ? " Couldn't save on this device." : ''
        }`

  return (
    <>
      <div className="relative min-h-dvh overflow-x-hidden">
        <WaterBackground level={level} splash={splash} />
        <button
          type="button"
          onPointerDown={rememberTap}
          onClick={() => {
            const x = tapXRef.current ?? 0.5
            tapXRef.current = null
            logDrink(defaultMl, Date.now(), x)
          }}
          aria-label={label}
          className={`tap-surface group relative z-10 flex min-h-dvh w-full cursor-pointer items-center justify-center bg-transparent px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-left outline-none select-none ${
            historyOpen ? 'sm:pr-96' : ''
          }`}
        >
          <span
            key={splash?.id ?? 'still'}
            className={`relative z-20 ${splash ? 'bubble-pop' : ''} ${
              historyOpen ? 'max-sm:invisible' : ''
            }`}
          >
            <span className="tap-plate relative flex size-[min(19rem,80vw)] flex-col items-center justify-center overflow-hidden rounded-full bg-glass/78 px-8 text-center text-glass-ink shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32),inset_0_-28px_56px_rgb(127_214_232/0.14),0_24px_64px_rgb(2_20_28/0.35)] backdrop-blur-md transition-transform duration-150 ease-out group-active:scale-[0.97] group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-glass-ink">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.26),transparent_40%)]"
              />
              {last != null && (
                <span className="relative text-sm text-glass-muted tabular-nums">
                  Logged {formatWhen(last.at, now)}
                </span>
              )}
              <span className="relative mt-1 text-[clamp(2.25rem,8.5vw,3.75rem)] leading-[1.05] font-medium text-balance tabular-nums">
                {last == null ? 'Tap' : formatElapsed(elapsed)}
              </span>
              <span className="relative mt-2 max-w-[14rem] text-base text-pretty text-glass-muted">
                {last == null
                  ? `Log ${defaultMl} ml`
                  : fresh
                    ? 'Drink logged'
                    : reminder ?? 'Since last drink'}
              </span>
              <span className="relative mt-3 text-sm tabular-nums">
                {todayMl.toLocaleString()} of {goal.toLocaleString()} ml
              </span>
              {last != null && !reminder && (
                <span className="relative mt-4 text-sm tabular-nums">
                  Tap for {defaultMl} ml
                </span>
              )}
              {saveError && (
                <span className="relative mt-3 text-sm">
                  Couldn&apos;t save on this device.
                </span>
              )}
            </span>
          </span>
        </button>
        <aside
          id="drink-history"
          inert={historyOpen ? undefined : true}
          aria-hidden={historyOpen ? undefined : true}
          className={`history-panel fixed inset-y-0 right-0 z-30 w-full overflow-y-auto border-l border-white/10 bg-glass/88 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-glass-ink transition-transform duration-200 ease-out sm:w-96 ${
            historyOpen
              ? 'translate-x-0'
              : 'pointer-events-none translate-x-full'
          }`}
        >
          <History
            sips={sips}
            now={now}
            goal={goal}
            onGoal={changeGoal}
            onRemove={removeDrink}
            onClear={clearDrinks}
            onClose={() => setHistoryOpen(false)}
          />
        </aside>
        {!historyOpen && (
          <button
            ref={historyButtonRef}
            type="button"
            aria-expanded={false}
            aria-controls="drink-history"
            onClick={() => setHistoryOpen(true)}
            className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 min-h-11 rounded-full bg-glass/78 px-4 text-sm text-glass-ink shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)] backdrop-blur-sm transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glass-ink"
          >
            History
          </button>
        )}
        <div
          className={`fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex justify-center gap-2 px-4 ${
            historyOpen ? 'max-sm:invisible sm:right-96' : ''
          }`}
        >
          {QUICK_DRINKS.map((drinkSize) => (
            <button
              key={drinkSize.ml}
              type="button"
              aria-pressed={drinkSize.ml === defaultMl}
              onClick={(event) => {
                changeDefault(drinkSize.ml)
                logDrink(
                  drinkSize.ml,
                  Date.now(),
                  event.clientX / Math.max(window.innerWidth, 1),
                )
              }}
              className={`min-h-11 min-w-16 rounded-full px-3 py-1.5 text-glass-ink shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)] backdrop-blur-sm transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glass-ink ${
                drinkSize.ml === defaultMl ? 'bg-white/16' : 'bg-glass/78'
              }`}
            >
              <span className="block text-sm leading-tight">{drinkSize.name}</span>
              <span className="block text-xs tabular-nums text-glass-muted">{drinkSize.ml} ml</span>
            </button>
          ))}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {notice}
      </span>
    </>
  )
}
