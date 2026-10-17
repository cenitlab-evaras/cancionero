// H28 · Copia a public/vendor/ lo que el navegador carga aparte, solo al cambiar
// de tono en «Ensayar»: Verovio (7 MB, el wasm va adentro) y el procesador de
// SoundTouch (un AudioWorklet se carga por URL, no se empaqueta). Corre antes de
// `dev` y de `build`, así la versión es siempre la de package-lock.json y no se
// versiona una copia.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const destino = join(import.meta.dirname, '..', 'public', 'vendor')
mkdirSync(destino, { recursive: true })

const archivos = {
  'verovio-module.mjs': require.resolve('verovio/wasm'),
  // El envoltorio (14 KB) va junto: no trae tipos, y así se carga igual que el módulo.
  // (`require.resolve('verovio/esm')` daría la versión CommonJS: se toma la .mjs de al lado).
  'verovio-toolkit.mjs': join(dirname(require.resolve('verovio/wasm')), 'verovio.mjs'),
  'soundtouch-processor.js': require.resolve('@soundtouchjs/audio-worklet/processor'),
}
for (const [nombre, origen] of Object.entries(archivos)) copyFileSync(origen, join(destino, nombre))
console.log('vendor:', Object.keys(archivos).join(', '))
