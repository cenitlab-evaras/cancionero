import { redirect } from 'next/navigation'

/**
 * «Canciones» ya no es una ruta propia: el 2026-11-19 las dos listas se
 * unificaron en `/repertorio` («Por momento / Todas»). Esta página queda solo
 * para no romper los enlaces viejos: redirige a la vista «Todas» conservando
 * la búsqueda y cada filtro.
 */
export default async function CancionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    momento?: string
    estado?: string
    partitura?: string
    repetidas?: string
    solistas?: string
  }>
}) {
  const sp = await searchParams
  const p = new URLSearchParams()
  p.set('vista', 'todas')
  if (sp.q) p.set('q', sp.q)
  if (sp.momento) p.set('momento', sp.momento)
  if (sp.estado) p.set('estado', sp.estado)
  if (sp.partitura) p.set('partitura', sp.partitura)
  if (sp.repetidas) p.set('repetidas', sp.repetidas)
  if (sp.solistas) p.set('solistas', sp.solistas)
  redirect(`/repertorio?${p.toString()}`)
}
