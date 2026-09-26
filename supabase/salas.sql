-- Rooms (salas). Run manually in the Supabase SQL Editor, AFTER schema.sql.
--
-- It only drops and recreates the room objects: juegos, niveles and preguntas
-- are not touched, so imported questions are kept. Existing rooms are deleted.
--
-- Requires "Allow anonymous sign-ins" (Authentication → Sign In / Providers):
-- every device signs in anonymously and auth.uid() identifies the player.
--
-- Security model:
--   * Clients can only SELECT rooms and players of rooms they belong to (RLS).
--   * Every write goes through the security definer functions below, which
--     validate the input and check the password.
--   * Password hashes live in salas_privado, which no client can read.

begin;

create extension if not exists pgcrypto with schema extensions;

-- Reset ---------------------------------------------------------------------------

drop function if exists public.crear_sala(int, text, text);
drop function if exists public.unirse_sala(text, text, text);
drop function if exists public.salir_sala(uuid);
drop function if exists public.salas_abiertas(int);
drop function if exists public.info_sala(text);
drop function if exists public.generar_codigo_sala();
drop table if exists public.jugadores_sala cascade;
drop table if exists public.salas_privado cascade;
drop table if exists public.salas cascade;
drop function if exists public.es_miembro_sala(uuid);

-- Tables --------------------------------------------------------------------------

create table public.salas (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique,
  juego_id       int  not null references public.juegos (id),
  anfitrion_id   uuid not null references auth.users (id) on delete cascade,
  tiene_password boolean not null default false,
  estado         text not null default 'esperando'
                 check (estado in ('esperando', 'jugando', 'terminada')),
  created_at     timestamptz not null default now()
);

create index salas_juego_id_idx     on public.salas (juego_id);
create index salas_anfitrion_id_idx on public.salas (anfitrion_id);

-- Password hash of protected rooms. No policies: unreadable from the frontend.
create table public.salas_privado (
  sala_id       uuid primary key references public.salas (id) on delete cascade,
  password_hash text not null
);

create table public.jugadores_sala (
  sala_id   uuid not null references public.salas (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  apodo     text not null check (char_length(apodo) between 2 and 20),
  joined_at timestamptz not null default now(),
  primary key (sala_id, user_id)
);

create index jugadores_sala_user_id_idx on public.jugadores_sala (user_id);

-- Row Level Security ----------------------------------------------------------------

alter table public.salas          enable row level security;
alter table public.salas_privado  enable row level security;
alter table public.jugadores_sala enable row level security;

-- Security definer so the jugadores_sala policy can use it without recursion.
create function public.es_miembro_sala(p_sala_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jugadores_sala
    where sala_id = p_sala_id and user_id = (select auth.uid())
  );
$$;

create policy "salas_select_miembros"
  on public.salas for select to authenticated
  using (public.es_miembro_sala(id));

create policy "jugadores_sala_select_miembros"
  on public.jugadores_sala for select to authenticated
  using (public.es_miembro_sala(sala_id));

-- Supabase grants everything on new tables by default: keep only SELECT.
revoke all on public.salas, public.salas_privado, public.jugadores_sala from anon, authenticated;
grant select on public.salas, public.jugadores_sala to authenticated;

-- Functions -------------------------------------------------------------------------

-- 6-character code without easily confused characters (0/O, 1/I/L).
create function public.generar_codigo_sala()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

-- Creates a room, makes the caller its host and first player. Returns the code.
create function public.crear_sala(p_juego_id int, p_apodo text, p_password text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_apodo    text := btrim(coalesce(p_apodo, ''));
  v_password text := nullif(p_password, '');
  v_codigo   text;
  v_sala_id  uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if char_length(v_apodo) not between 2 and 20 then
    raise exception 'INVALID_NICKNAME';
  end if;
  if v_password is not null and char_length(v_password) not between 4 and 50 then
    raise exception 'INVALID_PASSWORD';
  end if;
  if not exists (select 1 from public.juegos where id = p_juego_id) then
    raise exception 'GAME_NOT_FOUND';
  end if;

  loop
    v_codigo := public.generar_codigo_sala();
    exit when not exists (select 1 from public.salas where codigo = v_codigo);
  end loop;

  insert into public.salas (codigo, juego_id, anfitrion_id, tiene_password)
  values (v_codigo, p_juego_id, v_user, v_password is not null)
  returning id into v_sala_id;

  if v_password is not null then
    insert into public.salas_privado (sala_id, password_hash)
    values (v_sala_id, extensions.crypt(v_password, extensions.gen_salt('bf')));
  end if;

  insert into public.jugadores_sala (sala_id, user_id, apodo)
  values (v_sala_id, v_user, v_apodo);

  return v_codigo;
end;
$$;

-- Adds the caller to a room, checking the password if it has one. Players who
-- are already inside just get their nickname updated.
create function public.unirse_sala(p_codigo text, p_apodo text, p_password text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_apodo text := btrim(coalesce(p_apodo, ''));
  v_sala  public.salas%rowtype;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if char_length(v_apodo) not between 2 and 20 then
    raise exception 'INVALID_NICKNAME';
  end if;

  select * into v_sala from public.salas where codigo = upper(btrim(p_codigo));
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if exists (select 1 from public.jugadores_sala where sala_id = v_sala.id and user_id = v_user) then
    update public.jugadores_sala set apodo = v_apodo
    where sala_id = v_sala.id and user_id = v_user;
    return;
  end if;

  if v_sala.estado = 'terminada' then
    raise exception 'ROOM_CLOSED';
  end if;

  if v_sala.tiene_password then
    if nullif(p_password, '') is null then
      raise exception 'PASSWORD_REQUIRED';
    end if;
    if not exists (
      select 1 from public.salas_privado
      where sala_id = v_sala.id
        and password_hash = extensions.crypt(p_password, password_hash)
    ) then
      raise exception 'WRONG_PASSWORD';
    end if;
  end if;

  insert into public.jugadores_sala (sala_id, user_id, apodo)
  values (v_sala.id, v_user, v_apodo);
end;
$$;

-- Removes the caller from a room. If the host leaves, the oldest remaining
-- player becomes host; if nobody is left, the room is deleted.
create function public.salir_sala(p_sala_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  delete from public.jugadores_sala where sala_id = p_sala_id and user_id = v_user;

  if not exists (select 1 from public.jugadores_sala where sala_id = p_sala_id) then
    delete from public.salas where id = p_sala_id;
  else
    update public.salas
    set anfitrion_id = (
      select user_id from public.jugadores_sala
      where sala_id = p_sala_id
      order by joined_at
      limit 1
    )
    where id = p_sala_id and anfitrion_id = v_user;
  end if;
end;
$$;

-- Public list of waiting rooms of a game (last 12 hours, to hide abandoned ones).
create function public.salas_abiertas(p_juego_id int)
returns table (
  codigo         text,
  anfitrion      text,
  jugadores      int,
  tiene_password boolean,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.codigo,
    h.apodo,
    (select count(*)::int from public.jugadores_sala j where j.sala_id = s.id),
    s.tiene_password,
    s.created_at
  from public.salas s
  left join public.jugadores_sala h on h.sala_id = s.id and h.user_id = s.anfitrion_id
  where s.juego_id = p_juego_id
    and s.estado = 'esperando'
    and s.created_at > now() - interval '12 hours'
  order by s.created_at desc
  limit 50;
$$;

-- Public summary of a room by code, shown before joining it.
create function public.info_sala(p_codigo text)
returns table (
  id             uuid,
  codigo         text,
  juego_id       int,
  juego          text,
  anfitrion      text,
  jugadores      int,
  tiene_password boolean,
  estado         text,
  soy_miembro    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.codigo,
    s.juego_id,
    g.nombre,
    h.apodo,
    (select count(*)::int from public.jugadores_sala j where j.sala_id = s.id),
    s.tiene_password,
    s.estado,
    exists (
      select 1 from public.jugadores_sala m
      where m.sala_id = s.id and m.user_id = (select auth.uid())
    )
  from public.salas s
  join public.juegos g on g.id = s.juego_id
  left join public.jugadores_sala h on h.sala_id = s.id and h.user_id = s.anfitrion_id
  where s.codigo = upper(btrim(p_codigo));
$$;

-- Only signed-in (anonymous included) users can call the functions.
revoke execute on function
  public.es_miembro_sala(uuid),
  public.generar_codigo_sala(),
  public.crear_sala(int, text, text),
  public.unirse_sala(text, text, text),
  public.salir_sala(uuid),
  public.salas_abiertas(int),
  public.info_sala(text)
from public, anon;

grant execute on function
  public.es_miembro_sala(uuid),
  public.crear_sala(int, text, text),
  public.unirse_sala(text, text, text),
  public.salir_sala(uuid),
  public.salas_abiertas(int),
  public.info_sala(text)
to authenticated;

-- Realtime: members get live changes of their room and its players.
alter publication supabase_realtime add table public.salas, public.jugadores_sala;

commit;
