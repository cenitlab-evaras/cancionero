'use client'

import { fechaLarga } from '@/lib/motores/fecha'
import { IconoRepertorio, IconoSeguir, IconoVolver } from '@/app/componentes/iconos'

/**
 * La grilla del mes — H31, docs/PRD.md §17.
 *
 * Es una isla de cliente solo porque la pantalla de Misas es un Server
 * Component y la grilla es lo único que se repinta con la navegación. No tiene
 * estado ni hace fetch: cada día y cada flecha son enlaces con la fecha en la
 * URL (`?mes=AAAA-MM&dia=AAAA-MM-DD`), y el detalle lo vuelve a renderizar el
 * servidor. Así el botón «atrás» del teléfono recorre los días que se miraron.
 */

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

/** Cabecera de la semana: domingo primero, como el calendario del teléfono. */
const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const

type Marcas = { libro: boolean; punto: boolean }

function tituloDe(anio: number, mes: number): string {
  const nombre = MESES[mes] ?? ''
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`
}

/** `AAAA-MM` de un mes que puede caer en otro año, moviéndose en meses. */
function mesDe(anio: number, mes: number, delta: number): string {
  const total = anio * 12 + mes + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export default function Calendario({
  anio,
  mes,
  seleccionado,
  resumen,
  marcas,
  celebraciones,
}: {
  anio: number
  /** 0-indexado: enero = 0. */
  mes: number
  /** El día abierto abajo, como `AAAA-MM-DD`. */
  seleccionado: string
  /** «3 misas · 2 con lecturas · 5 propuestas». La arma el servidor. */
  resumen: string
  /** Solo los días con misa: los demás no llevan marcas ni fondo. */
  marcas: Record<string, Marcas>
  /** Celebración (o nombre) de cada día con misa, para el nombre accesible. */
  celebraciones: Record<string, string>
}) {
  const titulo = tituloDe(anio, mes)
  const primerDia = new Date(Date.UTC(anio, mes, 1)).getUTCDay()
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const prefijo = mesDe(anio, mes, 0)

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <a
          href={`/misas?mes=${mesDe(anio, mes, -1)}`}
          aria-label="Mes anterior"
          className="tactil inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-texto-tenue transition-colors hover:bg-superficie hover:text-texto"
        >
          <IconoVolver tamano={20} />
        </a>
        <h2 className="titulo-libro text-lg leading-tight">{titulo}</h2>
        <a
          href={`/misas?mes=${mesDe(anio, mes, 1)}`}
          aria-label="Mes siguiente"
          className="tactil inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-texto-tenue transition-colors hover:bg-superficie hover:text-texto"
        >
          <IconoSeguir tamano={20} />
        </a>
      </div>

      <p className="mt-1 text-sm text-texto-tenue">{resumen}</p>

      <div
        role="group"
        aria-label={`Días de ${titulo}`}
        className="mt-3 grid grid-cols-7 gap-0.5"
      >
        {LETRAS.map((letra) => (
          <div
            key={letra}
            aria-hidden
            className="flex h-6 items-center justify-center text-xs text-texto-tenue"
          >
            {letra}
          </div>
        ))}

        {/* Los huecos de la primera semana: el día 1 cae en su columna. */}
        {Array.from({ length: primerDia }, (_, i) => (
          <div key={`hueco-${i}`} aria-hidden />
        ))}

        {Array.from({ length: ultimoDia }, (_, i) => {
          const dia = i + 1
          const clave = `${prefijo}-${String(dia).padStart(2, '0')}`
          const marca = marcas[clave]
          const conMisa = Boolean(marca)
          const celebracion = celebraciones[clave]
          const activo = clave === seleccionado

          // Lo que las marcas dicen con dibujos, dicho con palabras para quien
          // usa lector de pantalla: un punto no se anuncia.
          const detalles = [
            celebracion ?? (conMisa ? 'con misa' : 'sin misa'),
            marca?.libro ? 'con lecturas' : null,
            marca?.punto ? 'con propuestas' : null,
          ].filter(Boolean)

          return (
            <a
              key={clave}
              href={`/misas?mes=${prefijo}&dia=${clave}`}
              aria-label={`${fechaLarga(clave)}, ${detalles.join(', ')}`}
              aria-current={activo ? 'date' : undefined}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg border-2 text-sm transition-colors ${
                conMisa
                  ? 'bg-superficie text-texto hover:bg-superficie-alta'
                  : 'text-texto-tenue hover:bg-superficie'
              } ${activo ? 'border-acento font-semibold' : 'border-transparent'}`}
            >
              <span>{dia}</span>
              {marca && (marca.libro || marca.punto) && (
                <span className="mt-0.5 flex h-3.5 items-center gap-1" aria-hidden>
                  {marca.libro && <IconoRepertorio tamano={13} />}
                  {marca.punto && (
                    <span className="block h-1.5 w-1.5 rounded-full bg-texto-tenue" />
                  )}
                </span>
              )}
            </a>
          )
        })}
      </div>

      {/* Sin esto, el libro y el punto serían dos dibujos sin explicación. */}
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-texto-tenue">
        <span className="inline-flex items-center gap-1">
          <IconoRepertorio tamano={14} aria-hidden />
          lecturas
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="block h-1.5 w-1.5 rounded-full bg-texto-tenue" aria-hidden />
          propuestas
        </span>
      </p>
    </div>
  )
}
