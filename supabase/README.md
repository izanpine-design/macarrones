# Base de datos (Supabase)

Estos scripts se ejecutan **a mano** en el SQL Editor de Supabase. No hay
migraciones automáticas: cuando cambie uno, vuelve a ejecutarlo.

| Orden | Fichero        | Qué hace | ¿Borra datos? |
|-------|----------------|----------|---------------|
| 1     | `schema.sql`   | Tablas base: juegos, niveles, preguntas | **Sí, todo** (solo para empezar de cero) |
| 2     | `juegos.sql`   | Catálogo de juegos y categorías | No |
| 3     | `lotes.sql`    | Lotes de preguntas | No |
| 4     | `salas.sql`    | Salas, jugadores y partidas de todos los juegos | Borra las salas y partidas |
| 5     | `perfiles.sql` | Perfiles, naves y bucket `naves` | No |
| 6     | `contenido.sql` | Lotes «Básico» de los juegos con preguntas/palabras | No (solo añade lo que falte) |
| 7     | `verdad_o_reto.sql` | Las 120 preguntas iniciales de Verdad o reto | No (solo añade lo que falte) |

## Actualizar una base que ya existe (juegos nuevos, octubre 2026)

Si tu base ya tenía salas y perfiles, para los 10 juegos nuevos basta con
ejecutar, en este orden: **`salas.sql`** (añade `partidas`, `aportes` y
`secretos_jugador`; borra las salas abiertas en ese momento), **`contenido.sql`**
y **`verdad_o_reto.sql`**. No toca preguntas, lotes ni perfiles.

### Cómo funcionan los juegos (salvo Verdad o reto)

- `partidas`: un estado JSON por sala con un número de versión. La app aplica
  las reglas y guarda con `guardar_partida`; si alguien guardó antes, la versión
  no coincide (`CONFLICT`) y la app reintenta con el estado nuevo.
- `aportes`: secretos anónimos y frases de «¿Quién dijo qué?». Se puede leer el
  texto, pero **no** quién lo escribió (permisos por columna); el autor solo sale
  con `revelar_aporte` cuando el juego lo revela.
- `secretos_jugador`: la palabra prohibida o la kryptonita de cada uno. La ve
  todo el mundo menos su dueño; al final de la ronda `secretos_de_sala` las
  enseña todas.
- Solo `partidas` va por Realtime; las otras dos avisan «tocando» la partida,
  para que los autores nunca viajen a los móviles.

## Antes de `perfiles.sql`

1. **Authentication → Sign In / Providers → Email**: desactiva **Confirm email**
   (los perfiles usan correos internos `@macarrones.netlify.app` que nadie ve;
   es nuestro dominio porque Supabase rechaza los inventados como `.example`).
2. **Authentication → Sign In / Providers**: deja activado **Allow anonymous
   sign-ins** (los invitados lo necesitan).
3. **Authentication → Users → Add user → Create new user** (con *Auto Confirm
   User*), uno por amigo, con la contraseña inicial de cada uno:
   `noe@macarrones.netlify.app`, `raul@macarrones.netlify.app`,
   `izan@macarrones.netlify.app`, `miguel@macarrones.netlify.app`.
   Al ejecutar `perfiles.sql` reciben su nave actual.

## Contraseñas olvidadas

No hay correo de recuperación (los correos son internos). Cámbiala desde el SQL
Editor, con el apodo del perfil y la contraseña nueva:

```sql
update auth.users
set encrypted_password = extensions.crypt('contraseña-nueva', extensions.gen_salt('bf'))
where id = (select user_id from public.perfiles where lower(apodo) = lower('Miguel'));
```
