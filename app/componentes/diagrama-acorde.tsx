import type { DigitacionResuelta } from '@/lib/motores/buscar-digitacion'

/**
 * Un diagrama de acorde, dibujado en el SERVIDOR (PRD decisión 4 y §3.2).
 *
 * No decide nada: `buscarDigitacion` ya resolvió los trastes, la cejilla y
 * dónde arranca la ventana. Acá solo se dibuja, igual que `cifrado.tsx` solo
 * dibuja lo que devolvió `renderizarCifrado`. Nada que decidir es nada que
 * testear en la interfaz.
 *
 * SVG a mano, sin librería de gráficos: son cuatro primitivas y una librería
 * sería una dependencia de render para un dato que ya está calculado.
 */

/** Cuántos trastes muestra la ventana. Igual que en el motor. */
const TRASTES = 5
/** Separación entre cuerdas y entre trastes, en unidades del viewBox. */
const PASO_CUERDA = 10
const PASO_TRASTE = 12
/** Dónde empieza el mástil. Arriba queda el aire para los círculos y las x. */
const Y_CEJUELA = 15
const X_PRIMERA = 6

const x = (cuerda: number) => X_PRIMERA + cuerda * PASO_CUERDA
const yTraste = (n: number) => Y_CEJUELA + n * PASO_TRASTE

function Marca({ cuerda, muda }: { cuerda: number; muda: boolean }) {
  const cx = x(cuerda)
  if (!muda) {
    // Al aire: un círculo vacío sobre la cejuela.
    return <circle cx={cx} cy={7} r={3.2} fill="none" stroke="currentColor" strokeWidth={1.2} />
  }
  // Muda: una x DIBUJADA, no la letra. El glifo cambia de ancho entre sistemas
  // y descoloca la columna, igual que pasa con los símbolos de reproducción.
  return (
    <g stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
      <line x1={cx - 2.6} y1={7 - 2.6} x2={cx + 2.6} y2={7 + 2.6} />
      <line x1={cx - 2.6} y1={7 + 2.6} x2={cx + 2.6} y2={7 - 2.6} />
    </g>
  )
}

export default function DiagramaAcorde({ digitacion }: { digitacion: DigitacionResuelta }) {
  const { trastes, cejilla, trasteInicial } = digitacion

  return (
    // El −12 de la izquierda reserva el sitio del número de traste SIEMPRE, se
    // dibuje o no: así todas las cartas de la tira miden exactamente igual.
    <svg viewBox="-12 0 74 80" className="h-[76px] w-[74px]" aria-hidden focusable="false">
      {/* Trastes */}
      {Array.from({ length: TRASTES + 1 }, (_, i) => (
        <line
          key={`t${i}`}
          x1={X_PRIMERA}
          y1={yTraste(i)}
          x2={x(5)}
          y2={yTraste(i)}
          stroke="var(--color-borde)"
          strokeWidth={i === 0 && trasteInicial > 1 ? 1 : 1}
        />
      ))}

      {/* La cejuela, gruesa: es lo que distingue "posición abierta" de un
          acorde alto. Si la ventana no arranca en el 1, no hay cejuela que
          dibujar y en su lugar va el número de traste. */}
      {trasteInicial === 1 && (
        <line
          x1={X_PRIMERA}
          y1={Y_CEJUELA}
          x2={x(5)}
          y2={Y_CEJUELA}
          stroke="var(--color-borde-fuerte)"
          strokeWidth={3}
        />
      )}

      {trasteInicial > 1 && (
        <text
          x={-2}
          y={yTraste(0) + 9}
          textAnchor="end"
          fontSize={9}
          fill="var(--color-texto-tenue)"
        >
          {trasteInicial}
        </text>
      )}

      {/* Cuerdas */}
      {trastes.map((_, i) => (
        <line
          key={`c${i}`}
          x1={x(i)}
          y1={Y_CEJUELA}
          x2={x(i)}
          y2={yTraste(TRASTES)}
          stroke="var(--color-borde-fuerte)"
          strokeWidth={1}
        />
      ))}

      {/* Al aire y mudas, sobre la cejuela */}
      <g className="text-texto-tenue">
        {trastes.map((t, i) =>
          t === null || t === 0 ? <Marca key={`m${i}`} cuerda={i} muda={t === null} /> : null
        )}
      </g>

      {/* La cejilla va ANTES que los puntos: los que caen encima se dibujan sobre ella. */}
      {cejilla && (
        <rect
          x={x(cejilla.desde) - 4}
          y={yTraste(cejilla.traste - trasteInicial) - 4}
          width={x(cejilla.hasta) - x(cejilla.desde) + 8}
          height={8}
          rx={4}
          fill="var(--color-acorde)"
        />
      )}

      {/* Los puntos. `--color-acorde` se usa acá y en la cejilla porque esto ES
          el acorde: el uso exacto que DESIGN.md le reserva. */}
      {trastes.map((t, i) =>
        t !== null && t > 0 ? (
          <circle
            key={`p${i}`}
            cx={x(i)}
            cy={yTraste(t - trasteInicial) + PASO_TRASTE / 2}
            r={4}
            fill="var(--color-acorde)"
          />
        ) : null
      )}
    </svg>
  )
}
