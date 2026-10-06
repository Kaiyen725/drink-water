export const SIP_KEY = 'drink-water.sips'
export const GOAL_KEY = 'drink-water.goal'
export const MAX_SIPS = 50
export const DEFAULT_ML = 250
export const DEFAULT_GOAL = 2000
export const QUICK_DRINKS = [
  { ml: 50, name: 'Gulp' },
  { ml: 150, name: 'Sip' },
  { ml: 250, name: 'Glass' },
  { ml: 500, name: 'Bottle' },
]
export const GOAL_OPTIONS = [1500, 2000, 2500, 3000]
const TIDE_WINDOW_MS = 3 * 60 * 60 * 1000
const TIDE_CEILING = 0.9
const TIDE_FLOOR = 0.14
const DEFAULT_GAP_MS = 45 * 60 * 1000

function asSip(value) {
  if (Number.isFinite(value) && value > 0) return { at: value, ml: DEFAULT_ML }
  if (!value || !Number.isFinite(value.at) || value.at <= 0) return null
  const ml = Number.isFinite(value.ml) && value.ml > 0 ? value.ml : DEFAULT_ML
  return { at: value.at, ml }
}

function normalize(list) {
  if (!Array.isArray(list)) return []
  return list.map(asSip).filter(Boolean).slice(-MAX_SIPS)
}

export function readSips() {
  try {
    const raw = localStorage.getItem(SIP_KEY)
    if (!raw) return []
    return normalize(JSON.parse(raw))
  } catch {
    return []
  }
}

export function enforceCap() {
  try {
    const raw = localStorage.getItem(SIP_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const next = normalize(parsed)
    if (JSON.stringify(parsed) !== JSON.stringify(next)) {
      localStorage.setItem(SIP_KEY, JSON.stringify(next))
    }
    return next
  } catch {
    return readSips()
  }
}

export function addSip(at = Date.now(), ml = DEFAULT_ML) {
  const next = normalize([...readSips(), { at, ml }])
  localStorage.setItem(SIP_KEY, JSON.stringify(next))
  return next
}

export function removeSip(at) {
  const current = readSips()
  const index = current.findIndex((sip) => sip.at === at)
  if (index < 0) return current
  const next = current.filter((_, position) => position !== index)
  localStorage.setItem(SIP_KEY, JSON.stringify(next))
  return next
}

export function clearSips() {
  localStorage.setItem(SIP_KEY, '[]')
  return []
}

export function readGoal() {
  try {
    const value = Number(localStorage.getItem(GOAL_KEY))
    return GOAL_OPTIONS.includes(value) ? value : DEFAULT_GOAL
  } catch {
    return DEFAULT_GOAL
  }
}

export function saveGoal(ml) {
  const next = GOAL_OPTIONS.includes(ml) ? ml : DEFAULT_GOAL
  localStorage.setItem(GOAL_KEY, String(next))
  return next
}

export function mlOnDay(sips, now) {
  const day = startOfDay(now)
  return sips
    .filter((sip) => startOfDay(sip.at) === day)
    .reduce((sum, sip) => sum + sip.ml, 0)
}

export function typicalGap(sips) {
  const sorted = [...sips].sort((a, b) => a.at - b.at)
  const gaps = []
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index].at - sorted[index - 1].at
    if (gap >= 5 * 60 * 1000 && gap <= 4 * 60 * 60 * 1000) gaps.push(gap)
  }
  if (gaps.length === 0) return DEFAULT_GAP_MS
  gaps.sort((a, b) => a - b)
  const median = gaps[Math.floor((gaps.length - 1) / 2)]
  return Math.min(2 * 60 * 60 * 1000, Math.max(20 * 60 * 1000, median))
}

export function hydrationReminder(sips, now) {
  const last = sips.at(-1)
  if (!last) return null
  const elapsed = Math.max(0, now - last.at)
  if (elapsed < typicalGap(sips)) return null
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 1) return null
  if (minutes < 60) {
    return `You haven't had water for ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`
  }
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  const hourLabel = `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  if (remainder === 0) return `You haven't had water for ${hourLabel}.`
  return `You haven't had water for ${hourLabel} ${remainder} ${remainder === 1 ? 'minute' : 'minutes'}.`
}

export function tideLevel(elapsedMs) {
  if (elapsedMs == null) return TIDE_FLOOR
  const progress =
    Math.min(Math.max(elapsedMs, 0), TIDE_WINDOW_MS) / TIDE_WINDOW_MS
  return TIDE_CEILING - progress * (TIDE_CEILING - TIDE_FLOOR)
}

function unit(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 5) return 'now'

  if (totalSeconds < 60) return `${totalSeconds}s`

  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) {
    const seconds = totalSeconds % 60
    return seconds === 0 ? `${totalMinutes}m` : `${totalMinutes}m ${seconds}s`
  }

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) {
    const minutes = totalMinutes % 60
    return minutes === 0 ? `${totalHours}h` : `${totalHours}h ${minutes}m`
  }

  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`
}

export function speakElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 5) return 'just now'
  if (totalSeconds < 60) return unit(totalSeconds, 'second', 'seconds')

  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) {
    const seconds = totalSeconds % 60
    return seconds === 0
      ? unit(totalMinutes, 'minute', 'minutes')
      : `${unit(totalMinutes, 'minute', 'minutes')} ${unit(seconds, 'second', 'seconds')}`
  }

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) {
    const minutes = totalMinutes % 60
    return minutes === 0
      ? unit(totalHours, 'hour', 'hours')
      : `${unit(totalHours, 'hour', 'hours')} ${unit(minutes, 'minute', 'minutes')}`
  }

  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours === 0
    ? unit(days, 'day', 'days')
    : `${unit(days, 'day', 'days')} ${unit(hours, 'hour', 'hours')}`
}

function startOfDay(value) {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

export function formatGap(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 5) return `${totalSeconds}s`
  return formatElapsed(ms)
}

export function gapStats(sips) {
  if (sips.length < 2) return null
  const sorted = [...sips].sort((a, b) => a.at - b.at)
  const gaps = []
  for (let index = 1; index < sorted.length; index += 1) {
    gaps.push(sorted[index].at - sorted[index - 1].at)
  }
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
  return { average, longest: Math.max(...gaps) }
}

export function formatClock(at, withSeconds = false) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  }).format(new Date(at))
}

export function clockLabels(times) {
  const base = times.map((time) => formatClock(time))
  const seen = new Map()
  for (const label of base) seen.set(label, (seen.get(label) || 0) + 1)
  return times.map((time, index) =>
    seen.get(base[index]) > 1 ? formatClock(time, true) : base[index],
  )
}

export function dayHeading(dayStart, now) {
  const dayDiff = Math.round((startOfDay(now) - dayStart) / 86_400_000)
  if (dayDiff <= 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dayStart))
}

export function groupSips(sips, now) {
  const grouped = new Map()
  const newestFirst = [...sips].sort((a, b) => b.at - a.at)
  for (const sip of newestFirst) {
    const day = startOfDay(sip.at)
    if (!grouped.has(day)) grouped.set(day, [])
    grouped.get(day).push(sip)
  }
  return [...grouped.entries()].map(([day, times]) => {
    const oldestFirst = [...times].sort((a, b) => a.at - b.at)
    const clocks = clockLabels(oldestFirst.map((sip) => sip.at))
    return {
      key: String(day),
      label: dayHeading(day, now),
      ml: oldestFirst.reduce((sum, sip) => sum + sip.ml, 0),
      drinks: oldestFirst.map((sip, index) => ({
        at: sip.at,
        ml: sip.ml,
        clock: clocks[index],
        gap: index === 0 ? null : sip.at - oldestFirst[index - 1].at,
      })),
    }
  })
}

export function buildChart(sips) {
  if (sips.length === 0) return { unit: 'day', bars: [] }

  const days = [...new Set(sips.map((sip) => startOfDay(sip.at)))].sort(
    (a, b) => a - b,
  )

  if (days.length === 1) {
    const hours = sips.map((sip) => new Date(sip.at).getHours())
    const first = Math.min(...hours)
    const last = Math.max(...hours)
    const bars = []
    for (let hour = first; hour <= last; hour += 1) {
      bars.push({
        key: `h-${hour}`,
        count: sips.filter((sip) => new Date(sip.at).getHours() === hour).length,
        label: new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(
          new Date(2000, 0, 1, hour),
        ),
      })
    }
    return { unit: 'hour', bars }
  }

  return {
    unit: 'day',
    bars: days.map((day) => ({
      key: `d-${day}`,
      count: sips.filter((sip) => startOfDay(sip.at) === day).length,
      label: new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(new Date(day)),
    })),
  }
}

export function formatWhen(at, now) {
  const date = new Date(at)
  const clock = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (dayDiff <= 0) return clock
  if (dayDiff === 1) return `yesterday, ${clock}`

  const day = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
  return `${day}, ${clock}`
}
