-- BarberHub Pro — UNICO script SQL (schema + dati di allineamento + RLS + RPC + trigger)
-- PostgreSQL / Supabase. Non esistono altri file SQL patch nel repo: tutto va qui.
--
-- USO:
--   1) SQL Editor → incolla tutto questo file → Run (transazione fino a COMMIT).
--   2) Settings → API → Reload schema cache.
--
-- DB già in produzione: esegui solo dopo backup; molte parti sono idempotenti
-- (IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS).
--
-- Ordine DDL: le FK verso public.profiles sono solo dopo la creazione di profiles.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUM / tipi
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'BARBER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('pending', 'confirmed', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'srl', 'privato');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Sedi / filiali per azienda (tenant)
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists idx_locations_company on public.locations (company_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role public.user_role not null,
  company_id uuid references public.companies (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint profiles_super_admin_company check (
    (role = 'SUPER_ADMIN' and company_id is null)
    or (role <> 'SUPER_ADMIN' and company_id is not null)
  )
);

alter table public.profiles add column if not exists location_id uuid references public.locations (id) on delete set null;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  location_id uuid references public.locations (id) on delete restrict,
  name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists location_id uuid references public.locations (id) on delete restrict;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  location_id uuid references public.locations (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  barber_id uuid references public.profiles (id) on delete set null,
  manager_id uuid references public.profiles (id) on delete set null,
  service_name text not null,
  date timestamptz not null,
  status public.appointment_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.appointments add column if not exists location_id uuid references public.locations (id) on delete restrict;

create index if not exists idx_appointments_company_date on public.appointments (company_id, date);
create index if not exists idx_appointments_barber_date on public.appointments (barber_id, date) where barber_id is not null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  location_id uuid references public.locations (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  category text not null,
  method public.payment_method not null,
  date timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.payments add column if not exists location_id uuid references public.locations (id) on delete restrict;

create index if not exists idx_payments_company_date on public.payments (company_id, date);

-- Slot pubblici /book (dopo profiles: FK barber_id, created_by)
create table if not exists public.location_open_slots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  slot_date date not null,
  slot_mins int not null,
  barber_id uuid references public.profiles (id) on delete set null,
  seats int not null default 1,
  slot_duration_mins int not null default 30,
  show_barber_name boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint location_open_slots_mins check (
    slot_mins >= 5 * 60 and slot_mins <= 23 * 60 and slot_mins % 30 = 0
  ),
  constraint location_open_slots_seats_chk check (seats >= 1 and seats <= 20),
  constraint location_open_slots_dur_chk check (slot_duration_mins >= 15 and slot_duration_mins <= 240)
);

create index if not exists idx_location_open_slots_loc_date on public.location_open_slots (location_id, slot_date);

create unique index if not exists location_open_slots_uq_loc_date_mins_barber
  on public.location_open_slots (location_id, slot_date, slot_mins, barber_id) nulls not distinct;

-- Aggiornamento DB esistenti (prima install senza sedi / colonne)
insert into public.locations (company_id, name)
select c.id, 'Sede principale'
from public.companies c
where not exists (select 1 from public.locations l where l.company_id = c.id);

update public.clients cl
set location_id = coalesce(
  cl.location_id,
  (
    select l.id
    from public.locations l
    where l.company_id = cl.company_id
    order by l.created_at asc
    limit 1
  )
)
where cl.location_id is null;

update public.payments p
set location_id = coalesce(
  p.location_id,
  (
    select l.id
    from public.locations l
    where l.company_id = p.company_id
    order by l.created_at asc
    limit 1
  )
)
where p.location_id is null;

update public.appointments a
set location_id = coalesce(a.location_id, (select c.location_id from public.clients c where c.id = a.client_id))
where a.location_id is null;

alter table public.payments drop column if exists location;

alter table public.clients drop constraint if exists clients_company_id_phone_key;

update public.profiles pr
set location_id = coalesce(
  pr.location_id,
  (
    select l.id
    from public.locations l
    where l.company_id = pr.company_id
    order by l.created_at asc
    limit 1
  )
)
where pr.role in ('MANAGER', 'BARBER') and pr.company_id is not null and pr.location_id is null;

alter table public.clients alter column location_id set not null;
alter table public.appointments alter column location_id set not null;
alter table public.payments alter column location_id set not null;

alter table public.clients drop constraint if exists clients_company_location_phone;
alter table public.clients add constraint clients_company_location_phone unique (company_id, location_id, phone);

-- ---------------------------------------------------------------------------
-- Helper RLS (SECURITY DEFINER, search_path fisso)
-- ---------------------------------------------------------------------------
create or replace function public.jwt_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '');
$$;

create or replace function public.profile_for(uid uuid)
returns public.profiles language sql security definer stable set search_path = public as $$
  select * from public.profiles where id = uid;
$$;

create or replace function public.is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'SUPER_ADMIN'
  );
$$;

create or replace function public.my_company_id()
returns uuid language sql security definer stable set search_path = public as $$
  select p.company_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.my_role()
returns public.user_role language sql security definer stable set search_path = public as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.my_location_id()
returns uuid language sql security definer stable set search_path = public as $$
  select p.location_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_company_admin_or_manager()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ADMIN', 'MANAGER')
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC prenotazione pubblica (anon + authenticated)
-- ---------------------------------------------------------------------------
drop function if exists public.rpc_public_book_appointment(uuid, text, text, text, text, timestamptz, int);
drop function if exists public.rpc_public_book_appointment(uuid, text, text, text, text, timestamptz, int, uuid);
drop function if exists public.rpc_public_book_appointment(uuid, text, text, text, text, timestamptz, int, uuid, uuid);

create or replace function public.rpc_public_book_appointment(
  p_company_id uuid,
  p_client_name text,
  p_client_phone text,
  p_client_notes text,
  p_service_name text,
  p_at timestamptz,
  p_slot_minutes int default 30,
  p_location_id uuid default null,
  p_barber_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $func$
#variable_conflict use_variable
declare
  chosen_location_id uuid;
  chosen_client_id uuid;
  new_appointment_id uuid;
  slot_rec public.location_open_slots%rowtype;
  overlap_count int;
begin
  if p_slot_minutes is null or p_slot_minutes < 15 or p_slot_minutes > 240 then
    raise exception 'slot non valido';
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'azienda non trovata';
  end if;

  chosen_location_id := p_location_id;
  if chosen_location_id is not null then
    if not exists (
      select 1 from public.locations l
      where l.id = chosen_location_id and l.company_id = p_company_id
    ) then
      raise exception 'sede non valida';
    end if;
  else
    select l.id into chosen_location_id
    from public.locations l
    where l.company_id = p_company_id
    order by l.created_at asc
    limit 1;
  end if;

  if chosen_location_id is null then
    raise exception 'nessuna sede per questa azienda';
  end if;

  if p_barber_id is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = p_barber_id
        and p.company_id = p_company_id
        and p.location_id = chosen_location_id
        and p.role = 'BARBER'
    ) then
      raise exception 'barber non valido';
    end if;
  end if;

  select s.*
  into slot_rec
  from public.location_open_slots s
  where s.location_id = chosen_location_id
    and s.company_id = p_company_id
    and date_trunc(
      'minute',
      (s.slot_date::timestamp + make_interval(mins => s.slot_mins)) at time zone 'Europe/Rome'
    ) = date_trunc('minute', p_at)
    and s.slot_duration_mins = p_slot_minutes
    and (s.barber_id is not distinct from p_barber_id)
  limit 1;

  if not found then
    raise exception 'slot non pubblico o non attivato dal manager';
  end if;

  if slot_rec.barber_id is not null then
    select count(*)::int into overlap_count
    from public.appointments a
    where a.barber_id = slot_rec.barber_id
      and a.status in ('pending', 'confirmed')
      and a.date < p_at + (slot_rec.slot_duration_mins * interval '1 minute')
      and a.date + (slot_rec.slot_duration_mins * interval '1 minute') > p_at;

    if overlap_count >= slot_rec.seats then
      raise exception 'slot non disponibile';
    end if;
  else
    select count(*)::int into overlap_count
    from public.appointments a
    where a.company_id = p_company_id
      and a.location_id = chosen_location_id
      and a.barber_id is null
      and a.status in ('pending', 'confirmed')
      and a.date < p_at + (slot_rec.slot_duration_mins * interval '1 minute')
      and a.date + (slot_rec.slot_duration_mins * interval '1 minute') > p_at;

    if overlap_count >= slot_rec.seats then
      raise exception 'slot non disponibile';
    end if;
  end if;

  insert into public.clients (company_id, location_id, name, phone, notes)
  values (
    p_company_id,
    chosen_location_id,
    p_client_name,
    p_client_phone,
    nullif(trim(p_client_notes), '')
  )
  on conflict (company_id, location_id, phone) do update
    set name = excluded.name,
        notes = coalesce(excluded.notes, public.clients.notes)
  returning id into chosen_client_id;

  insert into public.appointments (
    company_id, location_id, client_id, barber_id, manager_id, service_name, date, status
  )
  values (
    p_company_id,
    chosen_location_id,
    chosen_client_id,
    p_barber_id,
    null::uuid,
    p_service_name,
    p_at,
    'pending'::public.appointment_status
  )
  returning id into new_appointment_id;

  return new_appointment_id;
end;
$func$;

revoke all on function public.rpc_public_book_appointment(uuid, text, text, text, text, timestamptz, int, uuid, uuid) from public;
grant execute on function public.rpc_public_book_appointment(uuid, text, text, text, text, timestamptz, int, uuid, uuid) to anon, authenticated;

-- Slot liberi per giorno (fascia oraria Europe/Rome, anti-sovrapposizione)
drop function if exists public.rpc_public_availability(uuid, uuid, date, int);

create or replace function public.rpc_public_availability(
  p_company_id uuid,
  p_location_id uuid,
  p_date date,
  p_slot_minutes int default 30
) returns jsonb
language plpgsql
security definer
set search_path = public
as $av$
declare
  open_n int;
begin
  if p_slot_minutes is null or p_slot_minutes < 15 or p_slot_minutes > 240 then
    raise exception 'slot non valido';
  end if;

  if not exists (
    select 1 from public.locations l
    where l.id = p_location_id and l.company_id = p_company_id
  ) then
    raise exception 'sede non valida';
  end if;

  select count(*)::int into open_n
  from public.location_open_slots lbs
  where lbs.location_id = p_location_id
    and lbs.company_id = p_company_id
    and lbs.slot_date = p_date;

  if open_n = 0 then
    return '[]'::jsonb;
  end if;

  return coalesce((
    with base as (
      select
        lbs.id,
        lbs.barber_id,
        lbs.seats,
        lbs.slot_duration_mins,
        lbs.show_barber_name,
        ((lbs.slot_date::timestamp + make_interval(mins => lbs.slot_mins)) at time zone 'Europe/Rome') as slot_at
      from public.location_open_slots lbs
      where lbs.location_id = p_location_id
        and lbs.company_id = p_company_id
        and lbs.slot_date = p_date
    ),
    occ as (
      select
        b.id,
        b.slot_at,
        b.barber_id,
        b.seats,
        b.slot_duration_mins,
        b.show_barber_name,
        case
          when b.barber_id is not null then (
            select count(*)::int
            from public.appointments a
            where a.barber_id = b.barber_id
              and a.status in ('pending', 'confirmed')
              and a.date < b.slot_at + (b.slot_duration_mins * interval '1 minute')
              and a.date + (b.slot_duration_mins * interval '1 minute') > b.slot_at
          )
          else (
            select count(*)::int
            from public.appointments a
            where a.company_id = p_company_id
              and a.location_id = p_location_id
              and a.barber_id is null
              and a.status in ('pending', 'confirmed')
              and a.date < b.slot_at + (b.slot_duration_mins * interval '1 minute')
              and a.date + (b.slot_duration_mins * interval '1 minute') > b.slot_at
          )
        end as booked
      from base b
    ),
    named as (
      select
        o.slot_at,
        o.barber_id,
        case
          when o.barber_id is null then 'In salone'
          when o.show_barber_name then coalesce(pr.name, 'Barber')
          else 'Barber'
        end as barber_disp,
        o.slot_duration_mins,
        greatest(o.seats - o.booked, 0) as seats_left
      from occ o
      left join public.profiles pr on pr.id = o.barber_id
      where o.booked < o.seats
    )
    select jsonb_agg(
      jsonb_build_object(
        'at', n.slot_at,
        'barberId', n.barber_id,
        'barberName', n.barber_disp,
        'durationMins', n.slot_duration_mins,
        'seatsLeft', n.seats_left
      )
      order by n.slot_at, n.barber_disp
    )
    from named n
  ), '[]'::jsonb);
end;
$av$;

revoke all on function public.rpc_public_availability(uuid, uuid, date, int) from public;
grant execute on function public.rpc_public_availability(uuid, uuid, date, int) to anon, authenticated;

create or replace function public.rpc_public_company_info(p_company_id uuid)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'id', c.id,
    'name', c.name,
    'locations', coalesce(
      (
        select json_agg(json_build_object('id', l.id, 'name', l.name) order by l.created_at asc)
        from public.locations l
        where l.company_id = c.id
      ),
      '[]'::json
    )
  )
  from public.companies c
  where c.id = p_company_id;
$$;

revoke all on function public.rpc_public_company_info(uuid) from public;
grant execute on function public.rpc_public_company_info(uuid) to anon, authenticated;

-- Appuntamenti cliente da link pubblico (nome + email o telefono, sede della richiesta)
drop function if exists public.rpc_public_client_bookings(uuid, uuid, text, text);

create or replace function public.rpc_public_client_bookings(
  p_company_id uuid,
  p_location_id uuid,
  p_full_name text,
  p_contact text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_client_id uuid;
  v_name text := trim(coalesce(p_full_name, ''));
  v_contact_trim text := trim(coalesce(p_contact, ''));
  v_digits text;
  v_is_email boolean;
  v_appts jsonb;
begin
  if length(v_name) < 2 or length(v_contact_trim) < 3 then
    return jsonb_build_object('found', false, 'appointments', '[]'::jsonb);
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    return jsonb_build_object('found', false, 'appointments', '[]'::jsonb);
  end if;

  if not exists (
    select 1 from public.locations l where l.id = p_location_id and l.company_id = p_company_id
  ) then
    return jsonb_build_object('found', false, 'appointments', '[]'::jsonb);
  end if;

  v_is_email := position('@' in v_contact_trim) > 0;
  v_digits := regexp_replace(v_contact_trim, '[^0-9]', '', 'g');

  if not v_is_email and length(v_digits) < 8 then
    return jsonb_build_object('found', false, 'appointments', '[]'::jsonb);
  end if;

  select c.id into v_client_id
  from public.clients c
  where c.company_id = p_company_id
    and c.location_id = p_location_id
    and lower(trim(c.name)) = lower(v_name)
    and (
      (v_is_email and c.email is not null and lower(trim(c.email)) = lower(v_contact_trim))
      or (
        not v_is_email
        and (
          regexp_replace(trim(c.phone), '[^0-9]', '', 'g') = v_digits
          or (
            length(v_digits) >= 10
            and length(regexp_replace(trim(c.phone), '[^0-9]', '', 'g')) >= 10
            and right(regexp_replace(trim(c.phone), '[^0-9]', '', 'g'), 10) = right(v_digits, 10)
          )
        )
      )
    )
  limit 1;

  if v_client_id is null then
    return jsonb_build_object('found', false, 'appointments', '[]'::jsonb);
  end if;

  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'at', q.dt,
          'status', q.st::text,
          'service', q.svc,
          'location', q.locname
        )
        order by q.dt desc
      )
      from (
        select a.id, a.date as dt, a.status as st, a.service_name as svc, l.name as locname
        from public.appointments a
        join public.locations l on l.id = a.location_id
        where a.client_id = v_client_id
          and a.company_id = p_company_id
        order by a.date desc
        limit 80
      ) q
    ),
    '[]'::jsonb
  )
  into v_appts;

  return jsonb_build_object(
    'found', true,
    'client_name', (select c2.name from public.clients c2 where c2.id = v_client_id),
    'appointments', v_appts
  );
end;
$func$;

revoke all on function public.rpc_public_client_bookings(uuid, uuid, text, text) from public;
grant execute on function public.rpc_public_client_bookings(uuid, uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.locations enable row level security;

-- companies
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select using (
    public.is_super_admin()
    or id = public.my_company_id()
  );

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert with check (public.is_super_admin());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update using (
    public.is_super_admin()
    or (public.my_role() = 'ADMIN' and id = public.my_company_id())
  );

drop policy if exists companies_delete on public.companies;
create policy companies_delete on public.companies
  for delete using (public.is_super_admin());

-- locations (sedi)
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations
  for select using (
    public.is_super_admin()
    or (
      company_id = public.my_company_id()
      and (
        public.my_role() = 'ADMIN'
        or (
          public.my_role() in ('MANAGER', 'BARBER')
          and public.my_location_id() is not null
          and public.locations.id = public.my_location_id()
        )
      )
    )
  );

drop policy if exists locations_insert on public.locations;
create policy locations_insert on public.locations
  for insert with check (
    public.is_super_admin()
    or (public.my_role() = 'ADMIN' and company_id = public.my_company_id())
  );

drop policy if exists locations_update on public.locations;
create policy locations_update on public.locations
  for update using (
    public.is_super_admin()
    or (public.my_role() = 'ADMIN' and company_id = public.my_company_id())
  );

drop policy if exists locations_delete on public.locations;
create policy locations_delete on public.locations
  for delete using (
    public.is_super_admin()
    or (public.my_role() = 'ADMIN' and company_id = public.my_company_id())
  );

alter table public.location_open_slots enable row level security;

drop policy if exists location_open_slots_select on public.location_open_slots;
create policy location_open_slots_select on public.location_open_slots
  for select using (
    public.is_super_admin()
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'ADMIN'
    )
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'MANAGER'
      and location_id = public.my_location_id()
      and public.my_location_id() is not null
    )
  );

drop policy if exists location_open_slots_insert on public.location_open_slots;
create policy location_open_slots_insert on public.location_open_slots
  for insert with check (
    public.is_super_admin()
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'ADMIN'
    )
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'MANAGER'
      and location_id = public.my_location_id()
      and public.my_location_id() is not null
    )
  );

drop policy if exists location_open_slots_delete on public.location_open_slots;
create policy location_open_slots_delete on public.location_open_slots
  for delete using (
    public.is_super_admin()
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'ADMIN'
    )
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'MANAGER'
      and location_id = public.my_location_id()
      and public.my_location_id() is not null
    )
  );

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    public.is_super_admin()
    or id = auth.uid()
    or (
      public.my_company_id() is not null
      and company_id = public.my_company_id()
      and (
        public.my_role() = 'ADMIN'
        or (
          public.my_role() = 'MANAGER'
          and (
            public.profiles.role = 'ADMIN'
            or public.profiles.id = auth.uid()
            or public.profiles.location_id is not distinct from public.my_location_id()
          )
        )
        or (
          public.my_role() = 'BARBER'
          and (
            public.profiles.id = auth.uid()
            or public.profiles.role = 'ADMIN'
            or (
              public.profiles.role = 'MANAGER'
              and public.profiles.location_id is not distinct from public.my_location_id()
            )
          )
        )
      )
    )
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (
    public.is_super_admin()
    or (
      public.my_role() = 'ADMIN'
      and company_id = public.my_company_id()
      and role in ('MANAGER', 'BARBER')
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (
    public.is_super_admin()
    or id = auth.uid()
    or (
      public.my_role() = 'ADMIN'
      and company_id = public.my_company_id()
      and public.profiles.company_id = public.my_company_id()
      and public.profiles.role in ('MANAGER', 'BARBER', 'ADMIN')
    )
  );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete using (
    public.is_super_admin()
    or (
      public.my_role() = 'ADMIN'
      and company_id = public.my_company_id()
      and public.profiles.company_id = public.my_company_id()
      and public.profiles.role in ('MANAGER', 'BARBER')
    )
  );

-- clients (ADMIN tutta azienda; MANAGER/BARBER solo propria sede)
drop policy if exists clients_all_staff on public.clients;
drop policy if exists clients_company_admin on public.clients;
drop policy if exists clients_location_scope on public.clients;

create policy clients_company_admin on public.clients
  for all using (
    public.is_super_admin()
    or (
      public.my_role() = 'ADMIN'
      and company_id = public.my_company_id()
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.my_role() = 'ADMIN'
      and company_id = public.my_company_id()
    )
  );

create policy clients_location_scope on public.clients
  for all using (
    public.my_role() in ('MANAGER', 'BARBER')
    and company_id = public.my_company_id()
    and location_id = public.my_location_id()
    and public.my_location_id() is not null
  )
  with check (
    public.my_role() in ('MANAGER', 'BARBER')
    and company_id = public.my_company_id()
    and location_id = public.my_location_id()
    and public.my_location_id() is not null
  );

drop policy if exists clients_select_barber on public.clients;
create policy clients_select_barber on public.clients
  for select using (
    public.my_role() = 'BARBER'
    and (
      public.my_location_id() is null
      or clients.location_id = public.my_location_id()
    )
    and exists (
      select 1 from public.appointments a
      where a.client_id = clients.id
        and a.barber_id = auth.uid()
    )
  );

-- appointments
drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select using (
    public.is_super_admin()
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'ADMIN'
    )
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'MANAGER'
      and location_id = public.my_location_id()
      and public.my_location_id() is not null
    )
    or (
      public.my_role() = 'BARBER'
      and barber_id = auth.uid()
    )
  );

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert with check (
    public.is_super_admin()
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'ADMIN'
    )
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'MANAGER'
      and location_id = public.my_location_id()
      and public.my_location_id() is not null
    )
  );

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update using (
    public.is_super_admin()
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'ADMIN'
    )
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'MANAGER'
      and location_id = public.my_location_id()
      and public.my_location_id() is not null
    )
    or (
      public.my_role() = 'BARBER'
      and barber_id = auth.uid()
    )
  );

drop policy if exists appointments_delete on public.appointments;
create policy appointments_delete on public.appointments
  for delete using (
    public.is_super_admin()
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'ADMIN'
    )
    or (
      company_id = public.my_company_id()
      and public.my_role() = 'MANAGER'
      and location_id = public.my_location_id()
      and public.my_location_id() is not null
    )
  );

-- payments
drop policy if exists payments_all on public.payments;
drop policy if exists payments_company_admin on public.payments;
drop policy if exists payments_location_scope on public.payments;

create policy payments_company_admin on public.payments
  for all using (
    public.is_super_admin()
    or (
      public.my_role() = 'ADMIN'
      and company_id = public.my_company_id()
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.my_role() = 'ADMIN'
      and company_id = public.my_company_id()
    )
  );

create policy payments_location_scope on public.payments
  for all using (
    public.my_role() = 'MANAGER'
    and company_id = public.my_company_id()
    and location_id = public.my_location_id()
    and public.my_location_id() is not null
  )
  with check (
    public.my_role() = 'MANAGER'
    and company_id = public.my_company_id()
    and location_id = public.my_location_id()
    and public.my_location_id() is not null
  );

-- ---------------------------------------------------------------------------
-- Profilo automatico: ogni nuovo utente Auth → riga in public.profiles
-- (evita /no-profile dopo signup). SECURITY DEFINER, bypass RLS.
--
-- Regole:
-- - Se raw_user_meta_data ha role ADMIN|MANAGER|BARBER + company_id valido → quel profilo (inviti).
-- - SUPER_ADMIN da metadata solo se non esiste ancora alcun SUPER_ADMIN (bootstrap piattaforma).
-- - Altrimenti: primo utente assoluto → SUPER_ADMIN; utenti successivi → nuova azienda + ADMIN.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $trg$
declare
  v_name text;
  meta_role text;
  meta_company text;
  meta_location text;
  r public.user_role;
  new_cid uuid;
  v_loc uuid;
begin
  if exists (select 1 from public.profiles p where p.id = new.id) then
    return new;
  end if;

  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Utente'
  );

  meta_role := nullif(trim(upper(new.raw_user_meta_data->>'role')), '');
  meta_company := nullif(trim(new.raw_user_meta_data->>'company_id'), '');
  meta_location := nullif(trim(new.raw_user_meta_data->>'location_id'), '');

  if meta_role in ('ADMIN', 'MANAGER', 'BARBER') and meta_company is not null then
    begin
      if exists (select 1 from public.companies c where c.id = meta_company::uuid) then
        r := meta_role::public.user_role;
        v_loc := null;
        if r in ('MANAGER', 'BARBER') then
          if meta_location is not null then
            begin
              select l.id into v_loc
              from public.locations l
              where l.id = meta_location::uuid
                and l.company_id = meta_company::uuid;
            exception
              when invalid_text_representation then
                v_loc := null;
            end;
          end if;
          if v_loc is null then
            select l.id into v_loc
            from public.locations l
            where l.company_id = meta_company::uuid
            order by l.created_at asc
            limit 1;
          end if;
        end if;
        insert into public.profiles (id, name, role, company_id, location_id)
        values (new.id, v_name, r, meta_company::uuid, v_loc)
        on conflict (id) do nothing;
      end if;
    exception
      when invalid_text_representation then
        null;
    end;
  elsif meta_role = 'SUPER_ADMIN' then
    if not exists (select 1 from public.profiles p where p.role = 'SUPER_ADMIN') then
      insert into public.profiles (id, name, role, company_id)
      values (new.id, v_name, 'SUPER_ADMIN', null)
      on conflict (id) do nothing;
    end if;
  end if;

  if not exists (select 1 from public.profiles p where p.id = new.id) then
    if not exists (select 1 from public.profiles) then
      insert into public.profiles (id, name, role, company_id)
      values (new.id, v_name, 'SUPER_ADMIN', null)
      on conflict (id) do nothing;
    else
      insert into public.companies (name)
      values (v_name || ' — BarberHub')
      returning id into new_cid;
      insert into public.locations (company_id, name)
      values (new_cid, 'Sede principale');
      insert into public.profiles (id, name, role, company_id, location_id)
      values (new.id, v_name, 'ADMIN', new_cid, null)
      on conflict (id) do nothing;
    end if;
  end if;

  return new;
end;
$trg$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

commit;
