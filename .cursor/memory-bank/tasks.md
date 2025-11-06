# MEMORY BANK: Neiropsy Bot

## 📊 Обзор проекта

**Название**: Neiropsy Bot  
**Тип**: Telegram-бот для психологических и нейропсихологических опросов  
**Версия**: 1.0.0 (MVP)  
**Статус**: В эксплуатации

## 🏗️ Технологический стек

### Backend
- **Runtime**: Node.js 20+
- **Язык**: TypeScript 5.3.3
- **Framework**: Fastify 4.25.2 (REST API)
- **Telegram**: node-telegram-bot-api 0.64.0
- **Database**: PostgreSQL 16
- **ORM/Client**: pg (нативный PostgreSQL клиент)
- **Validation**: Zod 3.22.4

### DevOps
- **Containerization**: Docker + Docker Compose
- **Database Port**: 5439 (хост) → 5432 (контейнер)
- **API Port**: 8088

### Development Tools
- **Test Framework**: Jest 29.7.0
- **Build**: TypeScript Compiler
- **Dev Runner**: tsx
- **Linter**: ESLint + TypeScript ESLint
- **Formatter**: Prettier

## 📁 Структура проекта

```
neiropsy_bot/
├── app/
│   ├── src/
│   │   ├── index.ts          # Главный файл запуска
│   │   ├── config.ts          # Конфигурация
│   │   ├── types.ts           # TypeScript типы
│   │   ├── repo.ts            # Репозиторий (работа с БД)
│   │   ├── schema.ts          # Валидация JSON схем (Zod)
│   │   ├── scoring.ts         # Движок оценивания ответов
│   │   ├── server.ts          # REST API (Fastify)
│   │   ├── bot.ts             # Telegram бот логика
│   │   └── texts.ru.ts        # Русские тексты интерфейса
│   ├── migrations/
│   │   └── 001_init.sql       # Инициализация БД
│   ├── __tests__/             # Тесты
│   │   ├── schema.test.ts
│   │   └── scoring.test.ts
│   └── Dockerfile
├── examples/                  # Примеры опросников
│   ├── adhd-questionnaire.json
│   ├── mchat-questionnaire.json
│   ├── sdq-questionnaire.json
│   └── ...
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

## ✅ Реализованные функции

### Основной функционал
- ✅ Создание опросников через JSON
- ✅ Генерация одноразовых ссылок (токенов) с истечением через 24 часа
- ✅ Поддержка типов вопросов: single_choice, multi_choice, likert_5, numeric, text, date
- ✅ Автоматическое вычисление результатов (scoring engine)
- ✅ Уведомления администратора о новых ответах
- ✅ Выгрузка результатов в CSV/JSON
- ✅ Полная анонимность клиентов
- ✅ Русский интерфейс
- ✅ REST API для управления опросниками
- ✅ Healthcheck для контейнеров
- ✅ Тесты для schema и scoring

### Улучшения (из последних коммитов)
- ✅ **Persistent state storage** - состояние пользователей в PostgreSQL (было в памяти)
- ✅ **Professional questionnaires** - готовые опросники:
  - ADHD (attention deficit hyperactivity disorder)
  - M-CHAT (modified checklist for autism)
  - SDQ (strengths and difficulties questionnaire)
  - Sensory Processing (сенсорная обработка)
- ✅ **Setup documentation** - SETUP.md с пошаговыми инструкциями
- ✅ **Port optimization** - стандартизированные порты (8088, 5439)

## 🔄 Текущие задачи

### Статус: ✅ Платформа развернута и работает - 2025-11-06 13:24

**Платформа полностью развернута и функционирует.** Все контейнеры запущены, API работает, Telegram бот активен.

### Завершенные задачи сегодня (2025-11-06)
- ✅ Исправлен Dockerfile для работы без package-lock.json
- ✅ Исправлены все ошибки компиляции TypeScript
- ✅ Создан declaration file для json2csv
- ✅ Успешно собраны Docker образы
- ✅ Запущены все контейнеры (db + app)
- ✅ Проверена работоспособность API
- ✅ Создан volume для PostgreSQL данных

### Последние обновления в коде (Git History)
1. ✅ **Persistent user state** - состояние пользователей сохраняется в БД
2. ✅ **Professional questionnaires** - ADHD, M-CHAT, SDQ, Sensory опросники
3. ✅ **Documentation** - SETUP.md с детальными инструкциями
4. ✅ **Port configuration** - API: 8088, PostgreSQL: 5439

## 📋 Roadmap (из документации)

Планируемые улучшения:

- [x] ~~Redis для хранения состояний~~ ✅ **ГОТОВО** - используется PostgreSQL для persistent state
- [ ] Аутентификация REST API (JWT или API keys)
- [ ] Возможность редактировать ответы
- [ ] Сохранение прогресса и продолжение позже
- [ ] Поддержка файловых вложений
- [ ] Мультиязычность
- [ ] Web-интерфейс для админа
- [ ] Графики и визуализация результатов
- [ ] Экспорт в PDF

### 🎯 Приоритетные задачи для улучшения

1. **Аутентификация REST API** - защита endpoints
2. **Web-интерфейс админа** - удобное управление опросниками
3. **Сохранение прогресса** - возможность продолжить опрос позже

## 🎯 Известные ограничения MVP

1. ~~Состояние пользователей хранится в памяти~~ ✅ **ИСПРАВЛЕНО** - теперь в PostgreSQL
2. Нет аутентификации для REST API
3. Нет возможности редактировать ответы
4. Нельзя продолжить опрос позже
5. Файловые загрузки не поддерживаются

## 🔐 Безопасность

- ✅ Полная анонимность опросов
- ✅ Криптографически стойкие токены
- ✅ Доступ к админ-функциям только по Telegram ID
- ✅ Автоматическое истечение сессий через 24 часа
- ✅ Одноразовые токены (нельзя использовать повторно)

## 📊 База данных

### Основные таблицы
- `questionnaires` - опросники (questionnaire + scoring JSON)
- `sessions` - одноразовые токены для опросов
- `responses` - ответы клиентов с результатами scoring

### Миграции
- Автоматически применяются при запуске контейнера БД
- Файл: `app/migrations/001_init.sql`

## 🚀 Команды запуска

### Production (Docker)
```bash
docker-compose up -d
```

### Development
```bash
docker-compose up -d db  # только БД
npm run dev              # запуск с hot-reload
```

### Tests
```bash
npm test
```

## 📝 Примечания

- **Ветка**: `claude/telegram-survey-bot-mvp-011CUr8P5YueDFLRkAnspLTp`
- **Файлов TypeScript**: 11 (включая тесты)
- **Конфигурация**: `.env` настроен (последнее изменение: 6 ноября 12:53)
- **Стиль кода**: Простой, понятный для Junior разработчика
- **Язык**: Все комментарии и документация на русском
- **Принципы**: Без сложных техник (без наследования, рефлексии и т.д.)
- **Docker**: Контейнеры не запущены, volume отсутствует (будет создан при первом запуске)

