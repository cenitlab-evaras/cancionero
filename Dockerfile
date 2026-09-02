# syntax=docker/dockerfile:1

# Imagen de producción de Cantoral (Next.js 16 · React 19 · Supabase).
#
# ── Configuración en Dokploy ────────────────────────────────────────────────
#   Build Type ......... Dockerfile      (NO Nixpacks: Nixpacks usa Node 18 y
#                                         Next 16 exige >= 20.9)
#   Dockerfile Path .... ./Dockerfile
#   Docker Context ..... .               (la raíz del repo ya es la app)
#   Port ............... 3000
#
#   En Environment Settings hay que definir, SÍ O SÍ:
#     NEXT_PUBLIC_SUPABASE_URL
#     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#
#   Dokploy las pasa tanto al build como al contenedor. Son necesarias en el
#   BUILD porque Next las incrusta en el bundle del navegador (lib/supabase/
#   client.ts); si sólo estuvieran en runtime, el navegador intentaría hablar
#   con "undefined". Por eso el build de acá abajo se planta si faltan.
#
#   SUPABASE_SECRET_KEY no va en esta imagen: sólo la usa el script de semilla.
#
# ── Build manual (fuera de Dokploy) ─────────────────────────────────────────
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
#     -t cantoral .

ARG NODE_VERSION=22-bookworm-slim


# --- deps: instala node_modules exactamente como manda el lockfile ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


# --- builder: compila y type-chequea --------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}

# Cortar acá es deliberado. Sin estas dos variables el build termina «bien» y
# produce una imagen que falla recién en el navegador del usuario, con un error
# incomprensible. Mejor un log claro en Dokploy ahora.
RUN if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" ]; then \
      echo "" >&2; \
      echo "ERROR: faltan las variables públicas de Supabase en el BUILD." >&2; \
      echo "  NEXT_PUBLIC_SUPABASE_URL              = '${NEXT_PUBLIC_SUPABASE_URL}'" >&2; \
      echo "  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  = '${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}'" >&2; \
      echo "" >&2; \
      echo "Next las incrusta en el bundle del navegador al compilar, así que" >&2; \
      echo "tienen que existir ahora, no sólo al arrancar el contenedor." >&2; \
      echo "En Dokploy: pestaña Environment de la aplicación." >&2; \
      echo "" >&2; \
      exit 1; \
    fi

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build


# --- runner: sólo lo necesario para servir ---------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# dumb-init como PID 1: Dokploy reinicia y detiene contenedores a menudo, y
# así el SIGTERM llega limpio a Next en vez de morir de un SIGKILL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/*

# Usuario sin privilegios: el servidor no necesita ser root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# `standalone` trae el server con sus dependencias; `static` y `public` van
# aparte porque Next no los copia adentro.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Dokploy y Traefik miran este estado para saber si el contenedor está sano.
# Cualquier respuesta HTTP por debajo de 500 significa que el server contesta;
# no se chequea una ruta de negocio a propósito.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/entrar').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
