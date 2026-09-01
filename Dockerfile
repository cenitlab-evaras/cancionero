# syntax=docker/dockerfile:1

# Imagen de producción de Cantoral (Next.js 16 · React 19 · Supabase).
# El contexto de build es esta carpeta `app/`, no la raíz del repo.
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
#     -t cantoral .
#
#   docker run --rm -p 3000:3000 \
#     -e NEXT_PUBLIC_SUPABASE_URL=... \
#     -e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
#     cantoral

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

# Las variables NEXT_PUBLIC_ se INCRUSTAN en el bundle del navegador durante
# el build: tienen que estar acá, no sólo en `docker run`. Son las claves
# públicas de Supabase (protegidas por RLS), nunca la SUPABASE_SECRET_KEY.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}

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

CMD ["node", "server.js"]
