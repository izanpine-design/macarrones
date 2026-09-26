# Ideas y roadmap — Macarrones

> Revisado el 27/09/2026 contra `master` en `0cd75fb` (`Add player profiles with password login, customisable rockets and versioned SQL`). El commit ya está integrado en la copia local sincronizada con `origin/master`.

## Estado actual

La web ya ofrece selección de perfil con contraseña, alta de nuevos perfiles, entrada de invitados y personalización persistente de la nave. La apariencia se asocia al `user_id` de Supabase y se muestra en cohetes, lobby y aviso de bebida. La base de datos ahora incluye scripts SQL en el repo.

La partida completa disponible sigue siendo **Verdad o reto**. Las otras ideas de juego/temas no están terminadas por tener presencia visual en el catálogo.

## Implementado en `master`

- Inicio con perfiles existentes, creación de perfil y acceso como invitado.
- Login de perfil con contraseña, cambio de contraseña, salir/cambiar de perfil y apodos únicos.
- Perfil asociado a `auth.users.id` mediante `perfiles.user_id`.
- Editor «Mi nave»: color, pelo, objetos, mascota, retrato, nave dibujada o imagen completa, fondo de «¡A beber!» y vista previa.
- Subida/preparación de imágenes y referencias en Supabase Storage (`naves`).
- Cohete propio primero en la portada/presentación y perfiles del resto como escaparate aleatorio.
- Apariencia del perfil en el lobby por `user_id`; invitados aparecen sin nave propia.
- Aviso de bebida resuelto por `userId`, con retrato, mascota y fondo personal cuando existen.
- Scripts versionados para esquema, juegos, lotes, salas y perfiles, más guía para aplicarlos manualmente.
- Diseños de Noe, Raúl, Izan y Miguel conservados como plantillas iniciales y reserva del escaparate.
- Portada, presentación, mascotas, efectos, salas y pregunta CSV ya existentes.

## Aclaración: qué cubre la personalización de ahora

El camino de visitante ya está implementado: se crea un perfil, se elige un diseño de inicio o nave en blanco, se personaliza y se guarda ligado a la cuenta. Puede volver a entrar desde otro dispositivo con perfil y contraseña.

El grupo fijo también tiene diseños semilla de las cuatro personas; cada cuenta puede editar su propio perfil. Aún no existe una herramienta de anfitrión que edite en una sola sesión las cuatro naves del grupo ni una asignación de «elige cuál de los cuatro personajes serás en esta sala». El código muestra apariencias de perfiles ligados a usuarios.

## Pendiente / siguientes mejoras

### 1. Cerrar la experiencia de grupo fijo

**Parcialmente cubierto; pendiente como flujo explícito.** Decidir si al iniciar se ofrece una opción clara entre «grupo fijo tal cual», «personalizar el grupo» y «crear/usar perfil propio». Los perfiles y editor ya existen, pero falta el recorrido guiado para el grupo que quiere mantener cuatro identidades comunes sin que cada persona tenga que entrar y editar su cuenta.

Acordar si la personalización de los cuatro perfiles la hace cada propietario con contraseña o si se desea una consola compartida de anfitrión. Evitar que una cuenta pueda sobrescribir el perfil de otra sin una regla de propiedad deliberada.

### 2. Mejorar recuperación de cuenta

**Pendiente.** Los emails internos no reciben correo, por lo que no se puede usar recuperación estándar. Hay cambio de contraseña dentro de una sesión y recuperación administrativa descrita en `supabase/README.md`. Antes de abrir el registro a usuarios externos, definir una estrategia segura de recuperación (correo real verificado, código alternativo u otra opción) y proteger el proceso contra suplantación.

### 3. Revisar alta abierta, nombres y moderación

**Pendiente de decisión/operación.** Actualmente alguien que visita la web puede crear perfil y subir imágenes públicas. Definir si esto es intencional, cómo gestionar perfiles abusivos, límites de contenido y borrado de cuenta/datos. Revisar políticas, límites de Storage y validación de imagen junto con el backend Supabase.

### 4. Completar juegos

**Pendiente.** Elegir el siguiente juego y terminar reglas, sincronización de estados, interfaz, salida y reconexión antes de marcarlo jugable. Mantener el botón de inicio desactivado para juegos sin mecánica implementada.

### 5. Completar recursos del grupo fijo

**Pendiente de recursos.** Solo Miguel tiene retrato fotográfico. Noe, Raúl e Izan usan rostro dibujado; Pepe tiene representación propia como objeto. Incorporar fotos solo si el grupo las facilita y autoriza, manteniendo una alternativa ilustrada.

### 6. Revisar experiencia y despliegue

**Pendiente de pasada final.** Probar el recorrido de invitado, registro, login, cambio de perfil, personalización/subida, crear sala y aviso compartido. Confirmar permisos y scripts en el proyecto Supabase real. El repo configura Netlify, pero falta confirmar el sitio desplegado y probar su URL.

## Orden recomendado

1. Aplicar y comprobar los scripts de perfiles en Supabase siguiendo `supabase/README.md`; no ejecutar `schema.sql` sobre datos que se quieran conservar.
2. Probar la experiencia de grupo fijo con las cuatro cuentas y fijar si necesitan un flujo de edición conjunta.
3. Decidir recuperación de cuenta, registro público y moderación de imágenes.
4. Revisar el flujo conectado completo en la URL desplegada.
5. Implementar otro juego cuando el flujo de usuarios y salas esté estable.

## Preguntas de producto aún abiertas

- ¿Se quiere que cualquiera pueda crear un perfil, o solo personas invitadas por el grupo?
- ¿Las cuatro cuentas fijas representan personas reales y deben conservarse como identidades compartidas?
- ¿Se necesita un selector por sala para asignar un miembro fijo a un usuario, o cada persona entra siempre con su propia nave?
- ¿Quién puede editar cada una de las cuatro naves fijas?
- ¿Cómo se recupera una contraseña si se olvida?
- ¿La presentación se ve antes de personalizar o solo después de guardar el perfil nuevo?
- ¿Se quiere una forma de borrar perfil y fotos propias?
