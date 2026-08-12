FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
CMD ["sh", "-c", "node scripts/wait-for-database.mjs && node scripts/migrate-prod.mjs && node dist/index.js"]
