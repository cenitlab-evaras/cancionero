/**
 * Las marcas de un canto en las listas, como íconos y no como palabras (pedido
 * del dueño, 2026-10-17: «en vez de decir Partitura, una P en círculo»; «lo
 * mismo con el ensayo»; «usar íconos»). Un solo dibujo: un círculo de 18 px con
 * el trazo de los íconos de la app, y adentro lo que dice.
 *
 * Cada una lleva su nombre (para quien no ve el dibujo) y su `title` (al pasar
 * el mouse), porque un ícono nuevo no se entiende solo la primera vez.
 */

function Marca({ nombre, className = '', children }: { nombre: string; className?: string; children: React.ReactNode }) {
  return (
    <span role="img" aria-label={nombre} title={nombre} className={`inline-flex shrink-0 ${className}`}>
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
      >
        <circle cx="12" cy="12" r="9.25" />
        {children}
      </svg>
    </span>
  )
}

/** Tiene partitura para ensayar (H23): una P. */
export function MarcaPartitura({ className }: { className?: string }) {
  return (
    <Marca nombre="Tiene partitura" className={className}>
      <path d="M10 16.5v-9h3.25a2.5 2.5 0 0 1 0 5H10" />
    </Marca>
  )
}

/** Todavía en ensayo (H10): el círculo a medio llenar. */
export function MarcaEnsayo({ className }: { className?: string }) {
  return (
    <Marca nombre="En ensayo" className={className}>
      <path d="M12 2.75a9.25 9.25 0 0 0 0 18.5Z" fill="currentColor" stroke="none" />
    </Marca>
  )
}

/** Lista para cantar: solo en «Canciones», donde el estado tiene columna. */
export function MarcaLista({ className }: { className?: string }) {
  return (
    <Marca nombre="Lista" className={className}>
      <path d="m8 12.25 2.75 2.75L16 9.5" />
    </Marca>
  )
}

/** Está cargada más de una vez («Canciones»): dos círculos que se pisan. */
export function MarcaRepetida({ veces, className }: { veces: number; className?: string }) {
  return (
    <Marca nombre={`Repetida: está ${veces} veces`} className={className}>
      <circle cx="10" cy="12" r="3.75" />
      <circle cx="14" cy="12" r="3.75" />
    </Marca>
  )
}

/** Tiene estrofas de solista: un micrófono. */
export function MarcaSolistas({ className }: { className?: string }) {
  return (
    <Marca nombre="Con estrofas de solista" className={className}>
      <rect x="10.25" y="6.25" width="3.5" height="7" rx="1.75" />
      <path d="M8.5 11.5a3.5 3.5 0 0 0 7 0M12 15v2.5" />
    </Marca>
  )
}

/** Se está dejando de cantar (historial): un reloj de arena. */
export function MarcaOlvido({ className }: { className?: string }) {
  return (
    <Marca nombre="Hace mucho que no se canta" className={className}>
      <path d="M8.5 6.75h7M8.5 17.25h7M9.25 6.75c0 3 5.5 3 5.5 5.25s-5.5 2.25-5.5 5.25M14.75 6.75c0 3-5.5 3-5.5 5.25s5.5 2.25 5.5 5.25" />
    </Marca>
  )
}
