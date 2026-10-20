-- Manajemen pasien dari dashboard peneliti: membuat akun pasien dan mereset PIN.
-- API tetap membatasi aksi ini ke role researcher dan hanya untuk akun role patient.
begin;

alter table public.accounts
  add column created_by uuid references public.accounts(id) on delete set null,
  add column pin_reset_at timestamptz;

grant insert on public.accounts to moodbite_app;

commit;
