-- Full schema. Run manually in the Supabase SQL Editor.
-- WARNING: it drops and recreates every table, so ALL existing data
-- (including imported questions) is deleted and replaced by the seed rows.
-- Afterwards run, in this order: juegos.sql, lotes.sql, salas.sql and perfiles.sql.

begin;

-- Reset -------------------------------------------------------------------------

-- Rooms depend on juegos: they are dropped too; run salas.sql again afterwards.
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

-- Keep these four levels in the same order as juegos.sql. Their ids are 1–4
-- on a fresh schema, so the question seeds below refer to: suave=1,
-- secretos=2, picante=3 and sobre el grupo=4.
insert into public.niveles (nombre, orden) values ('suave', 1);          -- id 1
insert into public.niveles (nombre, orden) values ('secretos', 2);       -- id 2
insert into public.niveles (nombre, orden) values ('picante', 3);        -- id 3
insert into public.niveles (nombre, orden) values ('sobre el grupo', 4); -- id 4

-- Sample phrase for the future "Yo nunca nunca" game.
insert into public.preguntas (texto, juego_id, nivel_id, tipo) values
  ('Yo nunca nunca he cantado en un karaoke.', 1, 1, null);

-- Verdad o reto: 15 questions and 15 challenges in each level.
insert into public.preguntas (texto, juego_id, nivel_id, tipo) values
  -- Suave: verdades (nivel_id 1)
  ('¿Cuál es tu comida favorita?', 2, 1, 'verdad'),
  ('¿Qué canción podrías escuchar en bucle?', 2, 1, 'verdad'),
  ('¿Qué película o serie te sabes casi de memoria?', 2, 1, 'verdad'),
  ('¿Cuál ha sido tu último capricho?', 2, 1, 'verdad'),
  ('¿Qué talento te gustaría tener?', 2, 1, 'verdad'),
  ('¿Qué aplicación usas más?', 2, 1, 'verdad'),
  ('¿Cuál es tu estación del año favorita?', 2, 1, 'verdad'),
  ('¿Qué comida no te cansas de comer?', 2, 1, 'verdad'),
  ('¿Qué lugar te gustaría visitar?', 2, 1, 'verdad'),
  ('¿Qué animal te gustaría tener como mascota?', 2, 1, 'verdad'),
  ('¿Cuál era tu asignatura favorita?', 2, 1, 'verdad'),
  ('¿Qué plan sencillo te hace feliz?', 2, 1, 'verdad'),
  ('¿Qué personaje de ficción se parece más a ti?', 2, 1, 'verdad'),
  ('¿Qué habilidad te gustaría aprender?', 2, 1, 'verdad'),
  ('¿Cuál es el mejor regalo que has recibido?', 2, 1, 'verdad'),

  -- Suave: retos (nivel_id 1)
  ('Imita a un animal hasta que alguien lo adivine.', 2, 1, 'reto'),
  ('Tararea una canción para que el grupo la reconozca.', 2, 1, 'reto'),
  ('Haz una pose de superhéroe durante diez segundos.', 2, 1, 'reto'),
  ('Cuenta una historia inventada en treinta segundos.', 2, 1, 'reto'),
  ('Di tres cosas que empiecen por la letra que elija el grupo.', 2, 1, 'reto'),
  ('Habla como un presentador de televisión durante un turno.', 2, 1, 'reto'),
  ('Haz una reverencia como si acabaras de ganar un premio.', 2, 1, 'reto'),
  ('Baila durante quince segundos sin música.', 2, 1, 'reto'),
  ('Di el abecedario al revés hasta donde puedas.', 2, 1, 'reto'),
  ('Inventa un eslogan para la persona de tu derecha.', 2, 1, 'reto'),
  ('Describe tu día como si fuera una película de acción.', 2, 1, 'reto'),
  ('Haz una cara graciosa y mantenla cinco segundos.', 2, 1, 'reto'),
  ('Di los nombres del grupo con voz de robot.', 2, 1, 'reto'),
  ('Representa una profesión para que los demás la adivinen.', 2, 1, 'reto'),
  ('Inventa un saludo secreto con la persona de tu izquierda.', 2, 1, 'reto'),

  -- Secretos: verdades (nivel_id 2)
  ('¿Qué manía tuya conoce poca gente?', 2, 2, 'verdad'),
  ('¿Qué mentira piadosa has dicho recientemente?', 2, 2, 'verdad'),
  ('¿Qué mensaje escribiste y al final no enviaste?', 2, 2, 'verdad'),
  ('¿Qué compra innecesaria te hizo mucha ilusión?', 2, 2, 'verdad'),
  ('¿Qué canción te gusta aunque te dé un poco de vergüenza admitirlo?', 2, 2, 'verdad'),
  ('¿Qué cosa has fingido entender alguna vez?', 2, 2, 'verdad'),
  ('¿Qué apodo te han puesto que recuerdas especialmente?', 2, 2, 'verdad'),
  ('¿Qué moda seguiste y ahora te da risa?', 2, 2, 'verdad'),
  ('¿Qué es lo más raro que has buscado en Internet?', 2, 2, 'verdad'),
  ('¿Qué excusa has usado para cancelar un plan?', 2, 2, 'verdad'),
  ('¿Qué comida te gusta aunque a casi nadie de tu entorno le guste?', 2, 2, 'verdad'),
  ('¿Qué cosa te da vergüenza hacer cuando hay gente mirando?', 2, 2, 'verdad'),
  ('¿Qué hábito te gustaría dejar?', 2, 2, 'verdad'),
  ('¿Qué recuerdo te hace reír cada vez que lo cuentas?', 2, 2, 'verdad'),
  ('¿Qué pequeño secreto inofensivo nunca habías contado al grupo?', 2, 2, 'verdad'),

  -- Secretos: retos (nivel_id 2)
  ('Haz tu mejor baile durante quince segundos.', 2, 2, 'reto'),
  ('Lee en voz alta el último emoji que usaste y explica por qué.', 2, 2, 'reto'),
  ('Inventa un nombre artístico para cada persona del grupo.', 2, 2, 'reto'),
  ('Haz una declaración dramática de amor a un objeto de la habitación.', 2, 2, 'reto'),
  ('Cuenta un chiste malo con total seriedad.', 2, 2, 'reto'),
  ('Recrea cómo reaccionas cuando te llevas una sorpresa.', 2, 2, 'reto'),
  ('Di una frase típica tuya imitando tu propia voz.', 2, 2, 'reto'),
  ('Improvisa una canción de cuatro versos sobre el grupo.', 2, 2, 'reto'),
  ('Describe tu móvil como si estuvieras vendiéndolo por televisión.', 2, 2, 'reto'),
  ('Haz una imitación cariñosa de ti mismo cuando tienes sueño.', 2, 2, 'reto'),
  ('Representa cómo pones una excusa para llegar tarde.', 2, 2, 'reto'),
  ('Inventa una noticia absurda sobre el día de hoy.', 2, 2, 'reto'),
  ('Di algo amable de cada persona presente.', 2, 2, 'reto'),
  ('Haz una entrevista de treinta segundos a la persona de tu derecha.', 2, 2, 'reto'),
  ('Cuenta una anécdota inventada como si te hubiera pasado de verdad.', 2, 2, 'reto'),

  -- Picante: verdades (nivel_id 3)
  ('¿A quién del grupo besarías si supieras que también quiere?', 2, 3, 'verdad'),
  ('¿Cuál ha sido el lugar más inesperado donde has besado a alguien?', 2, 3, 'verdad'),
  ('¿Has tenido un flechazo por alguien que no te convenía?', 2, 3, 'verdad'),
  ('¿Qué es lo más atrevido que has hecho para llamar la atención de alguien?', 2, 3, 'verdad'),
  ('¿Has enviado alguna vez un mensaje subido de tono y luego te has arrepentido?', 2, 3, 'verdad'),
  ('¿Con quién de aquí tendrías una cita secreta?', 2, 3, 'verdad'),
  ('¿Te has liado alguna vez con alguien y después has fingido que no significó nada?', 2, 3, 'verdad'),
  ('¿Qué tipo de beso te gusta más?', 2, 3, 'verdad'),
  ('¿Cuál es tu mayor debilidad cuando alguien te atrae?', 2, 3, 'verdad'),
  ('¿Has sentido química con alguien nada más conocerlo?', 2, 3, 'verdad'),
  ('¿A quién de aquí elegirías para interpretar una escena de pasión contigo?', 2, 3, 'verdad'),
  ('¿Qué fantasía romántica o atrevida te daría vergüenza contar en voz alta?', 2, 3, 'verdad'),
  ('¿Has vuelto a hablar con alguien solo porque todavía te atraía?', 2, 3, 'verdad'),
  ('¿Qué es lo más atrevido que has hecho en una primera cita?', 2, 3, 'verdad'),
  ('¿Con quién de aquí crees que tendrías más tensión si os quedarais a solas?', 2, 3, 'verdad'),

  -- Picante: retos (nivel_id 3)
  ('Mantén la mirada con quien elijas durante quince segundos; esa persona puede aceptar o elegir a otra.', 2, 3, 'reto'),
  ('Dedícale a alguien del grupo tu mejor frase para ligar.', 2, 3, 'reto'),
  ('Susurra una frase coqueta a quien elijas, solo si acepta.', 2, 3, 'reto'),
  ('Recrea cómo sería tu beso de película, sin besar a nadie.', 2, 3, 'reto'),
  ('Dile a alguien del grupo qué rasgo suyo te parece más atractivo.', 2, 3, 'reto'),
  ('Invita a alguien a una cita imaginaria y descríbele el plan.', 2, 3, 'reto'),
  ('Haz un baile lento durante veinte segundos; puedes hacerlo a solas o con alguien que acepte.', 2, 3, 'reto'),
  ('Di quién del grupo te pondría más nervioso en una cita y explica por qué.', 2, 3, 'reto'),
  ('Interpreta una escena de tensión romántica con quien quiera participar.', 2, 3, 'reto'),
  ('Lanza un piropo atrevido, pero respetuoso, a alguien del grupo.', 2, 3, 'reto'),
  ('Representa cómo intentarías seducir a alguien en una película.', 2, 3, 'reto'),
  ('Elige a alguien que acepte y recread juntos una escena de reencuentro apasionado, sin contacto obligatorio.', 2, 3, 'reto'),
  ('Di en voz baja tu invitación más atrevida a una cita.', 2, 3, 'reto'),
  ('Haz una declaración de deseo a un personaje imaginario con toda la intensidad posible.', 2, 3, 'reto'),
  ('Elige a alguien que acepte y bailad pegados durante diez segundos; si no, haz el baile a solas.', 2, 3, 'reto'),

  -- Sobre el grupo: verdades (nivel_id 4)
  ('¿Con quién del grupo te irías de viaje?', 2, 4, 'verdad'),
  ('¿Quién del grupo te hace reír más?', 2, 4, 'verdad'),
  ('¿Quién sería el mejor compañero para resolver un problema?', 2, 4, 'verdad'),
  ('¿Qué recuerdo con el grupo te gusta especialmente?', 2, 4, 'verdad'),
  ('¿Quién del grupo improvisa mejor?', 2, 4, 'verdad'),
  ('¿Qué plan te gustaría hacer próximamente con todos?', 2, 4, 'verdad'),
  ('¿Quién sería el mejor guía turístico?', 2, 4, 'verdad'),
  ('¿Quién organizaría mejor una fiesta?', 2, 4, 'verdad'),
  ('¿Quién crees que sobreviviría mejor en una isla desierta?', 2, 4, 'verdad'),
  ('¿A quién llamarías primero para pedir consejo?', 2, 4, 'verdad'),
  ('¿Quién del grupo cuenta mejor las historias?', 2, 4, 'verdad'),
  ('¿Qué momento del grupo te gustaría repetir?', 2, 4, 'verdad'),
  ('¿Quién sería el mejor compañero para un concurso?', 2, 4, 'verdad'),
  ('¿Qué cualidad admiras de la persona de tu izquierda?', 2, 4, 'verdad'),
  ('¿Qué es lo más divertido que os ha pasado juntos?', 2, 4, 'verdad'),

  -- Sobre el grupo: retos (nivel_id 4)
  ('Haz una imitación cariñosa de alguien del grupo para que lo adivinen.', 2, 4, 'reto'),
  ('Asigna a cada persona un superpoder.', 2, 4, 'reto'),
  ('Elige a alguien y haced juntos una pose de portada de disco.', 2, 4, 'reto'),
  ('Propón un plan para el grupo y véndelo como si fuera un anuncio.', 2, 4, 'reto'),
  ('Di una cualidad que valores de cada persona presente.', 2, 4, 'reto'),
  ('Representa con gestos una anécdota compartida para que la adivinen.', 2, 4, 'reto'),
  ('Inventa un nombre de equipo para el grupo y preséntalo oficialmente.', 2, 4, 'reto'),
  ('Haz de presentador y anuncia la entrada de cada persona.', 2, 4, 'reto'),
  ('Elige una película que represente al grupo y explica el reparto.', 2, 4, 'reto'),
  ('Crea un lema para el grupo y haz que todos lo repitan.', 2, 4, 'reto'),
  ('Describe a cada persona como si fuera un personaje de videojuego.', 2, 4, 'reto'),
  ('Organiza una foto imaginaria y dirige las poses del grupo.', 2, 4, 'reto'),
  ('Imita cómo sería el grupo dentro de veinte años.', 2, 4, 'reto'),
  ('Inventa un premio para cada persona y entrégalo en una ceremonia.', 2, 4, 'reto'),
  ('Cuenta una historia breve en la que cada persona del grupo tenga un papel.', 2, 4, 'reto');

commit;
