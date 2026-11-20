# Auditoría de backend y velocidad de datos · 20 nov 2026

Auditoría técnica (Impeccable · dimensión Performance) sobre la app en producción
(`https://cantoral.cenitlab.cl`, build `0cd3341`) y sobre el Supabase self-hosted del mismo VPS.
Medición, no opinión: cada número sale de una consulta o de una petición real.

## Puntaje

| # | Dimensión | Puntaje | Hallazgo clave |
|---|---|---|---|
| 1 | Latencia de datos (red) | 1/4 | Cada consulta a Supabase cuesta **140–250 ms** porque sale a la URL pública; el camino interno medido es **3 ms** |
| 2 | Consultas y esquema | 3/4 | La base es chica y está indexada: la consulta del repertorio tarda **2,5 ms** |
| 3 | Rondas por pantalla | 2/4 | Cada pantalla hacía **4–5 viajes** en serie antes de pintar; ahora 2–3 |
| 4 | Caché y trabajo repetido | 2/4 | No se cachean datos globales (momentos) y algunas pantallas corren dos rondas |
| 5 | Integridad y RLS | 4/4 | La RLS sigue siendo el portón real; los cambios de sesión no la relajan |
| **Total** | | **12/20** | **Aceptable — el problema es de red y de rondas, no de base de datos** |

## Evidencia

- **Desde el contenedor de la app** (VPS), un `GET /rest/v1/cantos?select=id&limit=1`:
  **138–192 ms**; `/auth/v1/health`: **254 ms**.
- **Camino interno** desde el mismo contenedor al gateway de ingreso (SNI y Host de
  `supabase.cenitlab.cl`, keep-alive): **3 ms** por consulta (34 ms el primer TLS).
  A la IP pública del VPS: 22–24 ms después del primer TLS.
- **De la app a Supabase se va por `https://supabase.cenitlab.cl`**: DNS público, TLS y vuelta
  por Traefik. No hay red compartida entre la app (overlay `dokploy-network`, 10.0.1.88) y el
  Supabase (bridge `supabase_network_cantoral`); Kong no publica el 8000 al host.
- **Base de datos**: 558 cantos, 558 vínculos de momento, 10 misas, 43 filas de misa, 6 perfiles.
  `EXPLAIN ANALYZE` del listado principal: planificación 0,6 ms · ejecución **2,5 ms**;
  ejecuciones del historial: 0,8 ms. Índices presentes (`cantos_coro_activos_idx`,
  `canto_momentos_coro_idx`, `misas_coro_fecha_idx`, `misa_cantos_misa_idx`…).
- **VPS**: 32 GB de RAM, 8,5 GB en uso, load 1,6–2,4; sin swap. El servidor no está ahogado: la
  app respondía `/entrar` en **1–13 ms** desde el propio host.

## Hallazgos

### P0 · Cada pantalla paga 4–5 viajes de ida y vuelta a Supabase

**Dónde**: `proxy.ts` (`getUser` por request), `lib/sesion.ts` (getUser → perfiles →
coro_acceso, tres consultas en serie) y las consultas propias de cada pantalla.

**Impacto**: con 140–250 ms por viaje, una pantalla tarda ~0,8–1,2 s solo en datos, antes de
renderizar y de bajar el HTML. En el teléfono, con la RTT móvil encima, se siente «lentísimo».

**Arreglado** (en código, pendiente de deploy):
- `proxy.ts`: `getSession()` en vez de `getUser()` → solo va a la red si el token venció.
- `obtenerSesion()`: las cookies se leen localmente y perfil + coros van en **una** consulta
  embebida. De 3 viajes a 1.
- Rondas por pantalla: **4–5 → 2–3**.

**Pendiente (necesita autorización)**: que el servidor hable con Supabase por el **camino
interno** (3 ms) en vez de la URL pública (140–250 ms). Dos formas:
1. Entrada de hosts en el contenedor de producción: `supabase.cenitlab.cl → 172.16.1.1`
   (medido: 3 ms), o
2. regla de red equivalente en Dokploy (alias interno para el mismo host).
La primera es un cambio de configuración del contenedor vivo; por eso está esperando la
autorización del dueño.

### P1 · Dos rondas en serie en pantallas de uso frecuente

**Dónde**: Inicio (misas → misa + inscritos), ficha del canto (`herramientasDelCanto` después
del `Promise.all`, solo consulta si «resaltar mi cuerda» está prendido).

**Impacto**: +150–250 ms por ronda extra hoy; +3 ms cuando el camino interno esté activo. Vale
igual: la segunda ronda de Inicio es inevitable sin cambiar `misasDelCoro` para que traiga la
misa completa.

**Recomendación**: cuando se toque Inicio, pedir la próxima misa con sus cantos en la primera
consulta (`misasDelCoro` ya trae el conteo; sumarle los cantos es un embed).

### P1 · Cálculo de historial completo en cada visita al repertorio

**Dónde**: `repertorioConHistorial()` en `app/repertorio/page.tsx` (se agregó para la regleta).

**Impacto**: hoy es barato (10 misas, 43 filas, 0,8 ms de ejecución); crece con las misas. Es
una consulta HTTP más por visita, pero va en paralelo: no agrega una ronda.

**Recomendación**: dejarlo; vigilar si las misas pasan del centenar.

### P2 · Datos globales sin caché

**Dónde**: `momentos_liturgicos`, digitaciones y catálogos se piden por pantalla.

**Impacto**: viajes repetidos por datos que cambian casi nunca.

**Recomendación**: `unstable_cache`/`cache()` de React por request para los momentos; invalidar
al editar. No urgente: con el camino interno cada viaje cuesta 3 ms.

### P2 · `NODE_ENV` y arranque

Sin hallazgos: la imagen corre `standalone`, healthcheck OK, sin reinicios inesperados. La
deuda conocida del `CMD` (`next start` vs `server.js`) no afecta la latencia actual.

## Lo que está bien

- La base está bien modelada y indexada para este volumen; ninguna consulta lenta.
- La RLS sigue siendo la seguridad real; los cambios de sesión solo afectan la interfaz, y cada
  escritura/lectura sigue viajando con el JWT del usuario.
- Paginación del catálogo (P2-3 de la auditoría UI) ya reduce el DOM.
- Los cambios de estado usan `revalidatePath` y no revalidan de más.

## Cambios aplicados en esta pasada

1. `proxy.ts`: refresco de sesión solo al vencer.
2. `lib/sesion.ts`: una consulta para perfil + coros; lectura local de la sesión.
3. (Pedido del dueño) Entrar con el logo y el nombre del coro.
4. (Pedido del dueño) Gestos de fila: izquierda descubre «Próxima misa» y «Ensayar»; derecha
   archiva. Con las acciones `enviarAProximaMisa` y `marcarParaEnsayar`, reusando `agregarCanto`
   y las capacidades existentes.

## Próximo paso

Con autorización para el camino interno, la misma pantalla que hoy tarda ~0,8–1,2 s en datos
pasa a ~30–60 ms. Es el cambio de mayor impacto de toda la auditoría.

## Resultado aplicado (misma fecha)

Con la autorización del dueño, el 2026-11-20 se agregó al servicio de producción
(`proyectos-test-cancionero-8wrxc5`, VPS 2.24.83.80) la entrada
`supabase.cenitlab.cl → 172.16.1.1`. Verificado dentro del contenedor:

- `rest/v1/cantos`: **5–6 ms** en régimen (87 ms el primero, por el TLS).
- `auth/v1/health`: **5 ms**.
- El navegador sigue usando el DNS público (la entrada es solo del contenedor).

Medido desde el teléfono emulado (Playwright, 360 px), mismo día y red, antes → después:

| Pantalla | DCL antes | DCL después |
|---|---|---|
| Inicio | ~1,2 s | **0,44–0,47 s** |
| Canciones · Por momento | ~1,8–2,0 s | **0,93–1,08 s** |
| Canciones · Todas | ~0,95–1,13 s | **0,46–0,62 s** |

El TTFB restante (~250–450 ms) es casi todo la RTT de la red de origen, no el servidor: desde el
propio host la app responde `/entrar` en 1–13 ms.

**Ojo con los redeploys**: la entrada se agregó con `docker service update --host-add`. Si un
deploy de Dokploy recrea el servicio con su especificación, la entrada puede perderse. Después
de cada deploy hay que comprobar `getent hosts supabase.cenitlab.cl` dentro del contenedor y, si
falta, volver a aplicarla (o pasar a una solución persistente en la imagen).
