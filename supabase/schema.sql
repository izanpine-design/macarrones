-- Run manually in the Supabase SQL Editor.

create table if not exists public.preguntas (
  id    bigint generated always as identity primary key,
  texto text not null unique,
  juego text not null check (juego in ('yo_nunca', 'verdad', 'reto')),
  nivel text
);

alter table public.preguntas enable row level security;

-- Read-only access for the frontend (anonymous and signed-in users).
-- No insert/update/delete policies: with RLS on, those are denied by default.
drop policy if exists "preguntas_select_public" on public.preguntas;
create policy "preguntas_select_public"
  on public.preguntas
  for select
  to anon, authenticated
  using (true);

grant select on public.preguntas to anon, authenticated;

-- Sample rows (ignored if they already exist, thanks to the unique `texto`).
insert into public.preguntas (texto, juego, nivel) values
  ('Yo nunca nunca he cantado en un karaoke.', 'yo_nunca', 'suave'),
  ('¿Cuál es la mentira más gorda que has contado?', 'verdad', 'suave'),
  ('Imita a otro jugador hasta que adivinen quién es.', 'reto', 'suave')
on conflict (texto) do nothing;
