# Usuarios — menú y rol global

Fecha: 2026-11-18 · Rama: `h27-tono-en-la-misa`

## Qué y por qué

El dueño quiere en Cantoral un menú **«Usuarios»** como el del CRM: una
pantalla donde el administrador ve todas las cuentas, las pendientes primero,
y puede aprobar y fijar el rol global. Hoy `/admin/perfiles` aprueba y
suspende, pero el rol global (`admin` / `usuario` / `externo`) solo se puede
cambiar por SQL.

## Alcance

- La entrada de «Más» pasa de **«Administración»** a **«Usuarios»** (misma ruta
  `/admin/perfiles`: no se rompen enlaces ni el PRD).
- Título y metadata de la pantalla: «Usuarios».
- Los habilitados ganan un **select de rol global** (`usuario` / `admin`) que
  guarda al cambiar. El propio admin no puede cambiarse el rol.
- La sección **«Coros»** (lista + alta) sigue en la misma pantalla, como
  sección aparte, para no ampliar el alcance.

## Fuera de alcance

- **Invitar por correo**: el CRM lo hace con la clave de servicio; Cantoral no
  la tiene en la app (el Dockerfile la excluye) y el Supabase self-hosted
  necesita SMTP y redirects. Es una decisión de seguridad aparte.
- **Teléfono de avisos**: el CRM lo usa para WhatsApp; Cantoral no.
- **Cambiar a/desde `externo` desde la UI**: la RLS actual
  (`puede_ver_coro` y `es_director_de`) no excluye a un externo con vínculo,
  así que pasarlo a externo le dejaría el acceso al coro. Queda como deuda de
  seguridad aparte (migración + caso en `verificar:rls`); el select solo
  ofrece los dos roles internos y un externo existente se muestra de solo
  lectura.
- **shadcn**: la app tiene su sistema; se copia la estructura del CRM, no su
  librería.
- **Migración**: la RLS ya deja actualizar `perfiles` al admin
  (`perfiles_write` es `es_admin()`).

## Decisiones

- **Ruta intacta**: `/admin/perfiles`. Cambia la etiqueta, no la URL.
- El select **guarda al cambiar**, con el patrón de la app
  (`useTransition` + error inline + `router.refresh()`), no con un botón
  Guardar por fila como el CRM.
- Regla pura en `lib/motores/gobierno.ts` (`puedeCambiarRol`) con test: el
  admin no se cambia su propio rol.
- Ícono nuevo `IconoUsuarios` (dos personas) para no repetir el de Miembros.

## Verificación

- `npm test`, `npm run lint` y build.
- En la app a 360 px: `admin@` ve «Usuarios» y cambia el rol de `ajeno@`;
  `musico@` no ve la entrada y por URL recibe el mensaje de administración.
