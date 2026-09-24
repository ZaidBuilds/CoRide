FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
# Full install: the TypeScript build needs devDependencies.
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
EXPOSE 4000
CMD ["node", "dist/index.js"]
