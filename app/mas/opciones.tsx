'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { coincideOpcion } from '@/lib/motores/busqueda'
import TituloConLupa from '@/app/componentes/titulo-con-lupa'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { IconoSeguir } from '@/app/componentes/iconos'

export type Fila = {
  href: string
  texto: string
  detalle?: string
  /** Con qué otras palabras alguien la buscaría (no se muestran). */
  claves?: string[]
  icono: ReactNode
}

export type Grupo = { titulo: string; filas: Fila[] }

/**
 * El título de «Más» con su lupa y las filas que filtra (el dueño, 2026-10-17:
 * acá no se busca una canción sino una opción de esta sección). Filtra en el
 * teléfono, sin ir al servidor: son una docena de filas que ya están en la
 * página, y la matriz de permisos ya decidió cuáles venían.
 *
 * «Salir» viene aparte (`salir`) porque es un formulario, no un enlace: va
 * al final de `grupoDeSalir`, sin búsqueda o cuando la búsqueda lo nombra.
 */
export default function Opciones({
  grupos,
  salir,
  grupoDeSalir,
  arriba,
}: {
  grupos: Grupo[]
  salir: ReactNode
  grupoDeSalir: string
  /** Lo que va bajo el título (el correo de la cuenta). */
  arriba?: ReactNode
}) {
  const [termino, setTermino] = useState('')
  const buscando = termino.trim() !== ''

  const conSalir = coincideOpcion({ texto: 'Salir', claves: ['cerrar sesión', 'cuenta'] }, termino)
  const filtrados = grupos
    .map((g) => ({ ...g, filas: g.filas.filter((f) => coincideOpcion(f, termino)) }))
    .filter((g) => g.filas.length > 0 || (conSalir && g.titulo === grupoDeSalir))

  return (
    <>
      <TituloConLupa
        titulo="Más"
        valor={termino}
        alCambiar={setTermino}
        etiqueta="Buscar una opción en Más"
        muestra="Herramientas, miembros…"
      />
      {arriba}

      {filtrados.map((g) => (
        <section key={g.titulo} className="mt-8">
          <TituloSeccion>{g.titulo}</TituloSeccion>
          <ul className="mt-2">
            {g.filas.map((f) => (
              <FilaMas key={f.href} fila={f} />
            ))}
            {conSalir && g.titulo === grupoDeSalir && <li>{salir}</li>}
          </ul>
        </section>
      ))}

      {buscando && filtrados.length === 0 && (
        <p className="py-10 text-texto-tenue">Nada en «Más» coincide con «{termino.trim()}».</p>
      )}
    </>
  )
}

function FilaMas({ fila }: { fila: Fila }) {
  return (
    <li>
      <Link
        href={fila.href}
        className="tactil flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-superficie"
      >
        <span className="text-texto-tenue">{fila.icono}</span>
        <span className="min-w-0 flex-1">
          <span className="block">{fila.texto}</span>
          {fila.detalle && (
            <span className="block truncate text-sm text-texto-tenue">{fila.detalle}</span>
          )}
        </span>
        <IconoSeguir tamano={18} className="shrink-0 text-texto-tenue" />
      </Link>
    </li>
  )
}
