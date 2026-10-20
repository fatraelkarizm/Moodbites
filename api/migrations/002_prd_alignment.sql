-- Menyelaraskan skema dengan PRD v1.0:
-- FR-10 kategori makanan baku, kolom fase foto AI, dan kelompok pendapatan
-- (brief klien) menggantikan nominal pendapatan. Stres tetap ya/tidak + penyebab sesuai brief.
begin;

alter table public.meal_entries
  add column food_category text not null default 'lainnya'
    check (food_category in ('karbo','gorengan','manis','sayur_buah','protein','minuman_manis','lainnya')),
  add column photo_url text,
  add column input_source text not null default 'manual' check (input_source in ('manual','ai'));
alter table public.meal_entries alter column food_category drop default;

alter table public.patient_profiles
  add column income_group text not null default 'prefer_not_to_say'
    check (income_group in ('lt_1m','1m_3m','3m_5m','gt_5m','prefer_not_to_say'));
alter table public.patient_profiles alter column income_group drop default;
alter table public.patient_profiles drop column monthly_income;

create index meal_entries_category_idx on public.meal_entries(food_category);

commit;
