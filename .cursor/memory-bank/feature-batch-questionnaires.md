# PLAN: Батч-опросники (Множественные опросники)

**Дата создания**: 2025-11-06  
**Уровень сложности**: Level 3 (Feature Development)  
**Статус**: В планировании

---

## 🎯 ЦЕЛЬ ФИЧИ

Разработать систему создания и прохождения **батчей опросников** - когда специалист создает набор из нескольких опросников, а пользователь проходит их последовательно по одной ссылке.

---

## 📋 ТРЕБОВАНИЯ

### Функциональные требования

#### 1. Создание батча (Специалист)
- ✅ Специалист начинает создание опросника через Telegram бота
- ✅ Появляется выбор доступных опросников с возможностью множественного выбора
- ✅ На основе выбранных опросников генерируется одна уникальная ссылка
- ✅ Ссылка имеет срок действия (24 часа по умолчанию)

#### 2. Прохождение опросов (Пользователь)
- ✅ Пользователь переходит по ссылке
- ✅ Получает опросники **последовательно** (один за другим)
- ✅ После завершения одного опросника автоматически начинается следующий
- ✅ Показывается прогресс (например, "Опросник 2 из 4")
- ✅ Возможность прервать и продолжить позже (опционально)

#### 3. Получение результатов (Специалист)
- ✅ Специалист получает уведомление о завершении всех опросников
- ✅ Доступен **агрегированный отчет** с анализом всех опросников
- ✅ Возможность выгрузки детальных ответов на все вопросы (опционально)
- ✅ Выгрузка в форматах: JSON, CSV

---

## 🏗️ АРХИТЕКТУРА РЕШЕНИЯ

### Текущая система
```
Специалист → создает сессию для ОДНОГО опросника
              ↓
            Генерирует ссылку
              ↓
Пользователь → проходит ОДИН опросник
              ↓
            Сохраняется ОДИН ответ (response)
              ↓
Специалист → получает результат одного опросника
```

### Новая система (батчи)
```
Специалист → выбирает НЕСКОЛЬКО опросников
              ↓
            Создает БАТЧ
              ↓
            Генерирует ОДНУ ссылку для батча
              ↓
Пользователь → проходит опросники ПОСЛЕДОВАТЕЛЬНО
              ↓
            Сохраняется ответ для КАЖДОГО опросника
              ↓
            После завершения всех - создается БАТЧ-ОТВЕТ
              ↓
Специалист → получает АГРЕГИРОВАННЫЙ отчет + детальные ответы
```

---

## 🗄️ СХЕМА БАЗЫ ДАННЫХ

### Новые таблицы

#### 1. `questionnaire_batches`
Хранит информацию о батчах опросников.

```sql
CREATE TABLE questionnaire_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL, -- Название батча (например, "Комплексная оценка ребенка")
    description TEXT, -- Описание батча
    created_by_telegram_id BIGINT NOT NULL, -- Telegram ID специалиста
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_batches_created_by ON questionnaire_batches(created_by_telegram_id);
CREATE INDEX idx_batches_active ON questionnaire_batches(is_active);
```

#### 2. `batch_questionnaires`
Связь между батчами и опросниками (many-to-many) с порядком.

```sql
CREATE TABLE batch_questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES questionnaire_batches(id) ON DELETE CASCADE,
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL, -- Порядок прохождения (1, 2, 3...)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(batch_id, questionnaire_id),
    UNIQUE(batch_id, order_index)
);

CREATE INDEX idx_batch_questionnaires_batch ON batch_questionnaires(batch_id, order_index);
```

#### 3. `batch_sessions`
Сессии для батчей (аналог sessions, но для батчей).

```sql
CREATE TABLE batch_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES questionnaire_batches(id) ON DELETE CASCADE,
    token VARCHAR(100) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed BOOLEAN DEFAULT false, -- Все опросники завершены
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT token_format CHECK (length(token) >= 20)
);

CREATE UNIQUE INDEX idx_batch_sessions_token ON batch_sessions(token);
CREATE INDEX idx_batch_sessions_batch ON batch_sessions(batch_id);
CREATE INDEX idx_batch_sessions_expires ON batch_sessions(expires_at);
```

#### 4. `batch_responses`
Ответы в контексте батча (связь response -> batch_session).

```sql
CREATE TABLE batch_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_session_id UUID NOT NULL REFERENCES batch_sessions(id) ON DELETE CASCADE,
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL, -- Порядок прохождения
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(batch_session_id, questionnaire_id),
    UNIQUE(batch_session_id, response_id)
);

CREATE INDEX idx_batch_responses_batch_session ON batch_responses(batch_session_id);
CREATE INDEX idx_batch_responses_order ON batch_responses(batch_session_id, order_index);
```

#### 5. `batch_reports`
Агрегированные отчеты по батчам.

```sql
CREATE TABLE batch_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_session_id UUID NOT NULL REFERENCES batch_sessions(id) ON DELETE CASCADE,
    summary_text TEXT, -- Итоговый анализ всех опросников
    aggregated_scores_json JSONB, -- Агрегированные баллы
    flags_json JSONB, -- Флаги и предупреждения
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(batch_session_id)
);

CREATE INDEX idx_batch_reports_batch_session ON batch_reports(batch_session_id);
```

---

## 🔄 WORKFLOW

### 1. Создание батча специалистом

**Команда в Telegram**: `/newbatch`

**Сценарий**:
1. Бот отправляет список доступных опросников с кнопками (inline keyboard)
2. Специалист выбирает несколько опросников (checkbox-стиль)
3. Специалист подтверждает выбор
4. Система создает:
   - Запись в `questionnaire_batches`
   - Записи в `batch_questionnaires` (с порядком)
   - Запись в `batch_sessions` (токен)
5. Бот отправляет специалисту ссылку: `https://t.me/bot?start=batch_{token}`

### 2. Прохождение батча пользователем

**Сценарий**:
1. Пользователь переходит по ссылке `/start batch_{token}`
2. Бот проверяет:
   - Токен действителен
   - Батч-сессия не завершена
   - Батч-сессия не истекла
3. Бот загружает список опросников в батче
4. Бот начинает с первого опросника:
   - "Вы будете проходить 4 опросника. Начинаем с первого: «СДВГ скрининг»"
   - Задает вопросы первого опросника
5. После завершения первого опросника:
   - Сохраняет ответ в `responses`
   - Создает связь в `batch_responses`
   - Сообщает: "Опросник 1 из 4 завершен. Переходим к следующему: «M-CHAT»"
6. Повторяет для всех опросников
7. После завершения всех:
   - Отмечает `batch_sessions.completed = true`
   - Генерирует агрегированный отчет в `batch_reports`
   - Отправляет уведомление специалисту

### 3. Получение результатов специалистом

**Команда**: `/batchreport {batch_session_id}`

**Сценарий**:
1. Бот отправляет агрегированный отчет:
   ```
   📊 ОТЧЕТ ПО БАТЧУ ОПРОСНИКОВ
   
   Завершено: 2025-11-06 15:30
   
   === Опросник 1: СДВГ скрининг ===
   Общий балл: 45 (Высокий риск)
   
   === Опросник 2: M-CHAT ===
   Общий балл: 8 (Требуется внимание)
   
   === Опросник 3: SDQ ===
   ...
   
   ОБЩИЕ ВЫВОДЫ:
   - Выявлен высокий риск СДВГ
   - Рекомендуется дополнительная диагностика
   ```
2. Кнопки:
   - [Выгрузить детальный отчет (JSON)]
   - [Выгрузить все ответы (CSV)]

---

## 🔧 ИЗМЕНЕНИЯ В КОДЕ

### 1. Миграция БД
**Файл**: `app/migrations/006_add_batch_questionnaires.sql`
- Создание всех новых таблиц
- Создание индексов
- Создание триггеров

### 2. Типы (types.ts)
**Добавить новые интерфейсы**:
```typescript
export interface QuestionnaireBatch {
  id: string;
  title: string;
  description?: string;
  created_by_telegram_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BatchQuestionnaire {
  id: string;
  batch_id: string;
  questionnaire_id: string;
  order_index: number;
  created_at: Date;
}

export interface BatchSession {
  id: string;
  batch_id: string;
  token: string;
  expires_at: Date;
  completed: boolean;
  created_at: Date;
  completed_at?: Date;
}

export interface BatchResponse {
  id: string;
  batch_session_id: string;
  questionnaire_id: string;
  response_id: string;
  order_index: number;
  created_at: Date;
}

export interface BatchReport {
  id: string;
  batch_session_id: string;
  summary_text?: string;
  aggregated_scores_json?: Record<string, any>;
  flags_json?: string[];
  created_at: Date;
}

export interface BotUserBatchState extends BotUserState {
  batchSessionId: string;
  batchId: string;
  totalQuestionnaires: number;
  currentQuestionnaireOrder: number; // 1, 2, 3...
  questionnaireIds: string[]; // Список ID опросников в порядке
}
```

### 3. Репозиторий (repo.ts)
**Добавить методы**:
```typescript
// Батчи
async createBatch(title: string, description: string, telegramId: number): Promise<QuestionnaireBatch>
async addQuestionnaireToBatch(batchId: string, questionnaireId: string, orderIndex: number): Promise<void>
async getBatch(batchId: string): Promise<QuestionnaireBatch | null>
async getBatchQuestionnaires(batchId: string): Promise<BatchQuestionnaire[]>

// Батч-сессии
async createBatchSession(batchId: string, expiryHours: number): Promise<BatchSession>
async getBatchSessionByToken(token: string): Promise<BatchSession | null>
async completeBatchSession(batchSessionId: string): Promise<void>

// Батч-ответы
async createBatchResponse(batchSessionId: string, questionnaireId: string, responseId: string, orderIndex: number): Promise<void>
async getBatchResponses(batchSessionId: string): Promise<BatchResponse[]>

// Батч-отчеты
async createBatchReport(batchSessionId: string, summary: string, aggregatedScores: any, flags: string[]): Promise<BatchReport>
async getBatchReport(batchSessionId: string): Promise<BatchReport | null>

// Состояние пользователя для батча
async saveBatchUserState(userId: number, state: BotUserBatchState): Promise<void>
async getBatchUserState(userId: number): Promise<BotUserBatchState | null>
```

### 4. Бот (bot.ts)
**Добавить команды и обработчики**:

#### Команда `/newbatch`
```typescript
async handleNewBatch(msg: TelegramBot.Message) {
  // 1. Проверка: только для админов
  // 2. Получить список опросников
  // 3. Показать inline keyboard с чекбоксами
  // 4. Обработать выбор через callback_query
  // 5. Создать батч и сессию
  // 6. Отправить ссылку
}
```

#### Команда `/start batch_{token}`
```typescript
async handleBatchStart(msg: TelegramBot.Message, token: string) {
  // 1. Проверить токен и сессию
  // 2. Загрузить батч и опросники
  // 3. Начать с первого опросника
  // 4. Сохранить состояние батча
}
```

#### Обработка ответов в батче
```typescript
async handleBatchMessage(msg: TelegramBot.Message) {
  // 1. Загрузить состояние батча
  // 2. Обработать ответ на текущий вопрос
  // 3. Если опросник завершен:
  //    - Сохранить response
  //    - Создать batch_response
  //    - Перейти к следующему опроснику или завершить батч
  // 4. Если все опросники завершены:
  //    - Сгенерировать агрегированный отчет
  //    - Уведомить специалиста
}
```

#### Команда `/batchreport {batch_session_id}`
```typescript
async handleBatchReport(msg: TelegramBot.Message, batchSessionId: string) {
  // 1. Проверка: только для создателя батча
  // 2. Загрузить batch_report
  // 3. Отформатировать и отправить
  // 4. Показать кнопки для выгрузки
}
```

### 5. Scoring (scoring.ts)
**Добавить функцию агрегирования**:
```typescript
export function aggregateBatchScores(
  responses: Array<{ questionnaire: Questionnaire; score: ScoringResult }>
): {
  summary: string;
  aggregatedScores: Record<string, any>;
  flags: string[];
} {
  // Логика агрегирования:
  // 1. Собрать все баллы по шкалам
  // 2. Выявить общие паттерны
  // 3. Сгенерировать итоговый текст
  // 4. Собрать все флаги
}
```

### 6. Server (server.ts)
**Добавить REST API endpoints**:

```typescript
// POST /batches - Создать батч
app.post('/batches', async (request, reply) => { ... })

// GET /batches/:id - Получить батч
app.get('/batches/:id', async (request, reply) => { ... })

// POST /batch-sessions - Создать сессию для батча
app.post('/batch-sessions', async (request, reply) => { ... })

// GET /batch-reports/:batch_session_id - Получить отчет
app.get('/batch-reports/:batch_session_id', async (request, reply) => { ... })

// GET /exports/batch-report/:batch_session_id.json - Выгрузка JSON
app.get('/exports/batch-report/:batch_session_id.json', async (request, reply) => { ... })

// GET /exports/batch-report/:batch_session_id.csv - Выгрузка CSV
app.get('/exports/batch-report/:batch_session_id.csv', async (request, reply) => { ... })
```

---

## 📊 ПОЛЬЗОВАТЕЛЬСКИЕ СЦЕНАРИИ

### Сценарий 1: Детский нейропсихолог создает комплексное обследование

1. Специалист: `/newbatch`
2. Бот: "Создайте батч опросников. Выберите опросники:"
   - [ ] СДВГ скрининг
   - [ ] M-CHAT (аутизм)
   - [ ] SDQ (сильные стороны и трудности)
   - [ ] Сенсорная чувствительность
3. Специалист выбирает все 4
4. Бот: "Создан батч из 4 опросников. Ссылка: https://t.me/bot?start=batch_abc123"
5. Специалист отправляет ссылку родителю
6. Родитель проходит все 4 опросника последовательно
7. Специалист получает уведомление + отчет

### Сценарий 2: Быстрая оценка (2 опросника)

1. Специалист: `/newbatch`
2. Выбирает: СДВГ + SDQ
3. Получает ссылку
4. Пользователь проходит 2 опросника
5. Специалист получает краткий отчет

---

## ✅ КРИТЕРИИ ПРИЕМКИ

### Функциональные
- [ ] Специалист может создать батч из 2+ опросников
- [ ] Генерируется одна ссылка для всего батча
- [ ] Пользователь проходит опросники последовательно
- [ ] Показывается прогресс (X из Y)
- [ ] После завершения генерируется агрегированный отчет
- [ ] Специалист получает уведомление о завершении
- [ ] Доступна выгрузка в JSON и CSV
- [ ] Выгрузка содержит как анализ, так и детальные ответы

### Технические
- [ ] Миграция БД применяется успешно
- [ ] Все новые типы добавлены в types.ts
- [ ] API endpoints работают корректно
- [ ] Telegram бот обрабатывает все команды
- [ ] Состояние батча сохраняется в БД
- [ ] Написаны тесты для новой функциональности

### UX
- [ ] Понятные сообщения пользователю
- [ ] Прогресс-бар или индикация прогресса
- [ ] Мотивирующие сообщения между опросниками
- [ ] Четкая структура агрегированного отчета

---

## 🧪 ТЕСТИРОВАНИЕ

### Unit тесты
- Функция агрегирования результатов
- Валидация батчей
- Генерация токенов

### Integration тесты
- Создание батча через API
- Прохождение батча через Telegram
- Генерация отчета

### E2E тесты
- Полный сценарий от создания до получения отчета

---

## 📚 ДОКУМЕНТАЦИЯ

### Обновить файлы:
1. `README.md` - добавить описание батчей
2. `SETUP.md` - миграции
3. `examples/QUESTIONNAIRES.md` - примеры батчей
4. `examples/batch-example.json` - пример конфигурации батча

### Создать новые файлы:
1. `docs/BATCHES.md` - полная документация по батчам
2. `examples/batch-workflow.md` - примеры сценариев

---

## ⏱️ ОЦЕНКА ВРЕМЕНИ

| Задача | Оценка |
|--------|--------|
| Миграция БД | 1-2 часа |
| Типы и интерфейсы | 1 час |
| Репозиторий (методы БД) | 3-4 часа |
| API endpoints | 2-3 часа |
| Telegram бот (команды) | 4-5 часов |
| Агрегирование результатов | 2-3 часа |
| Тестирование | 2-3 часа |
| Документация | 1-2 часа |
| **ИТОГО** | **16-23 часа** |

---

## 🚨 РИСКИ И ОГРАНИЧЕНИЯ

### Технические риски
1. **Сложность состояния**: Управление состоянием для батчей сложнее
   - Митигация: Использовать существующую систему user_states
2. **Производительность**: Большие батчи могут быть долгими
   - Митигация: Ограничение на 10 опросников в батче
3. **Истечение токена**: Пользователь может не успеть пройти все опросники
   - Митигация: Увеличенный TTL для батчей (48 часов вместо 24)

### UX риски
1. **Усталость пользователя**: Слишком много вопросов подряд
   - Митигация: Показывать прогресс, мотивирующие сообщения
2. **Прерывание процесса**: Пользователь может закрыть бот
   - Митигация: Сохранение прогресса, возможность продолжить

---

## 📋 СЛЕДУЮЩИЕ ШАГИ

1. ✅ **Утверждение плана** - обсудить с пользователем
2. ⏳ **Фаза CREATIVE** - проектирование деталей
3. ⏳ **Фаза IMPLEMENT** - разработка
4. ⏳ **Фаза REFLECT** - тестирование и документация

---

**Статус**: Ожидает утверждения  
**Дата обновления**: 2025-11-06 15:15

