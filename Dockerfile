# ---- Etapa de build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Etapa de produção ----
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY drizzle.config.ts ./
COPY drizzle ./drizzle

EXPOSE 3000

CMD ["node", "dist/index.js"]