import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { validarCanto } from '../../lib/motores/validar-canto.ts'

/**
 * Importa cantos ya convertidos a ChordPro, desde un archivo JSON.
 *
 * ES EL HERMANO DE `cancionero.ts`, y la diferencia es de dónde sale el
 * cifrado. Aquel lee un PDF de dos columnas y lo convierte solo, porque conoce
 * ese formato exacto. Este recibe el resultado ya convertido —lo produce el
 * skill `pdf-a-cantoral`, que puede leer formatos que el parser determinista
 * no— y se limita a validarlo y ponerlo.
 *
 * POR QUÉ NO ESTÁ EN LA APP: convertir un PDF cualquiera pide criterio, y §16
 * veta la IA dentro del producto —«ni carpeta, ni cliente de modelo, ni clave
 * en el ejemplo de entorno»—. El criterio lo pone quien corre el skill, fuera
 * del producto; la app solo recibe texto ChordPro, como siempre.
 *
 * Y EL PDF NO PASA POR ACÁ. Ni se sube, ni se guarda, ni entra al repositorio:
 * son obras de terceros (§18-1) y este repo es público. Lo que viaja es el
 * cifrado ya convertido.
 *
 * POR DEFECTO NO ESCRIBE NADA. Sin `--aplicar` sólo informa qué haría, que es
 * lo que uno quiere mirar antes de meter cantos en una base con datos.
 *
 * NUNCA PISA UN CANTO EXISTENTE, igual que H16: si el título ya está, se salta
 * y se dice. Los curados a mano tienen la columna de cada acorde ajustada, y
 * nada automático la mejora.
 *
 *   npm run importar:archivo -- <archivo.json> [--aplicar]
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SECRETO = process.env.SUPABASE_SECRET_KEY!
const CORO = 'Coro San José de la Familia'

const args = process.argv.slice(2)
const aplicar = args.includes('--aplicar')
const archivo = args.find((a) => !a.startsWith('--'))

if (!URL || !SECRETO) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.')
if (!archivo) throw new Error('Falta el archivo: npm run importar:archivo -- cantos.json')

const db = createClient(URL, SECRETO, { auth: { persistSession: false } })

/** Lo que produce el skill. Todo opcional salvo lo que un canto necesita para existir. */
type CantoDeArchivo = {
  titulo: string
  cifrado: string
  momento: string
  autor?: string | null
  tonalidadOriginal?: string | null
  fuenteTitulo?: string | null
  fuenteNumero?: number | null
  fuentePagina?: number | null
  /** Lo que el skill no pudo resolver y hay que mirar a ojo. Se informa, no se calla. */
  revisar?: string | null
}

/** La tonalidad que se declara: el primer acorde del canto, si no vino declarada. */
function primerAcorde(cifrado: string): string | null {
  return /\[([A-G][^\]]*)\]/.exec(cifrado)?.[1] ?? null
}

async function main() {
  const crudo: unknown = JSON.parse(readFileSync(archivo!, 'utf8'))
  const cantos = (Array.isArray(crudo) ? crudo : []) as CantoDeArchivo[]
  if (cantos.length === 0) throw new Error(`${archivo} no trae ningún canto (se esperaba un array).`)

  console.log(`${archivo}: ${cantos.length} cantos.\n`)

  const { data: coro } = await db.from('coros').select('id').eq('nombre', CORO).maybeSingle()
  if (!coro) throw new Error(`No existe el coro «${CORO}».`)

  const { data: momentos } = await db.from('momentos_liturgicos').select('id, codigo, nombre')
  const idDeMomento = new Map((momentos ?? []).map((m) => [m.codigo, m.id]))

  const { data: existentes } = await db.from('cantos').select('titulo').eq('coro_id', coro.id)
  const yaEstan = new Set((existentes ?? []).map((c) => c.titulo.toLocaleLowerCase('es')))

  const nuevos: CantoDeArchivo[] = []
  const saltados: string[] = []
  const rotos: string[] = []

  for (const c of cantos) {
    if (!c.titulo || yaEstan.has(c.titulo.toLocaleLowerCase('es'))) {
      saltados.push(c.titulo ?? '(sin título)')
      continue
    }
    // El MISMO motor que valida el formulario del director (RN-01): un canto
    // que entra por acá no puede ser peor que uno cargado a mano.
    const v = validarCanto({ titulo: c.titulo, cifrado: c.cifrado })
    if (!v.ok) {
      rotos.push(`${c.titulo} — ${Object.values(v.errores)[0]}`)
      continue
    }
    if (!idDeMomento.has(c.momento)) {
      rotos.push(`${c.titulo} — momento desconocido: «${c.momento}»`)
      continue
    }
    if (!/\[[A-G]/.test(c.cifrado)) {
      rotos.push(`${c.titulo} — no tiene ningún acorde en ChordPro`)
      continue
    }
    nuevos.push(c)
  }

  console.log(`A importar: ${nuevos.length}`)
  console.log(`Ya existen (NO se tocan): ${saltados.length}`)
  saltados.forEach((s) => console.log(`   · ${s}`))
  console.log(`Se omiten por problema: ${rotos.length}`)
  rotos.forEach((s) => console.log(`   ✗ ${s}`))

  const dudosos = nuevos.filter((c) => c.revisar)
  if (dudosos.length) {
    console.log(`\nMarcados para revisar: ${dudosos.length}`)
    dudosos.forEach((c) => console.log(`   ? ${c.titulo} — ${c.revisar}`))
  }

  if (!aplicar) {
    console.log('\n(prueba en seco: no se escribió nada — usa --aplicar para importar)')
    return
  }

  let puestos = 0
  for (const c of nuevos) {
    let autorId: string | null = null
    if (c.autor) {
      const { data: existe } = await db
        .from('autores')
        .select('id')
        .eq('nombre', c.autor)
        .maybeSingle()
      if (existe) autorId = existe.id
      else {
        const { data } = await db.from('autores').insert({ nombre: c.autor }).select('id').single()
        autorId = data?.id ?? null
      }
    }

    const { data: fila, error } = await db
      .from('cantos')
      .insert({
        coro_id: coro.id,
        titulo: c.titulo,
        cifrado: c.cifrado,
        autor_id: autorId,
        tonalidad_original: c.tonalidadOriginal ?? primerAcorde(c.cifrado),
        fuente_titulo: c.fuenteTitulo ?? null,
        fuente_numero: c.fuenteNumero ?? null,
        fuente_pagina: c.fuentePagina ?? null,
        // Un canto recién importado NO está listo: nadie del coro lo cantó ni
        // revisó sus acordes. `en_ensayo` es exactamente lo que es, y H10 existe
        // para poder decirlo.
        estado: 'en_ensayo',
      })
      .select('id')
      .single()

    if (error) {
      console.log(`   ✗ ${c.titulo}: ${error.message}`)
      continue
    }
    await db.from('canto_momentos').upsert(
      { canto_id: fila.id, momento_id: idDeMomento.get(c.momento)!, coro_id: coro.id },
      { onConflict: 'canto_id,momento_id' }
    )
    puestos++
  }
  console.log(`\n✓ ${puestos} cantos importados en ${CORO}, todos EN ENSAYO.`)
  console.log('  Nadie los revisó todavía: el director los pasa a «listo» cuando los mire.')
}

main().catch((e) => {
  console.error('✗ La importación falló:', e.message ?? e)
  process.exit(1)
})
