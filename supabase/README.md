# Base de datos (Supabase)

Estos scripts se ejecutan **a mano** en el SQL Editor de Supabase. No hay
migraciones automáticas: cuando cambie uno, vuelve a ejecutarlo.

| Orden | Fichero        | Qué hace | ¿Borra datos? |
|-------|----------------|----------|---------------|
| 1     | `schema.sql`   | Tablas base: juegos, niveles, preguntas | **Sí, todo** (solo para empezar de cero) |
| 2     | `juegos.sql`   | Catálogo de juegos y categorías | No |
| 3     | `lotes.sql`    | Lotes de preguntas | No |
| 4     | `salas.sql`    | Salas, jugadores y partidas | Borra las salas y partidas |
| 5     | `perfiles.sql` | Perfiles, naves y bucket `naves` | No |

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
