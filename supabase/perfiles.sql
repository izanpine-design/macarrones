-- Player profiles and their rockets. Run manually in the Supabase SQL Editor,
-- AFTER salas.sql. Safe to run again: it never deletes profiles nor pictures.
--
-- How identity works:
--   * Registered players sign in with Supabase Auth (email + password). The
--     email is an internal one (<something>@macarrones.netlify.app, our own
--     domain: Supabase rejects reserved ones like .example) that players
--     never see: they pick their profile and type their password.
--   * Guests use an anonymous session: they can play but have no profile, so no
--     rocket of their own.
--   * Only the owner (auth.uid()) can change their profile; everybody can see
--     every profile (welcome page, presentation, rooms, "¡A beber!").
--
-- BEFORE running it:
--   1. Authentication → Sign In / Providers → Email: turn OFF "Confirm email"
--      (the internal emails cannot receive anything).
--   2. Authentication → Users → Add user → Create new user, once per friend,
--      with "Auto Confirm User" ticked:
--         noe@macarrones.netlify.app · raul@macarrones.netlify.app
--         izan@macarrones.netlify.app · miguel@macarrones.netlify.app
--      and the password each one will use (they can change it later in the app).
--   The seed at the end then gives each of them their current rocket.

begin;

-- Profiles --------------------------------------------------------------------------

create table if not exists public.perfiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  apodo      text not null check (char_length(btrim(apodo)) between 2 and 20),
  -- Internal login email, needed to sign in by picking the profile.
  login      text not null unique,
  -- Rocket: colours, objects, pet and paths of the pictures in the "naves"
  -- bucket (or app assets such as 'crew/miguel.webp'). Never image data.
  nave       jsonb not null default '{}'::jsonb
             check (jsonb_typeof(nave) = 'object' and pg_column_size(nave) < 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists perfiles_apodo_key on public.perfiles (lower(btrim(apodo)));

alter table public.perfiles enable row level security;

drop policy if exists "perfiles_select" on public.perfiles;
drop policy if exists "perfiles_insert" on public.perfiles;
drop policy if exists "perfiles_update" on public.perfiles;
drop policy if exists "perfiles_delete" on public.perfiles;

create policy "perfiles_select" on public.perfiles for select to anon, authenticated using (true);
-- Only registered (non anonymous) users create their own profile.
create policy "perfiles_insert" on public.perfiles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );
create policy "perfiles_update" on public.perfiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "perfiles_delete" on public.perfiles for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.perfiles from anon, authenticated;
grant select on public.perfiles to anon, authenticated;
grant insert, delete on public.perfiles to authenticated;
-- Only the nickname and the rocket can be changed (not the login email).
grant update (apodo, nave) on public.perfiles to authenticated;

create or replace function public.perfiles_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists perfiles_touch on public.perfiles;
create trigger perfiles_touch
  before update on public.perfiles
  for each row execute function public.perfiles_touch();

-- Storage: public bucket for rocket pictures ------------------------------------------
-- Paths: <user id>/<kind>-<random>.<ext>. The app converts every picture to WebP
-- (JPEG / PNG where the browser cannot) and shrinks it first: 1 MB is plenty.
-- Public: anyone who opens the web sees the rockets, pictures included.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('naves', 'naves', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "naves_insert" on storage.objects;
drop policy if exists "naves_update" on storage.objects;
drop policy if exists "naves_delete" on storage.objects;

-- Public bucket: reading needs no policy. Only registered owners write, and only
-- in their own folder.
create policy "naves_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'naves'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );
create policy "naves_update" on storage.objects for update to authenticated
  using (bucket_id = 'naves' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "naves_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'naves' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Seed: the crew's current rockets ----------------------------------------------------
-- Only for the users created in step 2 that still have no profile; later
-- changes made in the app are never overwritten.

insert into public.perfiles (user_id, apodo, login, nave)
select u.id, v.apodo, u.email, v.nave
from (values
  ('noe', 'Noe',
   '{"color":"#e8589a","colorOscuro":"#9c2c63","pelo":"#3b2418","delante":"vaper","detras":null,"mascota":"pichu"}'::jsonb),
  ('raul', 'Raúl',
   '{"color":"#3f82ea","colorOscuro":"#20478f","pelo":"#241a14","delante":"micro","detras":"bolos","mascota":"nael"}'::jsonb),
  ('izan', 'Izan',
   '{"color":"#2eab6e","colorOscuro":"#17663f","pelo":"#5a3a22","delante":"pepe","detras":null,"mascota":"simba"}'::jsonb),
  ('miguel', 'Miguel',
   '{"color":"#f08a24","colorOscuro":"#a1520c","pelo":"#2e2019","delante":"mando","detras":null,"mascota":"enana","cabeza":"crew/miguel.webp"}'::jsonb)
) as v (usuario, apodo, nave)
-- Also accepts users created with the old @macarrones.example emails.
join auth.users u on u.email in (v.usuario || '@macarrones.netlify.app', v.usuario || '@macarrones.example')
on conflict do nothing;

commit;
