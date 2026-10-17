'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TAMANO_MAX, TAMANO_MIN, cambiarTamano } from '@/lib/motores/tamano-letra'
import { guardarTamanoLetra } from '@/app/repertorio/[cantoId]/acciones'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { BotonIcono } from '@/app/componentes/boton-icono'

/**
 * El tamaño de letra, fuera del formulario del perfil (rediseño 2026-10-17).
 *
 * Es otra preferencia y se guarda sola, al tocar: meterla en el formulario de
 * la ficha la ataría a «Guardar mi perfil», y quien ve poco tendría que
 * agrandar, bajar hasta el botón y guardar para recién ver si le sirve.
 *
 * Es de la PERSONA y no del coro (RN-14): por eso la pantalla la muestra
 * aunque no haya coro activo ni permiso para editar la ficha. La action exige
 * `guardar_preferencia_propia` y la RLS lo vuelve a exigir.
 *
 * El patrón es el de `controles.tsx`: `useOptimistic` + `router.refresh()`.
 * Si el guardado falla, el número vuelve solo al valor real del servidor y el
 * error se dice.
 *
 * La vista previa es un verso real del cancionero (PRD §9), con su acorde en
 * ámbar encima: lo que se elige acá es cómo se va a ver el canto, así que se
 * muestra un canto, no un «Aa».
 */
export default function TamanoLetra({ tamanoLetra }: { tamanoLetra: number }) {
  const router = useRouter()
  const [, iniciarTransicion] = useTransition()
  const [optimista, aplicarOptimista] = useOptimistic(tamanoLetra)
  const [error, setError] = useState<string | null>(null)

  function cambiar(direccion: 1 | -1) {
    const nuevo = cambiarTamano(optimista, direccion)
    if (nuevo === optimista) return
    setError(null)
    iniciarTransicion(async () => {
      aplicarOptimista(nuevo)
      const r = await guardarTamanoLetra(nuevo)
      if (!r.ok) setError(r.error)
      router.refresh()
    })
  }

  return (
    <section className="mt-10 border-t border-borde pt-6" aria-labelledby="titulo-tamano">
      <TituloSeccion id="titulo-tamano">Tamaño de letra</TituloSeccion>
      <p className="mt-1 text-sm text-texto-tenue">Vale para todos los cantos y para la misa.</p>

      <div className="mt-4 flex items-center gap-3">
        <BotonIcono
          etiqueta={`Achicar la letra, ahora en ${optimista}`}
          apariencia="borde"
          disabled={optimista <= TAMANO_MIN}
          onClick={() => cambiar(-1)}
        >
          <span className="text-sm font-bold" aria-hidden>
            A
          </span>
        </BotonIcono>
        <span className="w-10 text-center text-base tabular-nums" aria-live="polite">
          {optimista}
        </span>
        <BotonIcono
          etiqueta={`Agrandar la letra, ahora en ${optimista}`}
          apariencia="borde"
          disabled={optimista >= TAMANO_MAX}
          onClick={() => cambiar(1)}
        >
          <span className="text-xl font-bold" aria-hidden>
            A
          </span>
        </BotonIcono>
      </div>

      <div
        className="mt-4 overflow-hidden rounded-lg border border-borde bg-superficie px-4 py-3 font-cifrado leading-snug"
        style={{ fontSize: `${optimista}px` }}
        aria-hidden
      >
        <div className="font-semibold text-acorde">E</div>
        <div className="text-texto">Abre tu jardín,</div>
      </div>

      {error && (
        <p role="status" className="mt-2 text-sm text-peligro">
          {error}
        </p>
      )}
    </section>
  )
}
