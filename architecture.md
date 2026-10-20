# MoodBite — Arsitektur Aplikasi (Feasibility Test)

Versi 1.2 (self-hosted di VPS) · 19 Oktober 2026 · mengacu ke PRD MoodBite v1.0 dan brief implementasi terbaru

Prinsip: **sesederhana mungkin, cukup untuk 20 pasien x 7 hari**. Satu VPS, satu aplikasi, satu database. Tanpa Supabase, tanpa layanan cloud tambahan.

> **Keputusan tata kelola yang harus disetujui sebelum studi:** PRD awal menempatkan data di Supabase milik klien, sedangkan versi arsitektur ini menempatkan data di VPS yang dikelola developer. Perubahan lokasi, kepemilikan operasional, backup, retensi, dan akses ini wajib mendapat persetujuan tertulis dari klien/komite etik. Implementasi tidak boleh dianggap sebagai persetujuan.

## 0. Kontrak Produk v1.2

- Dua pengalaman berbasis peran: UI pasien mobile-first (minimum 360 px) dan dashboard analitik peneliti responsif.
- Profil pasien mencakup usia, jenis kelamin, pendidikan, status pernikahan, pekerjaan, kelompok pendapatan, durasi diagnosis, berat badan, tinggi badan, BMI turunan, komplikasi (ya/tidak + detail), dan efek samping pengobatan (ya/tidak + detail). Field klinis PRD v1.0 tetap opsional dan tidak dihapus.
- BMI dihitung dari sumber data berat/tinggi (`kg / m²`), ditampilkan satu desimal, dan tidak menjadi sumber data independen.
- Catatan makan mendukung sarapan, makan siang, makan malam, dan snack; menyimpan waktu, makanan, ukuran porsi, serta jumlah sajian tanpa estimasi kalori.
- Check-in harian memakai mood 1–5 dengan angka, label, emoji, dan warna (warna bukan satu-satunya penanda), catatan perasaan opsional, serta stres ya/tidak dengan penyebab wajib ketika "ya".
- Tidur menyimpan durasi menit sebagai nilai kanonik, kualitas 1–5 dengan label, serta hambatan tidur opsional.
- Field detail bersyarat wajib ketika jawaban "ya" dan dinormalisasi menjadi `null` ketika jawaban "tidak".
- Dashboard peneliti menyediakan filter tanggal/kode pasien, kelengkapan pengisian, distribusi mood, tren mood/tidur/stres, dan ekspor CSV seluruh field. Analitik bersifat deskriptif; prediksi atau inferensi klinis tetap di luar scope.
- Skala mood mengikuti gambar referensi klien 0–5 (lihat penyelarasan di bawah); keputusan sebelumnya (1–5) digantikan atas permintaan klien 20 Okt 2026.
- **Penyelarasan PRD (migrasi `002_prd_alignment.sql`):** catatan makan wajib memiliki kategori baku FR-10 (`karbo`, `gorengan`, `manis`, `sayur_buah`, `protein`, `minuman_manis`, `lainnya`) serta kolom `photo_url`/`input_source` untuk fase foto AI; profil menyimpan `income_group` (kelompok) menggantikan nominal pendapatan. Sesuai brief klien, stres dicatat sebagai ya/tidak + penyebab (bukan skala 1–5 PRD FR-04), dan mood mengikuti *Emotional Thermometer* referensi klien (migrasi `003`): skor 0–5 (0 senang, 1 baik, 2 cemas, 3 sedih, 4 kesal, 5 marah sekali; makin tinggi = emosi makin berat). Catatan makan menambah `mindfulness` 1–5 (perhatian saat makan), yang ikut dianalisis sebagai prediktor. Kualitas tidur berlabel 1 sangat buruk, 2 buruk, 3 cukup, 4 baik, 5 sangat baik.

- **Analisis hubungan (perubahan scope dari PRD v1.0):** aplikasi menyimpulkan hubungan stres, tidur, dan kategori makanan (hari yang sama atau hari berikutnya) terhadap mood dan stres (`api/src/stats.ts`). Metodenya within-person (setiap partisipan dibandingkan dengan dirinya sendiri), CI 95% dari cluster bootstrap, dan koreksi Benjamini–Hochberg. Status "terlihat" hanya diberikan bila CI tidak melewati 0 dan q < 0,05; selain itu "belum jelas" atau "data kurang". Hasilnya asosiasi observasional, bukan sebab-akibat. Peneliti melihat analisis lengkap di `/api/admin/insights`. Pasien melihat timeline terhubung dan pola pribadi di `/api/insights`, yang **dapat dimatikan** dengan `PATIENT_INSIGHTS=false`. Menampilkan pola ke pasien dapat memengaruhi jawaban mereka (*reactivity*), sehingga wajib disetujui peneliti/komite etik sebelum studi.

- **Kelayakan dan kualitas data (migrasi `004`):** setiap catatan menyimpan `fill_seconds`, yaitu waktu aktif mengisi yang diukur di perangkat dari interaksi pertama sampai tersimpan. `day_checks.meals_complete` membedakan "tidak makan" dari "lupa mencatat"; hari bertanda `false` dikeluarkan dari analisis makanan. `study_feedback` menampung kuesioner akhir (kemudahan, hambatan, saran), yang tampil ke pasien mulai hari studi ke-6. Dashboard menampilkan kriteria PRD bagian 11, dan `daily_summary.csv` menyediakan ekspor gabungan per pasien per hari (PRD bagian 8).

Migrasi SQL di `api/migrations/` adalah sumber kebenaran skema implementasi. Cuplikan SQL historis di dokumen ini menjelaskan model keamanan, bukan pengganti migrasi tersebut.

## 1. Gambaran Besar

```text
 HP pasien / peneliti (browser)
          |  HTTPS
          v
 +---------------------------------------------------------------+
 |  VPS                                                           |
 |                                                                |
 |  nginx (TLS, rate limit, header keamanan)                      |
 |    |-- /          -> file statis React (dist/)                 |
 |    '-- /api/*     -> Node API di 127.0.0.1:3000                |
 |                          |                                     |
 |                          v                                     |
 |                   PostgreSQL (hanya localhost)                 |
 |                                                                |
 |  Backup harian terenkripsi -> lokasi lain yang disetujui       |
 +---------------------------------------------------------------+
```

Beban server kecil: React hanya file statis, API Node ringan, 20 pengguna dengan beberapa entri per hari. VPS 1 vCPU dan 1-2 GB RAM seharusnya cukup (perkiraan, pantau saat uji).

## 2. Stack

| Bagian | Pilihan | Catatan |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind | SPA, mobile-first mulai 360 px |
| Web server | nginx | TLS, file statis, reverse proxy, rate limit |
| API | Node.js (LTS) + Fastify + zod | validasi input, tanpa ORM berat |
| Database | PostgreSQL | hanya listen di localhost |
| Driver | `pg` | query SQL langsung |
| Hash PIN | argon2id (`argon2` atau `@node-rs/argon2`) | PIN tidak pernah disimpan polos |
| Sesi | cookie httpOnly + tabel `sessions` | bisa dicabut kapan saja |
| Proses | systemd | auto-restart |
| Backup | `pg_dump` + `age` + cron/systemd timer | lihat bagian 9 |
| TLS | Let's Encrypt (certbot) | butuh domain atau subdomain netral |

Tidak dipakai (sengaja): Docker/Kubernetes, Next.js/SSR, ORM, Redis, message queue. Semuanya menambah bagian yang harus dijaga tanpa membantu tujuan feasibility.

## 3. Struktur Repo

```text
moodbite/
  web/                          # React
    src/
      main.tsx, App.tsx         # router + guard login
      lib/api.ts                # fetch wrapper (credentials: 'include')
      lib/date.ts               # tanggal lokal WIB
      features/
        auth/LoginPage.tsx
        onboarding/ProfileForm.tsx
        today/TodayPage.tsx
        meal/MealForm.tsx
        checkin/MoodStressForm.tsx
        sleep/SleepForm.tsx
        history/HistoryPage.tsx
        admin/ExportPage.tsx    # hanya role researcher
      components/               # skala 1-5, pilihan kategori, layout
    index.html                  # title netral: "MoodBite"
    public/robots.txt           # Disallow: /
  api/
    src/
      server.ts                 # Fastify, cookie, error handler
      db.ts                     # pool + withAccount()
      auth.ts                   # login, sesi, lockout
      routes/ profile.ts meals.ts moods.ts sleep.ts history.ts export.ts
      csv.ts
    migrations/001_init.sql     # skema di bagian 6
    scripts/create-account.ts   # buat akun pasien/peneliti + PIN acak
  deploy/
    nginx.conf
    moodbite-api.service
    backup.sh
```

## 4. Layar dan Endpoint

| Rute web | Siapa | Fungsi |
|---|---|---|
| `/login` | semua | kode pasien + PIN |
| `/onboarding` | pasien | profil awal, sekali |
| `/` | pasien | status hari ini |
| `/meal/new` | pasien | input makan |
| `/checkin` | pasien | mood + stres 1-5 |
| `/sleep` | pasien | jam tidur/bangun + kualitas 1-5 |
| `/history` | pasien | riwayat 7 hari sendiri |
| `/admin/export` | peneliti | unduh CSV |

| Endpoint API | Metode | Fungsi |
|---|---|---|
| `/api/auth/login` | POST | `{code, pin}` → set cookie sesi |
| `/api/auth/logout` | POST | hapus sesi |
| `/api/me` | GET | info akun (kode, role, sudah onboarding?) |
| `/api/profile` | GET, PUT | profil awal |
| `/api/meals` | GET, POST, PATCH | entri makan |
| `/api/moods` | GET, POST, PATCH | mood + stres |
| `/api/sleep` | GET, PUT | tidur per tanggal |
| `/api/history` | GET | 7 hari terakhir milik sendiri |
| `/api/admin/export/:tabel.csv` | GET | hanya role `researcher` |

Akun dibuat lewat skrip `create-account` di server (bukan endpoint publik). Skrip itu membuat PIN acak dan menampilkannya **sekali** untuk diberikan ke pasien lewat saluran terpisah.
Layar Mood Forecast tidak dibuat (di luar scope).

## 5. Autentikasi dan Sesi

- Login: kode pasien + PIN (minimal 6 digit, disarankan 8). PIN di-hash dengan argon2id.
- **Lockout:** 5 kali salah berturut-turut mengunci akun 15 menit (kolom `failed_attempts`, `locked_until`). Respons gagal login selalu sama (tidak membedakan "kode salah" dan "PIN salah").
- **Rate limit nginx** per IP di `/api/auth/login` sebagai lapisan kedua. Jangan terlalu ketat: banyak pasien berbagi IP operator seluler (NAT).
- **Sesi:** token acak 256-bit dikirim di cookie `HttpOnly; Secure; SameSite=Strict`; di database hanya disimpan hash SHA-256 token. Masa berlaku default 3 hari sliding, bisa diubah.
- **CSRF:** `SameSite=Strict`, API hanya menerima JSON, dan cek header `Origin`.
- Tombol **Keluar** selalu tersedia; ingatkan pasien yang berbagi HP.
- `role` dan `account_id` selalu diambil dari sesi di server, **tidak pernah dari input klien**.

## 6. Model Data dan Keamanan (SQL)

Dua lapis perlindungan: API membatasi akses per akun, dan **Row Level Security (RLS) di Postgres** jadi lapisan kedua. Kalau ada bug di API, database tetap menolak membaca data pasien lain. Aplikasi connect sebagai role `moodbite_app` yang bukan superuser dan tanpa `BYPASSRLS`.

```sql
-- Fungsi konteks: diisi API per transaksi (set_config ... true)
create or replace function public.app_account_id()
returns uuid language sql stable as $$
  select nullif(current_setting('app.account_id', true), '')::uuid
$$;

create or replace function public.app_is_researcher()
returns boolean language sql stable as $$
  select coalesce(current_setting('app.role', true) = 'researcher', false)
$$;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                       -- kode pasien, mis. P001
  pin_hash text not null,
  role text not null default 'patient' check (role in ('patient','researcher')),
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.sessions (
  token_hash text primary key,                     -- SHA-256 dari token cookie
  account_id uuid not null references public.accounts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.patient_profiles (
  patient_id uuid primary key references public.accounts(id) on delete cascade,
  age smallint check (age between 0 and 120),
  sex text,
  education text,
  occupation text,
  marital_status text,
  years_since_diagnosis numeric(4,1),
  -- field klinis opsional: lihat api/migrations/001_init.sql
  comorbidities text,
  other_meds text,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  smoking text,
  alcohol text,
  updated_at timestamptz not null default now()
);

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.accounts(id) on delete cascade,
  entry_date date not null,
  meal_time text not null check (meal_time in ('pagi','siang','malam')),
  eaten_at time,
  food_name text not null,
  food_category text not null check (food_category in
    ('karbo','gorengan','manis','sayur_buah','protein','minuman_manis','lainnya')),
  portion text check (portion in ('sedikit','sedang','banyak')),
  photo_url text,                                  -- disiapkan untuk fase foto AI
  input_source text not null default 'manual' check (input_source in ('manual','ai')),
  created_at timestamptz not null default now()
);

create table public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.accounts(id) on delete cascade,
  entry_date date not null,
  recorded_at timestamptz not null default now(),
  mood smallint not null check (mood between 1 and 5),
  stress smallint not null check (stress between 1 and 5)
);

create table public.sleep_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.accounts(id) on delete cascade,
  entry_date date not null,                        -- tanggal bangun
  sleep_time time,
  wake_time time,
  duration_min int check (duration_min between 0 and 1440),
  quality smallint not null check (quality between 1 and 5),
  created_at timestamptz not null default now(),
  unique (patient_id, entry_date)
);

create index on public.meal_entries (patient_id, entry_date);
create index on public.mood_entries (patient_id, entry_date);

-- RLS pada tabel data pasien
do $$
declare t text;
begin
  foreach t in array array['patient_profiles','meal_entries','mood_entries','sleep_entries']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy %I on public.%I for select
      using (patient_id = public.app_account_id() or public.app_is_researcher())$p$,
      t || '_select', t);
    execute format($p$create policy %I on public.%I for insert
      with check (patient_id = public.app_account_id())$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update
      using (patient_id = public.app_account_id())
      with check (patient_id = public.app_account_id())$p$, t || '_update', t);
  end loop;
end $$;

-- Role runtime: bukan owner, tanpa BYPASSRLS, tanpa hak delete pada data pasien
create role moodbite_app nologin;                  -- ganti jadi LOGIN + password dari env di server
grant usage on schema public to moodbite_app;
grant execute on function public.app_account_id(), public.app_is_researcher() to moodbite_app;
grant select, insert, update on public.patient_profiles, public.meal_entries,
  public.mood_entries, public.sleep_entries to moodbite_app;
grant select, update on public.accounts to moodbite_app;      -- login + lockout
grant select, insert, delete on public.sessions to moodbite_app;
```

Cara API memakai konteks (inti keamanannya):

```ts
// api/src/db.ts
export async function withAccount<T>(
  acc: { id: string; role: 'patient' | 'researcher' },   // dari sesi server
  fn: (c: PoolClient) => Promise<T>
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(
      "select set_config('app.account_id', $1, true), set_config('app.role', $2, true)",
      [acc.id, acc.role]
    );
    const result = await fn(c);
    await c.query('commit');
    return result;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}
```

Catatan desain:
- `entry_date` dihitung di **server dengan tanggal WIB** (boleh menerima hari ini atau kemarin dari klien), supaya entri jam 23:30 tidak masuk hari yang salah.
- Kategori makanan disimpan sebagai nilai baku agar langsung bisa dianalisis. Daftar final menunggu peneliti.
- `photo_url` dan `input_source` sudah disiapkan untuk fase foto AI.
- Tidak menyimpan nama, NIK, atau nomor HP. Tidak ada policy delete pada data pasien.

## 7. Export Data

`GET /api/admin/export/:tabel.csv` (hanya `researcher`, dicek di API dan RLS). Server menggabungkan `accounts.code` sebagai `patient_code` dan **tidak pernah** menyertakan `pin_hash` atau id internal. File: `patient_profiles.csv`, `meal_entries.csv`, `mood_entries.csv`, `sleep_entries.csv`. Data sekecil ini cukup dibangun di memori lalu dikirim sebagai CSV.

## 8. Konfigurasi VPS

### nginx (contoh, sesuaikan versi dan domain)

```nginx
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;

server {
  listen 80;
  server_name app.contoh-netral.id;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name app.contoh-netral.id;
  # ssl_certificate dan ssl_certificate_key diisi certbot

  server_tokens off;
  root /var/www/moodbite/dist;
  index index.html;

  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy no-referrer always;
  add_header X-Frame-Options DENY always;
  add_header X-Robots-Tag "noindex, nofollow" always;
  add_header Strict-Transport-Security "max-age=31536000" always;
  add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" always;

  location = /api/auth/login {
    limit_req zone=login burst=10 nodelay;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
  }

  location / {
    try_files $uri /index.html;          # SPA fallback
  }
}
```

Jangan menaruh `add_header` lagi di dalam `location` (itu menimpa header di tingkat server).

### systemd (API)

```ini
[Unit]
Description=MoodBite API
After=network.target postgresql.service

[Service]
User=moodbite
WorkingDirectory=/opt/moodbite/api
EnvironmentFile=/etc/moodbite/api.env     # chmod 600, milik root
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`/etc/moodbite/api.env` berisi `DATABASE_URL` (role `moodbite_app`), `PORT=3000`, `NODE_ENV=production`. Tidak ada rahasia di repo.

### Hardening dasar

- Firewall (ufw): hanya 22, 80, 443. Postgres `listen_addresses = 'localhost'`.
- SSH: login key saja, root login mati, `fail2ban`.
- `unattended-upgrades` untuk patch keamanan, dan jadwalkan restart bila perlu.
- API jalan sebagai user non-root (`moodbite`), database memakai role terpisah untuk migrasi (owner) dan runtime (`moodbite_app`).
- Log tidak boleh berisi body request atau data pasien. Retensi log pendek (mis. 14 hari).
- `GET /api/health` dan monitor uptime eksternal, plus alert disk hampir penuh.
- Domain/subdomain **netral** (tanpa nama kondisi kesehatan apa pun), `robots.txt` Disallow dan `noindex`.

## 9. Backup dan Pemulihan

`deploy/backup.sh`, dijalankan harian lewat cron/systemd timer:

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%F_%H%M)
DIR=/var/backups/moodbite
mkdir -p "$DIR"
pg_dump -Fc moodbite | age -r "$AGE_PUBLIC_KEY" > "$DIR/moodbite_$STAMP.dump.age"
find "$DIR" -name '*.age' -mtime +14 -delete
# lalu salin ke lokasi LAIN yang disetujui (rclone/scp). Jangan hanya di VPS yang sama.
```

- Backup terenkripsi dengan `age`; **kunci privat disimpan terpisah dari VPS**.
- **Wajib tes restore** sebelum study dimulai (restore ke database sementara, cek jumlah baris).
- Tujuan salinan di luar VPS harus disepakati dengan klien/komite etik, karena itu juga lokasi data kesehatan.
- Selama study, tambahkan export CSV manual harian sebagai cadangan kedua.

## 10. Tanggung Jawab Operasional (Penting)

Karena data ada di VPS developer, hal berikut harus tertulis di perjanjian dengan klien:
- Lokasi data (penyedia VPS dan region), siapa yang punya akses, dan lama penyimpanan.
- Persetujuan klien/komite etik bahwa data disimpan di server tersebut.
- Developer bertindak sebagai pemroses data; klien (peneliti) sebagai pengendali data (UU PDP, cek dengan pihak etik/hukum).
- **Setelah study:** serahkan export final ke klien, lalu hapus database, backup, dan akun sesuai kesepakatan, dan konfirmasi tertulis.
- Jam dukungan dan batas tanggung jawab bila VPS bermasalah di tengah pengambilan data.

## 11. Estimasi Biaya

| Item | Perkiraan |
|---|---|
| VPS | milik developer (biaya marginal nol, tapi ada tanggung jawab operasional) |
| Domain / subdomain netral | subdomain domain sendiri gratis, domain baru berbayar tahunan |
| TLS | Let's Encrypt, gratis |
| Penyimpanan backup di luar VPS | tergantung tujuan yang disetujui |

## 12. Rencana Tes Sebelum Pasien Mulai

1. **Isolasi data:** pasien A tidak bisa membaca/mengubah data pasien B, dites langsung lewat API (bukan hanya UI) dan lewat SQL dengan role `moodbite_app`.
2. Peneliti bisa membaca semua data tapi tidak bisa mengubahnya.
3. Lockout: 5 PIN salah mengunci akun, dan pasien lain tidak terpengaruh.
4. Isi data dummy 7 hari, export CSV, cek kolom, kategori, tanggal WIB.
5. Uji di Chrome Android dan Safari iPhone, layar kecil, koneksi lambat.
6. Entri dekat tengah malam (tanggal WIB benar).
7. Postgres tidak bisa diakses dari luar (cek port dari komputer lain).
8. **Restore backup** berhasil.
9. Reboot VPS: nginx, API, dan Postgres naik sendiri.
10. Hapus semua data dummy sebelum akun pasien asli dipakai.

## 13. Di Luar Scope

- Mood forecast / prediksi individual (butuh model dan data yang belum ada)
- Foto makanan dengan AI (kolom sudah siap; penyimpanan foto butuh keputusan etik dan storage terpisah)
- App native, notifikasi push, mode offline, high availability

## 14. Alternatif yang Dipertimbangkan

**Supabase (managed):** lebih sedikit kode dan perawatan (login, RLS, backup harian di Pro), plan Free $0. Bisa dipakai kalau nanti klien lebih nyaman data di layanan managed atas nama mereka, dengan frontend React yang sama. Dalam arsitektur ini keputusan self-hosted diambil untuk menghindari biaya layanan, dengan konsekuensi tanggung jawab operasional di developer (bagian 10).
