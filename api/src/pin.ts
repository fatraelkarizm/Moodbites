import { randomInt } from 'node:crypto';
import { hash } from '@node-rs/argon2';

/** PIN 8 angka dari sumber acak kriptografis. Hanya ditampilkan sekali; yang disimpan hanya hash-nya. */
export function generatePin(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0');
}

export function hashPin(pin: string): Promise<string> {
  return hash(pin, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
