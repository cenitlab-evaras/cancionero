'use client'

import { useState } from 'react'
import type { LecturaGuardada } from '@/lib/datos/lecturas'
import { BotonIcono } from '@/app/componentes/boton-icono'
import { IconoRepertorio } from '@/app/componentes/iconos'
import Lector from '../lecturas/lector'

/**
 * La puerta a las lecturas desde la ejecución — H30, Task 7.
 *
 * Es lo mínimo que hacía falta en el cliente: el estado de abierto y el botón.
 * El lector es el MISMO de la misa (`../lecturas/lector`), montado acá con su
 * contrato controlado; no hay un segundo `<dialog>` ni otra copia de las
 * pestañas. Como todo llega por props, abrir y cerrar no toca la ruta: el
 * canto y la posición de la página quedan donde estaban.
 *
 * Sin partes no se dibuja nada: un botón «Lecturas» que abre un vacío no
 * ofrece nada.
 */
export default function PuertaLecturas({
  partes,
  titulo,
  tamanoLetra,
  apariencia = 'borde',
}: {
  /** Solo las partes presentes, en el orden litúrgico en que se leen. */
  partes: LecturaGuardada[]
  /** El título de la cabecera del lector: la misa y su fecha. */
  titulo: string
  /** El tamaño de letra de la persona, en px. */
  tamanoLetra: number
  /**
   * En la barra de la ejecución va `plano`, como sus vecinos: solo el libro,
   * sin borde ni texto visible. El nombre accesible («Lecturas») no cambia.
   */
  apariencia?: 'borde' | 'plano'
}) {
  const [abierto, setAbierto] = useState(false)

  if (partes.length === 0) return null

  return (
    <>
      <BotonIcono
        etiqueta="Lecturas"
        texto={apariencia === 'borde' ? 'Lecturas' : undefined}
        apariencia={apariencia}
        onClick={() => setAbierto(true)}
      >
        <IconoRepertorio tamano={18} />
      </BotonIcono>

      <Lector
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        partes={partes}
        titulo={titulo}
        tamanoLetra={tamanoLetra}
      />
    </>
  )
}
