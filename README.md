# Cantoral

El repertorio de un coro católico, en el teléfono. Especificación completa en
[`../docs/PRD.md`](../docs/PRD.md).

Next.js 16 · Supabase · esquema `public` · despliegue previsto en Vercel.

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
| `director@cantoral.local` | miembro · director | Misión País | editar repertorio (H8) |
| `musico@cantoral.local` | miembro · músico | Misión País | leer y tocar |
| `pendiente@cantoral.local` | miembro, **sin aprobar** | — | probar el portón |
| `ajeno@cantoral.local` | miembro · músico | San Ejemplo | probar el aislamiento entre coros |

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
