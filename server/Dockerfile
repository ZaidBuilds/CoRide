FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production 2>/dev/null || npm i
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["node", "dist/index.js"]
