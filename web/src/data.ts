import type { Barrier, FoodCategory, MealType, Profile } from './lib/api'

/**
 * Mood thermometer 0-5 (persis gambar referensi klien "Emotional Thermometer").
 * Angka lebih tinggi = emosi lebih berat. Urutan, warna, dan deskripsi mengikuti gambar.
 */
export const moodOptions = [
  { value: 0, label: 'Senang', face: '😄', color: '#2e8b3e', description: 'Aku merasa senang, puas, dan tenang.' },
  { value: 1, label: 'Baik', face: '🙂', color: '#7b3fa0', description: 'Aku merasa cukup baik. Aku bisa mengatasi semuanya sendiri.' },
  { value: 2, label: 'Cemas', face: '😐', color: '#2f3f95', description: 'Aku merasa cemas atau tegang. Aku bisa bercerita ke orang yang kupercaya.' },
  { value: 3, label: 'Sedih', face: '🙁', color: '#ec9a2a', description: 'Aku merasa sedih. Aku perlu bercerita ke orang yang kupercaya.' },
  { value: 4, label: 'Kesal', face: '😠', color: '#e8622a', description: 'Aku merasa kesal atau frustrasi. Mungkin aku butuh dukungan segera.' },
  { value: 5, label: 'Marah sekali', face: '😡', color: '#c8262c', description: 'Aku sangat marah. Aku butuh bantuan sekarang.' },
]

export const sleepOptions = [
  { value: 1, label: 'Sangat buruk', face: '😵', color: '#d8665b' },
  { value: 2, label: 'Buruk', face: '🥱', color: '#e78f55' },
  { value: 3, label: 'Cukup', face: '😐', color: '#e6b84b' },
  { value: 4, label: 'Baik', face: '😌', color: '#83aa73' },
  { value: 5, label: 'Sangat baik', face: '✨', color: '#3b8175' },
]

export type ScaleOption = { value: number; label: string; face: string; color: string }

export const mealTypes: Array<{ value: MealType; label: string; time: string }> = [
  { value: 'breakfast', label: 'Sarapan', time: '07:00' },
  { value: 'lunch', label: 'Makan siang', time: '12:00' },
  { value: 'dinner', label: 'Makan malam', time: '19:00' },
  { value: 'snack', label: 'Camilan', time: '15:00' },
]

/** Kategori baku FR-10 (final ditentukan peneliti). */
export const foodCategories: Array<{ value: FoodCategory; label: string }> = [
  { value: 'karbo', label: 'Karbohidrat (nasi, mi, roti)' },
  { value: 'gorengan', label: 'Gorengan' },
  { value: 'manis', label: 'Makanan manis' },
  { value: 'sayur_buah', label: 'Sayur / buah' },
  { value: 'protein', label: 'Protein (lauk, telur, tahu)' },
  { value: 'minuman_manis', label: 'Minuman manis' },
  { value: 'lainnya', label: 'Lainnya' },
]

/** Perhatian saat makan (mindful eating), permintaan klien. */
export const mindfulnessOptions = [
  { value: 1, label: 'Sama sekali tidak memperhatikan' },
  { value: 2, label: 'Sedikit memperhatikan' },
  { value: 3, label: 'Cukup memperhatikan' },
  { value: 4, label: 'Sangat memperhatikan' },
  { value: 5, label: 'Sepenuhnya memperhatikan' },
]

export const barrierOptions: Array<{ value: Barrier; label: string }> = [
  { value: 'lupa', label: 'Sering lupa mengisi' },
  { value: 'sibuk', label: 'Tidak sempat / sibuk' },
  { value: 'internet', label: 'Sinyal atau kuota internet' },
  { value: 'hp', label: 'Masalah HP (baterai, memori, dipakai bersama)' },
  { value: 'pertanyaan_sulit', label: 'Ada pertanyaan yang sulit dipahami' },
  { value: 'terlalu_lama', label: 'Pengisian terlalu lama' },
  { value: 'privasi', label: 'Khawatir soal privasi' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const easeOptions = [
  { value: 1, label: 'Sangat sulit' },
  { value: 2, label: 'Sulit' },
  { value: 3, label: 'Biasa saja' },
  { value: 4, label: 'Mudah' },
  { value: 5, label: 'Sangat mudah' },
]

export const portionOptions = ['Sedikit', 'Sedang', 'Banyak']

export const labelOf = <T extends string>(list: Array<{ value: T; label: string }>, value: T | null | undefined) =>
  list.find((item) => item.value === value)?.label ?? value ?? '–'

type Opt<K extends keyof Profile> = Array<{ value: NonNullable<Profile[K]>; label: string }>

export const sexOptions: Opt<'sex'> = [
  { value: 'female', label: 'Perempuan' },
  { value: 'male', label: 'Laki-laki' },
  { value: 'other', label: 'Lainnya' },
]
export const educationOptions = ['Tidak sekolah', 'SD / sederajat', 'SMP / sederajat', 'SMA / sederajat', 'Diploma', 'S1 / sederajat', 'Pascasarjana']
export const maritalOptions: Opt<'maritalStatus'> = [
  { value: 'single', label: 'Belum menikah' },
  { value: 'married', label: 'Menikah' },
  { value: 'divorced', label: 'Cerai hidup' },
  { value: 'widowed', label: 'Cerai mati' },
  { value: 'other', label: 'Lainnya' },
]
export const incomeOptions: Opt<'incomeGroup'> = [
  { value: 'lt_1m', label: 'Di bawah Rp1 juta' },
  { value: '1m_3m', label: 'Rp1–3 juta' },
  { value: '3m_5m', label: 'Rp3–5 juta' },
  { value: 'gt_5m', label: 'Di atas Rp5 juta' },
]
export const artStatusOptions: Opt<'artStatus'> = [
  { value: 'not_started', label: 'Belum mulai' },
  { value: 'active', label: 'Sedang menjalani' },
  { value: 'stopped', label: 'Berhenti' },
]
export const adherenceOptions: Opt<'adherence'> = [
  { value: 'good', label: 'Selalu sesuai jadwal' },
  { value: 'moderate', label: 'Kadang terlewat' },
  { value: 'poor', label: 'Sering terlewat' },
]
export const cd4Options = [
  { value: 'lt_200', label: '< 200' },
  { value: '200_499', label: '200–499' },
  { value: 'gte_500', label: '≥ 500' },
  { value: 'unknown', label: 'Tidak tahu' },
]
export const viralLoadOptions = [
  { value: 'undetectable', label: 'Tidak terdeteksi' },
  { value: 'detectable', label: 'Terdeteksi' },
  { value: 'unknown', label: 'Tidak tahu' },
]
export const smokingOptions: Opt<'smoking'> = [
  { value: 'never', label: 'Tidak pernah' },
  { value: 'former', label: 'Sudah berhenti' },
  { value: 'current', label: 'Masih merokok' },
]
export const alcoholOptions: Opt<'alcohol'> = [
  { value: 'never', label: 'Tidak pernah' },
  { value: 'occasionally', label: 'Kadang-kadang' },
  { value: 'regularly', label: 'Rutin' },
]
