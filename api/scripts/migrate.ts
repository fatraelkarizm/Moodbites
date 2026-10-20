/**
 * Menjalankan migrasi SQL yang belum pernah dijalankan, berurutan menurut nama file.
 * Dicatat di tabel schema_migrations agar aman dijalankan ulang setiap deploy.
 *
 *   MIGRATION_DATABASE_URL=postgres://owner@... npm run migrate
 *   npm run migrate -- --baseline 004   # tandai 001..004 sudah dijalankan (database lama tanpa catatan)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error('MIGRATION_DATABASE_URL wajib diisi dengan koneksi role owner');

const dir = join(import.meta.dirname, '..', 'migrations');
const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
const baselineIndex = process.argv.indexOf('--baseline');
const baseline = baselineIndex >= 0 ? process.argv[baselineIndex + 1] : undefined;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`create table if not exists public.schema_migrations(
    name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await client.query<{ name: string }>('select name from public.schema_migrations')).rows.map((r) => r.name));

  if (baseline) {
    for (const f of files.filter((f) => f.slice(0, baseline.length) <= baseline && !done.has(f))) {
      await client.query('insert into public.schema_migrations(name) values($1)', [f]);
      console.log(`baseline: ${f}`);
    }
  } else {
    const pending = files.filter((f) => !done.has(f));
    if (!pending.length) console.log('Tidak ada migrasi baru.');
    for (const f of pending) {
      // Setiap file migrasi berisi begin/commit sendiri.
      await client.query(readFileSync(join(dir, f), 'utf8'));
      await client.query('insert into public.schema_migrations(name) values($1)', [f]);
      console.log(`applied: ${f}`);
    }
  }
} finally {
  await client.end();
}
