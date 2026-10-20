# MoodBite API

Node.js 22+, Fastify, Zod, dan PostgreSQL. Salin `.env.example` ke konfigurasi runtime, jalankan `migrations/001_init.sql` sebagai owner database, lalu beri password/login kepada role `moodbite_app` di luar migrasi.

```sh
npm install
npm run typecheck
npm test
npm run build
```

Buat akun menggunakan koneksi owner:

```sh
MIGRATION_DATABASE_URL=postgres://... npm run create-account -- P001 patient
```

PIN acak dicetak sekali. API runtime harus memakai `DATABASE_URL` milik `moodbite_app`, bukan role owner, agar RLS tidak dapat dilewati.
