-- Drop out partisipan tanpa menghapus data penelitian secara permanen.
-- Akun yang dikeluarkan tidak dapat masuk dan tidak disertakan dalam analisis/ekspor.
begin;

alter table public.accounts
  add column excluded_at timestamptz,
  add column exclusion_reason text;

commit;
