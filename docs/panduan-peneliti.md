# Panduan MoodBite untuk Peneliti

Panduan ini menjelaskan cara memantau pengisian dan mengambil data setelah 7 hari pemakaian. Tidak dibutuhkan keahlian teknis.

## 1. Sebelum studi dimulai

1. **Akun peneliti** dibuat oleh developer. Akun **pasien** dibuat sendiri oleh peneliti lewat dashboard, di menu **Kelola pasien** (lihat bagian 2a).
2. Setiap PIN pasien hanya ditampilkan **sekali** saat akun dibuat atau direset. Catat di tempat aman. Bila hilang, cukup tekan **Reset PIN**.
3. Berikan ke setiap partisipan: link aplikasi, kode, PIN, dan **Panduan Singkat untuk Partisipan** (`panduan-pasien.md`). Kirim PIN lewat saluran yang terpisah dari link bila memungkinkan.
4. Pastikan *ethical clearance* dan *informed consent* sudah ada sebelum data pertama diisi.
5. Minta developer menghapus semua data uji coba sebelum partisipan asli mulai mengisi.

## 2. Masuk ke dashboard

Buka link yang sama dengan partisipan, lalu masuk memakai **kode dan PIN peneliti**. Dashboard peneliti akan terbuka otomatis.

## 2a. Kelola pasien (membuat akun & reset PIN)

Di dashboard, buka menu **Kelola pasien**:

- **Membuat akun:** kode pasien disarankan otomatis (P001, P002, …) dan boleh diubah (huruf, angka, atau tanda hubung). Tekan **Buat akun**. Sistem membuat PIN 8 angka secara acak.
- **PIN hanya ditampilkan sekali.** Tekan **Salin kode & PIN** atau catat, lalu berikan ke pasien. Sebaiknya kirim PIN terpisah dari link aplikasi. Tekan **Sudah dicatat** untuk menutup.
- **Pasien lupa PIN atau akunnya terkunci** (5 kali salah PIN): tekan **Reset PIN** pada baris pasien. PIN lama langsung tidak berlaku, pasien otomatis keluar dari HP-nya, dan kunci akun dibuka.
- **Status pasien:** *Belum onboarding* (belum mengisi profil awal), *Aktif*, atau *Terkunci*.
- Jangan menulis nama atau nomor HP pasien sebagai kode. Simpan daftar pasangan nama ↔ kode di luar aplikasi, sesuai protokol studi.

## 3. Memantau pengisian (setiap hari)

Dashboard menampilkan:

| Bagian | Isinya |
|---|---|
| **Kelayakan studi** | Kriteria keberhasilan PRD bagian 11 untuk seluruh studi: jumlah partisipan yang menyelesaikan 7 hari (lengkap / ada isian), median waktu mengisi per hari, rata-rata kemudahan (1–5), hambatan yang dilaporkan, dan komentar partisipan |
| **Kartu ringkasan** | Jumlah partisipan, persentase hari yang terisi lengkap, rerata mood (serta % check-in yang merasa stres), dan rerata durasi tidur |
| **Tren termometer emosi** | Rerata skor emosi 0–5 per hari (makin tinggi = emosi makin berat). Arahkan kursor atau ketuk grafik untuk melihat angkanya |
| **Check-in yang merasa stres** | Persentase jawaban "Ya" untuk pertanyaan stres, per hari |
| **Kelengkapan pengisian** | Jumlah hari-partisipan yang lengkap, sebagian, atau kosong |
| **Tren durasi tidur** | Rerata jam tidur per hari |
| **Kategori makanan** | Proporsi kategori dari semua catatan makan |
| **Distribusi termometer emosi** | Sebaran jawaban 0–5 |
| **Kelengkapan per partisipan** | Jumlah hari terisi per kode. Status *Perlu diingatkan* berarti kurang dari 50% hari terisi lengkap |
| **Analisis hubungan** | Kesimpulan otomatis tentang hubungan stres, tidur, dan kategori makanan terhadap mood dan stres (lihat bagian 3a) |

**Filter:** pilih rentang tanggal (atau *Rentang cepat*) dan isi kode partisipan bila ingin melihat satu orang saja, lalu tekan **Terapkan**.

Satu hari dihitung **lengkap** bila ada minimal 1 catatan makan, 1 catatan perasaan & stres, dan 1 catatan tidur pada tanggal tersebut (zona waktu WIB).

**Pengingat:** aplikasi tidak mengirim notifikasi. Kirim pengingat manual dengan pesan netral, misalnya *"Halo, jangan lupa isi catatan harian hari ini ya."* Jangan menyebut kondisi kesehatan di dalam pesan.

## 3a. Membaca analisis hubungan

- **Cara kerja:** setiap partisipan dibandingkan dengan **dirinya sendiri**. Contoh: mood di hari ia stres dibandingkan dengan mood di hari ia tidak stres. Hasilnya lalu dirata-rata antar partisipan, sehingga perbedaan "orang yang memang selalu ceria" tidak ikut memengaruhi.
- **Tombol "Makanan: hari sama / Hari berikutnya"** memilih apakah makanan dibandingkan dengan mood/stres di hari yang sama atau keesokan harinya.
- **Kolom kesimpulan:**
  - **Terlihat ↑/↓:** rentang kepercayaan 95% tidak melewati 0 dan lolos koreksi banyak perbandingan.
  - **Belum jelas:** ada perkiraan, tetapi masih bisa terjadi karena kebetulan.
  - **Data kurang:** jumlah hari belum memenuhi syarat minimal.
- **Grafik titik-garis (forest plot):** titik adalah perkiraan efek, garis adalah rentang ketidakpastian 95%, dan garis tegak adalah "tidak ada efek". Makin pendek garisnya, makin pasti perkiraannya.
- **Isi kode partisipan di filter** untuk melihat timeline dan analisis satu orang. Syarat datanya lebih longgar, jadi hasilnya lebih tidak pasti.
- **Penting untuk publikasi:** hasil ini adalah **asosiasi dari data observasional, bukan sebab-akibat**. Dengan sekitar 20 partisipan × 7 hari, hanya efek yang cukup besar yang bisa terlihat. Efek makanan yang nyata pun bisa tetap berstatus "belum jelas". Untuk konferensi, laporkan sebagai temuan eksploratif dan konfirmasi dengan model multilevel dari data CSV.

## 4. Mengambil data (CSV)

Di bagian bawah dashboard (**Ekspor CSV**) ada 6 file:

| File | Isi |
|---|---|
| **`daily_summary.csv`** | **Mulai dari file ini untuk analisis.** Satu baris = satu partisipan pada satu tanggal, gabungan emosi, stres, tidur, dan makan (PRD bagian 8). Hari kosong dalam 7 hari studi tetap muncul sebagai baris agar data yang hilang terlihat |
| `study_feedback.csv` | Kuesioner akhir: kemudahan 1–5, hambatan, dan saran |
| `patient_profiles.csv` | Profil awal (demografi, BMI, informasi tambahan) |
| `meal_entries.csv` | Catatan makan, termasuk kategori makanan dan perhatian saat makan |
| `mood_entries.csv` | Termometer emosi 0–5, catatan perasaan, stres ya/tidak, dan penyebabnya |
| `sleep_entries.csv` | Durasi tidur, kualitas 1–5, dan hambatan tidur |

- File berisi **seluruh data**, tidak terpengaruh filter di dashboard.
- Setiap baris memakai `patient_code`. Tidak ada nama atau id internal.
- File bisa dibuka langsung di Excel (sudah memakai format UTF-8), SPSS, R, atau Python.
- **Selama studi, unduh keempat file setiap hari** sebagai cadangan tambahan.

### Kolom `daily_summary.csv`

| Kolom | Arti |
|---|---|
| `study_day` | Hari studi ke-n sejak catatan pertama partisipan |
| `complete` | `true` bila hari itu ada catatan makan, emosi, dan tidur |
| `mood`, `mood_label` | Termometer emosi 0–5 dan labelnya |
| `negative_emotion` | `true` bila mood ≥ 2 (cemas, sedih, kesal, marah sekali). Lebih aman dianalisis daripada rata-rata skor, karena tiap tingkat adalah emosi yang berbeda jenis |
| `mood_recorded_at` | Waktu check-in emosi (UTC). Bandingkan dengan `first_meal_at`/`last_meal_at` untuk memastikan makan terjadi sebelum check-in |
| `is_stressed`, `stress_cause` | Stres ya/tidak dan penyebabnya |
| `sleep_hours`, `sleep_quality`, `sleep_obstacle` | Tidur malam sebelumnya |
| `meal_count`, `breakfast_count` … `snack_count` | Jumlah catatan makan total dan per waktu makan |
| `cat_karbo` … `cat_lainnya` | Jumlah catatan makan per kategori pada hari itu |
| `mindfulness_mean` | Rata-rata perhatian saat makan (1–5) |
| `first_meal_at`, `last_meal_at` | Jam makan pertama dan terakhir |
| `meals_complete` | Jawaban "semua makan sudah dicatat?": `true`, `false`, atau kosong bila tidak dijawab. **Untuk analisis makanan, sebaiknya keluarkan baris `false`**: di hari itu, kategori yang bernilai 0 belum tentu berarti tidak dimakan |
| `fill_seconds` | Total detik aktif mengisi pada hari itu (dari sentuhan pertama sampai tersimpan, termasuk perbaikan) |

### Kode nilai di CSV

| Kolom | Nilai |
|---|---|
| `mindfulness` | Perhatian saat makan: 1 sama sekali tidak · 2 sedikit · 3 cukup · 4 sangat · 5 sepenuhnya memperhatikan |
| `barriers` (study_feedback) | Dipisah titik koma: `lupa` · `sibuk` · `internet` · `hp` · `pertanyaan_sulit` · `terlalu_lama` · `privasi` · `lainnya` |
| `ease` (study_feedback) | Kemudahan: 1 sangat sulit … 5 sangat mudah |
| `meal_type` | `breakfast` sarapan · `lunch` makan siang · `dinner` makan malam · `snack` camilan |
| `food_category` | `karbo` · `gorengan` · `manis` · `sayur_buah` · `protein` · `minuman_manis` · `lainnya` |
| `input_source` | `manual` (saat ini selalu manual; `ai` disiapkan untuk fase foto) |
| `mood` | Termometer emosi: 0 senang · 1 baik · 2 cemas · 3 sedih · 4 kesal · 5 marah sekali (**makin tinggi = emosi makin berat**) |
| `note` | catatan perasaan hari ini (opsional) |
| `is_stressed` | `true` / `false`; `stress_cause` hanya terisi bila `true` |
| `quality` (tidur) | 1 sangat buruk · 2 buruk · 3 cukup · 4 baik · 5 sangat baik |
| `sex` | `female` · `male` · `other` · `prefer_not_to_say` |
| `marital_status` | `single` · `married` · `divorced` · `widowed` · `other` |
| `income_group` | `lt_1m` (< Rp1 jt) · `1m_3m` · `3m_5m` · `gt_5m` (> Rp5 jt) · `prefer_not_to_say` |
| `diagnosis_duration_months` | lama sejak diagnosis, dalam bulan |
| Kolom klinis opsional lainnya | Kode nilai mengikuti pilihan di form profil (`web/src/data.ts`); kosong = tidak diisi |
| `smoking` | `never` · `former` · `current` |
| `alcohol` | `never` · `occasionally` · `regularly` |
| `entry_date` | tanggal catatan (WIB). Partisipan boleh mengisi hari ini atau kemarin |

## 4a. Pilihan 4 atau 5 di termometer emosi

Level 5 berbunyi *"Aku sangat marah. Aku butuh bantuan sekarang."* Aplikasi menampilkan pesan dukungan dan nomor darurat 119 kepada partisipan, tetapi **tidak mengirim notifikasi ke peneliti**. Sepakati sejak awal dengan komite etik bagaimana tim akan menindaklanjuti jawaban 4–5, misalnya dengan memeriksa `mood_entries.csv` setiap hari.

## 5. Setelah hari ke-7

1. Unduh keempat file CSV dan simpan di lokasi institusi yang aman.
2. Konfirmasi ke developer bahwa data sudah diterima.
3. Developer akan menghapus database, backup, dan akun sesuai kesepakatan, lalu mengirim konfirmasi tertulis.

> Catatan: dengan 20 partisipan × 7 hari, data ini untuk menilai kelayakan alur pengumpulan data, belum untuk menyimpulkan hubungan makanan dan mood.
