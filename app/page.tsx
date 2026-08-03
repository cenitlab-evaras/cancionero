import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { rutaInicial } from '@/lib/permisos'

/**
 * La raíz no dibuja nada: reparte. El destino sale de `rutaInicial()`, que es
 * la única fuente de enrutamiento del producto (PRD §8.3) — así ninguna
 * pantalla decide por su cuenta a dónde mandar a quién.
 */
export default async function Home() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  redirect(rutaInicial(sesion.sujeto))
}
