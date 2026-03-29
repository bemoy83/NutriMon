import { format, parseISO } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export function getTodayInTimezone(tz: string): string {
  const now = new Date()
  const zoned = toZonedTime(now, tz)
  return format(zoned, 'yyyy-MM-dd')
}

export function formatDisplayDate(date: string): string {
  const parsed = parseISO(date)
  return format(parsed, 'EEEE, MMM d')
}

export function formatShortDate(date: string): string {
  const parsed = parseISO(date)
  return format(parsed, 'MMM d')
}

export function toLocalDateString(ts: string, tz: string): string {
  const date = new Date(ts)
  const zoned = toZonedTime(date, tz)
  return format(zoned, 'yyyy-MM-dd')
}

export function formatTime(ts: string, tz: string): string {
  const date = new Date(ts)
  const zoned = toZonedTime(date, tz)
  return format(zoned, 'h:mm a')
}

export function getCurrentTimestampInTimezone(tz: string): string {
  const now = new Date()
  return fromZonedTime(toZonedTime(now, tz), 'UTC').toISOString()
}

export function combineDateWithCurrentTime(date: string, tz: string): string {
  const now = toZonedTime(new Date(), tz)
  const timeStr = format(now, 'HH:mm:ss')
  const combined = new Date(`${date}T${timeStr}`)
  return fromZonedTime(combined, tz).toISOString()
}

export function guessTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function addDays(date: string, days: number): string {
  const parsed = parseISO(date)
  parsed.setDate(parsed.getDate() + days)
  return format(parsed, 'yyyy-MM-dd')
}

export function isToday(date: string, tz: string): boolean {
  return getTodayInTimezone(tz) === date
}

export function isPast(date: string, tz: string): boolean {
  return date < getTodayInTimezone(tz)
}
