# Cantoral

El repertorio de un coro católico, en el teléfono. Especificación completa en
[`docs/PRD.md`](docs/PRD.md).

Next.js 16 · Supabase · esquema `public` · despliegue en Dokploy con el `Dockerfile`.

## Levantarlo

Necesitás Docker corriendo (para Supabase local) y Node 22+.

```bash
cp .env.example .env.local     # completar con lo que imprime `supabase status`
npm install
supabase start                 # Postgres + Auth + Studio en tu máquina
supabase db reset              # aplica las migraciones
npm run db:seed                # siembra 12 cantos y 5 usuarios de prueba
npm run dev
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | levanta la app |
| `npm test` | motores puros y matriz de permisos |
| `npm run build` | compila y type-chequea |
| `npm run db:reset` | reaplica las migraciones (borra los datos) |
| `npm run db:seed` | siembra el repertorio y los usuarios de prueba |
| `npm run db:borrar-semilla` | deja el esquema como estaba |
| `npm run verificar:rls` | prueba la RLS con **sesiones reales** de cada rol |

## Usuarios de prueba

Todos con la contraseña de `SEED_PASSWORD` (no está en el repo).

| Usuario | Rol | Coro | Para qué |
| --- | --- | --- | --- |
| `admin@cantoral.local` | admin | — | aprobar perfiles (H7) |
| `director@cantoral.local` | usuario · director | Coro San José de la Familia | editar repertorio (H8) |
| `musico@cantoral.local` | usuario · miembro | Coro San José de la Familia | leer y tocar |
| `pendiente@cantoral.local` | usuario, **sin aprobar** | — | probar el portón |
| `ajeno@cantoral.local` | usuario · miembro | San Ejemplo | probar el aislamiento entre coros |

## Despliegue e invitaciones por email

Producción: `https://cantoral.cenitlab.cl`, en Dokploy con el `Dockerfile`
(`output: "standalone"`, puerto 3000). No es Vercel.

### Variables de la app (servicio Next.js)

| Variable | Cuándo se lee | Si falta |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | build y runtime | el build corta a propósito (Dockerfile) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build y runtime | el build corta a propósito (Dockerfile) |
| `SITE_URL` | runtime | invitar devuelve «Falta configurar `SITE_URL` en el servidor.» y **no se crea** la invitación |
| `SUPABASE_SECRET_KEY` | runtime | invitar crea la fila pero el envío devuelve «El envío de correos no está configurado en el servidor.» |

Las `NEXT_PUBLIC_*` se hornean **en el build**: si cambian, hay que reconstruir
(Deploy), no reiniciar. `SITE_URL` y `SUPABASE_SECRET_KEY` son de runtime: alcanza
con reiniciar el contenedor. La clave secreta va solo del lado del servidor,
nunca con prefijo `NEXT_PUBLIC_` ni en el repo.

`SITE_URL` es el dominio público exacto, sin barra final
(`https://cantoral.cenitlab.cl`). La app lo usa para armar el link absoluto de la
invitación: `${SITE_URL}/auth/confirm?inv=<token>`.

### Supabase self-hosted (servicio de Auth en Dokploy)

El SMTP y los redirects **no viven en este repo**: se configuran en las variables
del servicio de Auth del stack self-hosted (el `.env` del stack que Dokploy pasa
al contenedor `auth`) y se aplican al reiniciar ese servicio.

| Variable | Valor de producción | Para qué |
| --- | --- | --- |
| `SITE_URL` | `https://cantoral.cenitlab.cl` | base de los links de los correos y del allow-list |
| `ADDITIONAL_REDIRECT_URLS` | `https://cantoral.cenitlab.cl/auth/confirm` | destinos exactos permitidos; sin esta entrada el link de invitación es rechazado |
| `SMTP_HOST` | `smtp.resend.com` | servidor de salida |
| `SMTP_PORT` | `587` | STARTTLS (Resend también acepta 465 con TLS directo) |
| `SMTP_USER` | `resend` | usuario SMTP de Resend |
| `SMTP_PASS` | (API key de Resend) | secreto; solo en Dokploy |
| `SMTP_ADMIN_EMAIL` | remitente, p. ej. `no-reply@cantoral.cenitlab.cl` | From de los correos |
| `SMTP_SENDER_NAME` | `Cantoral` | nombre visible del remitente |
| `DISABLE_SIGNUP` | `true` | cierra el registro público: la única puerta es la invitación |

`ADDITIONAL_REDIRECT_URLS` es una lista separada por comas de URLs **exactas** (sin
comodines); agregá una entrada por cada entorno. Si tu plantilla de Dokploy expone
los nombres internos de GoTrue en vez de los de arriba, el equivalente es
`GOTRUE_SITE_URL`, `GOTRUE_URI_ALLOW_LIST`, `GOTRUE_SMTP_HOST`,
`GOTRUE_SMTP_PORT`, `GOTRUE_SMTP_USER`, `GOTRUE_SMTP_PASS`,
`GOTRUE_SMTP_ADMIN_EMAIL`, `GOTRUE_SMTP_SENDER_NAME` y
`GOTRUE_DISABLE_SIGNUP=true`.

Dos avisos que evitan una caída:

- **Desactivar el registro no desactiva el correo.** Después de `DISABLE_SIGNUP`,
  dejá habilitado el proveedor de email (`ENABLE_EMAIL_SIGNUP=true`, o
  `GOTRUE_EXTERNAL_EMAIL_ENABLED=true`): a una cuenta que ya existe se le reenvía
  con un link mágico, y sin proveedor ese envío falla.
- **Plantilla «Invite user».** Mantené el botón apuntando a
  `{{ .ConfirmationURL }}`; el redirect al dominio propio lo resuelve la
  configuración de Auth, no la plantilla.

**Proveedor recomendado: Resend por SMTP.** Verificá el dominio en Resend y
publicá sus registros **SPF y DKIM** en el DNS. Sin SPF/DKIM los correos no salen
o caen en spam, y una invitación que no llega es un miembro que no entra.

### Probar el flujo en local (Inbucket)

El stack local (`supabase start`) captura los correos en vez de mandarlos:
**Inbucket en <http://127.0.0.1:56324>**. No hace falta SMTP ni proveedor.

La configuración local ya está en `supabase/config.toml`: `[auth] enable_signup =
false`, `site_url = "http://127.0.0.1:3000"` y
`additional_redirect_urls` con `http://127.0.0.1:3000/auth/confirm` y
`http://localhost:3000/auth/confirm`.

1. En `.env.local`, `SITE_URL=http://localhost:3000` (debe estar en la lista de
   redirects; `supabase/config.toml` ya lo tiene).
2. `npm run dev`, entrar como `admin@cantoral.local` e invitar un director desde
   `/admin/perfiles`.
3. Abrir <http://127.0.0.1:56324>, abrir el correo y copiar el link.
4. Abrir el link sin sesión: crear la contraseña y aceptar la invitación.
5. Entrar como ese director, invitar un miembro desde `/coro/miembros` y repetir.

Si el server corre en otro puerto (p. ej. `:3002`), `SITE_URL` debe decirlo y esa
URL exacta con `/auth/confirm` debe estar en `additional_redirect_urls`; después
`supabase stop && supabase start` para que Auth relea `config.toml`. Si no
coinciden, Auth ignora el destino no permitido y te deja en el `site_url` sin
sesión: el link no llega a `/auth/confirm`.

### Cuando el correo no sale

La fila de `invitacion` se escribe **antes** de mandar el correo. Si el SMTP no
está configurado o falla, la app muestra
«No pudimos enviar el correo de invitación. La invitación quedó pendiente:
reintenta con «Reenviar».» y la invitación **no se pierde**: aparece en la lista
de pendientes con «Reenviar» (y «Revocar»). Corregí el SMTP en el servicio de Auth
y reenviá; el reenvío invalida el token anterior y emite uno nuevo.

## Lo que no se toca

Son cimientos del producto, no preferencias (PRD §8 y §16):

1. **RLS activa en la misma migración que crea la tabla.** Esquema `public`, expuesto por defecto en la Data API.
2. **La RLS es la seguridad; `lib/permisos.ts` es la interfaz.** Si discrepan, manda la RLS y la
   discrepancia es un bug — no se afloja la política para que la pantalla ande.
3. **Los motores son puros y testeados.** `lib/motores/`: sin base, sin red, sin reloj.
4. **Cero valores derivados persistidos.** Lo que se calcula, se calcula al leer.
5. **`aprobado` es el portón.** Toda decisión de acceso pasa por el sujeto completo.
6. **La clave de servicio solo del lado del servidor**, sin prefijo `NEXT_PUBLIC_`, fuera del repo.

## Estado

**H1 a H4 hechos y verificados: el corte mínimo del PRD está alcanzado.** Un coro puede entrar,
ver su repertorio por momento litúrgico, leer un canto con los acordes sobre la letra, transponerlo
a su tonalidad y tocarlo con la pantalla desplazándose sola.

El detalle de cada hito y lo que quedó pendiente está en el PRD, §17 y §17.1. El siguiente es
**H5: diagramas de acorde**.
