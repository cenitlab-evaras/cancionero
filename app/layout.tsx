import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Dos familias en ejes distintos —neo-grotesca y monoespaciada—, nunca dos sans
 * parecidas (DESIGN.md · Typography).
 *
 * Inter para la interfaz: neutra, legible en tamaños chicos, con números
 * tabulares para los contadores.
 *
 * JetBrains Mono para el cifrado: ancho de carácter estable en 0.6em, que es lo
 * que sostiene la alineación de los acordes sobre la letra, y altura de x
 * generosa para leerse de reojo mientras se toca.
 */
const inter = Inter({
  variable: "--fuente-interfaz",
  subsets: ["latin"],
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

export const viewport: Viewport = {
  // El tema oscuro también en la barra del navegador: al tocar de pie, una
  // franja blanca arriba es un foco de luz en la cara.
  themeColor: "#0f0f0f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
