-- Full schema. Run manually in the Supabase SQL Editor.
-- WARNING: it drops and recreates every table, so ALL existing data
-- (including imported questions) is deleted and replaced by the seed rows.
-- Afterwards run, in this order: juegos.sql, lotes.sql, salas.sql and perfiles.sql.

begin;

-- Reset -------------------------------------------------------------------------

-- Rooms depend on juegos: they are dropped too, run salas.sql again afterwards.
drop table if exists public.turnos, public.jugadores_sala, public.salas_privado, public.salas cascade;
drop table if exists public.preguntas cascade;
drop table if exists public.lotes     cascade;
drop table if exists public.juegos    cascade;
drop table if exists public.niveles   cascade;
drop type  if exists public.tipo_pregunta cascade;

-- Lookup tables -----------------------------------------------------------------

-- The full catalog (descriptions, order, the rest of games) is in juegos.sql.
create table public.juegos (
  id          int generated always as identity primary key,
  clave       text not null unique,  -- stable identifier used by the game logic
  nombre      text not null unique,
  descripcion text,
  con_alcohol boolean not null default false,
  orden       int     not null default 0
);

create table public.niveles (
  id     int generated always as identity primary key,
  nombre text not null unique,
  orden  int  not null default 0
);

-- Kind of question inside "Verdad o reto" (null for other games).
create type public.tipo_pregunta as enum ('verdad', 'reto');

-- Questions ---------------------------------------------------------------------

create table public.preguntas (
  id       bigint generated always as identity primary key,
  texto    text not null unique,
  juego_id int  not null references public.juegos (id),
  nivel_id int  references public.niveles (id),
  tipo     public.tipo_pregunta
);

create index preguntas_juego_id_idx on public.preguntas (juego_id);
create index preguntas_nivel_id_idx on public.preguntas (nivel_id);

-- Row Level Security: read-only access for the frontend -------------------------
-- No insert/update/delete policies: with RLS on, those are denied by default.

alter table public.juegos    enable row level security;
alter table public.niveles   enable row level security;
alter table public.preguntas enable row level security;

create policy "juegos_select_public"    on public.juegos    for select to anon, authenticated using (true);
create policy "niveles_select_public"   on public.niveles   for select to anon, authenticated using (true);
create policy "preguntas_select_public" on public.preguntas for select to anon, authenticated using (true);

grant select on public.juegos, public.niveles, public.preguntas to anon, authenticated;

-- Seed data ---------------------------------------------------------------------

insert into public.juegos (clave, nombre) values ('yo_nunca', 'Yo nunca nunca');      -- id 1
insert into public.juegos (clave, nombre) values ('verdad_o_reto', 'Verdad o reto'); -- id 2

insert into public.niveles (nombre, orden) values ('suave', 1);   -- id 1
insert into public.niveles (nombre, orden) values ('picante', 2); -- id 2

insert into public.preguntas (texto, juego_id, nivel_id, tipo) values
  ('Yo nunca nunca he cantado en un karaoke.',          1, 1, null),
  ('¿Cuál es la mentira más gorda que has contado?',   2, 1, 'verdad'),
  ('Imita a otro jugador hasta que adivinen quién es.', 2, 1, 'reto');

commit;
