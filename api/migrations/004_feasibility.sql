-- Kriteria keberhasilan feasibility (PRD bagian 11) dan kualitas data makan:
-- 1. fill_seconds: waktu aktif mengisi tiap catatan (dijumlahkan bila diperbaiki), dari interaksi pertama sampai simpan.
-- 2. day_checks: pasien menandai apakah semua makan pada tanggal itu sudah dicatat,
--    agar "tidak makan" bisa dibedakan dari "lupa mencatat".
-- 3. study_feedback: kuesioner singkat hambatan di akhir 7 hari.
begin;

alter table public.mood_entries add column fill_seconds int not null default 0 check (fill_seconds >= 0);
alter table public.meal_entries add column fill_seconds int not null default 0 check (fill_seconds >= 0);
alter table public.sleep_entries add column fill_seconds int not null default 0 check (fill_seconds >= 0);

create table public.day_checks(
  patient_id uuid not null references public.accounts(id) on delete cascade,
  entry_date date not null,
  meals_complete boolean not null,
  updated_at timestamptz not null default now(),
  primary key (patient_id, entry_date)
);

create table public.study_feedback(
  patient_id uuid primary key references public.accounts(id) on delete cascade,
  ease smallint not null check (ease between 1 and 5),
  barriers text[] not null default '{}'
    check (barriers <@ array['lupa','sibuk','internet','hp','pertanyaan_sulit','terlalu_lama','privasi','lainnya']::text[]),
  barriers_other text,
  suggestion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
 foreach t in array array['day_checks','study_feedback'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('create policy %I on public.%I for select using(patient_id=public.app_account_id() or public.app_is_researcher())',t||'_select',t);
  execute format('create policy %I on public.%I for insert with check(patient_id=public.app_account_id() and not public.app_is_researcher())',t||'_insert',t);
  execute format('create policy %I on public.%I for update using(patient_id=public.app_account_id() and not public.app_is_researcher()) with check(patient_id=public.app_account_id() and not public.app_is_researcher())',t||'_update',t);
 end loop;
end $$;

grant select, insert, update on public.day_checks, public.study_feedback to moodbite_app;

commit;
