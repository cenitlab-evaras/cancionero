/**
 * Semilla de cantos — docs/PRD.md §13.2
 *
 * FUENTE ÚNICA: docs/cancioneros catolicos/Cancionero Catolico.pdf
 *   (título real: "Cancionero Misionero — Coro Misión País 2025", 99 pág, 91 cantos)
 * Cada canto declara su número y la PÁGINA DEL PDF donde está.
 *
 * TRANSCRIPCIÓN — tres cosas que hay que saber antes de leer esto:
 *
 * 1. NOTACIÓN. El cancionero está en latina (MI, fa#m, SI7) y acá se guarda en
 *    americana (E, F#m, B7), que es lo que decidió el PRD (decisión 3):
 *      DO=C · RE=D · MI=E · FA=F · SOL=G · LA=A · SI=B
 *      minúscula + m = menor:  rem=Dm · mim=Em · lam=Am · sim=Bm · fa#m=F#m
 *
 * 2. LA LETRA Y LOS ACORDES SON DE LA FUENTE. Qué acordes lleva cada verso, en
 *    qué orden y en qué tonalidad: todo eso sale del cancionero, verificable
 *    contra su página.
 *
 * 3. LA POSICIÓN DE CADA ACORDE ES UNA ESTIMACIÓN, NO UN DATO.
 *    El PDF es de dos columnas —letra a la izquierda, acordes de esa línea a la
 *    derecha— y NO dice sobre qué sílaba cae cada uno. Acá están repartidos con
 *    criterio musical sobre la métrica del verso, decidido por quien transcribió,
 *    para que el cifrado sirva para tocar.
 *
 *    Es lo mejor que se puede hacer sin la grabación, y puede estar equivocado
 *    en algún verso. Corregir a oído es trabajo legítimo y esperable: cambiar la
 *    posición de un corchete no rompe nada, porque la transposición se calcula
 *    al leer y no está persistida (PRD decisión 10).
 *
 * `tonalidadOriginal` es la del cancionero, informativa.
 */

export type CantoSemilla = {
  titulo: string
  autor: string | null
  momento: string
  cifrado: string
  tonalidadOriginal: string
  fuenteNumero: number
  fuentePagina: number
}

export const FUENTE = 'Cancionero Misionero — Coro Misión País 2025'

/**
 * Los autores NO están declarados en el cancionero. Los dos que aparecen acá
 * son atribuciones de conocimiento público y comprobable, no inventadas; el
 * resto queda sin autor, que es lo que la fuente dice.
 */
export const CANTOS: CantoSemilla[] = [
  {
    titulo: 'Abre tu jardín',
    autor: null,
    momento: 'entrada',
    tonalidadOriginal: 'E',
    fuenteNumero: 1,
    fuentePagina: 6,
    cifrado: `[E]Abre tu [F#m]jardín,
[G#m]traigo una [F#m]nueva [B]noticia;[B7]
[E]novedad sin [F#m]fin,
[G#m]corramos a re[F#m]cibirla
[A]ven, [B]le[E]ván[A]tate.[E]

[E]Abre tu jardín, [A]pon flores [E]en tu ven[A]tana,
[E]canta una can[A]ción, hoy [E]día se murió la [A]muerte.
[F#m]Es día de [G#m]fiesta, es [F#m]día de [B7]vida.

[E]No te quedes hoy, [A]encerrado [E]en tus cos[A]tumbres,
[E]como en el si[A]llón de las [E]antiguas ver[A]dades.
[F#m]Llega un [G#m]nuevo día, [F#m]ven a re[B7]nacer.

Vamos por ahí, cantando la buena nueva.
Ama de verdad, como a ti te están amando.
Vive la palabra, luego vivirás.`,
  },
  {
    titulo: 'Hoy perdóname',
    autor: null,
    momento: 'perdon',
    tonalidadOriginal: 'D',
    fuenteNumero: 8,
    fuentePagina: 13,
    cifrado: `[D]Hoy per[A]dóna[Bm]me
[G]hoy por [Em]siem[A]pre,
[D]sin mirar la men[D7]tira,
[G]el vacío de nuestras [Gm]vidas
[D]nuestras faltas de a[Bm]mor y cari[A]dad.

[D]Hoy per[A]dóna[Bm]me
[G]hoy por [Em]siem[A]pre
[D]aún sabiendo que he ca[D7]ído
[G]que de Ti siempre había [Gm]huido
[D]hoy regreso arrepen[Bm]tido, [A]vuelvo a Ti, [G]vuelvo a [D]Ti.`,
  },
  {
    titulo: 'Gloria Palazón',
    autor: null,
    momento: 'gloria',
    tonalidadOriginal: 'A',
    fuenteNumero: 14,
    fuentePagina: 17,
    cifrado: `[A]Gloria a [Bm]Dios en el [C#m]Cielo, [Bm]y en la [E]tierra [A]Paz a [F#m]los
[Bm]hombres, que [E]ama el Se[A]ñor.

[A]Por Tu inmensa [D]gloria Te ala[A]bamos,
[Bm]Te bende[E]cimos, Te ado[A]ramos,
[C#m]Te glorifi[A]camos, Te [B]damos [E]gracias.

[A]Gloria a [Bm]Dios en el [C#m]Cielo, [Bm]y en la [E]tierra [A]Paz a [F#m]los
[Bm]hombres, que [E]ama el Se[A]ñor.

[A]Señor Dios Rey ce[D]lestial, Dios [A]Padre
[Bm]Todopode[E]roso, Señor Hijo único, Jesu[A]cristo,
[C#m]Señor Dios, Cor[A]dero de Dios, [B]Hijo del [E]Padre.

[A]Gloria a [Bm]Dios en el [C#m]Cielo, [Bm]y en la [E]tierra [A]Paz a [F#m]los
[Bm]hombres, que [E]ama el Se[A]ñor.

[A]Tú que quitas el pecado del mundo,
[D]¡Ten piedad de no[A]sotros!
[Bm]Tú que quitas el pecado del mundo,
[E]¡Atiende nuestra [A]súplica!
[C#m]Tú que estás sentado a la derecha del Padre,
[A]¡Ten pie[B]dad de no[E]sotros!

[A]Gloria a [Bm]Dios en el [C#m]Cielo, [Bm]y en la [E]tierra [A]Paz a [F#m]los
[Bm]hombres, que [E]ama el Se[A]ñor.

[A]Porque sólo Tú eres [D]Santo, sólo Tú Se[A]ñor,
[Bm]sólo Tú, Al[E]tísimo Jesu[A]cristo,
[C#m]con el Espíritu [A]Santo, en la [B]Gloria de Dios [E]Padre.
[D]A[E]mén.[A]`,
  },
  {
    titulo: 'Salmo 23 (El Señor es mi Pastor)',
    autor: null,
    momento: 'salmo',
    tonalidadOriginal: 'C',
    fuenteNumero: 18,
    fuentePagina: 22,
    cifrado: `[C]El Se[G]ñor es mi [E]pas[Am]tor
[F]nada me ha[G]brá de fal[C]tar.

[C]El Señor es mi [F]pastor, qué me [G]puede fal[C]tar
[C]En las [F]verdes pra[C]deras
[F]Él me lleva a re[G]po[A]sar
[C7]Condúceme a las [F]aguas del solaz
[G]y mi alma recon[C]forta.

[C]Él me guía por [F]sendas de jus[G]ti[C]cia
[C]por a[F]mor de su [C]nombre
[F]En oscura que[G]bra[A]da
[C7]yo no temo porque es[F]tás junto a mí
[G]Tu cayado, la vara de tu [C]diestra
son ellos mi confianza.

[C]Para mí Tú dis[F]pones una [G]me[C]sa
[C]frente a [F]mis adver[C]sarios
[F]Has ungido con [G]ó[A]leo
[C7]mi cabeza y mi [F]cáliz rebosa
[G]De bienes y de [C]gracias
gozaré en tu casa mientras viva.

[C]Demos gloria al [F]Padre pode[G]ro[C]so,
[C]a Je[F]sús, el Se[C]ñor
[F]Al Espíritu que ha[G]bita en nuestras [A]almas,
[C7]nuestro con[F]solador
[G]Al Dios que es, que era y que ven[C]drá
por los siglos de los siglos.`,
  },
  {
    titulo: 'Donde hay amor',
    autor: null,
    momento: 'antifona',
    tonalidadOriginal: 'D',
    fuenteNumero: 27,
    fuentePagina: 30,
    cifrado: `[D]Donde [A]hay a[Bm]mor
[G]y cari[A]dad,
[D]Donde [A]hay a[Bm]mor,
[Em]Dios a[A]hí es[D]tá.`,
  },
  {
    titulo: 'El Alfarero',
    autor: null,
    momento: 'ofertorio',
    tonalidadOriginal: 'C',
    fuenteNumero: 34,
    fuentePagina: 34,
    cifrado: `[C]Gracias quiero [Am]darte por a[F]mar[G]me
[G]Gracias [C]quiero darte yo a [F]ti Se[G]ñor
[C]Hoy soy fe[C7]liz porque [F]te cono[Fm]cí
[C]Gracias por a[G]marme a [C]mí tam[G]bién.

[C]Señor yo quiero aban[G]donarme
[F]Como el barro en las [G]manos del alfa[C]rero
[C7]Toma mi [F]vida, hazla de [Fm]nuevo
[C]Yo quiero ser, [G]yo quiero ser
[C]Un vaso nuevo`,
  },
  {
    titulo: 'Santo Gen Rosso',
    autor: null,
    momento: 'santo',
    tonalidadOriginal: 'G',
    fuenteNumero: 43,
    fuentePagina: 41,
    cifrado: `[G][C][G][C]

[G]Santo, santo, [Bm]santo
[C]El Señor Dios del [Am7]univer[D]so
[C]El cielo y la [G/B]tierra es[Am]tán [Am/G]llenos de su [A7]glo[D]ria

[G]Ho[D]sanna, [G]ho[D]sanna,
[C]hosanna en lo [D]alto del [G]cie[D]lo.

[G]Bendito el que [C/G]viene en el [D]nombre del Se[G]ñor

[G]Ho[D]sanna, [G]ho[D]sanna,
[C]hosanna en lo [D]alto del [G]cie[D]lo.`,
  },
  {
    titulo: 'Cordero de Dios I',
    autor: null,
    momento: 'cordero',
    tonalidadOriginal: 'G',
    fuenteNumero: 47,
    fuentePagina: 44,
    cifrado: `[G]Corde[C]ro de [D]Dios,
[C]corde[D]ro de [G]Dios,
[C]tú que [D]quitas el pe[C]cado del [D]mundo,
[C]ten piedad de no[G]sotros.

[G]Corde[C]ro de [D]Dios,
[C]corde[D]ro de [G]Dios
[C]tú que [D]quitas el pe[C]cado del [D]mundo,
[C]danos [D]la [G]paz,[G7]
[C]danos [D]la [G]paz.`,
  },
  {
    titulo: 'Nada te turbe',
    autor: 'Santa Teresa de Jesús',
    momento: 'comunion',
    tonalidadOriginal: 'A',
    fuenteNumero: 66,
    fuentePagina: 65,
    cifrado: `[A]Nada te [E]turbe
[Bm]Nada te es[E]pante.
[A]Todo se [E]pasa
[Bm]Dios no se [E]muda.
[A]La paciencia [E]todo lo alcanza
[Bm]Quien a Dios tiene [E]nada le falta
[A]Sólo [F#m]Dios [Bm]bas[E]ta.
[A]Amén.`,
  },
  {
    titulo: 'Pescador de hombres',
    autor: 'Cesáreo Gabaráin',
    momento: 'comunion',
    tonalidadOriginal: 'A',
    fuenteNumero: 67,
    fuentePagina: 65,
    cifrado: `[A]Tú, has ve[E]nido a la o[F#m]rilla,
[Bm]No has buscado ni a [Bm/A]sabios ni a [E]ricos,
[A]Tan sólo [E]quieres que [A]yo te siga[A7]

[D]Señor, me has mi[A]rado a los ojos,
[Bm]Sonriendo has [E]dicho mi [A]nombre,[A7]
[D]En la arena, he de[A]jado mi [F#]barca
[Bm]Junto a ti bus[E]caré otro [A]mar.

[A]Tú, sabes [E]bien lo que [F#m]tengo,
[Bm]En mi barca no hay [Bm/A]oro ni es[E]padas,
[A]Tan sólo [E]redes y [A]mi trabajo.[A7]

[A]Tú, nece[E]sitas mis [F#m]manos,
[Bm]Mi cansancio, que a [Bm/A]otros des[E]canse,
[A]Amor que [E]quiera, se[A]guir amando.[A7]

[A]Tú, pesca[E]dor de otros [F#m]lagos,
[Bm]Ansia eterna de [Bm/A]almas que es[E]peran,
[A]Amigo [E]bueno, que [A]así me llaman.[A7]`,
  },
  {
    titulo: 'Reina del Cielo',
    autor: null,
    momento: 'maria',
    tonalidadOriginal: 'A',
    fuenteNumero: 83,
    fuentePagina: 80,
    cifrado: `[A]En Maipú [E]fue que Chile [C#7]te hizo su [F#m]madre,
[D]creció bajo tus [A]ojos
[E]allá va, allá va, Virgen del [A]Carmen.

[A]A mi Salva[E]dor llevan [C#7]tus [F#m]brazos
[D]y a mi patria en[A]tera
[E]la proteges con tu [A]manto.

[A]El huaso [E]siempre lleva [C#7]bajo su [F#m]manta
[D]un escapu[A]lario
[E]allá va, allá va, con la más [A]Santa[A7]
[D]un escapu[A]lario
[E]allá va, allá va, Chile te [A]canta.

[A]Chile te [E]canta ¡ay, sí! [C#7]con lindas [F#m]flores
[D]rojas, blancas y a[A]zules,
[E]allá va, allá va, son tus co[A]lores.

[A]Colores chi[E]lenos, [C#7]Reina del [F#m]Cie[D]lo,[A]
[E]Reina del [A]Cielo.`,
  },
  {
    titulo: 'Himno Misión País',
    autor: null,
    momento: 'himno',
    tonalidadOriginal: 'D',
    fuenteNumero: 89,
    fuentePagina: 86,
    cifrado: `[D]Hoy des[A9/C#]pierta un lla[G/B]mado a conver[D/A]tir
[G]nuestros pasos en [Bm]huellas de ver[A7]dad
[D]nacen mi[A9/C#]radas fe[G/B]lices de se[D/A]guir
[G]la tarea que [Bm]se nos con[C]fi[A7]ó

[D]Se abre una I[A9/C#]glesia dis[G/B]puesta a reno[D/A]var
[G]la promesa de e[Bm]vangeli[A7]zar
[D]nuestras ciu[A9/C#]dades se i[G/B]nunden de tu [D/A]paz
[G]y el esfuerzo se [Bm]vuelva santi[C]dad[A7]
[Em]las visiones se [Bm]hacen reali[A7]dad
[C]si en tu nombre las [G]redes se hunden [E7]en el [A7]mar

[D]Construyamos la his[G]toria de esta [A]tierra
[D]con el alma dis[Em]puesta a escu[Bm]char y ser[A7]vir
[D]entregando por [G]Cristo las [A]manos y la [Bm]voz
[C]se abrirán los caminos para [A]Dios
[Em]nos envíe el Es[D/F#]píritu porque [G]es Su Volun[A7]tad
nuestra Misión

[D]Los her[A9/C#]manos se en[G/B]cuentren en Je[D/A]sús
[G]anunciando el ca[Bm]mino de la [A7]Cruz
[D]nuestra [A9/C#]Virgen del [G/B]Carmen nos pro[D/A]teja
[G]y nos muestre el [Bm]rostro del Se[C]ñor.[A7]

[D]Contem[A9/C#]plando el mis[G/B]terio de tu a[D/A]mor
[G]respondemos con [Bm]nuestra liber[A7]tad
[D]haz de [A9/C#]Chile Se[G/B]ñor una fa[D/A]milia
[G]que viva a[Bm]bierta a entre[C]gar[A7]
[Em]tu palabra donde [Bm]haya sole[A7]dad
[C]donde hijos y [G]padres se vuelvan [E7]a encon[A7]trar.`,
  },
]

/**
 * El canto del coro de control. No sale del cancionero: existe solo para
 * comprobar que un coro no ve el repertorio del otro (PRD §13.3).
 */
export const CANTO_CONTROL: CantoSemilla = {
  titulo: 'Canto de prueba del coro de control',
  autor: null,
  momento: 'entrada',
  tonalidadOriginal: 'C',
  fuenteNumero: 0,
  fuentePagina: 0,
  cifrado: `[C]Este canto perte[G]nece a San Ejemplo.
[F]Si lo ves desde Mi[C]sión País, la RLS está mal.`,
}

export type MomentoSemilla = { codigo: string; nombre: string; orden: number }

/** Los 11 momentos del índice del cancionero (pág. 3-4), en orden de misa. */
export const MOMENTOS: MomentoSemilla[] = [
  { codigo: 'entrada', nombre: 'Entrada', orden: 1 },
  { codigo: 'perdon', nombre: 'Perdón', orden: 2 },
  { codigo: 'gloria', nombre: 'Gloria', orden: 3 },
  { codigo: 'salmo', nombre: 'Salmos', orden: 4 },
  { codigo: 'antifona', nombre: 'Antífonas', orden: 5 },
  { codigo: 'ofertorio', nombre: 'Ofertorio', orden: 6 },
  { codigo: 'santo', nombre: 'Santo', orden: 7 },
  { codigo: 'cordero', nombre: 'Cordero', orden: 8 },
  { codigo: 'comunion', nombre: 'Comunión', orden: 9 },
  { codigo: 'maria', nombre: 'María', orden: 10 },
  { codigo: 'himno', nombre: 'Himnos', orden: 11 },
]
