import type { NextConfig } from "next";

// Proxy de Supabase para probar desde el teléfono en desarrollo: el teléfono
// solo habla con el puerto de Next y este reenvía /supabase/* al Supabase local.
// Sin esta variable (producción) no se registra ninguna rewrite.
const supabaseDevProxy = process.env.SUPABASE_DEV_PROXY_TARGET;

// Next bloquea los recursos de desarrollo si se entra con un host distinto de
// localhost (el HMR no conecta y la página no hidrata). Para probar desde el
// teléfono por la IP de la Mac hay que declararla acá. Solo desarrollo.
const allowedDevOrigins = process.env.DEV_ALLOWED_ORIGINS?.split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Empaqueta el servidor y sólo las dependencias que realmente usa, en
  // `.next/standalone`. Es lo que hace que la imagen Docker no cargue con
  // todo `node_modules` encima. No afecta a `next dev` ni al deploy en Vercel.
  output: "standalone",

  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),

  async rewrites() {
    if (!supabaseDevProxy) return [];
    return [
      {
        source: "/supabase/:path*",
        destination: `${supabaseDevProxy}/:path*`,
      },
    ];
  },
};

export default nextConfig;
