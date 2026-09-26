-- Question packs (lotes). Run manually in the Supabase SQL Editor, after
-- juegos.sql and BEFORE salas.sql. Safe to run more than once; it never
-- deletes questions.
--
-- Every question now belongs to a pack, and every pack to a game and a
-- category (nivel). Existing questions are moved to a "Básico" pack of their
-- game and category.
--
-- Importing a CSV from the Table Editor: only `texto`, `lote_id` and `tipo` are
-- needed; `juego_id` and `nivel_id` are filled in from the pack automatically.

begin;

-- Packs -----------------------------------------------------------------------------

create table if not exists public.lotes (
  id         int generated always as identity primary key,
  juego_id   int  not null references public.juegos (id) on delete cascade,
  nivel_id   int  not null references public.niveles (id),
  nombre     text not null check (char_length(nombre) between 2 and 40),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (juego_id, nivel_id, nombre)
);

create index if not exists lotes_nivel_id_idx   on public.lotes (nivel_id);
create index if not exists lotes_created_by_idx on public.lotes (created_by);

alter table public.lotes enable row level security;

drop policy if exists "lotes_select_public" on public.lotes;
create policy "lotes_select_public" on public.lotes for select to anon, authenticated using (true);

-- Writes only through the room functions (salas.sql).
revoke all on public.lotes from anon, authenticated;
grant select on public.lotes to anon, authenticated;

-- Questions → packs ------------------------------------------------------------------

alter table public.preguntas
  add column if not exists lote_id int references public.lotes (id) on delete cascade;

create index if not exists preguntas_lote_id_idx on public.preguntas (lote_id);

-- Questions without a category go to "suave".
update public.preguntas
set nivel_id = (select id from public.niveles where nombre = 'suave')
where nivel_id is null;

insert into public.lotes (juego_id, nivel_id, nombre)
select distinct juego_id, nivel_id, 'Básico'
from public.preguntas
where lote_id is null
on conflict (juego_id, nivel_id, nombre) do nothing;

update public.preguntas p
set lote_id = l.id
from public.lotes l
where p.lote_id is null
  and l.juego_id = p.juego_id
  and l.nivel_id = p.nivel_id
  and l.nombre = 'Básico';

alter table public.preguntas alter column lote_id set not null;

-- The same text can now exist in different packs, but not twice in one.
alter table public.preguntas drop constraint if exists preguntas_texto_key;
alter table public.preguntas drop constraint if exists preguntas_lote_texto_key;
alter table public.preguntas add constraint preguntas_lote_texto_key unique (lote_id, texto);

-- Keep juego_id / nivel_id in sync with the pack.
create or replace function public.preguntas_sync_lote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select l.juego_id, l.nivel_id into new.juego_id, new.nivel_id
  from public.lotes l
  where l.id = new.lote_id;
  return new;
end;
$$;

drop trigger if exists preguntas_sync_lote on public.preguntas;
create trigger preguntas_sync_lote
  before insert or update of lote_id on public.preguntas
  for each row execute function public.preguntas_sync_lote();

commit;
