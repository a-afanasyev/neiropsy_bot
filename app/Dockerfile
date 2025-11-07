# Используем официальный образ Node.js LTS
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json (package-lock.json может отсутствовать)
COPY package.json ./

# Устанавливаем ВСЕ зависимости (включая devDependencies для сборки)
RUN npm install

# Копируем исходный код и конфигурацию
COPY app/src ./app/src
COPY tsconfig.json ./

# Собираем TypeScript (outDir будет ./dist относительно корня)
RUN npm run build

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Меняем владельца файлов
RUN chown -R nodejs:nodejs /app

# Переключаемся на непривилегированного пользователя
USER nodejs

# Открываем порт для API
EXPOSE 8088

# Запускаем приложение (файлы компилируются в dist/src/)
CMD ["node", "dist/src/index.js"]

