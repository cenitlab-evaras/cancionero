'use client'

import { useState } from 'react'
import type { LecturaGuardada } from '@/lib/datos/lecturas'
import { NOMBRE_DE_PARTE } from '@/lib/motores/lecturas'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { BotonIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoAgregar, IconoEditar, IconoRepertorio } from '@/app/componentes/iconos'
import Lector, { ROTULO_CORTO } from './lector'
import Editor from './editor'

/**
 * La puerta de las lecturas en la misa — H30.
 *
 * Sección con las referencias y dos puertas: «Leer» (el lector) y «Editar» (el
 * editor, solo para el director). Sin lecturas guardadas, el miembro no ve
 * nada —no hay qué leer ni qué ofrecer—; el director ve «Agregar lecturas».
 */
export default function BloqueLecturas({
  misaId,
  fecha,
  partes,
  esDirector,
  tamanoLetra,
  titulo,
}: {
  misaId: string
  fecha: string | null
  partes: LecturaGuardada[]
  esDirector: boolean
  tamanoLetra: number
  titulo: string
}) {
  const [leyendo, setLeyendo] = useState(false)
  const [editando, setEditando] = useState(false)

  if (partes.length === 0 && !esDirector) return null

  return (
    <section className="mt-10 border-t border-borde pt-6">
      <div className="flex items-center justify-between gap-2">
        <TituloSeccion>Lecturas</TituloSeccion>
        {partes.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5">
            {esDirector && (
              <BotonIcono
                etiqueta="Editar las lecturas"
                apariencia="borde"
                onClick={() => setEditando(true)}
              >
                <IconoEditar tamano={18} />
              </BotonIcono>
            )}
            <BotonIcono
              etiqueta="Leer las lecturas"
              apariencia="lleno"
              texto="Leer"
              onClick={() => setLeyendo(true)}
            >
              <IconoRepertorio tamano={18} />
            </BotonIcono>
          </div>
        )}
      </div>

      {partes.length === 0 ? (
        <>
          <p className="mt-2 text-sm text-texto-tenue">
            Esta misa todavía no tiene lecturas.
          </p>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className={clasesBotonIcono('lleno', 'mt-4 text-base')}
          >
            <IconoAgregar tamano={18} />
            <span>Agregar lecturas</span>
          </button>
        </>
      ) : (
        <ul className="mt-2 divide-y divide-borde border-t border-borde">
          {partes.map((p) => (
            <li key={p.tipo} className="flex min-h-11 items-baseline gap-3 py-1.5">
              <span className="w-14 shrink-0 text-sm font-semibold text-texto-tenue">
                {ROTULO_CORTO[p.tipo]}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {p.referencia !== '' ? p.referencia : NOMBRE_DE_PARTE[p.tipo]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Lector
        abierto={leyendo}
        onCerrar={() => setLeyendo(false)}
        partes={partes}
        titulo={titulo}
        tamanoLetra={tamanoLetra}
      />

      {esDirector && editando && (
        <Editor
          misaId={misaId}
          fecha={fecha}
          partes={partes}
          onCerrar={() => setEditando(false)}
        />
      )}
    </section>
  )
}
