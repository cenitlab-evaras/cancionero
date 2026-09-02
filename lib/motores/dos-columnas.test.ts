import { describe, expect, test } from 'vitest'
import {
  aAcordesSobreLetra,
  detectarColumnaDeAcordes,
  detectarCorteDeColumnas,
  esColumnaDeAcordes,
  leerIndice,
  normalizarTitulo,
  repartirSobreLetra,
  tituloDeCanto,
} from './dos-columnas'
import { desdeElCancionero } from './acordes-sobre-letra'

/**
 * H16 · el cancionero impreso viene a dos columnas.
 *
 * Los casos salen de mirar el PDF real (`Cancionero Catolico.pdf`, 91 cantos):
 * estribillos sin acordes repetidos, acordes con bajo (`RE/LA`), acordes entre
 * paréntesis (`(lam7)`), y páginas que no son cantos —índice, fotos— que no
 * deben colarse como repertorio fantasma.
 */

describe('esColumnaDeAcordes', () => {
  test('acepta una línea de acordes latinos', () => {
    expect(esColumnaDeAcordes('MI fa#m')).toBe(true)
    expect(esColumnaDeAcordes('sol#m fa#m SI (SI7)')).toBe(true)
    expect(esColumnaDeAcordes('LA SI MI LA MI')).toBe(true)
  })

  test('acepta acorde con bajo y con paréntesis, que la fuente usa', () => {
    expect(esColumnaDeAcordes('RE/LA LA9')).toBe(true)
    expect(esColumnaDeAcordes('(lam7) RE SOL')).toBe(true)
  })

  test('rechaza la LETRA, que es el riesgo real', () => {
    // «la» y «mi» son palabras comunes en español: sin exigir que TODOS los
    // tokens sean acordes, media letra pasaría por cifrado.
    expect(esColumnaDeAcordes('la sangre y la flor')).toBe(false)
    expect(esColumnaDeAcordes('ven, levántate.')).toBe(false)
    expect(esColumnaDeAcordes('Abre tu jardín,')).toBe(false)
  })

  test('rechaza el vacío', () => {
    expect(esColumnaDeAcordes('')).toBe(false)
    expect(esColumnaDeAcordes('   ')).toBe(false)
  })
})

describe('detectarColumnaDeAcordes', () => {
  test('encuentra la columna donde empieza el bloque de acordes', () => {
    const lineas = [
      'Abre tu jardín,        MI fa#m',
      'traigo una noticia;    sol#m fa#m',
    ]
    expect(detectarColumnaDeAcordes(lineas)).toBe(23)
  })

  test('gana la columna más frecuente, no la primera', () => {
    // Una línea de letra larga corre su bloque; fijarse en ella partiría mal
    // todas las demás.
    const lineas = [
      'corta                  MI',
      'otra corta             LA',
      'una línea de letra muchísimo más larga que las otras   SOL',
    ]
    expect(detectarColumnaDeAcordes(lineas)).toBe(23)
  })

  test('devuelve null si la página no tiene acordes', () => {
    expect(detectarColumnaDeAcordes(['Índice', '1. Abre tu jardín......'])).toBeNull()
  })
})

describe('aAcordesSobreLetra', () => {
  test('convierte el canto 1 del cancionero tal como sale del PDF', () => {
    const pagina = [
      'Abre tu jardín,                                  MI fa#m',
      'traigo una nueva noticia;                        sol#m fa#m SI (SI7)',
      'ven, levántate.                                  LA SI MI LA MI',
    ].join('\n')

    const r = aAcordesSobreLetra(pagina).split('\n')

    // Los acordes caen sobre INICIOS DE PALABRA, repartidos: por eso hay
    // relleno entre ellos y no van amontonados.
    expect(r[1]).toBe('Abre tu jardín,')
    expect(r[0].trimEnd()).toMatch(/^MI\s+fa#m$/)
    expect(r[0].indexOf('fa#m')).toBe('Abre '.length) // arranca en «tu»
    expect(r[3]).toBe('traigo una nueva noticia;')
    expect(r[5]).toBe('ven, levántate.')
  })

  test('una estrofa sin acordes pasa sola: el cancionero no los repite', () => {
    const pagina = [
      'Vamos por ahí, cantando la buena nueva.',
      'Ama de verdad, como a ti te están amando.',
    ].join('\n')
    expect(aAcordesSobreLetra(pagina)).toBe(
      'Vamos por ahí, cantando la buena nueva.\nAma de verdad, como a ti te están amando.'
    )
  })

  test('una línea de acordes sin letra debajo queda sola (intro)', () => {
    const pagina = ['                          MI LA SI', 'Abre tu jardín,           MI fa#m'].join('\n')
    const r = aAcordesSobreLetra(pagina).split('\n')
    expect(r[0]).toBe('MI LA SI')
    expect(r).toContain('Abre tu jardín,')
  })

  test('el resultado lo entiende desdeElCancionero, que es para lo que existe', () => {
    // La prueba que importa: la salida de este motor entra en el de H9 y sale
    // ChordPro americano, sin tocar ninguno de los dos.
    const pagina = 'Grande es el cariño        RE LA\npara con tus hijos         sim fa#m'
    const chordpro = desdeElCancionero(aAcordesSobreLetra(pagina))

    expect(chordpro).toContain('[D]')
    expect(chordpro).toContain('[A]')
    expect(chordpro).toContain('[Bm]')
    // La letra sigue entera: en ChordPro va intercalada con los acordes, así
    // que se compara quitándolos.
    expect(chordpro.replace(/\[[^\]]*\]/g, '')).toContain('Grande es el cariño')
    // Y ya no queda notación latina suelta.
    expect(chordpro).not.toMatch(/\[(DO|RE|MI|FA|SOL|LA|SI)[^\]]*\]/)
  })
})

describe('tituloDeCanto', () => {
  test('reconoce el encabezado de una página de canto', () => {
    expect(tituloDeCanto('1. ABRE TU JARDÍN')).toEqual({ numero: 1, titulo: 'Abre tu jardín' })
    expect(tituloDeCanto('42. SANTO ESPAÑOL')).toEqual({ numero: 42, titulo: 'Santo español' })
  })

  test('NO confunde una fila del índice con un canto', () => {
    // El índice usa la misma forma «N. Título» con puntos de relleno. Colarlo
    // cargaría 91 cantos fantasma, sin una sola línea de letra.
    expect(tituloDeCanto('1. Abre tu jardín....................................')).toBeNull()
    expect(tituloDeCanto('23. Alabe todo el mundo......................')).toBeNull()
  })

  test('NO toma una línea de letra que empiece con número', () => {
    expect(tituloDeCanto('40 días en el desierto')).toBeNull()
  })
})

describe('normalizarTitulo', () => {
  // Ojo: esto es el respaldo. El título que se guarda sale del ÍNDICE del PDF,
  // que ya viene con la capitalización que quiso el editor («Santo Español»).
  // Esta función sólo actúa si un canto no figura en el índice.
  test('baja las versales del diseño sin gritar', () => {
    expect(normalizarTitulo('ABRE TU JARDÍN')).toBe('Abre tu jardín')
    expect(normalizarTitulo('PESCADOR DE HOMBRES')).toBe('Pescador de hombres')
  })

  test('respeta las palabras de enlace en minúscula', () => {
    expect(normalizarTitulo('TOMAD SEÑOR Y RECIBID')).toBe('Tomad Señor y recibid')
    expect(normalizarTitulo('EL SEÑOR ES MI FORTALEZA')).toBe('El Señor es mi fortaleza')
  })

  test('la primera palabra siempre va en mayúscula, aunque sea de enlace', () => {
    expect(normalizarTitulo('LA SAMARITANA')).toBe('La Samaritana')
  })
})

describe('leerIndice', () => {
  // El índice es la ÚNICA parte del PDF que dice a qué momento pertenece cada
  // canto: los encabezados de las páginas son imágenes, no texto.
  const indice = [
    'Entrada....................................................5       Antífonas...............................................27',
    '1. Abre tu jardín....................................              23. Alabe todo el mundo......................',
    '2. Celebremos.......................................               24. Aleluya II......................................',
    '                                                                   ',
    'Perdón...................................................12        Ofertorio................................................33',
    '8. Hoy perdóname.................................                  34. El Alfarero....................................',
  ].join('\n')

  test('asigna a cada canto el momento de su sección', () => {
    const r = leerIndice(indice)
    expect(r.find((c) => c.numero === 1)?.momento).toBe('entrada')
    expect(r.find((c) => c.numero === 8)?.momento).toBe('perdon')
  })

  test('no mezcla las dos columnas: la derecha tiene sus propias secciones', () => {
    // Leído de corrido, «Alabe todo el mundo» (nº 23) caería en Entrada.
    const r = leerIndice(indice)
    expect(r.find((c) => c.numero === 23)?.momento).toBe('antifona')
    expect(r.find((c) => c.numero === 34)?.momento).toBe('ofertorio')
  })

  test('trae el título bien escrito, sin los puntos de relleno', () => {
    const r = leerIndice(indice)
    expect(r.find((c) => c.numero === 1)?.titulo).toBe('Abre tu jardín')
    expect(r.find((c) => c.numero === 34)?.titulo).toBe('El Alfarero')
  })

  test('ignora una fila de canto que aparezca antes de cualquier sección', () => {
    expect(leerIndice('5. Suelto sin sección........................')).toEqual([])
  })
})

describe('detectarCorteDeColumnas', () => {
  test('cada página del índice pone la segunda columna en otro lado', () => {
    // El bug real: con un corte fijo, «Cordero......43       72. Tenemos…»
    // quedaba partido como «…43       7» y la sección dejaba de reconocerse,
    // perdiendo los 40 cantos de esa página del índice.
    const pagina4 = [
      'Cordero.................................................43       72. Tenemos un amigo....',
      '46. Cordero Betsaida .........................                   73. Ven y verás.........',
    ]
    const corte = detectarCorteDeColumnas(pagina4)
    expect(pagina4[0].slice(0, corte).trim()).toMatch(/^Cordero\.+43$/)
  })

  test('sin columnas, no parte nada', () => {
    const corte = detectarCorteDeColumnas(['una sola columna', 'sin huecos grandes'])
    expect('una sola columna'.slice(0, corte)).toBe('una sola columna')
  })
})

describe('acordes entre paréntesis', () => {
  test('el opcional (SI7) se convierte igual, no descarta la línea', () => {
    // El cancionero marca así los acordes opcionales. H9 no los reconoce, y
    // una sola línea con paréntesis hacía que descartara TODA la línea: el
    // canto 1 salía con la mitad de sus acordes sin convertir.
    const pagina = 'traigo una nueva noticia;    sol#m fa#m SI (SI7)'
    const chordpro = desdeElCancionero(aAcordesSobreLetra(pagina))

    expect(chordpro).toContain('[B7]')
    expect(chordpro).not.toContain('(')
    expect(chordpro.replace(/\[[^\]]*\]/g, '')).toContain('traigo una nueva noticia;')
  })
})

describe('repartirSobreLetra', () => {
  test('los acordes caen en inicios de palabra mientras haya lugar', () => {
    // El defecto que esto arregla: cuando el acorde anterior llegaba justo a la
    // columna ideal, empujarlo un carácter lo metía dentro de la palabra
    // («una n[B]ueva»). Ahora salta al siguiente inicio con lugar.
    //
    // LÍMITE DEL FORMATO, declarado: si dos acordes tienen que caer sobre la
    // misma palabra, el segundo se desplaza. El formato de dos líneas no puede
    // decir «[B][B7]noticia» — pegarlos en la línea de acordes los leería como
    // un solo acorde inventado. Se acepta: es la fuente la que no dice dónde va
    // cada uno.
    const letra = 'traigo una nueva noticia;'
    const linea = repartirSobreLetra('sol#m fa#m SI SI7', letra)
    const inicios = new Set([...letra.matchAll(/\S+/g)].map((m) => m.index))
    const puestos = [...linea.matchAll(/\S+/g)].map((m) => m.index)

    // La mayoría cae bien, y el primero siempre.
    expect(inicios.has(puestos[0])).toBe(true)
    expect(puestos.filter((p) => inicios.has(p)).length).toBeGreaterThanOrEqual(3)
  })

  test('el primero arranca en la primera palabra', () => {
    expect(repartirSobreLetra('MI fa#m', 'Abre tu jardín,')).toMatch(/^MI/)
  })

  test('más acordes que palabras: los sobrantes van seguidos, sin pisarse', () => {
    const linea = repartirSobreLetra('LA SI MI LA MI', 'ven,')
    expect(linea.split(/\s+/).filter(Boolean)).toEqual(['LA', 'SI', 'MI', 'LA', 'MI'])
  })
})

describe('títulos con subtítulo', () => {
  test('el subtítulo entre paréntesis no descarta el canto', () => {
    // Sin esto se perdían los SEIS salmos: «17. SALMO 4 (Me entregas calma)»
    // tiene minúsculas en el paréntesis, y exigirle versales a toda la línea
    // rechazaba el encabezado entero.
    expect(tituloDeCanto('17. SALMO 4 (Me entregas calma)')).toEqual({
      numero: 17,
      titulo: 'Salmo 4',
    })
    expect(tituloDeCanto('63. MAR ADENTRO (CD V CMP)')).toEqual({
      numero: 63,
      titulo: 'Mar adentro',
    })
  })

  test('sigue rechazando una línea de letra que empiece con número', () => {
    expect(tituloDeCanto('40 días en el desierto')).toBeNull()
  })
})
