-- Permintaan klien (20 Okt 2026):
-- 1. Mood mengikuti emotional thermometer 0-5: 0 senang, 1 baik, 2 cemas, 3 sedih, 4 kesal, 5 marah sekali.
--    Angka lebih tinggi = emosi lebih berat. Ini MEMBALIK arti skala lama (1 sangat buruk - 5 sangat baik),
--    jadi seluruh data uji coba mood dengan skala lama harus dihapus sebelum studi dimulai.
-- 2. Catatan makan menambah pertanyaan perhatian saat makan (mindful eating) 1-5.
begin;

alter table public.mood_entries drop constraint mood_entries_mood_check;
alter table public.mood_entries add constraint mood_entries_mood_check check (mood between 0 and 5);
comment on column public.mood_entries.mood is '0 senang, 1 baik, 2 cemas, 3 sedih, 4 kesal, 5 marah sekali';

-- Nullable agar baris lama tetap valid; API mewajibkan nilai untuk entri baru.
alter table public.meal_entries add column mindfulness smallint check (mindfulness between 1 and 5);
comment on column public.meal_entries.mindfulness is
  'Saat makan, seberapa besar memperhatikan apa yang dimakan dan dirasakan: 1 sama sekali tidak - 5 sepenuhnya';

commit;
