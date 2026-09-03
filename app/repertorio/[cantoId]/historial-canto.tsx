import {
  describirAntiguedad,
  describirEspaciado,
  type HistorialCanto,
} from '@/lib/motores/historial'

/**
 * El historial del canto, en su vista de lectura (H13).
 *
 * Server component y `<details>` nativo: desplegar el detalle no necesita
 * JavaScript, y esta pantalla se abre de pie en una iglesia con mala señal.
 *
 * Contesta la pregunta del director antes de meter un canto otra vez: ¿cuánto
 * hace que lo cantamos, y cada cuánto vuelve?
 */

/** `2026-07-12` → `12 jul`. El año solo cuando no es el de la fecha más nueva. */
function fechaCorta(iso: string, conAnio: boolean): string {
  const [anio, mes, dia] = iso.split('-')
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const texto = `${Number(dia)} ${MESES[Number(mes) - 1]}`
  return conAnio ? `${texto} ${anio}` : texto
}

export default function HistorialDelCanto({
  historial,
  anioActual,
}: {
  historial: HistorialCanto
  anioActual: string
}) {
  const { veces, diasDesdeUltima, cadaCuantosDias, ejecuciones, agendadas, porMomento } = historial
  const ritmo = describirEspaciado(cadaCuantosDias)

  // Nunca cantado. NO se dibuja un «0 veces»: se dice en palabras, porque el
  // dato útil no es el cero sino qué hacer con él (§14, los estados vacíos).
  if (veces === 0) {
    return (
      <p className="mt-2 pl-7 text-xs text-texto-tenue">
        Todavía no se ha cantado en ninguna misa.
        {agendadas.length > 0 && (
          <>
            {' '}
            {/* El aviso que evita el «esto está roto»: el canto está puesto en
                una misa que todavía no ocurrió, y por eso no cuenta. */}
            Está en <span className="text-texto">{agendadas[0].misaNombre}</span> del{' '}
            {fechaCorta(agendadas[0].fecha, agendadas[0].fecha.slice(0, 4) !== anioActual)}, que
            todavía no ocurrió.
          </>
        )}
      </p>
    )
  }

  return (
    <details className="mt-2 ml-7">
      <summary className="cursor-pointer text-xs text-texto-tenue marker:text-texto-tenue">
        Cantado {veces} {veces === 1 ? 'vez' : 'veces'} ·{' '}
        <span className="text-texto">{describirAntiguedad(diasDesdeUltima)}</span>
        {ritmo && <> · {ritmo}</>}
      </summary>

      <div className="mt-2 flex flex-col gap-2 border-l border-borde pl-3 text-xs text-texto-tenue">
        <ul className="flex flex-col gap-1">
          {ejecuciones.map((e) => (
            <li key={e.misaId} className="flex gap-2">
              <span className="w-16 shrink-0 font-cifrado">
                {fechaCorta(e.fecha, e.fecha.slice(0, 4) !== anioActual)}
              </span>
              <span className="min-w-0 flex-1 truncate text-texto">{e.misaNombre}</span>
              <span className="shrink-0">{e.momento}</span>
            </li>
          ))}
        </ul>

        {/* «En qué parte de la misa lo cantamos» — la otra mitad de lo que se
            pidió. Con un solo momento no se repite la tabla: se dice y basta. */}
        {porMomento.length === 1 ? (
          <p>Siempre en {porMomento[0].momento}.</p>
        ) : (
          <p>
            {porMomento.map((m, i) => (
              <span key={m.momento}>
                {i > 0 && ' · '}
                {m.momento} ({m.veces})
              </span>
            ))}
          </p>
        )}

        {agendadas.length > 0 && (
          <p>
            Además está en{' '}
            <span className="text-texto">{agendadas[0].misaNombre}</span> del{' '}
            {fechaCorta(agendadas[0].fecha, agendadas[0].fecha.slice(0, 4) !== anioActual)}, que
            todavía no ocurrió y no cuenta.
          </p>
        )}
      </div>
    </details>
  )
}
