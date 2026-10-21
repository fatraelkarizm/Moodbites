-- Persetujuan partisipan sebelum data apa pun direkam (permintaan klien, mengikuti prototype):
-- 1. persetujuan ikut penelitian (informed consent), 2. persetujuan data aplikasi direkam & dipakai untuk penelitian.
-- consent_version mencatat versi teks yang disetujui agar bisa dilacak bila teks berubah.
begin;

create table public.consents(
  patient_id uuid primary key references public.accounts(id) on delete cascade,
  research_consent boolean not null check (research_consent),
  data_consent boolean not null check (data_consent),
  consent_version text not null,
  agreed_at timestamptz not null default now()
);

alter table public.consents enable row level security;
alter table public.consents force row level security;
create policy consents_select on public.consents for select using (patient_id = public.app_account_id() or public.app_is_researcher());
create policy consents_insert on public.consents for insert with check (patient_id = public.app_account_id() and not public.app_is_researcher());
create policy consents_update on public.consents for update using (patient_id = public.app_account_id() and not public.app_is_researcher()) with check (patient_id = public.app_account_id() and not public.app_is_researcher());

grant select, insert, update on public.consents to moodbite_app;

commit;
