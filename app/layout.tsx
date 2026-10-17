import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { COLOR_BARRA, COOKIE_TEMA, esTema, type Tema } from "./componentes/tema";
import { Atkinson_Hyperlegible_Next, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

/**
 * Tres familias, cada una con un trabajo (DESIGN.md · Typography):
 *
 * Atkinson Hyperlegible Next para la interfaz. Se diseñó para personas con baja
 * visión: distingue l / I / 1 y b / 6, que en una sans neutra se confunden. En
 * el coro hay alguien que ve poco, y la regla es que la app entera le sirva,
 * no solo la vista de lectura.
 *
 * Source Serif 4 para los títulos de canto y de misa: la letra del cancionero
 * impreso y del misal. Con eje óptico, así que se ajusta sola al tamaño.
 *
 * JetBrains Mono para el cifrado: ancho de carácter estable en 0.6em, que es lo
 * que sostiene la alineación de los acordes sobre la letra (`cifrado.tsx`
 * calcula con ese ancho, así que no se cambia sin cambiar ese número).
 */
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--fuente-interfaz",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--fuente-titulo",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--fuente-cifrado",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cantoral",
  description: "El repertorio de tu coro, en tu teléfono.",
};

/** El tema elegido con el sol y la luna (2026-10-17); sin elegir, el oscuro. */
async function temaElegido(): Promise<Tema> {
  const valor = (await cookies()).get(COOKIE_TEMA)?.value;
  return esTema(valor) ? valor : "oscuro";
}

export async function generateViewport(): Promise<Viewport> {
  // La barra del navegador en el color del fondo: en el oscuro, una franja
  // blanca arriba es un foco de luz en la cara al tocar de pie. Metadata no
  // acepta variables CSS, por eso el color va repetido en `tema.ts`.
  const tema = await temaElegido();
  return { themeColor: COLOR_BARRA[tema], colorScheme: tema === "claro" ? "light" : "dark" };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tema = await temaElegido();
  return (
    <html
      lang="es"
      data-tema={tema}
      className={`${atkinson.variable} ${sourceSerif.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
