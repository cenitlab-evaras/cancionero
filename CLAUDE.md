# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Dónde se trabaja

**Todas las modificaciones se hacen en el proyecto Next.js de la carpeta `app/`**, que cuelga de la
raíz `Open Chord/`. Es la raíz del repo y del proyecto: aquí viven `package.json`, `lib/`,
`supabase/`, `docs/` y la carpeta de rutas `app/app/`. Las carpetas hermanas de la raíz (`motor/`,
`pruebas/`, `diseno/`, `assets/`, `docs/`) no se tocan. Si una tarea parece pedir cambios ahí,
primero se pregunta.

## Qué es

**Cantoral**: el repertorio de un coro católico en el teléfono (cifrados ChordPro, transposición,
diagramas, misas, inscripciones, sugerencias). Next.js 16 (App Router, Turbopack) · React 19 ·
Supabase · Tailwind 4 · zod. Sin IA dentro del producto (PRD §16): ni cliente de modelo ni claves.

La especificación manda: `docs/PRD.md` (hitos en §17, matriz de permisos en §8.2, motores en §9,
verificación en §15). `docs/DESIGN.md` explica los tokens de `app/globals.css` (tema oscuro único,
el acento cálido es solo para los acordes). Todo el código, los comentarios y la UI están en
español; la UI tutea («No tienes permiso…»).

El repositorio git empieza en esta carpeta (`app/`) y es **público**: los PDF de cancioneros viven
fuera, en `../docs/`, y nunca se versionan.

## Comandos

```bash
npm run dev                      # Next en :3000
npm test                         # vitest: solo lib/**/*.test.ts (motores + permisos)
npx vitest run lib/motores/transponer.test.ts   # un archivo
npx vitest run -t "Abre tu jardín"              # un test por nombre
npm run build                    # compila y type-chequea (no hay script de typecheck aparte)
npm run lint
npm run verificar:rls            # RLS probada con sesiones reales de cada rol; hoy da 71/71
```

Los scripts de `supabase/seed/` e `supabase/importar/` corren con `node --env-file=.env.local`
(TypeScript nativo de Node, sin tsx). Los importadores (`importar:cancionero`, `importar:archivo`)
son en seco por defecto: solo escriben con `--aplicar`.

**Ojo con `.env.local`:** apunta al Supabase de producción (`supabase.cenitlab.cl`), no a uno
local. Con esa configuración `db:seed`, `db:borrar-semilla` y los importadores con `--aplicar`
escriben en datos reales; `db:borrar-semilla` vacía `cantos`, `coros`, `autores`, etc. Confirmar
antes de correrlos. `db:reset` es solo para el Supabase local (`supabase start`, requiere Docker).

Usuarios de prueba: `admin@`, `director@`, `musico@`, `pendiente@`, `ajeno@` (todos
`@cantoral.local`), con la contraseña de `SEED_PASSWORD`. Ver el README para qué prueba cada uno.

## Arquitectura

Flujo de lectura: **Server Component → `lib/datos/*` (cliente de servidor con la sesión del
usuario; la RLS decide qué filas salen) → motores puros de `lib/motores/` → HTML**. El cliente
solo tiene islas mínimas (auto scroll, controles, modal de acorde).

Flujo de escritura: **server action (`acciones.ts` junto a la ruta) → `obtenerSesion()` →
`puede(sujeto, capacidad)` → validación con zod y el mismo motor que usa la pantalla → escritura
con la sesión del usuario → la RLS vuelve a decidir.** La comprobación previa existe para devolver
un mensaje en vez de un update que afectó cero filas; no reemplaza a la RLS.

Piezas que hay que leer juntas:

- `lib/sesion.ts` — `obtenerSesion()` arma el `Sujeto` (`rol` global, `aprobado`, `rolLocal` en el
  coro activo) una sola vez por request. El coro activo sale de la cookie `cantoral_coro`. Cada
  ruta vuelve a llamarla: es lo que hace cumplir el portón `aprobado`.
- `lib/permisos.ts` — matriz pura de capacidades (PRD §8.2), segura para el cliente. Es la
  **interfaz**, no la seguridad. Si discrepa con la RLS, manda la RLS y la discrepancia es un bug:
  no se afloja una política para que una pantalla funcione.
- `proxy.ts` — el antiguo middleware (Next 16 lo renombró). Solo refresca el token; no autoriza.
- `lib/supabase/` — `server.ts` (default, async: siempre `await createClient()`), `client.ts`
  (navegador, casi no se usa), `admin.ts` (salta la RLS: **solo** semilla e importadores, nunca en
  una ruta de usuario).
- `supabase/migrations/` — esquema `public`. Roles: global en `perfiles.rol`
  (`admin`/`usuario`/`externo`), local en `coro_acceso.rol_local` (`director`/`miembro`). Las
  tablas con alcance de coro llevan `coro_id` denormalizado (con foránea compuesta cuando hace
  falta) para que la política no tenga que hacer joins. `canto_version` la escribe un trigger y no
  tiene políticas de escritura.

## Reglas que no se negocian (README y PRD §8, §16)

1. **RLS activa en la misma migración que crea la tabla**, con sus casos agregados a
   `supabase/seed/verificar-rls.ts`.
2. **Motores puros en `lib/motores/`**: sin Supabase, sin red, sin reloj (el «ahora» entra como
   parámetro), cada uno con su `.test.ts` al lado afirmando la invariante del PRD §9. La UI y las
   consultas no llevan unit tests: se verifican corriendo la app (a 360 px, sin scroll horizontal).
3. **Cero valores derivados persistidos**: edad, conteos, historial y orden recomendado se calculan
   al leer.
4. **Composición:** los diagramas se calculan sobre el cifrado ya transpuesto,
   `acordesDeCanto(transponer(cifrado, n))`.
5. **Los cifrados se guardan en ChordPro con acordes americanos.** Lo que llega en notación latina
   o con acordes en línea aparte se convierte con `desdeElCancionero`. Para meter PDFs de cifrados
   al repertorio existe el skill `.claude/skills/pdf-a-cantoral`.
6. La clave secreta (`SUPABASE_SECRET_KEY`) va solo del lado del servidor y nunca con prefijo
   `NEXT_PUBLIC_`.

## Despliegue

Producción en `https://cantoral.cenitlab.cl`: Dokploy con el `Dockerfile` (`output: "standalone"`),
no Vercel como dice el PRD §15. `NEXT_PUBLIC_*` se hornea **en el build**: si cambia, hay que
reconstruir (Deploy), no reiniciar.
