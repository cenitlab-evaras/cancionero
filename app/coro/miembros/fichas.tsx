import { etiquetaDisponibilidad, etiquetaTesitura } from '@/lib/motores/ficha'
import type { FichaDeMiembro } from '@/lib/datos/ficha'

/**
 * H14 · las fichas del coro, para el director.
 *
 * De voz aguda a grave: así se lista un coro, y así lo ordenó el motor. Quien
 * no cargó nada aparece igual —al final—, o el director no sabría a quién
 * pedirle que la complete.
 *
 * Solo se muestra la edad, no la fecha: para armar voces alcanza, y la fecha
 * de nacimiento completa es un dato más sensible del que hace falta a la vista.
 */
export default function FichasDelCoro({ fichas }: { fichas: FichaDeMiembro[] }) {
  const sinCargar = fichas.filter((f) => !f.tesitura && !f.disponibilidad && !f.edad).length

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold">Fichas del coro</h2>
      <p className="mt-1 text-xs text-texto-tenue">
        Las carga cada uno desde «Mi ficha». Vos las ves para armar las voces.
      </p>

      <ul className="mt-3 divide-y divide-borde rounded-md border border-borde">
        {fichas.map((f) => (
          <li key={f.perfilId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm">
              {f.nombre ?? f.email}
              {f.rolLocal === 'director' && (
                <span className="ml-2 text-xs text-texto-tenue">director</span>
              )}
            </span>
            <span className="text-xs text-texto-tenue">{etiquetaTesitura(f.tesitura)}</span>
            <span className="text-xs text-texto-tenue">
              {etiquetaDisponibilidad(f.disponibilidad)}
            </span>
            <span className="text-xs text-texto-tenue">
              {f.edad === null ? '—' : `${f.edad} años`}
              {/* Se dice, no se deduce: en contexto parroquial tiene consecuencias. */}
              {f.esMenor === true && <strong className="ml-1 text-acento">menor</strong>}
            </span>
          </li>
        ))}
      </ul>

      {sinCargar > 0 && (
        <p className="mt-2 text-xs text-texto-tenue">
          {sinCargar === 1
            ? '1 miembro todavía no cargó su ficha.'
            : `${sinCargar} miembros todavía no cargaron su ficha.`}
        </p>
      )}
    </section>
  )
}
