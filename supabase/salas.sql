-- Rooms (salas) and games: "Verdad o reto" (turnos) and every other game
-- (partidas, aportes, secretos_jugador). Run manually in the Supabase SQL
-- Editor, after schema.sql, juegos.sql and lotes.sql.
--
-- It only drops and recreates the room/game objects: juegos, niveles, lotes and
-- preguntas are not touched, so questions and packs are kept. Existing rooms
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
drop function if exists public.crear_sala(int, int, text, text);
drop function if exists public.elegir_lote(uuid, int);
drop function if exists public.crear_lote(uuid, text);
drop function if exists public.anadir_preguntas(uuid, jsonb);
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
drop function if exists public.empezar_juego(uuid, jsonb);
drop function if exists public.guardar_partida(uuid, jsonb, int);
drop function if exists public.enviar_aporte(uuid, text, text, uuid);
drop function if exists public.revelar_aporte(uuid, bigint);
drop function if exists public.autores_aportes(uuid, text);
drop function if exists public.guardar_secreto(uuid, uuid, jsonb);
drop function if exists public.borrar_secretos(uuid);
drop function if exists public.secretos_de_sala(uuid);
drop table if exists public.secretos_jugador cascade;
drop table if exists public.aportes cascade;
drop table if exists public.partidas cascade;
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
  -- Category chosen when creating the room, and the pack chosen by the host.
  nivel_id       int  not null references public.niveles (id),
  lote_id        int  references public.lotes (id) on delete set null,
  anfitrion_id   uuid not null references auth.users (id) on delete cascade,
  tiene_password boolean not null default false,
  estado         text not null default 'esperando'
                 check (estado in ('esperando', 'jugando', 'terminada')),
  created_at     timestamptz not null default now()
);

create index salas_juego_id_idx     on public.salas (juego_id);
create index salas_nivel_id_idx     on public.salas (nivel_id);
create index salas_lote_id_idx      on public.salas (lote_id);
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

-- State of every other game (one row per room): a JSON document that the app
-- reads and writes whole. "version" grows on every write, so two players
-- acting at once never overwrite each other (the second one retries).
create table public.partidas (
  sala_id    uuid primary key references public.salas (id) on delete cascade,
  juego      text not null,
  estado     jsonb not null default '{}'::jsonb,
  version    int  not null default 0,
  updated_at timestamptz not null default now()
);

-- Things players write whose author must stay hidden until revealed:
-- anonymous secrets ("Secretos anónimos") and phrases said by someone of the
-- group ("¿Quién dijo qué?", where sobre_id is who said it). Clients can read
-- the text but not autor_id / sobre_id (column privileges below).
create table public.aportes (
  id         bigint generated always as identity primary key,
  sala_id    uuid not null references public.salas (id) on delete cascade,
  autor_id   uuid not null,
  sobre_id   uuid,
  tipo       text not null check (tipo in ('secreto', 'frase')),
  texto      text not null check (char_length(btrim(texto)) between 2 and 300),
  created_at timestamptz not null default now()
);

create index aportes_sala_id_idx on public.aportes (sala_id);

-- Per-player data everybody but that player can see: the forbidden word
-- ("Palabra prohibida") or the hidden kryptonite ("Tu kryptonita").
create table public.secretos_jugador (
  sala_id uuid not null references public.salas (id) on delete cascade,
  user_id uuid not null,
  datos   jsonb not null default '{}'::jsonb,
  primary key (sala_id, user_id)
);

-- Row Level Security ----------------------------------------------------------------

alter table public.salas          enable row level security;
alter table public.salas_privado  enable row level security;
alter table public.jugadores_sala enable row level security;
alter table public.turnos         enable row level security;
alter table public.partidas         enable row level security;
alter table public.aportes          enable row level security;
alter table public.secretos_jugador enable row level security;

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

create policy "partidas_select_miembros"
  on public.partidas for select to authenticated
  using (public.es_miembro_sala(sala_id));

create policy "aportes_select_miembros"
  on public.aportes for select to authenticated
  using (public.es_miembro_sala(sala_id));

-- Everybody in the room except the player it belongs to.
create policy "secretos_jugador_select_otros"
  on public.secretos_jugador for select to authenticated
  using (public.es_miembro_sala(sala_id) and user_id <> (select auth.uid()));

-- Supabase grants everything on new tables by default: keep only SELECT.
revoke all on public.salas, public.salas_privado, public.jugadores_sala, public.turnos,
  public.partidas, public.aportes, public.secretos_jugador
  from anon, authenticated;
grant select on public.salas, public.jugadores_sala, public.turnos, public.partidas, public.secretos_jugador
  to authenticated;
-- Authors stay hidden: only these columns of aportes can be read.
grant select (id, sala_id, tipo, texto, created_at) on public.aportes to authenticated;

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

-- Creates a room of a game and category, makes the caller its host and first
-- player. Returns the code. The host picks the question pack afterwards.
create function public.crear_sala(p_juego_id int, p_nivel_id int, p_apodo text, p_password text default null)
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
  if not exists (select 1 from public.niveles where id = p_nivel_id) then
    raise exception 'LEVEL_NOT_FOUND';
  end if;

  loop
    v_codigo := public.generar_codigo_sala();
    exit when not exists (select 1 from public.salas where codigo = v_codigo);
  end loop;

  insert into public.salas (codigo, juego_id, nivel_id, anfitrion_id, tiene_password)
  values (v_codigo, p_juego_id, p_nivel_id, v_user, v_password is not null)
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
  nivel          text,
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
    n.nombre,
    (select count(*)::int from public.jugadores_sala j where j.sala_id = s.id),
    s.tiene_password,
    s.created_at
  from public.salas s
  join public.niveles n on n.id = s.nivel_id
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
  nivel_id       int,
  nivel          text,
  lote_id        int,
  lote           text,
  lote_preguntas int,
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
    s.nivel_id,
    n.nombre,
    s.lote_id,
    l.nombre,
    (select count(*)::int from public.preguntas q where q.lote_id = s.lote_id),
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
  join public.niveles n on n.id = s.nivel_id
  left join public.lotes l on l.id = s.lote_id
  left join public.jugadores_sala h on h.sala_id = s.id and h.user_id = s.anfitrion_id
  where s.codigo = upper(btrim(p_codigo));
$$;

-- Question pack functions (host only) ----------------------------------------------

-- Chooses the pack of the room: it must belong to the room's game and category.
create function public.elegir_lote(p_sala_id uuid, p_lote_id int)
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
  if not exists (
    select 1 from public.lotes
    where id = p_lote_id and juego_id = v_sala.juego_id and nivel_id = v_sala.nivel_id
  ) then
    raise exception 'LOT_NOT_FOUND';
  end if;

  update public.salas set lote_id = p_lote_id where id = p_sala_id;
end;
$$;

-- Creates a new (empty) pack for the room's game and category and selects it.
create function public.crear_lote(p_sala_id uuid, p_nombre text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sala    public.salas%rowtype;
  v_nombre  text := btrim(coalesce(p_nombre, ''));
  v_lote_id int;
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
  if char_length(v_nombre) not between 2 and 40 then
    raise exception 'INVALID_LOT_NAME';
  end if;
  if exists (
    select 1 from public.lotes
    where juego_id = v_sala.juego_id and nivel_id = v_sala.nivel_id and lower(nombre) = lower(v_nombre)
  ) then
    raise exception 'LOT_NAME_TAKEN';
  end if;

  insert into public.lotes (juego_id, nivel_id, nombre, created_by)
  values (v_sala.juego_id, v_sala.nivel_id, v_nombre, auth.uid())
  returning id into v_lote_id;

  update public.salas set lote_id = v_lote_id where id = p_sala_id;
  return v_lote_id;
end;
$$;

-- Adds questions to the room's selected pack. `p_preguntas` is a JSON array of
-- {"texto": "...", "tipo": "verdad" | "reto"} (tipo only for "Verdad o reto").
-- Questions already in the pack are skipped. Returns how many were added.
create function public.anadir_preguntas(p_sala_id uuid, p_preguntas jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sala          public.salas%rowtype;
  v_requiere_tipo boolean;
  v_item          jsonb;
  v_texto         text;
  v_tipo          text;
  v_anadidas      int := 0;
  v_filas         int;
begin
  select * into v_sala from public.salas where id = p_sala_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_sala.anfitrion_id is distinct from auth.uid() then
    raise exception 'NOT_HOST';
  end if;
  if v_sala.lote_id is null then
    raise exception 'NO_LOT_SELECTED';
  end if;
  if jsonb_typeof(p_preguntas) <> 'array' or jsonb_array_length(p_preguntas) not between 1 and 500 then
    raise exception 'INVALID_QUESTION';
  end if;

  v_requiere_tipo := (select clave from public.juegos where id = v_sala.juego_id) = 'verdad_o_reto';

  for v_item in select * from jsonb_array_elements(p_preguntas) loop
    v_texto := btrim(coalesce(v_item ->> 'texto', ''));
    v_tipo  := lower(btrim(coalesce(v_item ->> 'tipo', '')));

    if char_length(v_texto) not between 3 and 300 then
      raise exception 'INVALID_QUESTION';
    end if;
    if v_requiere_tipo and v_tipo not in ('verdad', 'reto') then
      raise exception 'INVALID_QUESTION_TYPE';
    end if;

    insert into public.preguntas (texto, lote_id, tipo)
    values (
      v_texto,
      v_sala.lote_id,
      case when v_requiere_tipo then v_tipo::public.tipo_pregunta end
    )
    on conflict (lote_id, texto) do nothing;

    get diagnostics v_filas = row_count;
    v_anadidas := v_anadidas + v_filas;
  end loop;

  -- Touch the room so every player's lobby refreshes the question count.
  update public.salas set lote_id = lote_id where id = p_sala_id;
  return v_anadidas;
end;
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
  if v_sala.lote_id is null then
    raise exception 'NO_LOT_SELECTED';
  end if;

  delete from public.turnos where sala_id = p_sala_id;
  delete from public.partidas where sala_id = p_sala_id;
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
  delete from public.partidas where sala_id = p_sala_id;
  delete from public.aportes where sala_id = p_sala_id;
  delete from public.secretos_jugador where sala_id = p_sala_id;
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

-- The asker takes a random question of the chosen type from the room's pack.
-- Questions used fewer times in this room go first, so nothing repeats until
-- all have been used.
create function public.elegir_pregunta_aleatoria(p_sala_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turno    public.turnos%rowtype;
  v_lote_id  int;
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

  select lote_id into v_lote_id from public.salas where id = p_sala_id;

  select q.id, q.texto into v_id, v_texto
  from public.preguntas q
  where q.lote_id = v_lote_id and q.tipo = v_turno.tipo
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
      delete from public.partidas where sala_id = p_sala_id;
      delete from public.aportes where sala_id = p_sala_id;
      delete from public.secretos_jugador where sala_id = p_sala_id;
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

-- Other games (partidas) ------------------------------------------------------------
-- The rules of these games live in the app: the database keeps the state, makes
-- sure only room members change it, and hides what must stay secret.

-- Host starts any game except "Verdad o reto" (2+ players), with the initial
-- state built by the app.
create function public.empezar_juego(p_sala_id uuid, p_estado jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sala  public.salas%rowtype;
  v_clave text;
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
  select clave into v_clave from public.juegos where id = v_sala.juego_id;
  if v_clave is null or v_clave = 'verdad_o_reto' then
    raise exception 'GAME_NOT_SUPPORTED';
  end if;
  if (select count(*) from public.jugadores_sala where sala_id = p_sala_id) < 2 then
    raise exception 'NOT_ENOUGH_PLAYERS';
  end if;
  if jsonb_typeof(p_estado) <> 'object' or pg_column_size(p_estado) > 262144 then
    raise exception 'INVALID_STATE';
  end if;

  delete from public.turnos where sala_id = p_sala_id;
  delete from public.aportes where sala_id = p_sala_id;
  delete from public.secretos_jugador where sala_id = p_sala_id;
  insert into public.partidas (sala_id, juego, estado, version)
  values (p_sala_id, v_clave, p_estado, 1)
  on conflict (sala_id) do update
    set juego = excluded.juego, estado = excluded.estado,
        version = public.partidas.version + 1, updated_at = now();
  update public.salas set estado = 'jugando' where id = p_sala_id;
end;
$$;

-- Any member saves the new state, if nobody changed it since they read it
-- (p_version). Returns the new version; raises CONFLICT otherwise.
create function public.guardar_partida(p_sala_id uuid, p_estado jsonb, p_version int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version int;
begin
  if not public.es_miembro_sala(p_sala_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if jsonb_typeof(p_estado) <> 'object' or pg_column_size(p_estado) > 262144 then
    raise exception 'INVALID_STATE';
  end if;

  update public.partidas
  set estado = p_estado, version = version + 1, updated_at = now()
  where sala_id = p_sala_id and version = p_version
  returning version into v_version;

  if v_version is null then
    if not exists (select 1 from public.partidas where sala_id = p_sala_id) then
      raise exception 'GAME_NOT_STARTED';
    end if;
    raise exception 'CONFLICT';
  end if;
  return v_version;
end;
$$;

-- A member writes an anonymous secret, or a phrase said by p_sobre_id.
create function public.enviar_aporte(p_sala_id uuid, p_tipo text, p_texto text, p_sobre_id uuid default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not public.es_miembro_sala(p_sala_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if not exists (select 1 from public.partidas where sala_id = p_sala_id) then
    raise exception 'GAME_NOT_STARTED';
  end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 2 and 300 or p_tipo not in ('secreto', 'frase') then
    raise exception 'INVALID_QUESTION';
  end if;

  insert into public.aportes (sala_id, autor_id, sobre_id, tipo, texto)
  values (p_sala_id, auth.uid(), p_sobre_id, p_tipo, btrim(p_texto))
  returning id into v_id;

  -- Touch the game so every player's screen refreshes (aportes itself is not
  -- sent through Realtime, so authors never travel to the clients).
  update public.partidas set updated_at = now() where sala_id = p_sala_id;
  return v_id;
end;
$$;

-- Who wrote an aporte and who it is about (called when the game reveals it).
create function public.revelar_aporte(p_sala_id uuid, p_id bigint)
returns table (autor_id uuid, sobre_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select a.autor_id, a.sobre_id
  from public.aportes a
  where a.sala_id = p_sala_id and a.id = p_id and public.es_miembro_sala(p_sala_id);
$$;

-- How many aportes of a kind each player has written (progress, not authorship).
create function public.autores_aportes(p_sala_id uuid, p_tipo text)
returns table (user_id uuid, total int)
language sql
stable
security definer
set search_path = ''
as $$
  select a.autor_id, count(*)::int
  from public.aportes a
  where a.sala_id = p_sala_id and a.tipo = p_tipo and public.es_miembro_sala(p_sala_id)
  group by a.autor_id;
$$;

-- A member stores p_datos for a player (their forbidden word, their
-- kryptonite…). That player cannot read it; everybody else can.
create function public.guardar_secreto(p_sala_id uuid, p_user_id uuid, p_datos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_miembro_sala(p_sala_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if jsonb_typeof(p_datos) <> 'object' or pg_column_size(p_datos) > 4096 then
    raise exception 'INVALID_STATE';
  end if;
  insert into public.secretos_jugador (sala_id, user_id, datos)
  values (p_sala_id, p_user_id, p_datos)
  on conflict (sala_id, user_id) do update set datos = excluded.datos;
  update public.partidas set updated_at = now() where sala_id = p_sala_id;
end;
$$;

-- Starts a new round of secrets.
create function public.borrar_secretos(p_sala_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_miembro_sala(p_sala_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  delete from public.secretos_jugador where sala_id = p_sala_id;
end;
$$;

-- Every secret, your own included, once the game has finished the round
-- (estado.revelarSecretos = true).
create function public.secretos_de_sala(p_sala_id uuid)
returns table (user_id uuid, datos jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, s.datos
  from public.secretos_jugador s
  where s.sala_id = p_sala_id
    and public.es_miembro_sala(p_sala_id)
    and exists (
      select 1 from public.partidas p
      where p.sala_id = p_sala_id and (p.estado ->> 'revelarSecretos')::boolean is true
    );
$$;

-- Permissions -----------------------------------------------------------------------

-- Only signed-in (anonymous included) users can call the functions; the
-- internal helpers cannot be called directly.
revoke execute on function
  public.es_miembro_sala(uuid),
  public.generar_codigo_sala(),
  public.crear_turno(uuid, uuid),
  public.crear_sala(int, int, text, text),
  public.elegir_lote(uuid, int),
  public.crear_lote(uuid, text),
  public.anadir_preguntas(uuid, jsonb),
  public.unirse_sala(text, text, text),
  public.salir_sala(uuid),
  public.salas_abiertas(int),
  public.info_sala(text),
  public.empezar_partida(uuid),
  public.terminar_partida(uuid),
  public.elegir_tipo(uuid, public.tipo_pregunta),
  public.elegir_pregunta_aleatoria(uuid),
  public.escribir_pregunta(uuid, text),
  public.empezar_juego(uuid, jsonb),
  public.guardar_partida(uuid, jsonb, int),
  public.enviar_aporte(uuid, text, text, uuid),
  public.revelar_aporte(uuid, bigint),
  public.autores_aportes(uuid, text),
  public.guardar_secreto(uuid, uuid, jsonb),
  public.borrar_secretos(uuid),
  public.secretos_de_sala(uuid),
  public.siguiente_turno(uuid)
from public, anon;

grant execute on function
  public.es_miembro_sala(uuid),
  public.crear_sala(int, int, text, text),
  public.elegir_lote(uuid, int),
  public.crear_lote(uuid, text),
  public.anadir_preguntas(uuid, jsonb),
  public.unirse_sala(text, text, text),
  public.salir_sala(uuid),
  public.salas_abiertas(int),
  public.info_sala(text),
  public.empezar_partida(uuid),
  public.terminar_partida(uuid),
  public.elegir_tipo(uuid, public.tipo_pregunta),
  public.elegir_pregunta_aleatoria(uuid),
  public.escribir_pregunta(uuid, text),
  public.empezar_juego(uuid, jsonb),
  public.guardar_partida(uuid, jsonb, int),
  public.enviar_aporte(uuid, text, text, uuid),
  public.revelar_aporte(uuid, bigint),
  public.autores_aportes(uuid, text),
  public.guardar_secreto(uuid, uuid, jsonb),
  public.borrar_secretos(uuid),
  public.secretos_de_sala(uuid),
  public.siguiente_turno(uuid)
to authenticated;

-- Realtime: members get live changes of their room, its players, turns and
-- game state. (aportes and secretos_jugador are not published: their hidden
-- columns would travel to the clients; the game state is touched instead.)
alter publication supabase_realtime add table public.salas, public.jugadores_sala, public.turnos, public.partidas;

commit;
