# MoodBite

MoodBite adalah aplikasi feasibility study 7 hari dengan dua pengalaman berbasis peran:

- aplikasi pasien mobile-first untuk profil, diary makanan, mood/stres, tidur, dan riwayat;
- dashboard peneliti untuk kelengkapan, distribusi, tren deskriptif, filter, dan ekspor CSV.

## Struktur

- `web/` — React + TypeScript + Vite
- `api/` — Fastify + Zod + PostgreSQL
- `api/migrations/` — sumber kebenaran skema dan RLS (jalankan berurutan: `001`, `002`, …)
- `docs/` — panduan singkat untuk partisipan dan peneliti
- `deploy/` — contoh nginx, systemd, dan backup terenkripsi
- `architecture.md` — keputusan arsitektur dan kontrak produk

## Menjalankan lokal

Prasyarat: Node.js 22+ dan PostgreSQL.

```bash
npm install --prefix api
npm install --prefix web
```

Siapkan database (contoh memakai cluster dev terpisah di port 5433 agar tidak mengganggu Postgres lain):

```bash
initdb -D .pgdata -U postgres -A trust -E UTF8 --locale=C     # sekali saja
pg_ctl -D .pgdata -o "-p 5433" -l .pgdata/server.log start
psql -h 127.0.0.1 -p 5433 -U postgres -c "create database moodbite"
for f in api/migrations/*.sql; do psql -h 127.0.0.1 -p 5433 -U postgres -d moodbite -v ON_ERROR_STOP=1 -f "$f"; done
psql -h 127.0.0.1 -p 5433 -U postgres -d moodbite -c "alter role moodbite_app login password 'moodbite_dev'"
```

Salin `api/.env.example` ke `api/.env` (dibaca otomatis lewat `--env-file`), sesuaikan `DATABASE_URL` dan `MIGRATION_DATABASE_URL`, lalu buat akun:

```bash
npm run create-account --prefix api -- P001 patient
npm run create-account --prefix api -- R001 researcher
```

Jalankan pada dua terminal, lalu buka http://localhost:5173 (Vite meneruskan `/api` ke port 3000):

```bash
npm run dev:api
npm run dev:web
```

Pasien baru diarahkan ke onboarding profil; akun `researcher` langsung masuk ke dashboard peneliti.

Data demo untuk mereview dashboard dan analisis hubungan (khusus dev, 15 partisipan × 7 hari, PIN `20262026`):

```bash
npm run seed-demo --prefix api            # buat DEMO01–DEMO15
npm run seed-demo --prefix api -- --clear # hapus
```

`PATIENT_INSIGHTS=true|false` di `api/.env` mengatur apakah pasien melihat timeline dan pola pribadi di halaman Riwayat.

## Verifikasi

```bash
npm test
npm run build
```

Sebelum studi dimulai, lakukan pengujian isolasi lintas pasien, restore backup, tanggal WIB di sekitar tengah malam, perangkat Android/iPhone nyata, dan hapus seluruh data demo.

## Keputusan tata kelola terbuka

PRD awal menyebut Supabase milik klien, sedangkan `architecture.md` memilih VPS yang dikelola developer. Lokasi data, pihak yang memiliki akses, backup, retensi, dan prosedur penghapusan harus disetujui tertulis oleh klien/komite etik sebelum data pasien dikumpulkan.
