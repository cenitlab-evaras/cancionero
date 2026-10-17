import type { ReactNode } from 'react'

/**
 * El único título de sección de la app.
 *
 * Antes había dos —con tracking y línea en el repertorio, sin ellos en las
 * misas— y los dos en MAYÚSCULAS ESPACIADAS, que a 13 px y en tono tenue se
 * leen lento justo para quien ve poco. Ahora es texto normal en peso fuerte,
 * con la cuenta (si la hay) en tenue al lado.
 */
export default function TituloSeccion({
  children,
  detalle,
  id,
  className = '',
}: {
  children: ReactNode
  /** Un dato corto que acompaña: «3 cantos», «hace 2 semanas». */
  detalle?: ReactNode
  id?: string
  className?: string
}) {
  return (
    <h2 id={id} className={`flex items-baseline gap-2 text-[0.9375rem] font-bold text-texto ${className}`}>
      {children}
      {detalle && <span className="text-sm font-normal text-texto-tenue">{detalle}</span>}
    </h2>
  )
}
