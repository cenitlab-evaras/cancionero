import { nombreDeCuerda } from '@/lib/motores/cuerdas'
import type { MisaDeLista } from '@/lib/datos/misas'

/**
 * Quiénes se anotaron, en círculos con sus iniciales y el color de su cuerda
 * (pedido del dueño, 2026-10-17). Sin cuerda visible —la ficha es del dueño y
 * del director (H14)—, el círculo va en neutro.
 *
 * Hasta seis círculos; el resto, «+N». El nombre de cada uno queda para quien
 * no ve los círculos y al pasar el mouse.
 */
const COLOR: Record<string, string> = {
  soprano: 'border-[var(--color-soprano)] bg-[color-mix(in_oklch,var(--color-soprano)_18%,transparent)]',
  contralto: 'border-[var(--color-contralto)] bg-[color-mix(in_oklch,var(--color-contralto)_18%,transparent)]',
  tenor: 'border-[var(--color-tenor)] bg-[color-mix(in_oklch,var(--color-tenor)_18%,transparent)]',
  bajo: 'border-[var(--color-bajo)] bg-[color-mix(in_oklch,var(--color-bajo)_18%,transparent)]',
}
const MAXIMO = 6

export default function Anotados({ quienes }: { quienes: MisaDeLista['quienes'] }) {
  if (quienes.length === 0) return null
  const vistos = quienes.slice(0, quienes.length > MAXIMO ? MAXIMO - 1 : MAXIMO)
  const resto = quienes.length - vistos.length
  const describir = (q: MisaDeLista['quienes'][number]) =>
    q.cuerda ? `${q.nombre}, ${nombreDeCuerda(q.cuerda).toLowerCase()}` : q.nombre

  return (
    <span
      className="flex items-center justify-end -space-x-1.5"
      aria-label={`${quienes.length} ${quienes.length === 1 ? 'anotado' : 'anotados'}: ${quienes.map(describir).join('; ')}`}
      role="img"
    >
      {vistos.map((q) => (
        <span
          key={q.perfilId}
          title={describir(q)}
          className={`inline-flex size-7 items-center justify-center rounded-full border-2 text-[0.6875rem] font-bold text-texto ${
            q.cuerda ? COLOR[q.cuerda] : 'border-borde-fuerte bg-superficie'
          }`}
        >
          {q.iniciales}
        </span>
      ))}
      {resto > 0 && (
        <span className="inline-flex size-7 items-center justify-center rounded-full border-2 border-borde-fuerte bg-superficie text-[0.6875rem] font-bold text-texto-tenue">
          +{resto}
        </span>
      )}
    </span>
  )
}
