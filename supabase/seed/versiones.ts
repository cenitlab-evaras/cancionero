/**
 * Historial de cambios sembrado — H19-A.
 *
 * §18-17 lo dejó escrito después de perder la base entera: **el dato que no
 * está en la semilla no existe**. Sin esto, `/repertorio/:id/versiones` sería
 * una pantalla que solo se puede probar editando a mano un canto, y el estado
 * vacío se confundiría con un fallo.
 *
 * SE SIEMBRAN LOS DOS CASOS DE «QUIÉN», y no es adorno: el trigger guarda
 * `auth.uid()`, que es NULO cuando el `update` no vino de una sesión —la propia
 * semilla, los importadores—. Esa fila existe en producción desde el primer
 * import, así que la pantalla tiene que saber decir «Sin identificar» sin que
 * eso parezca un error.
 *
 * `cifradoAnterior` es lo que el canto TENÍA. El «después» no se guarda: es el
 * cifrado siguiente en el tiempo, o el actual. Ver `armarHistorial`.
 */

export type VersionSemilla = {
  cantoTitulo: string
  /** El cifrado que estaba guardado antes de este cambio. */
  cifradoAnterior: string
  /** Quién lo cambió, o `null` para el caso sin sesión. */
  quienEmail: string | null
  /** Cuándo se reemplazó, en ISO. Fija, para que la pantalla sea reproducible. */
  cuando: string
}

export const VERSIONES: VersionSemilla[] = [
  {
    // El caso normal del coro: el acorde entraba una sílaba tarde y alguien lo
    // corrigió a oído. La letra no se toca — es lo que el motor tiene que
    // distinguir de un cambio de letra.
    cantoTitulo: 'Abre tu jardín',
    quienEmail: 'director@cantoral.local',
    cuando: '2026-08-28T21:40:00Z',
    cifradoAnterior: `[E]Abre tu [F#m]jardín,
[G#m]traigo una [F#m]nueva [B]noticia;[B7]
[E]novedad sin [F#m]fin,
[G#m]corramos a re[F#m]cibirla
[A]ven, [B]le[E]ván[A]tate.[E]

[E]Abre tu jardín, [A]pon flores [E]en tu ven[A]tana,
[E]canta una can[A]ción, hoy [E]día se murió la [A]muerte.
[F#m]Es día de [G#m]fiesta, es [F#m]día de [B]vida.

[E]No te quedes hoy, [A]encerrado [E]en tus cos[A]tumbres,
[E]como en el si[A]llón de las [E]antiguas ver[A]dades.
[F#m]Llega un [G#m]nuevo día, [F#m]ven a re[B7]nacer.

Vamos por ahí, cantando la buena nueva.
Ama de verdad, como a ti te están amando.
Vive la palabra, luego vivirás.`,
  },
  {
    // El caso sin sesión: así entró el cifrado por el importador, sin acordes
    // en la última estrofa. Es la fila que la pantalla tiene que mostrar como
    // «Sin identificar» sin inventar un nombre.
    cantoTitulo: 'Abre tu jardín',
    quienEmail: null,
    cuando: '2026-08-14T13:05:00Z',
    cifradoAnterior: `[E]Abre tu [F#m]jardín,
[G#m]traigo una [F#m]nueva [B]noticia;[B7]
[E]novedad sin [F#m]fin,
[G#m]corramos a re[F#m]cibirla
[A]ven, [B]le[E]ván[A]tate.[E]

[E]Abre tu jardín, [A]pon flores [E]en tu ven[A]tana,
[E]canta una can[A]ción, hoy [E]día se murió la [A]muerte.
[F#m]Es día de [G#m]fiesta, es [F#m]día de [B]vida.

[E]No te quedes hoy, [A]encerrado [E]en tus cos[A]tumbres,
[E]como en el si[A]llón de las [E]antiguas ver[A]dades.
[F#m]Llega un [G#m]nuevo día, [F#m]ven a re[B7]nacer.`,
  },
]
