'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoDesplegar } from '@/app/componentes/iconos'

/**
 * Los controles de la lectura, pedidos (maqueta «Teleprompter», 2026-11-18).
 *
 * La pantalla es de la letra. Abajo queda una fila-manija de 44 px con el tono
 * y el tamaño (2026-11-20), para que transponer se descubra sin abrir nada; el
 * panel se abre con esa fila, tocando un BORDE de la pantalla o el botón de
 * arriba a la derecha, y se cierra tocando afuera, con Esc, o con el mismo
 * botón.
 *
 * En el lector de una tarea (H31) el Aa subió a la barra fija de cuatro
 * acciones y el botón de arriba a la derecha chocaría con su barra de íconos:
 * esa pantalla pasa `mostrarTamano={false}` y `sinBotonSuperior`. La manija y
 * los bordes siguen abriendo el panel, que es donde vive la transposición.
 *
 * NO se desmonta: el auto scroll vive adentro de `Controles`, y esconder la
 * barra no puede detener la letra que avanza sola. Cerrado se colapsa con
 * `transform` y una reja de 0fr —sin alto reservado— y queda `inert`, así el
 * teclado y el lector de pantalla no caen en controles que no se ven.
 */
export default function PanelLectura({
  children,
  tono,
  tamano,
  mostrarTono = true,
  mostrarTamano = true,
  sinBotonSuperior = false,
}: {
  children: ReactNode
  /** El tono actual, ya nombrado; `null` = sin tonalidad. */
  tono: string | null
  /** El tamaño de letra vigente. */
  tamano: number
  /** H11 · Con los acordes apagados el tono no cambia la pantalla: no se muestra. */
  mostrarTono?: boolean
  /** H31 · En la ejecución el Aa vive en la barra fija: la manija no lo repite. */
  mostrarTamano?: boolean
  /** H31 · La barra de arriba del lector ocupa la esquina: se retira el botón. */
  sinBotonSuperior?: boolean
}) {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      // Los botones del cifrado no cuentan como «afuera»: abren los diagramas.
      // Los que abren/cierran el panel tampoco: el pointerdown los cerraría y el
      // click volvería a abrirlo (el botón de arriba no cerraba, D1).
      if ((e.target as HTMLElement).closest('[data-panel-lectura], [data-acorde], [data-panel-toggle]')) return
      setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  return (
    <>
      {/* El botón de arriba: el camino con teclado y lector de pantalla. */}
      {!sinBotonSuperior && (
        <button
          type="button"
          data-panel-toggle
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          aria-controls="panel-controles-lectura"
          aria-label={abierto ? 'Ocultar los controles del canto' : 'Mostrar los controles del canto'}
          className={`fixed top-1 right-2 z-(--z-cabecera) ${clasesBotonIcono(abierto ? 'activo' : 'plano')}`}
        >
          <IconoDesplegar />
        </button>
      )}

      {/* Los bordes: el gesto del pulgar. Invisibles salvo su hebra. */}
      {!abierto && (
        <>
          <button
            type="button"
            aria-label="Mostrar los controles del canto"
            onClick={() => setAbierto(true)}
            className="fixed top-16 bottom-16 left-0 z-(--z-cabecera) w-4"
          >
            <span
              aria-hidden
              className="absolute top-1/2 left-1 h-12 w-[3px] -translate-y-1/2 rounded bg-superficie-alta"
            />
          </button>
          <button
            type="button"
            aria-label="Mostrar los controles del canto"
            onClick={() => setAbierto(true)}
            className="fixed top-16 right-0 bottom-16 z-(--z-cabecera) w-4"
          >
            <span
              aria-hidden
              className="absolute top-1/2 right-1 h-12 w-[3px] -translate-y-1/2 rounded bg-superficie-alta"
            />
          </button>
        </>
      )}

      {/* El panel cerrado NO reserva su altura: sin esto quedaba una franja
          vacía entre el pie y la fila, y la letra se veía pasar por debajo de
          «Siguiente». La reja anima de 0fr a 1fr; el translate de adentro hace
          el deslizamiento. */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id="panel-controles-lectura"
            data-panel-lectura
            aria-hidden={!abierto}
            // `inert` en React se pasa como booleano; sin él, tab entra a lo oculto.
            inert={!abierto}
            className={`border-t border-borde bg-fondo transition-transform duration-200 ease-out motion-reduce:transition-none ${
              abierto ? '' : 'pointer-events-none translate-y-full'
            }`}
          >
            {children}
          </div>
        </div>
      </div>

      {/* La manija del panel, siempre visible: el tono y el tamaño a la vista,
          y el gesto que abre los controles. Es la fila que hace descubrible la
          transposición sin devolver la barra fija que el teleprompter quitó. */}
      <div className="relative z-10 border-t border-borde bg-fondo pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          data-panel-toggle
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          aria-controls="panel-controles-lectura"
          aria-label={`${abierto ? 'Ocultar' : 'Mostrar'} los controles del canto. ${
            mostrarTono && tono ? `Tono ${tono}. ` : ''
          }${mostrarTamano ? `Letra ${tamano}.` : ''}`}
          className="tactil flex min-h-11 w-full items-center gap-3 px-4 text-left text-texto"
        >
          {mostrarTono && (
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm text-texto-tenue">Tono</span>
              <span className="font-cifrado text-base font-bold text-acorde">{tono ?? '—'}</span>
            </span>
          )}
          {mostrarTamano && (
            <span className="flex items-baseline gap-1.5 text-sm text-texto-tenue">
              <span aria-hidden className="font-bold">
                Aa
              </span>
              <span className="tabular-nums">{tamano}</span>
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-sm text-texto-tenue">
            <span>{abierto ? 'Ocultar' : 'Controles'}</span>
            <IconoDesplegar
              className={`transition-transform duration-150 motion-reduce:transition-none ${
                abierto ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>
      </div>
    </>
  )
}

/** Un enlace con ícono para la fila de herramientas del panel. */
export function HerramientaDelPanel({
  href,
  etiqueta,
  children,
}: {
  href: string
  etiqueta: string
  children: ReactNode
}) {
  return (
    <EnlaceIcono href={href} etiqueta={etiqueta}>
      {children}
    </EnlaceIcono>
  )
}
