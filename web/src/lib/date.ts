const TZ = 'Asia/Jakarta'

/** Tanggal hari ini di WIB dalam format YYYY-MM-DD (sama dengan aturan server). */
export const jakartaToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

/** Geser tanggal YYYY-MM-DD sebanyak `days` hari tanpa terpengaruh zona waktu perangkat. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Daftar tanggal inklusif dari `from` sampai `to`. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 400; d = shiftDate(d, 1)) out.push(d)
  return out
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', { ...opts, timeZone: 'UTC' })
const asUtc = (date: string) => new Date(`${date}T00:00:00Z`)

export const formatLongDate = (date: string) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(asUtc(date))
export const formatFullDate = (date: string) => fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(asUtc(date))
export const formatShortDate = (date: string) => fmt({ day: 'numeric', month: 'short' }).format(asUtc(date))
export const formatWeekday = (date: string) => fmt({ weekday: 'short' }).format(asUtc(date))

export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(now))
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}
