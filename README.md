# Neiropsy Bot

Telegram-бот для психологических и нейропсихологических опросов (MVP версия).

## Описание

Это система для проведения анонимных психологических опросов через Telegram. Специалист создает одноразовые ссылки на опросы, клиенты проходят их, а результаты автоматически обрабатываются и отправляются только специалисту.

### Основные возможности

- ✅ Создание опросников через JSON (questionnaire + scoring)
- ✅ Генерация одноразовых ссылок с истечением через 24 часа
- ✅ Поддержка различных типов вопросов (single_choice, multi_choice, likert_5, numeric, text, date)
- ✅ Автоматическое вычисление результатов по заданным правилам
- ✅ Уведомления администратора о новых ответах
- ✅ Выгрузка результатов в CSV/JSON
- ✅ Полная анонимность клиентов
- ✅ Русский интерфейс

## Требования

- Node.js 20+
- PostgreSQL 16+
- Docker и Docker Compose (для запуска в контейнерах)
- Telegram Bot Token (получить у [@BotFather](https://t.me/botfather))

## Быстрый старт

### 1. Клонирование и настройка

```bash
git clone <repository-url>
cd neiropsy_bot

# Создать .env файл
cp .env.example .env

# Отредактировать .env и указать свои данные:
# - TELEGRAM_BOT_TOKEN (получить у @BotFather)
# - ADMIN_TG_ID (ваш Telegram ID, узнать у @userinfobot)
# - PUBLIC_BOT_LINK (ссылка на бота, например https://t.me/your_bot_name)
```

### 2. Запуск с Docker Compose

```bash
# Запустить все сервисы
docker-compose up -d

# Проверить логи
docker-compose logs -f app
```

Сервисы будут доступны:
- REST API: http://localhost:8080
- PostgreSQL: localhost:5432

### 3. Запуск для разработки (локально)

```bash
# Установить зависимости
npm install

# Запустить PostgreSQL в Docker
docker-compose up -d db

# Применить миграции (автоматически при старте БД)

# Запустить в dev режиме
npm run dev

# Или собрать и запустить
npm run build
npm start
```

## Использование

### Для администратора

#### Команды в Telegram

- `/help` - справка по командам
- `/newsession <questionnaire_id>` - создать новую сессию (одноразовую ссылку)
- `/listq` - список доступных опросников
- `/listr <questionnaire_id>` - список последних ответов

#### Создание опросника через API

```bash
curl -X POST http://localhost:8080/questionnaires \
  -H "Content-Type: application/json" \
  -d '{
    "questionnaire": <содержимое questionnaire.json>,
    "scoring": <содержимое scoring.json>
  }'
```

Примеры опросников находятся в папке `examples/`.

#### Быстрая загрузка примера

```bash
cd examples
./upload-questionnaire.sh
```

### Для клиента

1. Клиент получает ссылку от специалиста вида: `https://t.me/your_bot?start=<token>`
2. Переходит по ссылке, нажимает "Начать"
3. Отвечает на вопросы по порядку
4. Проверяет ответы и отправляет
5. Получает подтверждение

Ссылка действует 24 часа и может быть использована только один раз.

## Структура проекта

```
neiropsy_bot/
├── app/
│   ├── src/
│   │   ├── index.ts          # Главный файл (запуск всех сервисов)
│   │   ├── config.ts          # Конфигурация
│   │   ├── types.ts           # TypeScript типы
│   │   ├── repo.ts            # Работа с БД
│   │   ├── schema.ts          # Валидация JSON схем
│   │   ├── scoring.ts         # Движок оценивания
│   │   ├── server.ts          # REST API
│   │   ├── bot.ts             # Telegram бот
│   │   └── texts.ru.ts        # Тексты интерфейса
│   ├── migrations/
│   │   └── 001_init.sql       # SQL миграции
│   ├── __tests__/             # Тесты
│   └── Dockerfile
├── examples/
│   ├── questionnaire-demo.json
│   ├── scoring-demo.json
│   └── upload-questionnaire.sh
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

## Типы вопросов

### single_choice
Выбор одного варианта из списка (показывается в виде кнопок).

```json
{
  "key": "q1",
  "text": "Вопрос?",
  "type": "single_choice",
  "options": [
    { "value": "yes", "label": "Да" },
    { "value": "no", "label": "Нет" }
  ],
  "required": true
}
```

### multi_choice
Выбор нескольких вариантов (ввод через запятую).

```json
{
  "key": "q2",
  "text": "Выберите все подходящие варианты",
  "type": "multi_choice",
  "options": [
    { "value": "a", "label": "Вариант А" },
    { "value": "b", "label": "Вариант Б" }
  ],
  "required": true
}
```

### likert_5
Шкала от 1 до 5 (показывается в виде кнопок).

```json
{
  "key": "q3",
  "text": "Оцените по шкале",
  "type": "likert_5",
  "labels": ["никогда", "редко", "иногда", "часто", "всегда"],
  "required": true
}
```

### numeric
Числовой ответ с опциональными ограничениями.

```json
{
  "key": "q4",
  "text": "Возраст",
  "type": "numeric",
  "min": 0,
  "max": 120,
  "required": true
}
```

### text
Текстовый ответ.

```json
{
  "key": "q5",
  "text": "Опишите ситуацию",
  "type": "text",
  "max_len": 500,
  "required": false
}
```

### date
Дата в формате YYYY-MM-DD.

```json
{
  "key": "q6",
  "text": "Дата рождения",
  "type": "date",
  "required": false
}
```

## Система оценивания

### Правила (rules)

#### when - точное совпадение
```json
{
  "when": { "q1": "yes" },
  "add": 2
}
```

#### when_range - диапазоны для чисел
```json
{
  "when_range": { "q2": { "gte": 4, "lte": 5 } },
  "add": 3
}
```

Операторы: `gte` (>=), `gt` (>), `lte` (<=), `lt` (<)

### Пороги (thresholds)

Определяют интерпретацию набранных баллов.

```json
{
  "thresholds": [
    { "gte": 0, "lt": 2, "level": "низкий риск" },
    { "gte": 2, "lt": 4, "level": "средний риск" },
    { "gte": 4, "level": "высокий риск" }
  ]
}
```

### Флаги (flags)

Специальные условия для важных находок.

```json
{
  "flags": [
    { "if_missing_required": true },
    { "if_text_contains": { "q5": ["агрессия", "самоповреждение"] } }
  ]
}
```

## REST API

### GET /health
Проверка работоспособности.

### POST /questionnaires
Создать опросник.

Request:
```json
{
  "questionnaire": { ... },
  "scoring": { ... }
}
```

### GET /questionnaires
Список опросников.

Query params:
- `active_only` (boolean) - только активные

### GET /questionnaires/:id
Получить опросник по ID.

### POST /sessions
Создать сессию (одноразовую ссылку).

Request:
```json
{
  "questionnaire_id": "uuid"
}
```

Response:
```json
{
  "success": true,
  "link": "https://t.me/bot?start=token",
  "token": "...",
  "expires_at": "2024-..."
}
```

### GET /responses
Список ответов.

Query params:
- `questionnaire_id` (uuid) - фильтр по опроснику
- `limit` (number) - количество
- `offset` (number) - смещение

### GET /responses/:id
Получить конкретный ответ.

### GET /exports/responses.csv
Экспорт в CSV.

Query params:
- `questionnaire_id` (uuid) - опционально

### GET /exports/responses.json
Экспорт в JSON.

Query params:
- `questionnaire_id` (uuid) - опционально

## Тестирование

```bash
# Запустить все тесты
npm test

# С покрытием
npm test -- --coverage

# Отдельный файл
npm test -- scoring.test.ts
```

## Разработка

### Линтинг и форматирование

```bash
# Проверить код
npm run lint

# Форматировать
npm run format
```

### Структура базы данных

Основные таблицы:
- `questionnaires` - опросники
- `sessions` - одноразовые токены
- `responses` - ответы клиентов

См. подробности в `app/migrations/001_init.sql`.

## Безопасность

- Все опросы полностью анонимны
- Токены сессий генерируются криптографически стойким генератором
- Доступ к админ-функциям только по Telegram ID
- Сессии автоматически истекают через 24 часа
- Использованные токены нельзя применить повторно

## Ограничения MVP

- Состояние пользователей хранится в памяти (для продакшена использовать Redis)
- Нет аутентификации для REST API (добавить JWT или API keys)
- Нет возможности редактировать ответы
- Нельзя продолжить опрос позже
- Файловые загрузки не поддерживаются

## Roadmap

- [ ] Redis для хранения состояний
- [ ] Аутентификация REST API
- [ ] Возможность редактировать ответы
- [ ] Сохранение прогресса и продолжение позже
- [ ] Поддержка файловых вложений
- [ ] Мультиязычность
- [ ] Web-интерфейс для админа
- [ ] Графики и визуализация результатов
- [ ] Экспорт в PDF

## Лицензия

MIT

## Поддержка

По вопросам и проблемам создавайте issue в репозитории.
