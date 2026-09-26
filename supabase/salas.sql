-- Rooms (salas) and games (turnos). Run manually in the Supabase SQL Editor,
-- AFTER schema.sql.
--
-- It only drops and recreates the room/game objects: juegos, niveles and
-- preguntas are not touched, so imported questions are kept. Existing rooms
-- and games are deleted.
--
-- Requires "Allow anonymous sign-ins" (Authentication → Sign In / Providers):
-- every device signs in anonymously and auth.uid() identifies the player.
--
-- Security model:
--   * Clients can only SELECT rooms, players and turns of rooms they belong to (RLS).
--   * Every write goes through the security definer functions below, which
--     validate the input, the caller's role and the game phase.
--   * Password hashes live in salas_privado, which no client can read.
--   * Random results (roulettes, random questions) are decided here, so every
--     player sees the same outcome.

begin;

create extension if not exists pgcrypto with schema extensions;

-- juegos.clave: stable identifier for the game logic (added by schema.sql on new
-- databases; this fills it in on databases created before it existed).
alter table public.juegos add column if not exists clave text unique;
update public.juegos set clave = 'yo_nunca'      where clave is null and nombre = 'Yo nunca nunca';
update public.juegos set clave = 'verdad_o_reto' where clave is null and nombre = 'Verdad o reto';

-- Reset ---------------------------------------------------------------------------

drop function if exists public.crear_sala(int, text, text);
drop function if exists public.unirse_sala(text, text, text);
drop function if exists public.salir_sala(uuid);
drop function if exists public.salas_abiertas(int);
drop function if exists public.info_sala(text);
drop function if exists public.generar_codigo_sala();
drop function if exists public.empezar_partida(uuid);
drop function if exists public.terminar_partida(uuid);
drop function if exists public.elegir_tipo(uuid, public.tipo_pregunta);
drop function if exists public.elegir_pregunta_aleatoria(uuid);
drop function if exists public.escribir_pregunta(uuid, text);
drop function if exists public.siguiente_turno(uuid);
drop function if exists public.crear_turno(uuid, uuid);
drop table if exists public.turnos cascade;
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

-- One row per turn of "Verdad o reto". The current turn is the highest `numero`.
--   eligiendo_tipo     → objetivo chooses verdad / reto
--   eligiendo_pregunta → preguntador picks a random question or writes one
--   respondiendo       → question shown; preguntador moves to the next turn
create table public.turnos (
  id             bigint generated always as identity primary key,
  sala_id        uuid not null references public.salas (id) on delete cascade,
  numero         int  not null,
  preguntador_id uuid not null,
  objetivo_id    uuid not null,
  -- Snapshot of the players ({user_id, apodo}) when the turn started: the
  -- roulettes of every device spin over the same names.
  jugadores      jsonb not null,
  tipo           public.tipo_pregunta,
  pregunta_id    bigint references public.preguntas (id) on delete set null,
  pregunta_texto text,
  personalizada  boolean not null default false,
  fase           text not null default 'eligiendo_tipo'
                 check (fase in ('eligiendo_tipo', 'eligiendo_pregunta', 'respondiendo')),
  created_at     timestamptz not null default now(),
  unique (sala_id, numero)
);

create index turnos_pregunta_id_idx on public.turnos (pregunta_id);

-- Row Level Security ----------------------------------------------------------------

alter table public.salas          enable row level security;
alter table public.salas_privado  enable row level security;
alter table public.jugadores_sala enable row level security;
alter table public.turnos         enable row level security;

-- Security definer so the policies can use it without recursion.
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

create policy "turnos_select_miembros"
  on public.turnos for select to authenticated
  using (public.es_miembro_sala(sala_id));

-- Supabase grants everything on new tables by default: keep only SELECT.
revoke all on public.salas, public.salas_privado, public.jugadores_sala, public.turnos
  from anon, authenticated;
grant select on public.salas, public.jugadores_sala, public.turnos to authenticated;

-- Room functions ------------------------------------------------------------------

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
-- are already inside just get their nickname updated. Players can also join a
-- game in progress: they enter the roulettes from the next turn on.
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
  juego_clave    text,
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
    g.clave,
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

-- Game functions ("Verdad o reto") ------------------------------------------------

-- Internal: starts a new turn. `p_preguntador` asks if still in the room
-- (otherwise a random player does); the target is a random player other than them.
create function public.crear_turno(p_sala_id uuid, p_preguntador uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jugadores   jsonb;
  v_preguntador uuid := p_preguntador;
  v_objetivo    uuid;
  v_numero      int;
begin
  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'apodo', apodo) order by joined_at), '[]'::jsonb)
  into v_jugadores
  from public.jugadores_sala
  where sala_id = p_sala_id;

  if jsonb_array_length(v_jugadores) < 2 then
    raise exception 'NOT_ENOUGH_PLAYERS';
  end if;

  if v_preguntador is null
     or not exists (select 1 from public.jugadores_sala where sala_id = p_sala_id and user_id = v_preguntador) then
    select user_id into v_preguntador
    from public.jugadores_sala where sala_id = p_sala_id
    order by random() limit 1;
  end if;

  select user_id into v_objetivo
  from public.jugadores_sala where sala_id = p_sala_id and user_id <> v_preguntador
  order by random() limit 1;

  select coalesce(max(numero), 0) + 1 into v_numero from public.turnos where sala_id = p_sala_id;

  insert into public.turnos (sala_id, numero, preguntador_id, objetivo_id, jugadores)
  values (p_sala_id, v_numero, v_preguntador, v_objetivo, v_jugadores);
end;
$$;

-- Host starts the game (2+ players). The first turn picks who starts at random.
create function public.empezar_partida(p_sala_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sala public.salas%rowtype;
begin
  select * into v_sala from public.salas where id = p_sala_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_sala.anfitrion_id is distinct from auth.uid() then
    raise exception 'NOT_HOST';
  end if;
  if v_sala.estado <> 'esperando' then
    raise exception 'WRONG_PHASE';
  end if;
  if (select clave from public.juegos where id = v_sala.juego_id) is distinct from 'verdad_o_reto' then
    raise exception 'GAME_NOT_SUPPORTED';
  end if;

  delete from public.turnos where sala_id = p_sala_id;
  perform public.crear_turno(p_sala_id, null);
  update public.salas set estado = 'jugando' where id = p_sala_id;
end;
$$;

-- Host ends the game and the room goes back to the waiting lobby.
create function public.terminar_partida(p_sala_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.salas where id = p_sala_id and anfitrion_id = auth.uid()) then
    raise exception 'NOT_HOST';
  end if;
  update public.salas set estado = 'esperando' where id = p_sala_id;
  delete from public.turnos where sala_id = p_sala_id;
end;
$$;

-- The target of the current turn chooses verdad or reto.
create function public.elegir_tipo(p_sala_id uuid, p_tipo public.tipo_pregunta)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turno public.turnos%rowtype;
begin
  select * into v_turno from public.turnos
  where sala_id = p_sala_id order by numero desc limit 1 for update;
  if not found then
    raise exception 'GAME_NOT_STARTED';
  end if;
  if v_turno.objetivo_id is distinct from auth.uid() then
    raise exception 'NOT_YOUR_TURN';
  end if;
  if v_turno.fase <> 'eligiendo_tipo' or p_tipo is null then
    raise exception 'WRONG_PHASE';
  end if;

  update public.turnos set tipo = p_tipo, fase = 'eligiendo_pregunta' where id = v_turno.id;
end;
$$;

-- The asker takes a random question of the chosen type. Questions used fewer
-- times in this room go first, so nothing repeats until all have been used.
create function public.elegir_pregunta_aleatoria(p_sala_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turno    public.turnos%rowtype;
  v_juego_id int;
  v_id       bigint;
  v_texto    text;
begin
  select * into v_turno from public.turnos
  where sala_id = p_sala_id order by numero desc limit 1 for update;
  if not found then
    raise exception 'GAME_NOT_STARTED';
  end if;
  if v_turno.preguntador_id is distinct from auth.uid() then
    raise exception 'NOT_YOUR_TURN';
  end if;
  if v_turno.fase <> 'eligiendo_pregunta' then
    raise exception 'WRONG_PHASE';
  end if;

  select juego_id into v_juego_id from public.salas where id = p_sala_id;

  select q.id, q.texto into v_id, v_texto
  from public.preguntas q
  where q.juego_id = v_juego_id and q.tipo = v_turno.tipo
  order by
    (select count(*) from public.turnos t where t.sala_id = p_sala_id and t.pregunta_id = q.id),
    random()
  limit 1;

  if v_id is null then
    raise exception 'NO_QUESTIONS';
  end if;

  update public.turnos
  set pregunta_id = v_id, pregunta_texto = v_texto, personalizada = false, fase = 'respondiendo'
  where id = v_turno.id;
end;
$$;

-- The asker writes their own question / dare.
create function public.escribir_pregunta(p_sala_id uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turno public.turnos%rowtype;
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  if char_length(v_texto) not between 3 and 300 then
    raise exception 'INVALID_QUESTION';
  end if;

  select * into v_turno from public.turnos
  where sala_id = p_sala_id order by numero desc limit 1 for update;
  if not found then
    raise exception 'GAME_NOT_STARTED';
  end if;
  if v_turno.preguntador_id is distinct from auth.uid() then
    raise exception 'NOT_YOUR_TURN';
  end if;
  if v_turno.fase <> 'eligiendo_pregunta' then
    raise exception 'WRONG_PHASE';
  end if;

  update public.turnos
  set pregunta_id = null, pregunta_texto = v_texto, personalizada = true, fase = 'respondiendo'
  where id = v_turno.id;
end;
$$;

-- Next turn: whoever answered now asks. The asker can do it once the question
-- is shown; the host can do it at any moment (to skip a stuck turn).
create function public.siguiente_turno(p_sala_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_sala  public.salas%rowtype;
  v_turno public.turnos%rowtype;
begin
  select * into v_sala from public.salas where id = p_sala_id for update;
  if not found or v_sala.estado <> 'jugando' then
    raise exception 'GAME_NOT_STARTED';
  end if;

  select * into v_turno from public.turnos
  where sala_id = p_sala_id order by numero desc limit 1;
  if not found then
    raise exception 'GAME_NOT_STARTED';
  end if;

  if not (
    v_user = v_sala.anfitrion_id
    or (v_user = v_turno.preguntador_id and v_turno.fase = 'respondiendo')
  ) then
    raise exception 'NOT_YOUR_TURN';
  end if;

  perform public.crear_turno(p_sala_id, v_turno.objetivo_id);
end;
$$;

-- Removes the caller from a room:
--   * nobody left            → the room is deleted
--   * the host left          → the oldest remaining player becomes host
--   * fewer than 2 in a game → back to the waiting lobby
--   * they were in the turn  → a new turn starts so the game does not get stuck
create function public.salir_sala(p_sala_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_sala      public.salas%rowtype;
  v_turno     public.turnos%rowtype;
  v_restantes int;
begin
  select * into v_sala from public.salas where id = p_sala_id for update;
  if not found then
    return;
  end if;

  delete from public.jugadores_sala where sala_id = p_sala_id and user_id = v_user;
  select count(*) into v_restantes from public.jugadores_sala where sala_id = p_sala_id;

  if v_restantes = 0 then
    delete from public.salas where id = p_sala_id;
    return;
  end if;

  if v_sala.anfitrion_id = v_user then
    update public.salas
    set anfitrion_id = (
      select user_id from public.jugadores_sala
      where sala_id = p_sala_id
      order by joined_at
      limit 1
    )
    where id = p_sala_id;
  end if;

  if v_sala.estado = 'jugando' then
    if v_restantes < 2 then
      update public.salas set estado = 'esperando' where id = p_sala_id;
      delete from public.turnos where sala_id = p_sala_id;
    else
      select * into v_turno from public.turnos
      where sala_id = p_sala_id order by numero desc limit 1;
      if found and v_user in (v_turno.preguntador_id, v_turno.objetivo_id) then
        -- Keep the asker if it was the target who left.
        perform public.crear_turno(
          p_sala_id,
          case when v_user = v_turno.objetivo_id then v_turno.preguntador_id end
        );
      end if;
    end if;
  end if;
end;
$$;

-- Permissions -----------------------------------------------------------------------

-- Only signed-in (anonymous included) users can call the functions; the
-- internal helpers cannot be called directly.
revoke execute on function
  public.es_miembro_sala(uuid),
  public.generar_codigo_sala(),
  public.crear_turno(uuid, uuid),
  public.crear_sala(int, text, text),
  public.unirse_sala(text, text, text),
  public.salir_sala(uuid),
  public.salas_abiertas(int),
  public.info_sala(text),
  public.empezar_partida(uuid),
  public.terminar_partida(uuid),
  public.elegir_tipo(uuid, public.tipo_pregunta),
  public.elegir_pregunta_aleatoria(uuid),
  public.escribir_pregunta(uuid, text),
  public.siguiente_turno(uuid)
from public, anon;

grant execute on function
  public.es_miembro_sala(uuid),
  public.crear_sala(int, text, text),
  public.unirse_sala(text, text, text),
  public.salir_sala(uuid),
  public.salas_abiertas(int),
  public.info_sala(text),
  public.empezar_partida(uuid),
  public.terminar_partida(uuid),
  public.elegir_tipo(uuid, public.tipo_pregunta),
  public.elegir_pregunta_aleatoria(uuid),
  public.escribir_pregunta(uuid, text),
  public.siguiente_turno(uuid)
to authenticated;

-- Realtime: members get live changes of their room, its players and turns.
alter publication supabase_realtime add table public.salas, public.jugadores_sala, public.turnos;

commit;
