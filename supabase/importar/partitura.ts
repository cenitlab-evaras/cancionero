import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

/**
 * H23 · La semilla del ensayo: sube a Storage lo que el motor local ya generó
 * para un canto que YA EXISTE en el repertorio (PRD §21.9).
 *
 * El script no inventa cantos. Si *El Señor es mi fortaleza* no está en el
 * repertorio del coro, el director lo crea con H8 y este script recibe su id.
 *
 * Lee de una carpeta FUERA del repo (`pruebas/<canto>/`, §18-25: ninguna
 * partitura ni pista se versiona):
 *   partitura.musicxml          la fuente; su SHA-256 es la huella
 *   partitura-datos.js          la partitura dibujada y su sincronía (sincronia.py)
 *   voces/{cuerda}.mp3          las pistas en «Voces»
 *   voces/{sonido}/{cuerda}.mp3 las pistas en los otros cuatro sonidos
 *
 * Y escribe, bajo `partituras/{coro}/{canto}/{huella}/`:
 *   fuente.musicxml · partitura.json · manifiesto.json · pistas/{sonido}/{cuerda}.mp3
 * más la fila `partitura`, PUBLICADA: es la semilla verificada por el dueño.
 *
 * POR DEFECTO NO ESCRIBE NADA. Sin `--aplicar` solo informa qué haría.
 *
 *   npm run importar:partitura -- --canto <uuid> --carpeta ../pruebas/el-senor-es-mi-fortaleza [--aplicar]
 *
 * Usa la clave secreta (salta la RLS): es un script de semilla, nunca una ruta.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SECRETO = process.env.SUPABASE_SECRET_KEY!
if (!URL || !SECRETO) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.')

const args = process.argv.slice(2)
const aplicar = args.includes('--aplicar')
const valor = (nombre: string) => {
  const i = args.indexOf(nombre)
  return i >= 0 ? args[i + 1] : undefined
}
const cantoId = valor('--canto')
const carpeta = valor('--carpeta')
if (!cantoId || !carpeta) {
  console.error('Uso: --canto <uuid> --carpeta <carpeta del canto> [--aplicar]')
  process.exit(1)
}

const SONIDOS = ['voces', 'piano', 'organo', 'guitarra', 'flauta'] as const

/**
 * Nombre de parte → cuerda, estricto. Es la semilla: las siete partes ya tienen
 * nombre de cuerda. El `proponerCuerdas` de verdad (más alias, y nunca adivina)
 * es del conversor, en H25.
 */
function cuerdaDeParte(nombre: string): string | null {
  const n = nombre.trim().toLowerCase()
  const directas: Record<string, string> = {
    soprano: 'soprano',
    contralto: 'contralto',
    alto: 'contralto',
    tenor: 'tenor',
    bajo: 'bajo',
    bass: 'bajo',
  }
  if (directas[n]) return directas[n]
  // Dividida: «Contralto 1», «Tenor 2» (Cantaré por siempre tiene seis pentagramas).
  const dividida = /^(soprano|contralto|alto|tenor|bajo|bass)\s+([12])$/.exec(n)
  if (dividida) return `${directas[dividida[1]]}-${dividida[2]}`
  const solista = /^solista\s+([1-9]\d*)$/.exec(n)
  return solista ? `solista-${solista[1]}` : null
}

function leerPartes(xml: string): { id: string; nombre: string }[] {
  const partes: { id: string; nombre: string }[] = []
  const re = /<score-part id="([^"]+)"[\s\S]*?<part-name>([^<]*)<\/part-name>/g
  for (let m = re.exec(xml); m; m = re.exec(xml)) partes.push({ id: m[1], nombre: m[2] })
  return partes
}

async function main() {
  const dir = resolve(carpeta!)
  const rutaFuente = join(dir, 'partitura.musicxml')
  const rutaDatos = join(dir, 'partitura-datos.js')
  for (const r of [rutaFuente, rutaDatos]) {
    if (!existsSync(r)) throw new Error(`No está ${r}`)
  }

  const fuente = readFileSync(rutaFuente)
  const huella = createHash('sha256').update(fuente).digest('hex')
  const xml = fuente.toString('utf8')

  // Las cuerdas, en el orden de las partes: es el orden de los pentagramas, y
  // la sincronía nombra cada nota por su pentagrama (`s`).
  const partes = leerPartes(xml)
  const cuerdas: Record<string, string> = {}
  const pentagramas: string[] = []
  for (const p of partes) {
    const c = cuerdaDeParte(p.nombre)
    if (!c) throw new Error(`La parte «${p.nombre}» no tiene una cuerda reconocible.`)
    cuerdas[p.nombre] = c
    pentagramas.push(c)
  }

  const tempoXml = /<sound[^>]*\btempo="([\d.]+)"/.exec(xml)
  const tempo = tempoXml ? Math.round(Number(tempoXml[1])) : 60
  if (!tempoXml) console.warn('⚠ La partitura no trae tempo: se asume ♩ = 60.')

  // H28 · Las armaduras del canto (puede modular) y si está en menor: con eso
  // «Ensayar» cruza el tono del cifrado con el de la partitura y elige cómo
  // escribir la transposición, sin bajar la fuente para averiguarlo.
  const armaduras = [...new Set([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))]
  const menor = /<key>[\s\S]*?<\/key>/.exec(xml)?.[0].includes('<mode>minor</mode>') ?? false

  // partitura-datos.js es `window.PARTITURA = {...};`: se queda con el objeto.
  const js = readFileSync(rutaDatos, 'utf8')
  const sincronia = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1))
  // La sincronía cuenta los pentagramas dentro de cada página; con varios sistemas
  // por página van más allá de las partes, pero siempre de a sistemas completos.
  const masAlto = Math.max(...sincronia.elementos.map((e: { s: number }) => e.s))
  if ((masAlto + 1) % pentagramas.length !== 0 && masAlto >= pentagramas.length) {
    throw new Error('La sincronía no calza con las partes de la partitura (¿un sistema sin todos sus pentagramas?).')
  }

  const pistas: { sonido: string; cuerda: string; ruta: string }[] = []
  for (const sonido of SONIDOS) {
    for (const cuerda of pentagramas) {
      const ruta = sonido === 'voces' ? join(dir, 'voces', `${cuerda}.mp3`) : join(dir, 'voces', sonido, `${cuerda}.mp3`)
      if (!existsSync(ruta)) throw new Error(`Falta la pista ${ruta}`)
      pistas.push({ sonido, cuerda, ruta })
    }
  }

  const db = createClient(URL, SECRETO, { auth: { persistSession: false } })

  const { data: canto, error: errorCanto } = await db
    .from('cantos')
    .select('id, titulo, coro_id, coros(nombre)')
    .eq('id', cantoId!)
    .maybeSingle()
  if (errorCanto) throw errorCanto
  if (!canto) throw new Error(`No existe el canto ${cantoId}. El script no inventa cantos: créalo con «Nuevo canto».`)

  const { data: publicada } = await db
    .from('partitura')
    .select('id, huella')
    .eq('canto_id', canto.id)
    .eq('estado', 'publicada')
    .maybeSingle()
  if (publicada && publicada.huella !== huella) {
    throw new Error('Ese canto ya tiene otra partitura publicada. Reemplazarla es de H25.')
  }

  const base = `${canto.coro_id}/${canto.id}/${huella}`
  const manifiesto = {
    version: 1,
    huella,
    tempo,
    duracionMs: sincronia.fin,
    pentagramas,
    // La primera es la del comienzo: la que cuenta como «tonalidad de la partitura».
    armaduras,
    menor,
    sonidos: SONIDOS,
    pistas: 'pistas/{sonido}/{cuerda}.mp3',
  }

  const peso = pistas.reduce((n, p) => n + readFileSync(p.ruta).length, 0) + fuente.length + js.length
  const coro = canto.coros as unknown as { nombre: string } | null
  console.log(`Canto: ${canto.titulo} (${coro?.nombre ?? canto.coro_id})`)
  console.log(`Huella: ${huella}`)
  console.log(`Cuerdas: ${pentagramas.join(', ')} · ♩ = ${tempo} · ${(sincronia.fin / 1000).toFixed(1)} s`)
  console.log(`Archivos: ${pistas.length} pistas + fuente + partitura + manifiesto · ${(peso / 1e6).toFixed(1)} MB`)
  console.log(`Destino: partituras/${base}/`)
  console.log(publicada ? 'La fila publicada ya existe con esta huella: solo se vuelven a subir los archivos.' : 'Se crea la fila `partitura`, publicada.')

  if (!aplicar) {
    console.log('\nEn seco: no se escribió nada. Repite con --aplicar para subirlo.')
    return
  }

  const subir = async (ruta: string, cuerpo: Buffer | string, tipo: string) => {
    const { error } = await db.storage.from('partituras').upload(`${base}/${ruta}`, cuerpo, {
      contentType: tipo,
      upsert: true,
    })
    if (error) throw new Error(`No se pudo subir ${ruta}: ${error.message}`)
  }

  await subir('fuente.musicxml', fuente, 'application/vnd.recordare.musicxml+xml')
  await subir('partitura.json', JSON.stringify(sincronia), 'application/json')
  for (const p of pistas) {
    await subir(`pistas/${p.sonido}/${p.cuerda}.mp3`, readFileSync(p.ruta), 'audio/mpeg')
    process.stdout.write('.')
  }
  // El manifiesto va al final: si algo falló antes, no queda uno que prometa
  // archivos que no están.
  await subir('manifiesto.json', JSON.stringify(manifiesto, null, 2), 'application/json')
  console.log(' subidos.')

  if (!publicada) {
    const { error } = await db.from('partitura').insert({
      canto_id: canto.id,
      coro_id: canto.coro_id,
      estado: 'publicada',
      origen: 'musicxml',
      huella,
      ruta_fuente: `${base}/fuente.musicxml`,
      cuerdas,
      publicada_at: new Date().toISOString(),
    })
    if (error) throw error
  }
  console.log('✓ Partitura publicada.')
}

main().catch((e) => {
  console.error('✗', e instanceof Error ? e.message : e)
  process.exit(1)
})
