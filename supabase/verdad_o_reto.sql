-- 120 starting questions of "Verdad o reto" (15 verdades + 15 retos per category)
-- for databases that already exist. From ACTUALIZACION-PREGUNTAS.md. Safe to run
-- again: categories are matched by name and existing questions are skipped.

begin;

-- 1. Asegurar que existen los lotes 'Básico' para Verdad o reto en las 4 categorías
insert into public.lotes (juego_id, nivel_id, nombre)
select j.id, n.id, 'Básico'
from public.juegos j
cross join public.niveles n
where j.clave = 'verdad_o_reto'
  and n.nombre in ('suave', 'secretos', 'picante', 'sobre el grupo')
on conflict (juego_id, nivel_id, nombre) do nothing;

-- 2. Insertar las 120 preguntas resolviendo automáticamente el lote_id correspondiente
with mapa_lotes as (
  select l.id as lote_id, n.nombre as nivel_nombre
  from public.lotes l
  join public.juegos j on j.id = l.juego_id
  join public.niveles n on n.id = l.nivel_id
  where j.clave = 'verdad_o_reto'
    and l.nombre = 'Básico'
)
insert into public.preguntas (texto, lote_id, tipo)
select v.texto, ml.lote_id, v.tipo::public.tipo_pregunta
from (
  values
    -- Suave: verdades
    ('¿Cuál es tu comida favorita?', 'suave', 'verdad'),
    ('¿Qué canción podrías escuchar en bucle?', 'suave', 'verdad'),
    ('¿Qué película o serie te sabes casi de memoria?', 'suave', 'verdad'),
    ('¿Cuál ha sido tu último capricho?', 'suave', 'verdad'),
    ('¿Qué talento te gustaría tener?', 'suave', 'verdad'),
    ('¿Qué aplicación usas más?', 'suave', 'verdad'),
    ('¿Cuál es tu estación del año favorita?', 'suave', 'verdad'),
    ('¿Qué comida no te cansas de comer?', 'suave', 'verdad'),
    ('¿Qué lugar te gustaría visitar?', 'suave', 'verdad'),
    ('¿Qué animal te gustaría tener como mascota?', 'suave', 'verdad'),
    ('¿Cuál era tu asignatura favorita?', 'suave', 'verdad'),
    ('¿Qué plan sencillo te hace feliz?', 'suave', 'verdad'),
    ('¿Qué personaje de ficción se parece más a ti?', 'suave', 'verdad'),
    ('¿Qué habilidad te gustaría aprender?', 'suave', 'verdad'),
    ('¿Cuál es el mejor regalo que has recibido?', 'suave', 'verdad'),

    -- Suave: retos
    ('Imita a un animal hasta que alguien lo adivine.', 'suave', 'reto'),
    ('Tararea una canción para que el grupo la reconozca.', 'suave', 'reto'),
    ('Haz una pose de superhéroe durante diez segundos.', 'suave', 'reto'),
    ('Cuenta una historia inventada en treinta segundos.', 'suave', 'reto'),
    ('Di tres cosas que empiecen por la letra que elija el grupo.', 'suave', 'reto'),
    ('Habla como un presentador de televisión durante un turno.', 'suave', 'reto'),
    ('Haz una reverencia como si acabaras de ganar un premio.', 'suave', 'reto'),
    ('Baila durante quince segundos sin música.', 'suave', 'reto'),
    ('Di el abecedario al revés hasta donde puedas.', 'suave', 'reto'),
    ('Inventa un eslogan para la persona de tu derecha.', 'suave', 'reto'),
    ('Describe tu día como si fuera una película de acción.', 'suave', 'reto'),
    ('Haz una cara graciosa y mantenla cinco segundos.', 'suave', 'reto'),
    ('Di los nombres del grupo con voz de robot.', 'suave', 'reto'),
    ('Representa una profesión para que los demás la adivinen.', 'suave', 'reto'),
    ('Inventa un saludo secreto con la persona de tu izquierda.', 'suave', 'reto'),

    -- Secretos: verdades
    ('¿Qué manía tuya conoce poca gente?', 'secretos', 'verdad'),
    ('¿Qué mentira piadosa has dicho recientemente?', 'secretos', 'verdad'),
    ('¿Qué mensaje escribiste y al final no enviaste?', 'secretos', 'verdad'),
    ('¿Qué compra innecesaria te hizo mucha ilusión?', 'secretos', 'verdad'),
    ('¿Qué canción te gusta aunque te dé un poco de vergüenza admitirlo?', 'secretos', 'verdad'),
    ('¿Qué cosa has fingido entender alguna vez?', 'secretos', 'verdad'),
    ('¿Qué apodo te han puesto que recuerdas especialmente?', 'secretos', 'verdad'),
    ('¿Qué moda seguiste y ahora te da risa?', 'secretos', 'verdad'),
    ('¿Qué es lo más raro que has buscado en Internet?', 'secretos', 'verdad'),
    ('¿Qué excusa has usado para cancelar un plan?', 'secretos', 'verdad'),
    ('¿Qué comida te gusta aunque a casi nadie de tu entorno le guste?', 'secretos', 'verdad'),
    ('¿Qué cosa te da vergüenza hacer cuando hay gente mirando?', 'secretos', 'verdad'),
    ('¿Qué hábito te gustaría dejar?', 'secretos', 'verdad'),
    ('¿Qué recuerdo te hace reír cada vez que lo cuentas?', 'secretos', 'verdad'),
    ('¿Qué pequeño secreto inofensivo nunca habías contado al grupo?', 'secretos', 'verdad'),

    -- Secretos: retos
    ('Haz tu mejor baile durante quince segundos.', 'secretos', 'reto'),
    ('Lee en voz alta el último emoji que usaste y explica por qué.', 'secretos', 'reto'),
    ('Inventa un nombre artístico para cada persona del grupo.', 'secretos', 'reto'),
    ('Haz una declaración dramática de amor a un objeto de la habitación.', 'secretos', 'reto'),
    ('Cuenta un chiste malo con total seriedad.', 'secretos', 'reto'),
    ('Recrea cómo reaccionas cuando te llevas una sorpresa.', 'secretos', 'reto'),
    ('Di una frase típica tuya imitando tu propia voz.', 'secretos', 'reto'),
    ('Improvisa una canción de cuatro versos sobre el grupo.', 'secretos', 'reto'),
    ('Describe tu móvil como si estuvieras vendiéndolo por televisión.', 'secretos', 'reto'),
    ('Haz una imitación cariñosa de ti mismo cuando tienes sueño.', 'secretos', 'reto'),
    ('Representa cómo pones una excusa para llegar tarde.', 'secretos', 'reto'),
    ('Inventa una noticia absurda sobre el día de hoy.', 'secretos', 'reto'),
    ('Di algo amable de cada persona presente.', 'secretos', 'reto'),
    ('Haz una entrevista de treinta segundos a la persona de tu derecha.', 'secretos', 'reto'),
    ('Cuenta una anécdota inventada como si te hubiera pasado de verdad.', 'secretos', 'reto'),

    -- Picante: verdades
    ('¿A quién del grupo besarías si supieras que también quiere?', 'picante', 'verdad'),
    ('¿Cuál ha sido el lugar más inesperado donde has besado a alguien?', 'picante', 'verdad'),
    ('¿Has tenido un flechazo por alguien que no te convenía?', 'picante', 'verdad'),
    ('¿Qué es lo más atrevido que has hecho para llamar la atención de alguien?', 'picante', 'verdad'),
    ('¿Has enviado alguna vez un mensaje subido de tono y luego te has arrepentido?', 'picante', 'verdad'),
    ('¿Con quién de aquí tendrías una cita secreta?', 'picante', 'verdad'),
    ('¿Te has liado alguna vez con alguien y después has fingido que no significó nada?', 'picante', 'verdad'),
    ('¿Qué tipo de beso te gusta más?', 'picante', 'verdad'),
    ('¿Cuál es tu mayor debilidad cuando alguien te atrae?', 'picante', 'verdad'),
    ('¿Has sentido química con alguien nada más conocerlo?', 'picante', 'verdad'),
    ('¿A quién de aquí elegirías para interpretar una escena de pasión contigo?', 'picante', 'verdad'),
    ('¿Qué fantasía romántica o atrevida te daría vergüenza contar en voz alta?', 'picante', 'verdad'),
    ('¿Has vuelto a hablar con alguien solo porque todavía te atraía?', 'picante', 'verdad'),
    ('¿Qué es lo más atrevido que has hecho en una primera cita?', 'picante', 'verdad'),
    ('¿Con quién de aquí crees que tendrías más tensión si os quedarais a solas?', 'picante', 'verdad'),

    -- Picante: retos
    ('Mantén la mirada con quien elijas durante quince segundos; esa persona puede aceptar o elegir a otra.', 'picante', 'reto'),
    ('Dedícale a alguien del grupo tu mejor frase para ligar.', 'picante', 'reto'),
    ('Susurra una frase coqueta a quien elijas, solo si acepta.', 'picante', 'reto'),
    ('Recrea cómo sería tu beso de película, sin besar a nadie.', 'picante', 'reto'),
    ('Dile a alguien del grupo qué rasgo suyo te parece más atractivo.', 'picante', 'reto'),
    ('Invita a alguien a una cita imaginaria y descríbele el plan.', 'picante', 'reto'),
    ('Haz un baile lento durante veinte segundos; puedes hacerlo a solas o con alguien que acepte.', 'picante', 'reto'),
    ('Di quién del grupo te pondría más nervioso en una cita y explica por qué.', 'picante', 'reto'),
    ('Interpreta una escena de tensión romántica con quien quiera participar.', 'picante', 'reto'),
    ('Lanza un piropo atrevido, pero respetuoso, a alguien del grupo.', 'picante', 'reto'),
    ('Representa cómo intentarías seducir a alguien en una película.', 'picante', 'reto'),
    ('Elige a alguien que acepte y recread juntos una escena de reencuentro apasionado, sin contacto obligatorio.', 'picante', 'reto'),
    ('Di en voz baja tu invitación más atrevida a una cita.', 'picante', 'reto'),
    ('Haz una declaración de deseo a un personaje imaginario con toda la intensidad posible.', 'picante', 'reto'),
    ('Elige a alguien que acepte y bailad pegados durante diez segundos; si no, haz el baile a solas.', 'picante', 'reto'),

    -- Sobre el grupo: verdades
    ('¿Con quién del grupo te irías de viaje?', 'sobre el grupo', 'verdad'),
    ('¿Quién del grupo te hace reír más?', 'sobre el grupo', 'verdad'),
    ('¿Quién sería el mejor compañero para resolver un problema?', 'sobre el grupo', 'verdad'),
    ('¿Qué recuerdo con el grupo te gusta especialmente?', 'sobre el grupo', 'verdad'),
    ('¿Quién del grupo improvisa mejor?', 'sobre el grupo', 'verdad'),
    ('¿Qué plan te gustaría hacer próximamente con todos?', 'sobre el grupo', 'verdad'),
    ('¿Quién sería el mejor guía turístico?', 'sobre el grupo', 'verdad'),
    ('¿Quién organizaría mejor una fiesta?', 'sobre el grupo', 'verdad'),
    ('¿Quién crees que sobreviviría mejor en una isla desierta?', 'sobre el grupo', 'verdad'),
    ('¿A quién llamarías primero para pedir consejo?', 'sobre el grupo', 'verdad'),
    ('¿Quién del grupo cuenta mejor las historias?', 'sobre el grupo', 'verdad'),
    ('¿Qué momento del grupo te gustaría repetir?', 'sobre el grupo', 'verdad'),
    ('¿Quién sería el mejor compañero para un concurso?', 'sobre el grupo', 'verdad'),
    ('¿Qué cualidad admiras de la persona de tu izquierda?', 'sobre el grupo', 'verdad'),
    ('¿Qué es lo más divertido que os ha pasado juntos?', 'sobre el grupo', 'verdad'),

    -- Sobre el grupo: retos
    ('Haz una imitación cariñosa de alguien del grupo para que lo adivinen.', 'sobre el grupo', 'reto'),
    ('Asigna a cada persona un superpoder.', 'sobre el grupo', 'reto'),
    ('Elige a alguien y haced juntos una pose de portada de disco.', 'sobre el grupo', 'reto'),
    ('Propón un plan para el grupo y véndelo como si fuera un anuncio.', 'sobre el grupo', 'reto'),
    ('Di una cualidad que valores de cada persona presente.', 'sobre el grupo', 'reto'),
    ('Representa con gestos una anécdota compartida para que la adivinen.', 'sobre el grupo', 'reto'),
    ('Inventa un nombre de equipo para el grupo y preséntalo oficialmente.', 'sobre el grupo', 'reto'),
    ('Haz de presentador y anuncia la entrada de cada persona.', 'sobre el grupo', 'reto'),
    ('Elige una película que represente al grupo y explica el reparto.', 'sobre el grupo', 'reto'),
    ('Crea un lema para el grupo y haz que todos lo repitan.', 'sobre el grupo', 'reto'),
    ('Describe a cada persona como si fuera un personaje de videojuego.', 'sobre el grupo', 'reto'),
    ('Organiza una foto imaginaria y dirige las poses del grupo.', 'sobre el grupo', 'reto'),
    ('Imita cómo sería el grupo dentro de veinte años.', 'sobre el grupo', 'reto'),
    ('Inventa un premio para cada persona y entrégalo en una ceremonia.', 'sobre el grupo', 'reto'),
    ('Cuenta una historia breve en la que cada persona del grupo tenga un papel.', 'sobre el grupo', 'reto')
) as v(texto, nivel_nombre, tipo)
join mapa_lotes ml on ml.nivel_nombre = v.nivel_nombre
on conflict do nothing;

commit;
