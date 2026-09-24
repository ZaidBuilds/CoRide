FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# Full install: the TypeScript build needs devDependencies.
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DATA_DIR=/app/data
# Runtime needs only the compiled output, prod deps, the public legal pages
# and init.sql (applied on boot when DATABASE_URL is set).
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/init.sql ./init.sql
# File-store mode writes here; mount a volume (or set DATABASE_URL) so data
# survives redeploys. Runs as the unprivileged `node` user.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
# node as PID 1 receives SIGTERM directly -> graceful drain + store flush.
CMD ["node", "dist/index.js"]
