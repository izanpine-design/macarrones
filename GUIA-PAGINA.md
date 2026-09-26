# Guía de la página — Macarrones

> Revisada el 27/09/2026 sobre `master`, commit `0cd75fb` (`Add player profiles with password login, customisable rockets and versioned SQL`). La rama local está sincronizada con `origin/master`. Describe lo que contiene este commit; las siguientes ideas están en `IDEAS-ROADMAP.md`.

## 1. Qué es el proyecto

Macarrones es una aplicación web para jugar en grupo. Está hecha con Angular y usa Supabase para autenticación, datos de salas y sincronización en tiempo real. La experiencia visual combina espacio, cohetes de macarrón, mascotas pixeladas y temas para juegos.

La aplicación tiene una partida jugable de **Verdad o reto**. Que un juego aparezca en catálogo o tenga fondo temático no significa que su mecánica esté terminada.

## 2. Tecnologías y comandos

- Angular 22.2, TypeScript 6 y RxJS.
- Supabase JS 2.117 para Auth, base de datos, Storage y Realtime.
- Bootstrap 5.3 y CSS propio por componente más estilos globales.
- Pruebas unitarias con Vitest mediante el builder de Angular.
- `.nvmrc` fija Node 24; `package.json` declara npm 11.13.

Desde la carpeta del repo:

```bash
npm install
npm start
npm run build
npm test
```

La salida de producción está en `dist/macarrones/browser`. Esta revisión fue de código y documentación; no ejecuté la compilación ni las pruebas.

## 3. Rutas y recorrido

| Ruta | Contenido | Acceso |
|---|---|---|
| `/` | Elegir un perfil existente, crear perfil, entrar como invitado o volver al perfil activo | Pública |
| `/juegos` | Catálogo separado en «Con alcohol» y «Sin alcohol» | Apodo elegido |
| `/juegos/:id` | Ficha, crear sala, entrar por código y ver salas abiertas | Apodo elegido |
| `/ajustes` | «Mi nave»: personalizar perfil, imagen y contraseña | Apodo elegido; guardar requiere perfil registrado |
| `/sala/:codigo` | Unirse, lobby y partida | Apodo elegido; puede conservarse la ruta de invitación |
| cualquier otra | Redirige a `/` | — |

`nicknameGuard` manda a portada a quien todavía no ha elegido perfil o invitado y conserva la ruta solicitada (`volver`). El menú muestra «Mi nave» a perfiles con cuenta y «Cambiar» a invitados.

### Elegir cómo entrar

La portada carga los perfiles públicos de Supabase. Se puede seleccionar uno e iniciar con contraseña, crear un perfil con apodo/contraseña y un diseño de partida, o entrar como invitado con solo apodo. Los perfiles nuevos pasan primero por `/ajustes` para personalizar; al guardar, continúa la presentación y luego la ruta solicitada.

Las cuentas originales Noe, Raúl, Izan y Miguel necesitan estar creadas en Supabase Auth para iniciar sesión. `perfiles.sql` siembra sus diseños predeterminados si encuentra las cuentas internas correspondientes; el script no crea esas cuentas.

## 4. Estructura del código

- `src/app/app.routes.ts`: rutas y guardas.
- `src/app/app.html`, `app.ts`, `app.config.ts`: shell, navegación y servicios globales.
- `src/app/welcome/`: selección/creación de identidad, invitado, presentación y entrada.
- `src/app/settings/`: editor de nave, selector/subida de imágenes y contraseña.
- `src/app/core/`: autenticación, apodo, perfiles, imágenes, jugadores, juegos, preguntas, salas y turnos.
- `src/app/games/`: listado, tarjetas y fichas.
- `src/app/rooms/`: crear/entrar en salas, lobby, lotes y partida.
- `src/app/rooms/truth-or-dare/`: selección de pregunta y reglas de Verdad o reto.
- `src/app/shared/crew/`: tripulación predeterminada y conversión de perfiles a la apariencia (`Look`) que consumen los componentes.
- `src/app/shared/rockets/`, `pets/`, `pixel/`, `space/`, `themes/`, `sfx/`, `drink/`, `intro/`: sistemas visuales compartidos.
- `src/environments/`: configuración de cliente por entorno.
- `supabase/`: scripts SQL, orden de instalación y ayuda operativa.
- `public/`: imágenes y recursos de frontend; Angular los copia al build.

## 5. Portada, presentación y apariencias

La portada conserva el fondo espacial, el sonido y la presentación. La zona de cohetes usa hasta seis apariencias: primero la del usuario activo y después perfiles elegidos aleatoriamente; si no hay perfiles cargados, usa los cuatro diseños de tripulación.

La presentación se dispara tras escoger identidad. En el primer acceso puede mostrarla una vez por sesión y respeta movimiento reducido. Incluye cuenta atrás, lanzamiento, transición y llegada; se puede volver a abrir manualmente.

### Nave personalizable

`/ajustes` permite editar apodo, colores, colores oscuros, pelo, objeto delante/detrás, mascota, imagen de cabeza, nave y fondo de «¡A beber!». La nave puede ser el cohete dibujado por piezas o una imagen subida que lo sustituya. Hay vista previa. Las imágenes se redimensionan/preparan antes de subirlas.

Cada perfil guarda su configuración en `perfiles.nave` como JSON. Las referencias a imágenes son rutas, no contenido binario en la fila. El bucket público `naves` sirve las imágenes; la política permite escritura del propietario autenticado en su carpeta. Los invitados no tienen nave propia ni pueden guardar ajustes.

## 6. Catálogo y partidas

El catálogo muestra los juegos y temas disponibles. En el estado de este commit solo `verdad_o_reto` tiene la mecánica jugable. El lobby impide empezar otro juego aún no implementado.

Flujo de Verdad o reto:

1. Crear una sala, entrar con código o elegir una abierta.
2. Compartir el enlace desde el lobby, comprobar jugadores y seleccionar/crear un lote de preguntas.
3. El anfitrión inicia con al menos dos jugadores y un lote elegido.
4. Los participantes eligen Verdad o Reto, reciben pregunta y pasan turno. El anfitrión puede saltar o terminar según las acciones del juego.

La importación de preguntas soporta CSV con coma o punto y coma, comillas y BOM; valida filas y evita duplicados. También existe entrada individual.

## 7. Identidad, salas y avisos de bebida

La autenticación separa dos casos:

- **Perfil:** cuenta con contraseña en Supabase Auth y fila asociada en `perfiles`; el identificador de ambas es `user_id`.
- **Invitado:** sesión anónima de Supabase y apodo guardado localmente en ese dispositivo. Sin una cuenta, el apodo no recupera una nave en otros dispositivos.

Los participantes de sala se identifican por `user_id`. El lobby busca la apariencia mediante `ProfileService.lookFor(user_id)` y enseña «Invitado» si no existe perfil. El aviso de bebida lleva `userId` y busca la apariencia con ese identificador; ya no depende de adivinar quién es por el apodo. Si no hay perfil, muestra una apariencia genérica. El aviso es un Broadcast Realtime efímero y no queda guardado como historial.

Las cuentas de perfil pueden tener apodo único y cambiar su contraseña desde ajustes. No hay correo de recuperación porque los emails de login son internos y no se envían; la guía de Supabase ofrece un procedimiento administrativo para restablecerla.

## 8. Sistemas visuales compartidos

- **Cohetes:** `RocketSky` anima apariencias de perfiles, con diseños predeterminados como reserva; hay trayectorias, interacción para derribar cohetes, sonido, partículas y mascotas en paracaídas.
- **Mascotas:** capa global de sprites dibujados en código, con movimiento, descanso y pequeñas interacciones; contempla movimiento reducido.
- **Espacio y temas:** `SpaceSky`, planeta de pasta, `GameBackdrop`, metadatos de temas y transiciones.
- **Sonido:** `SfxService` sintetiza efectos con Web Audio y guarda la preferencia de silencio localmente.
- **Aviso de bebida:** modal que muestra el nombre, rostro, mascota y, si el perfil lo usa, su fondo propio.

## 9. SQL y configuración de Supabase

Los scripts de `supabase/` se ejecutan manualmente en el SQL Editor; no hay migraciones automáticas enlazadas al despliegue.

- `supabase/README.md` explica orden, ajustes de Auth y creación de las cuatro cuentas de equipo.
- `schema.sql` es un reinicio completo y **borra datos** de las tablas que elimina; se usa solo al configurar desde cero.
- `juegos.sql`, `lotes.sql`, `salas.sql` y `perfiles.sql` aplican datos/esquema adicionales; `salas.sql` recrea salas y partidas, por lo que también puede borrar esos datos.
- `perfiles.sql` crea políticas y bucket, es repetible según sus comentarios y no borra perfiles/fotos.

Antes de ejecutar un script sobre el proyecto real, lee su cabecera y README. La web alojada no actualiza el esquema de Supabase automáticamente.

## 10. Despliegue

`netlify.toml` ejecuta `npm run build` y publica `dist/macarrones/browser`; `public/_redirects` devuelve las rutas al punto de entrada de Angular. El repo está preparado para Netlify, pero estos archivos no confirman que haya un sitio publicado ni su URL. No hay configuración `vercel.json` en el commit revisado.

## 11. Límites actuales

1. Solo Verdad o reto tiene partida completa.
2. Los invitados no tienen perfiles persistentes ni nave personal.
3. Elegir un perfil da la identidad personal de su dueño; no existe asignación de uno de los cuatro miembros fijos de la tripulación por jugador y por sala.
4. Cada perfil puede personalizar su nave, pero eso no equivale a un editor de una plantilla común de grupo con administración compartida.
5. Las cuentas originales y el SQL deben prepararse en Supabase; el despliegue de frontend no hace esa instalación.
6. La contraseña no tiene recuperación automática por correo.
7. La configuración Netlify del repo no confirma el estado del sitio publicado.

El estado de las próximas mejoras y las decisiones de producto están en `IDEAS-ROADMAP.md`.
