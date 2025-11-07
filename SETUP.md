# Инструкция по установке и настройке

Детальная инструкция по развертыванию neiropsy_bot.

## 📋 Содержание

1. [Предварительные требования](#предварительные-требования)
2. [Получение Telegram Bot Token](#получение-telegram-bot-token)
3. [Установка через Docker Compose](#установка-через-docker-compose)
4. [Локальная установка](#локальная-установка)
5. [Настройка переменных окружения](#настройка-переменных-окружения)
6. [Первый запуск](#первый-запуск)
7. [Загрузка опросников](#загрузка-опросников)
8. [Проверка работоспособности](#проверка-работоспособности)
9. [Troubleshooting](#troubleshooting)

## Предварительные требования

### Для Docker Compose

- Docker >= 20.10
- Docker Compose >= 2.0
- 2 GB свободной оперативной памяти
- 5 GB свободного места на диске

### Для локальной установки

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 12
- Redis >= 6 (опционально)

## Получение Telegram Bot Token

1. Откройте Telegram и найдите бота [@BotFather](https://t.me/BotFather)

2. Отправьте команду `/newbot`

3. Следуйте инструкциям:
   - Введите название бота (например: "Neiropsy Questionnaire Bot")
   - Введите username бота (должен заканчиваться на `bot`, например: `neiropsy_test_bot`)

4. Сохраните полученный токен (формат: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

5. Узнайте свой Telegram ID:
   - Найдите бота [@userinfobot](https://t.me/userinfobot)
   - Отправьте `/start`
   - Скопируйте ваш ID (число)

## Установка через Docker Compose

### Шаг 1: Клонирование репозитория

```bash
git clone https://github.com/your-org/neiropsy_bot.git
cd neiropsy_bot
```

### Шаг 2: Создание .env файла

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=ВАШ_ТОКЕН_БОТА
ADMIN_TELEGRAM_ID=ВАШ_TELEGRAM_ID
# Для поддержки нескольких администраторов используйте ADMIN_TELEGRAM_IDS:
# ADMIN_TELEGRAM_IDS=48617336,134502444

# Database
DATABASE_URL=postgres://neiropsy:neiropsy_password@db:5432/neiropsy_db

# Redis (для production рекомендуется)
REDIS_URL=redis://redis:6379/0

# Server
PORT=8088
NODE_ENV=production
LOG_LEVEL=info
```

### Шаг 3: Запуск контейнеров

```bash
# Запустить в фоновом режиме
docker-compose up -d

# Посмотреть логи
docker-compose logs -f app
```

### Шаг 4: Проверка статуса

```bash
# Проверить что все контейнеры запущены
docker-compose ps

# Должны быть running: neiropsy_bot, neiropsy_db, neiropsy_redis
```

## Локальная установка

### Шаг 1: Установка PostgreSQL

#### macOS (Homebrew)

```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql-15
sudo systemctl start postgresql
```

#### Создание базы данных

```bash
sudo -u postgres psql

CREATE DATABASE neiropsy_db;
CREATE USER neiropsy WITH PASSWORD 'neiropsy_password';
GRANT ALL PRIVILEGES ON DATABASE neiropsy_db TO neiropsy;
\q
```

### Шаг 2: Установка Redis (опционально)

#### macOS

```bash
brew install redis
brew services start redis
```

#### Ubuntu/Debian

```bash
sudo apt install redis-server
sudo systemctl start redis
```

### Шаг 3: Установка зависимостей Node.js

```bash
npm install
```

### Шаг 4: Настройка .env

Создайте файл `.env` в корне проекта со следующим содержимым:

```env
TELEGRAM_BOT_TOKEN=ВАШ_ТОКЕН_БОТА
ADMIN_TELEGRAM_ID=ВАШ_TELEGRAM_ID
# Для поддержки нескольких администраторов используйте ADMIN_TELEGRAM_IDS:
# ADMIN_TELEGRAM_IDS=48617336,134502444
DATABASE_URL=postgres://neiropsy:neiropsy_password@localhost:5432/neiropsy_db
REDIS_URL=redis://localhost:6379/0
PORT=8088
NODE_ENV=development
LOG_LEVEL=debug
```

### Шаг 5: Выполнение миграций

```bash
# Выполнить SQL миграции вручную
psql -U neiropsy -d neiropsy_db -f app/migrations/001_init.sql
psql -U neiropsy -d neiropsy_db -f app/migrations/002_batch_tables.sql
psql -U neiropsy -d neiropsy_db -f app/migrations/003_batch_sessions.sql
psql -U neiropsy -d neiropsy_db -f app/migrations/004_batch_responses.sql
psql -U neiropsy -d neiropsy_db -f app/migrations/005_batch_reports.sql
psql -U neiropsy -d neiropsy_db -f app/migrations/006_indexes_and_constraints.sql
```

### Шаг 6: Сборка TypeScript

```bash
npm run build
```

### Шаг 7: Запуск приложения

```bash
# Development режим (с hot reload)
npm run dev

# Production режим
npm start
```

## Настройка переменных окружения

### Обязательные параметры

| Переменная | Описание | Пример |
|------------|----------|--------|
| `TELEGRAM_BOT_TOKEN` | Токен бота от @BotFather | `123456:ABC-DEF...` |
| `ADMIN_TELEGRAM_ID` | Ваш Telegram ID (для обратной совместимости) | `123456789` |
| `ADMIN_TELEGRAM_IDS` | Список Telegram ID администраторов через запятую | `123456789,987654321` |
| `DATABASE_URL` | URL PostgreSQL | `postgres://user:pass@host:5432/db` |

**Примечание:** Требуется указать либо `ADMIN_TELEGRAM_ID`, либо `ADMIN_TELEGRAM_IDS`. Если указан `ADMIN_TELEGRAM_IDS`, он имеет приоритет и позволяет добавить несколько администраторов.

### Опциональные параметры

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `REDIS_URL` | URL Redis (рекомендуется) | - |
| `PORT` | Порт REST API | `8088` |
| `NODE_ENV` | Окружение | `development` |
| `LOG_LEVEL` | Уровень логов | `info` |

## Первый запуск

### 1. Проверка подключения к базе данных

```bash
# Для Docker
docker-compose exec db psql -U neiropsy -d neiropsy_db -c "SELECT NOW();"

# Для локальной установки
psql -U neiropsy -d neiropsy_db -c "SELECT NOW();"
```

### 2. Проверка работы API

```bash
curl http://localhost:8088/health
```

Ожидаемый ответ:

```json
{
  "status": "ok",
  "timestamp": "2025-11-06T...",
  "uptime": 123.45
}
```

### 3. Проверка Telegram бота

1. Найдите вашего бота в Telegram (по username)
2. Отправьте `/start`
3. Вы должны увидеть главное меню (так как вы администратор)

## Загрузка опросников

### Через bash скрипт

```bash
cd examples

# Сделать скрипт исполняемым
chmod +x upload-questionnaire.sh

# Установить переменные окружения
export API_URL=http://localhost:8088
export ADMIN_TELEGRAM_ID=ваш_id

# Загрузить опросники (примеры)
./upload-questionnaire.sh adhd-questionnaire.json adhd-scoring.json
./upload-questionnaire.sh mchat-questionnaire.json mchat-scoring.json

# Доступны также следующие опросники:
# - Conners 3, Vanderbilt, DuPaul, SNAP-IV (СДВГ)
# - Barkley HSQ/SSQ (поведение в ситуациях)
# - Brown ADD, WURS (исполнительные функции)
# - CARS-2, GARS-3, ADOS-2, ADI-R, SRS-2, SCQ, AQ, ASSQ, CAST (аутизм)
# - BRIEF-2 (исполнительные функции)
```

**Полный список доступных опросников см. в [examples/QUESTIONNAIRES.md](./examples/QUESTIONNAIRES.md)**

### Через curl

```bash
curl -X POST http://localhost:8088/questionnaires \
  -H "Content-Type: application/json" \
  -H "X-Telegram-ID: ВАШ_TELEGRAM_ID" \
  -d @- << 'EOF'
{
  "telegram_id": ВАШ_TELEGRAM_ID,
  "questionnaire": {
    "title": "Тестовый опросник",
    "version": "1.0",
    "language": "ru",
    "questions": [...]
  },
  "scoring": {
    "scales": [...],
    "overall": {...}
  }
}
EOF
```

## Проверка работоспособности

### 1. Создание опроса через бота

1. Откройте бота в Telegram
2. Нажмите "📋 Создать опрос"
3. Выберите опросники из списка
4. Подтвердите создание
5. Получите ссылку для клиента

### 2. Просмотр списка опросников

1. Откройте бота в Telegram
2. Нажмите "📚 Список опросников"
3. Выберите опросник для просмотра деталей
4. Просмотрите вопросы, опции ответов и шкалы оценки
5. Используйте кнопку "◀️ Назад к списку" для возврата

### 3. Прохождение опроса

1. Откройте ссылку в другом аккаунте Telegram (или браузере)
2. Нажмите "▶️ Начать"
3. Ответьте на вопросы
4. Проверьте, что администратор получил уведомление

### 4. Просмотр отчета

1. В меню администратора нажмите "📊 Мои опросы"
2. Выберите завершенный опрос из списка
3. Просмотрите автоматически сгенерированный отчет
4. Нажмите "📋 Ответы на вопросы" для детального просмотра всех ответов по каждому опроснику

### 5. Экспорт данных

1. В просмотре отчета нажмите "📄 Получить JSON" или "📊 Получить CSV"
2. Скопируйте ссылку и откройте в браузере
3. Проверьте полученный файл

## Troubleshooting

### Проблема: Бот не отвечает

**Решение:**

```bash
# Проверьте логи
docker-compose logs -f app

# Проверьте токен бота
echo $TELEGRAM_BOT_TOKEN

# Перезапустите контейнер
docker-compose restart app
```

### Проблема: Ошибка подключения к БД

**Решение:**

```bash
# Проверьте статус PostgreSQL
docker-compose ps db

# Проверьте логи БД
docker-compose logs db

# Проверьте подключение
docker-compose exec app psql $DATABASE_URL -c "SELECT 1;"
```

### Проблема: Не сохраняется прогресс

**Причина:** Redis не настроен или недоступен

**Решение:**

```bash
# Проверьте Redis
docker-compose ps redis

# Если не используете Redis, прогресс сохраняется в памяти
# При перезапуске приложения незавершенные сессии будут потеряны
```

### Проблема: Ошибка при загрузке опросника

**Причина:** Неверный Telegram ID или формат JSON

**Решение:**

```bash
# Проверьте формат JSON
cat adhd-questionnaire.json | jq .

# Проверьте что ваш ID совпадает с ADMIN_TELEGRAM_ID или находится в ADMIN_TELEGRAM_IDS
echo $ADMIN_TELEGRAM_ID
echo $ADMIN_TELEGRAM_IDS

# Для нескольких администраторов убедитесь, что ID указаны через запятую без пробелов
# Правильно: ADMIN_TELEGRAM_IDS=123456,789012
# Неправильно: ADMIN_TELEGRAM_IDS=123456, 789012
```

### Проблема: Порт 8088 занят

**Решение:**

```bash
# Измените порт в .env
PORT=8089

# Перезапустите
docker-compose down
docker-compose up -d
```

## Обновление приложения

### Docker Compose

```bash
# Остановить контейнеры
docker-compose down

# Получить обновления
git pull

# Пересобрать образы
docker-compose build

# Запустить с новой версией
docker-compose up -d
```

### Локальная установка

```bash
# Получить обновления
git pull

# Установить новые зависимости
npm install

# Выполнить новые миграции (если есть)
psql -U neiropsy -d neiropsy_db -f app/migrations/XXX_new_migration.sql

# Пересобрать
npm run build

# Перезапустить
npm start
```

## Мониторинг

### Логи приложения

```bash
# Docker
docker-compose logs -f app

# PM2 (если используется)
pm2 logs neiropsy_bot
```

### Метрики базы данных

```bash
docker-compose exec db psql -U neiropsy -d neiropsy_db

-- Количество батчей
SELECT COUNT(*) FROM questionnaire_batches;

-- Количество сессий
SELECT COUNT(*), completed FROM batch_sessions GROUP BY completed;

-- Количество отчетов
SELECT COUNT(*) FROM batch_reports;
```

## Резервное копирование

### Backup базы данных

```bash
# Создать backup
docker-compose exec db pg_dump -U neiropsy neiropsy_db > backup_$(date +%Y%m%d).sql

# Восстановить из backup
docker-compose exec -T db psql -U neiropsy neiropsy_db < backup_20251106.sql
```

---

**Готово!** Теперь ваш neiropsy_bot полностью настроен и готов к использованию.

При возникновении проблем создайте issue в GitHub или обратитесь к администратору проекта.

