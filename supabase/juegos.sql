-- Game catalog and question categories. Run manually in the Supabase SQL Editor,
-- after schema.sql. Safe to run as many times as you want: it adds the missing
-- columns and inserts or updates the rows, without deleting anything.
-- To change a description or the order later, edit it here and run it again.

begin;

-- Columns (schema.sql creates them on new databases) ----------------------------

alter table public.juegos add column if not exists clave       text unique;
alter table public.juegos add column if not exists descripcion text;
alter table public.juegos add column if not exists con_alcohol boolean not null default false;
alter table public.juegos add column if not exists orden       int     not null default 0;

-- Databases created before `clave` existed.
update public.juegos set clave = 'yo_nunca'      where clave is null and nombre = 'Yo nunca nunca';
update public.juegos set clave = 'verdad_o_reto' where clave is null and nombre = 'Verdad o reto';

-- Games (matched by `clave`, so existing ids and questions are kept) -------------

insert into public.juegos (clave, nombre, con_alcohol, orden, descripcion) values
  -- With alcohol
  ('yo_nunca', 'Yo nunca nunca', true, 1,
   'Por turnos se leen frases que empiezan por "yo nunca…" y quien sí lo ha hecho bebe. Categorías: suave, secretos, picante y sobre el grupo.'),
  ('quien_es_mas_probable', '¿Quién es más probable?', true, 2,
   'Se lee una situación y todos señalan a la vez a quien creen que encaja. El más señalado bebe.'),
  ('verdad_o_reto', 'Verdad o reto', true, 3,
   'Elige verdad o reto. Si no quieres responder o no cumples el reto, bebes.'),
  ('palabra_prohibida', 'Palabra prohibida', true, 4,
   'Cada jugador recibe en secreto una palabra prohibida durante un tiempo. Si se te escapa la tuya, bebes.'),
  ('reglas_por_carta', 'Reglas por carta', true, 5,
   'Estilo "Rey": se sacan cartas al azar y cada una activa una regla temporal, una acción o un trago. Ideal de fondo mientras se habla.'),
  ('tu_kryptonita', 'Tu kryptonita', true, 6,
   'Cada uno tiene una manía prohibida elegida por los demás. Si te pillan, bebes; las faltas graves activan un Brebaje aleatorio con las bebidas que haya.'),
  -- Without alcohol
  ('cuanto_me_conoces', '¿Cuánto me conoces?', false, 7,
   'Cada ronda se centra en una persona y el resto responde preguntas sobre ella. Gana quien más acierte.'),
  ('secretos_anonimos', 'Secretos anónimos', false, 8,
   'Cada uno escribe un secreto anónimo desde su móvil; se mezclan y hay que adivinar de quién es cada uno.'),
  ('mimica_pictionary', 'Mímica o Pictionary', false, 9,
   'Mímica o dibujo con palabras propias del grupo: chistes internos, anécdotas, películas y juegos que os gustan.'),
  ('tier_list', 'Tier list de amigos', false, 10,
   'Sale una categoría ("el más tacaño", "el que peor conduce"…) y tenéis que poneros de acuerdo en un orden.'),
  ('quien_dijo_que', '¿Quién dijo qué?', false, 11,
   'Frases reales que ha dicho cada uno: adivinad quién dijo cada una.')
on conflict (clave) do update set
  nombre      = excluded.nombre,
  con_alcohol = excluded.con_alcohol,
  orden       = excluded.orden,
  descripcion = excluded.descripcion;

-- Question categories --------------------------------------------------------------

insert into public.niveles (nombre, orden) values
  ('suave', 1),
  ('secretos', 2),
  ('picante', 3),
  ('sobre el grupo', 4)
on conflict (nombre) do update set orden = excluded.orden;

commit;
