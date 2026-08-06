import type { DigitacionResuelta } from '@/lib/motores/buscar-digitacion'
import DiagramaAcorde from './diagrama-acorde'

/**
 * Una carta de la tira de diagramas: el nombre, el dibujo y las cuerdas escritas.
 *
 * Server Component. El SVG se arma acá y viaja pintado; el navegador no dibuja
 * nada (PRD decisión 4).
 *
 * `x32010` va escrito debajo a propósito: es la notación que un guitarrista lee
 * en voz alta, y sirve cuando el diagrama queda chico o la vista no acompaña.
 */
export default function CartaAcorde({
  nombre,
  digitacion,
}: {
  nombre: string
  digitacion: DigitacionResuelta | null
}) {
  return (
    <div
      className={`flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 ${
        digitacion ? 'border-borde bg-superficie' : 'border-dashed border-borde'
      }`}
    >
      <span className="font-cifrado text-sm leading-none font-bold text-acorde">{nombre}</span>

      {digitacion ? (
        <>
          <DiagramaAcorde digitacion={digitacion} />
          <span className="font-cifrado text-[0.625rem] leading-none text-texto-tenue">
            {digitacion.cuerdas}
          </span>
        </>
      ) : (
        // §14: el acorde sin digitación conocida dice su motivo y el resto de la
        // barra sigue andando. No es un error del motor: es un hueco declarado.
        <span className="flex h-[88px] items-center px-1 text-center text-[0.625rem] leading-snug text-balance text-texto-tenue">
          sin digitación para «{nombre}»
        </span>
      )}
    </div>
  )
}
