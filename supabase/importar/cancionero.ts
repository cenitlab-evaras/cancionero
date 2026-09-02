import { createClient } from '@supabase/supabase-js'
import { leerCancionero, type CantoDelCancionero } from './leer-cancionero.ts'

/**
 * Carga el cancionero impreso en el repertorio del coro — H16.
 *
 * SEPARADO DE LA SEMILLA A PROPÓSITO: esto es repertorio real, no datos de
 * prueba. `npm run db:reset` se lleva la semilla; esto no debe irse con ella.
 *
 * POR DEFECTO NO ESCRIBE NADA. Sin `--aplicar` sólo informa qué haría, que es
 * lo que uno quiere mirar antes de meter noventa cantos en una base con datos.
 *
 * NUNCA PISA UN CANTO EXISTENTE. Los trece sembrados tienen la columna de cada
 * acorde ajustada a mano (`cantos.ts`); lo que sale de acá los pone al inicio
 * de palabra, que es más pobre. Si el título ya está, se salta y se dice.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SECRETO = process.env.SUPABASE_SECRET_KEY!
const PDF = '../docs/cancioneros catolicos/Cancionero Catolico.pdf'
const FUENTE = 'Cancionero Misionero — Coro Misión País 2025'
const CORO = 'San José de la Familia'

const aplicar = process.argv.includes('--aplicar')

if (!URL || !SECRETO) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.')
}

const db = createClient(URL, SECRETO, { auth: { persistSession: false } })

/** La tonalidad que se declara: el primer acorde del canto. */
function primerAcorde(cifrado: string): string | null {
  return /\[([A-G][^\]]*)\]/.exec(cifrado)?.[1] ?? null
}

async function main() {
  const { cantos } = leerCancionero(PDF)
  console.log(`Cancionero leído: ${cantos.length} cantos.\n`)

  const { data: coro } = await db.from('coros').select('id').eq('nombre', CORO).maybeSingle()
  if (!coro) throw new Error(`No existe el coro «${CORO}».`)

  const { data: momentos } = await db.from('momentos_liturgicos').select('id, codigo')
  const idDeMomento = new Map((momentos ?? []).map((m) => [m.codigo, m.id]))

  const { data: existentes } = await db.from('cantos').select('titulo').eq('coro_id', coro.id)
  const yaEstan = new Set((existentes ?? []).map((c) => c.titulo.toLocaleLowerCase('es')))

  const nuevos: CantoDelCancionero[] = []
  const saltados: string[] = []
  const rotos: string[] = []

  for (const c of cantos) {
    if (yaEstan.has(c.titulo.toLocaleLowerCase('es'))) {
      saltados.push(`${c.numero}. ${c.titulo}`)
      continue
    }
    if (!/\[[A-G]/.test(c.cifrado) || !c.momento || !idDeMomento.has(c.momento)) {
      rotos.push(`${c.numero}. ${c.titulo} — ${c.problema ?? 'sin momento válido'}`)
      continue
    }
    nuevos.push(c)
  }

  console.log(`A importar: ${nuevos.length}`)
  console.log(`Ya existen (NO se tocan): ${saltados.length}`)
  saltados.forEach((s) => console.log(`   · ${s}`))
  console.log(`Se omiten por problema: ${rotos.length}`)
  rotos.forEach((s) => console.log(`   ✗ ${s}`))

  const dudosos = nuevos.filter((c) => c.problema)
  if (dudosos.length) {
    console.log(`\nCon momento estimado (revisar): ${dudosos.length}`)
    dudosos.forEach((c) => console.log(`   ? ${c.numero}. ${c.titulo} — ${c.problema}`))
  }

  if (!aplicar) {
    console.log('\n(prueba en seco: no se escribió nada — usa --aplicar para importar)')
    return
  }

  let puestos = 0
  for (const c of nuevos) {
    const { data: fila, error } = await db
      .from('cantos')
      .insert({
        coro_id: coro.id,
        titulo: c.titulo,
        cifrado: c.cifrado,
        tonalidad_original: primerAcorde(c.cifrado),
        fuente_titulo: FUENTE,
        fuente_numero: c.numero,
        fuente_pagina: c.pagina,
        estado: 'listo',
      })
      .select('id')
      .single()

    if (error) {
      console.log(`   ✗ ${c.numero}. ${c.titulo}: ${error.message}`)
      continue
    }
    await db.from('canto_momentos').upsert(
      { canto_id: fila.id, momento_id: idDeMomento.get(c.momento!)!, coro_id: coro.id },
      { onConflict: 'canto_id,momento_id' }
    )
    puestos++
  }
  console.log(`\n✓ ${puestos} cantos importados en ${CORO}.`)
}

main().catch((e) => {
  console.error('✗ La importación falló:', e.message ?? e)
  process.exit(1)
})
