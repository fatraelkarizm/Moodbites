import { describe, expect, it } from 'vitest'
import { dateRange, jakartaToday, shiftDate } from './date'

describe('tanggal WIB', () => {
  it('memakai tanggal Jakarta di sekitar tengah malam UTC', () => {
    expect(jakartaToday(new Date('2026-10-18T16:59:00Z'))).toBe('2026-10-18')
    expect(jakartaToday(new Date('2026-10-18T17:00:00Z'))).toBe('2026-10-19')
  })
  it('menggeser tanggal melewati batas bulan/tahun', () => {
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('membuat rentang tanggal inklusif', () => {
    expect(dateRange('2026-10-14', '2026-10-20')).toHaveLength(7)
    expect(dateRange('2026-10-20', '2026-10-19')).toEqual([])
  })
})
