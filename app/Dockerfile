FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
# Используем npm install вместо npm ci, так как package-lock.json может отсутствовать
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Копируем исходный код
COPY tsconfig.json ./
COPY app ./app

# Устанавливаем TypeScript и собираем проект
RUN npm install -D typescript && \
    npm run build && \
    npm prune --production

FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs

EXPOSE 8080

CMD ["node", "dist/src/index.js"]
