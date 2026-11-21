/**
 * Fixtures sintéticos de la página de lecturas de Iglesia.cl.
 *
 * El repositorio es público: este HTML imita la estructura del sitio real
 * (`div.subtitulos > a[name=...]`, spans rojos, `p`), pero todo el texto es
 * inventado. No copies acá texto del leccionario ni HTML real del sitio.
 *
 * Los anclajes que usa el extractor son `liturgia`, `evangelio` y `eucaristia`.
 * Los días complejos se reconocen por sus rótulos de formulario o por
 * `SECUENCIA`. La página vacía conserva el título sin fecha y no trae anclajes.
 */

function pagina(titulo: string, contenido: string): string {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>${titulo}</title></head>
<body>
<div class="cuadro_interior">
<div class="titulos" align="center">${titulo}<br>
<a href="#"><div class="btn btn-primary">- A</div></a>
<a href="#"><div class="btn btn-primary">+ A</div></a>
</div>
<div class="subtitulos_azul">
<a href="#liturgia" class="txt_menu">Liturgia de la Palabra</a>
&nbsp;&nbsp;|&nbsp;&nbsp;
<a href="#evangelio" class="txt_menu">Evangelio</a>
</div>
${contenido}
</div>
</body>
</html>`
}

/** Un domingo completo: primera, salmo, segunda y Evangelio. */
export const CON_SEGUNDA = pagina(
  'Eucaristía del Domingo 22 de Noviembre de 2026',
  `<div class="subtitulos"><a name="liturgia" class="subtitulos">LITURGIA DE LA PALABRA</a></div>
<div><a href="ordinario.php#liturgia_p">(Ver Ordinario de la Misa)</a></div><br>
<div>
<p style="text-align:justify"><span style="color:#FF0000"><em>Tema inventado de la primera lectura</em></span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Lectura de la profecía de Ejemplo </span><span style="color:rgb(238, 0, 0)">55, 1-11</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto de prueba de la primera lectura.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Palabra de Dios.</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">SALMO RESPONSORIAL 44, 2-3</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">R. </span><span style="color:rgb(0, 0, 0)">Estribillo de prueba del salmo.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Verso de prueba del salmo.</span><span style="color:rgb(238, 0, 0)"> R.</span></p>
<p style="text-align:justify"><span style="color:#FF0000"><em>Tema inventado de la segunda lectura</em></span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Lectura de la segunda carta de Ejemplo a la comunidad </span><span style="color:rgb(238, 0, 0)">15, 20-26</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto de prueba de la segunda lectura.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Palabra de Dios.</span></p>
</div>
<div class="subtitulos"><a name="evangelio" class="subtitulos">EVANGELIO</a></div>
<div>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">ACLAMACIÓN AL EVANGELIO Mc 11, 9-10</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Aleluya de prueba.</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">EVANGELIO</span></p>
<p style="text-align:justify"><span style="color:#FF0000"><em>Tema inventado del Evangelio</em></span></p>
<p style="text-align:justify"><span style="color:rgb(255, 0, 0)">+</span><span style="color:rgb(0, 0, 0)"> Evangelio de nuestro Señor Jesucristo según san Ejemplo </span><span style="color:rgb(238, 0, 0)">14, 13-21</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto de prueba del Evangelio.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Palabra del Señor.</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">Credo</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto inventado del Credo que no debe entrar en el Evangelio.</span></p>
</div>
<div class="subtitulos"><a name="eucaristia" class="subtitulos">LITURGIA EUCARÍSTICA</a></div>
<div>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">ORACIÓN SOBRE LAS OFRENDAS</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto inventado de la liturgia eucarística.</span></p>
</div>`,
)

/** La misma forma, sin segunda lectura: las tres partes ordinarias. */
export const SIN_SEGUNDA = pagina(
  'Eucarist&iacute;a del Domingo 29 de Noviembre de 2026',
  `<div class="subtitulos"><a name="liturgia" class="subtitulos">LITURGIA DE LA PALABRA</a></div>
<div><a href="ordinario.php#liturgia_p">(Ver Ordinario de la Misa)</a></div><br>
<div>
<p style="text-align:justify"><span style="color:#FF0000"><em>Tema inventado de la única lectura</em></span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Lectura del libro de Ejemplo </span><span style="color:rgb(238, 0, 0)">63, 1-5</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto de prueba de la primera lectura sin segunda.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Palabra de Dios.</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">SALMO RESPONSORIAL 8, 2-4</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">R. </span><span style="color:rgb(0, 0, 0)">Estribillo de prueba del salmo sin segunda.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Verso de prueba del salmo sin segunda.</span><span style="color:rgb(238, 0, 0)"> R.</span></p>
</div>
<div class="subtitulos"><a name="evangelio" class="subtitulos">EVANGELIO</a></div>
<div>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">ACLAMACIÓN AL EVANGELIO Lc 3, 4-6</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Aleluya de prueba sin segunda.</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">EVANGELIO</span></p>
<p style="text-align:justify"><span style="color:rgb(255, 0, 0)">+</span><span style="color:rgb(0, 0, 0)"> Evangelio de nuestro Señor Jesucristo según san Ejemplo </span><span style="color:rgb(238, 0, 0)">21, 25-28</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto de prueba del Evangelio sin segunda.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Palabra del Señor.</span></p>
</div>
<div class="subtitulos"><a name="eucaristia" class="subtitulos">LITURGIA EUCARÍSTICA</a></div>
<div>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">ORACIÓN SOBRE LAS OFRENDAS</span></p>
</div>`,
)

/**
 * Navidad con tres formularios. El rótulo de cada uno está en un p propio,
 * como en el sitio real; las lecturas visibles son las de uno solo de ellos.
 */
export const COMPLEJO = pagina(
  'Eucaristía del Viernes 25 de Diciembre de 2026',
  `<div class="subtitulos"><a name="liturgia" class="subtitulos">LITURGIA DE LA PALABRA</a></div>
<div>
<p style="text-align:center"><span style="color:rgb(0, 0, 0)">Misa vespertina</span></p>
<p style="text-align:justify"><span style="color:#FF0000"><em>Tema inventado de la primera lectura de Navidad</em></span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Lectura de la profecía de Ejemplo </span><span style="color:rgb(238, 0, 0)">9, 1-6</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto de prueba de la primera lectura de Navidad.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Palabra de Dios.</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">SALMO RESPONSORIAL 95, 1-3</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">R. </span><span style="color:rgb(0, 0, 0)">Estribillo de prueba del salmo de Navidad.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Lectura de la segunda carta de Ejemplo a la comunidad </span><span style="color:rgb(238, 0, 0)">2, 1-5</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto de prueba de la segunda lectura de Navidad.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Palabra de Dios.</span></p>
</div>
<div class="subtitulos"><a name="evangelio" class="subtitulos">EVANGELIO</a></div>
<div>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">ACLAMACIÓN AL EVANGELIO Lc 2, 10-11</span></p>
<p style="text-align:justify"><span style="color:rgb(238, 0, 0)">EVANGELIO</span></p>
<p style="text-align:justify"><span style="color:rgb(255, 0, 0)">+</span><span style="color:rgb(0, 0, 0)"> Evangelio de nuestro Señor Jesucristo según san Ejemplo </span><span style="color:rgb(238, 0, 0)">2, 1-14</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto de prueba del Evangelio de Navidad.</span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Palabra del Señor.</span></p>
</div>
<div class="subtitulos"><a name="eucaristia" class="subtitulos">LITURGIA EUCARÍSTICA</a></div>
<div>
<p style="text-align:center"><span style="color:#FF0000"><strong>Misa de la Noche</strong></span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto inventado del formulario de la noche.</span></p>
<p style="text-align:center"><span style="color:#FF0000"><strong>Misa del Día</strong></span></p>
<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">Texto inventado del formulario del día.</span></p>
</div>`,
)

/** Una fecha futura sin lecturas publicadas: título sin fecha y sin anclajes. */
export const VACIA = pagina(
  'Eucaristía del Miércoles de de',
  `<p style="text-align:justify"><span style="color:rgb(0, 0, 0)">No hay lecturas publicadas para esta fecha.</span></p>`,
)
