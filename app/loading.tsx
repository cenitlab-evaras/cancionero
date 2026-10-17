/**
 * Lo que se ve mientras el servidor arma la pantalla (rediseño 2026-10-17).
 *
 * Antes no había nada: en una conexión lenta de la parroquia, tocar un destino
 * dejaba la pantalla anterior quieta y parecía que el toque no había entrado.
 * El esqueleto tiene la forma de una lista —un título y filas—, que es lo que
 * son casi todas las pantallas, y sin cabecera: no hay sesión a mano acá.
 *
 * `animate-pulse` se apaga solo con movimiento reducido: `globals.css` anula
 * las animaciones bajo `prefers-reduced-motion: reduce`.
 */
export default function Cargando() {
  return (
    <main
      className="mx-auto w-full max-w-2xl px-4 pt-10 pb-10"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="h-8 w-40 animate-pulse rounded-lg bg-superficie" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-3">
            <div className="h-5 w-7 rounded bg-superficie" />
            <div className="h-11 flex-1 rounded-lg bg-superficie" />
          </div>
        ))}
      </div>
    </main>
  )
}
