begin;
create extension if not exists pgcrypto;

create or replace function public.app_account_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.account_id', true), '')::uuid
$$;
create or replace function public.app_is_researcher() returns boolean language sql stable as $$
  select coalesce(current_setting('app.role', true) = 'researcher', false)
$$;

create table public.accounts(
 id uuid primary key default gen_random_uuid(), code text unique not null check(length(code) between 1 and 50), pin_hash text not null,
 role text not null default 'patient' check(role in('patient','researcher')), failed_attempts int not null default 0 check(failed_attempts>=0),
 locked_until timestamptz, created_at timestamptz not null default now()
);
create table public.sessions(
 token_hash text primary key, account_id uuid not null references public.accounts(id) on delete cascade,
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index sessions_account_id_idx on public.sessions(account_id);
create index sessions_expires_at_idx on public.sessions(expires_at);

create table public.patient_profiles(
 patient_id uuid primary key references public.accounts(id) on delete cascade,
 age smallint not null check(age between 10 and 120), sex text not null check(sex in('male','female','other','prefer_not_to_say')),
 weight_kg numeric(5,1) not null check(weight_kg between 20 and 500), height_cm numeric(5,1) not null check(height_cm between 80 and 250),
 bmi numeric(5,2) generated always as (round(weight_kg / power(height_cm / 100,2),2)) stored,
 education text not null, marital_status text not null check(marital_status in('single','married','divorced','widowed','other')),
 occupation text not null, monthly_income bigint not null check(monthly_income>=0), diagnosis_duration_months int not null check(diagnosis_duration_months between 0 and 1440),
 art_status text check(art_status in('not_started','active','stopped')), art_duration_months int check(art_duration_months between 0 and 1440),
 art_regimen text, adherence text check(adherence in('good','moderate','poor')), cd4_category text, viral_load_category text,
 smoking text check(smoking in('never','former','current')), alcohol text check(alcohol in('never','occasionally','regularly')),
 has_complications boolean not null, complications text,
 has_treatment_side_effects boolean not null, treatment_side_effects text, updated_at timestamptz not null default now(),
 check((has_complications and nullif(btrim(complications),'') is not null) or (not has_complications and complications is null)),
 check((has_treatment_side_effects and nullif(btrim(treatment_side_effects),'') is not null) or (not has_treatment_side_effects and treatment_side_effects is null))
);
create table public.meal_entries(
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.accounts(id) on delete cascade,
 entry_date date not null, meal_type text not null check(meal_type in('breakfast','lunch','dinner','snack')), eaten_at time not null,
 food_name text not null check(length(btrim(food_name))>0), portion_size text not null check(length(btrim(portion_size))>0),
 servings numeric(6,2) not null check(servings>0 and servings<=100), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.mood_entries(
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.accounts(id) on delete cascade,
 entry_date date not null, recorded_at timestamptz not null default now(), mood smallint not null check(mood between 1 and 5), note text,
 is_stressed boolean not null, stress_cause text, updated_at timestamptz not null default now(),
 check((is_stressed and nullif(btrim(stress_cause),'') is not null) or (not is_stressed and stress_cause is null)),
 unique(patient_id,entry_date)
);
create table public.sleep_entries(
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.accounts(id) on delete cascade,
 entry_date date not null, duration_hours numeric(4,2) not null check(duration_hours between 0 and 24), quality smallint not null check(quality between 1 and 5), obstacle text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(patient_id,entry_date)
);
create index meal_entries_patient_date_idx on public.meal_entries(patient_id,entry_date);
create index mood_entries_patient_date_idx on public.mood_entries(patient_id,entry_date);
create index sleep_entries_patient_date_idx on public.sleep_entries(patient_id,entry_date);

do $$ declare t text; begin
 foreach t in array array['patient_profiles','meal_entries','mood_entries','sleep_entries'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('create policy %I on public.%I for select using(patient_id=public.app_account_id() or public.app_is_researcher())',t||'_select',t);
  execute format('create policy %I on public.%I for insert with check(patient_id=public.app_account_id() and not public.app_is_researcher())',t||'_insert',t);
  execute format('create policy %I on public.%I for update using(patient_id=public.app_account_id() and not public.app_is_researcher()) with check(patient_id=public.app_account_id() and not public.app_is_researcher())',t||'_update',t);
 end loop;
end $$;

do $$ begin create role moodbite_app nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public to moodbite_app;
grant execute on function public.app_account_id(),public.app_is_researcher() to moodbite_app;
grant select,insert,update on public.patient_profiles,public.meal_entries,public.mood_entries,public.sleep_entries to moodbite_app;
grant select,update on public.accounts to moodbite_app;
grant select,insert,update,delete on public.sessions to moodbite_app;
commit;
