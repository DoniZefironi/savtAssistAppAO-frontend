# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# --fetch-* и --no-audit/--no-fund — сборочный сервер иногда обрывает
# соединение с registry.npmjs.org на новых (ещё не закэшированных) пакетах
# ("npm error Exit handler never called!" — известный баг npm при нестабильной
# сети), из-за чего npm ci падал уже спустя 2+ минуты. Больше попыток и таймаут
# терпимее к медленной/нестабильной сети, а audit/fund — лишние запросы, без
# которых сборка спокойно обходится.
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-timeout=300000

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* переменные вшиваются в клиентский бандл на этапе сборки,
# поэтому адрес бэкенда нужно задавать через --build-arg, а не через
# переменные окружения контейнера в рантайме.
ARG NEXT_PUBLIC_API_URL=https://helper.savt.by
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
