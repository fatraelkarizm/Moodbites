import { createHash } from 'node:crypto';
import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const dateSchema = z.iso.date();
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Format waktu harus HH:mm');

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function jakartaDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function jakartaDateDaysAgo(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return jakartaDate(date);
}

export function assertAllowedEntryDate(value: string, now = new Date()): void {
  const today = jakartaDate(now);
  const yesterday = jakartaDateDaysAgo(1, now);
  if (value !== today && value !== yesterday) {
    const error = new Error('Tanggal entri hanya boleh hari ini atau kemarin');
    Object.assign(error, { statusCode: 400 });
    throw error;
  }
}

export function toCsv(records: Record<string, unknown>[]): string {
  if (records.length === 0) return '\uFEFF';
  const headers = Object.keys(records[0]!);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = value instanceof Date ? value.toISOString() : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `\uFEFF${headers.map(escape).join(',')}\r\n${records.map((row) => headers.map((h) => escape(row[h])).join(',')).join('\r\n')}\r\n`;
}
