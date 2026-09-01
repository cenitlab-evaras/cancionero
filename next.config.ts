import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaqueta el servidor y sólo las dependencias que realmente usa, en
  // `.next/standalone`. Es lo que hace que la imagen Docker no cargue con
  // todo `node_modules` encima. No afecta a `next dev` ni al deploy en Vercel.
  output: "standalone",
};

export default nextConfig;
