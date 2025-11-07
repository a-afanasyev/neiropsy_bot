📌 CREATIVE PHASE: Упрощенная система множественных опросников
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Дата**: 2025-11-06 (упрощенная версия)  
**Уровень**: Level 2 (Enhancement)

---

## 1️⃣ PROBLEM (Проблема)

### Что проектируем?

Минимальное расширение существующей системы для поддержки **последовательной отправки нескольких опросников** по одной ссылке.

### Требования

**Функциональные:**
- Специалист выбирает 2-10 опросников
- Генерируется одна ссылка
- Клиент проходит опросники последовательно
- Специалист видит все результаты

**Технические:**
- Минимальные изменения БД (3 поля)
- Обратная совместимость (одиночные опросники работают как раньше)
- Простой, понятный код
- Легко откатить

---

## 2️⃣ OPTIONS (Варианты)

Рассмотрены 3 варианта, выбран **Вариант C** (массив в одной сессии) как самый простой.

См. детали в `creative-batch-simplified.md`

---

## 3️⃣ ANALYSIS (Анализ)

**Вариант C** оптимален по всем критериям:
- ⭐⭐⭐⭐⭐ Простота реализации
- ⭐⭐⭐⭐⭐ Минимальные изменения БД
- ⭐⭐⭐⭐⭐ Обратная совместимость

---

## 4️⃣ DECISION (Решение)

### Выбран: Массив опросников в одной сессии

**Ключевая идея:**
```sql
ALTER TABLE sessions ADD COLUMN
  questionnaire_ids JSONB,           -- [uuid1, uuid2, uuid3]
  current_questionnaire_index INT,   -- 0, 1, 2...
  total_questionnaires INT;          -- 3
```

Если `questionnaire_ids` = NULL → одиночный опросник (как сейчас)  
Если `questionnaire_ids` != NULL → группа опросников

---

## 5️⃣ IMPLEMENTATION NOTES (Детальное проектирование)

---

## 📋 A. МИГРАЦИЯ БД

**Файл**: `app/migrations/006_add_multi_questionnaires.sql`

```sql
-- ============================================
-- Migration 006: Упрощенная поддержка множественных опросников
-- ============================================
-- Добавляет возможность отправки нескольких опросников по одной ссылке

-- ============================================
-- 1. Расширение таблицы sessions
-- ============================================

-- Добавить поля для групп опросников
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
    questionnaire_ids JSONB DEFAULT NULL,
    current_questionnaire_index INTEGER DEFAULT 0,
    total_questionnaires INTEGER DEFAULT 1;

-- Комментарии
COMMENT ON COLUMN sessions.questionnaire_ids IS 
    'Массив UUID опросников для последовательного прохождения. NULL = одиночный опросник';

COMMENT ON COLUMN sessions.current_questionnaire_index IS 
    'Индекс текущего опросника в массиве (0-based). Для одиночных всегда 0';

COMMENT ON COLUMN sessions.total_questionnaires IS 
    'Общее количество опросников. 1 = одиночный, >1 = группа';

-- Constraint: questionnaire_ids должен быть массивом
ALTER TABLE sessions ADD CONSTRAINT valid_questionnaire_ids
    CHECK (
        questionnaire_ids IS NULL OR 
        jsonb_typeof(questionnaire_ids) = 'array'
    );

-- Constraint: логическая связь между полями
ALTER TABLE sessions ADD CONSTRAINT valid_multi_fields
    CHECK (
        (questionnaire_ids IS NULL AND total_questionnaires = 1) OR
        (questionnaire_ids IS NOT NULL AND total_questionnaires > 1)
    );

-- Индекс для быстрого поиска групповых сессий
CREATE INDEX idx_sessions_multi ON sessions(questionnaire_ids)
    WHERE questionnaire_ids IS NOT NULL;

-- ============================================
-- 2. Расширение таблицы responses
-- ============================================

-- Добавить индекс опросника в группе
ALTER TABLE responses ADD COLUMN IF NOT EXISTS
    questionnaire_index INTEGER DEFAULT NULL;

COMMENT ON COLUMN responses.questionnaire_index IS 
    'Индекс опросника в группе (0, 1, 2...). NULL для одиночных опросников';

-- Индекс для быстрой сортировки ответов в группе
CREATE INDEX idx_responses_questionnaire_index 
    ON responses(session_id, questionnaire_index)
    WHERE questionnaire_index IS NOT NULL;

-- ============================================
-- 3. View для мониторинга групповых сессий
-- ============================================

CREATE OR REPLACE VIEW multi_questionnaire_sessions AS
SELECT
    s.id as session_id,
    s.token,
    s.questionnaire_ids,
    s.current_questionnaire_index,
    s.total_questionnaires,
    s.expires_at,
    s.used,
    s.created_at,
    s.created_by_telegram_id,
    -- Статистика по ответам
    COUNT(r.id) FILTER (WHERE r.status = 'completed') as completed_questionnaires,
    COUNT(r.id) as total_responses,
    -- Прогресс в процентах
    CASE 
        WHEN s.total_questionnaires > 0 THEN
            ROUND(
                (COUNT(r.id) FILTER (WHERE r.status = 'completed')::numeric / s.total_questionnaires) * 100
            )
        ELSE 0
    END as progress_percentage,
    -- Массив ID ответов (в порядке прохождения)
    ARRAY_AGG(r.id ORDER BY r.questionnaire_index, r.created_at) 
        FILTER (WHERE r.id IS NOT NULL) as response_ids
FROM sessions s
LEFT JOIN responses r ON r.session_id = s.id
WHERE s.questionnaire_ids IS NOT NULL  -- Только групповые
GROUP BY s.id;

COMMENT ON VIEW multi_questionnaire_sessions IS 
    'Сводная информация о групповых сессиях для мониторинга и отладки';

-- ============================================
-- 4. Функция для проверки завершения группы
-- ============================================

CREATE OR REPLACE FUNCTION is_multi_questionnaire_completed(
    p_session_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    -- Получить общее количество опросников
    SELECT total_questionnaires INTO v_total
    FROM sessions
    WHERE id = p_session_id;
    
    IF v_total IS NULL OR v_total = 1 THEN
        -- Одиночный опросник
        RETURN EXISTS(
            SELECT 1 FROM responses
            WHERE session_id = p_session_id
            AND status = 'completed'
        );
    END IF;
    
    -- Групповой опросник
    SELECT COUNT(*) INTO v_completed
    FROM responses
    WHERE session_id = p_session_id
    AND status = 'completed';
    
    RETURN v_completed >= v_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_multi_questionnaire_completed(UUID) IS 
    'Проверяет завершена ли группа опросников (или одиночный)';

-- ============================================
-- 5. Обновление существующих данных
-- ============================================

-- Для всех существующих сессий установить дефолтные значения
UPDATE sessions
SET 
    questionnaire_ids = NULL,
    current_questionnaire_index = 0,
    total_questionnaires = 1
WHERE questionnaire_ids IS NULL;

-- ============================================
-- Завершение миграции
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006: Multi-questionnaire support added successfully';
    RAISE NOTICE 'Added fields:';
    RAISE NOTICE '  - sessions.questionnaire_ids (JSONB)';
    RAISE NOTICE '  - sessions.current_questionnaire_index (INTEGER)';
    RAISE NOTICE '  - sessions.total_questionnaires (INTEGER)';
    RAISE NOTICE '  - responses.questionnaire_index (INTEGER)';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - VIEW multi_questionnaire_sessions';
    RAISE NOTICE '  - FUNCTION is_multi_questionnaire_completed()';
END $$;
```

**Размер**: ~150 строк (с комментариями)  
**Чистый SQL**: ~30 строк

---

### Откат миграции

**Файл**: `app/migrations/006_rollback.sql`

```sql
-- Откат миграции 006

-- Удалить view
DROP VIEW IF EXISTS multi_questionnaire_sessions;

-- Удалить функцию
DROP FUNCTION IF EXISTS is_multi_questionnaire_completed(UUID);

-- Удалить индексы
DROP INDEX IF EXISTS idx_sessions_multi;
DROP INDEX IF EXISTS idx_responses_questionnaire_index;

-- Удалить constraints
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS valid_questionnaire_ids;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS valid_multi_fields;

-- Удалить поля из responses
ALTER TABLE responses DROP COLUMN IF EXISTS questionnaire_index;

-- Удалить поля из sessions
ALTER TABLE sessions 
    DROP COLUMN IF EXISTS questionnaire_ids,
    DROP COLUMN IF EXISTS current_questionnaire_index,
    DROP COLUMN IF EXISTS total_questionnaires;

RAISE NOTICE '✅ Migration 006 rolled back successfully';
```

---

## 📋 B. ТИПЫ TYPESCRIPT

**Файл**: `app/src/types.ts`

```typescript
// ============================================
// РАСШИРЕНИЕ СУЩЕСТВУЮЩИХ ИНТЕРФЕЙСОВ
// ============================================

/**
 * Session - расширен для поддержки групп опросников
 */
export interface Session {
  id: string;
  questionnaire_id: string; // Первый опросник (для совместимости)
  
  // ⭐ НОВЫЕ ПОЛЯ для групп опросников
  questionnaire_ids?: string[];         // Массив UUID опросников
  current_questionnaire_index?: number; // Индекс текущего (0-based)
  total_questionnaires?: number;        // Общее количество
  
  token: string;
  readable_id?: string;
  created_by_telegram_id?: number;
  expires_at: Date;
  used: boolean;
  created_at: Date;
  used_at?: Date;
}

/**
 * Response - расширен для отслеживания позиции в группе
 */
export interface Response {
  id: string;
  session_id: string;
  started_at: Date;
  submitted_at?: Date;
  answers_json?: Record<string, any>;
  score_json?: ScoringResult;
  summary_text?: string;
  status: ResponseStatus;
  
  // ⭐ НОВОЕ ПОЛЕ
  questionnaire_index?: number; // Индекс в группе (0, 1, 2...)
  
  created_at: Date;
  updated_at: Date;
}

/**
 * BotUserState - расширен для групп опросников
 */
export interface BotUserState {
  sessionToken: string;
  questionnaireId: string;      // Текущий опросник
  
  // ⭐ НОВЫЕ ПОЛЯ для групп
  questionnaireIds?: string[];           // Все опросники в группе
  currentQuestionnaireIndex?: number;    // Индекс текущего (0, 1, 2...)
  totalQuestionnaires?: number;          // Всего опросников
  
  responseId: string;
  currentQuestionIndex: number;
  answers: Record<string, any>;
  questions: Question[];
}

// ============================================
// НОВЫЕ ИНТЕРФЕЙСЫ
// ============================================

/**
 * Запрос на создание групповой сессии
 */
export interface CreateMultiSessionRequest {
  questionnaire_ids: string[];  // 2-10 опросников
  expiry_hours?: number;        // Часы до истечения (по умолчанию 48)
  created_by_telegram_id?: number; // Telegram ID создателя
}

/**
 * Ответ при создании групповой сессии
 */
export interface CreateMultiSessionResponse {
  session_id: string;
  token: string;
  link: string;
  questionnaires: Array<{
    id: string;
    title: string;
    questions_count: number;
  }>;
  total_questionnaires: number;
  total_questions: number;
  expires_at: string;
}

/**
 * Прогресс прохождения группы
 */
export interface MultiQuestionnaireProgress {
  is_multi: boolean;                    // Группа или одиночный
  total_questionnaires: number;         // Всего опросников
  completed_questionnaires: number;     // Завершено опросников
  current_questionnaire_index: number;  // Текущий индекс
  progress_percentage: number;          // Прогресс в процентах
  is_completed: boolean;                // Все завершены?
  responses?: Array<{                   // Детали ответов
    questionnaire_id: string;
    questionnaire_title: string;
    status: ResponseStatus;
    overall_score?: number;
    overall_label?: string;
  }>;
}

/**
 * Вспомогательная функция: проверка является ли сессия групповой
 */
export function isMultiSession(session: Session): boolean {
  return !!(session.questionnaire_ids && session.total_questionnaires && session.total_questionnaires > 1);
}

/**
 * Вспомогательная функция: проверка является ли состояние групповым
 */
export function isMultiState(state: BotUserState): boolean {
  return !!(state.questionnaireIds && state.totalQuestionnaires && state.totalQuestionnaires > 1);
}
```

**Размер**: ~100 строк (с комментариями)

---

## 📋 C. МЕТОДЫ РЕПОЗИТОРИЯ

**Файл**: `app/src/repo.ts`

```typescript
// ============================================
// НОВЫЕ МЕТОДЫ ДЛЯ ГРУППОВЫХ ОПРОСНИКОВ
// ============================================

/**
 * Создать сессию для группы опросников
 * 
 * @param questionnaireIds - Массив UUID опросников (2-10)
 * @param expiryHours - Часы до истечения (по умолчанию 48)
 * @param createdByTelegramId - Telegram ID создателя
 * @returns Созданная сессия
 * @throws Error если опросники не найдены или некорректное количество
 */
async createMultiQuestionnaireSession(
  questionnaireIds: string[],
  expiryHours: number = 48,
  createdByTelegramId?: number
): Promise<Session> {
  
  // Валидация
  if (!questionnaireIds || questionnaireIds.length < 2 || questionnaireIds.length > 10) {
    throw new Error('Необходимо от 2 до 10 опросников');
  }
  
  // Проверить что все опросники существуют
  for (const id of questionnaireIds) {
    const q = await this.getQuestionnaire(id);
    if (!q || !q.is_active) {
      throw new Error(`Опросник ${id} не найден или неактивен`);
    }
  }
  
  // Генерировать токен
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  
  // Создать сессию
  const result = await this.pool.query(
    `INSERT INTO sessions (
      questionnaire_id,
      questionnaire_ids,
      current_questionnaire_index,
      total_questionnaires,
      token,
      expires_at,
      created_by_telegram_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      questionnaireIds[0],              // Первый как основной (совместимость)
      JSON.stringify(questionnaireIds), // Массив
      0,                                // Начинаем с первого
      questionnaireIds.length,          // Общее количество
      token,
      expiresAt,
      createdByTelegramId || null
    ]
  );
  
  return this.mapSession(result.rows[0]);
}

/**
 * Обновить индекс текущего опросника в группе
 * 
 * @param sessionId - ID сессии
 * @param newIndex - Новый индекс (0, 1, 2...)
 */
async updateCurrentQuestionnaireIndex(
  sessionId: string,
  newIndex: number
): Promise<void> {
  await this.pool.query(
    `UPDATE sessions 
     SET current_questionnaire_index = $1 
     WHERE id = $2`,
    [newIndex, sessionId]
  );
}

/**
 * Проверить завершена ли группа опросников
 * 
 * @param sessionId - ID сессии
 * @returns true если все опросники завершены
 */
async isMultiQuestionnaireCompleted(sessionId: string): Promise<boolean> {
  const result = await this.pool.query(
    'SELECT is_multi_questionnaire_completed($1) as completed',
    [sessionId]
  );
  
  return result.rows[0]?.completed || false;
}

/**
 * Получить все ответы для группы опросников (в правильном порядке)
 * 
 * @param sessionId - ID сессии
 * @returns Массив ответов (отсортированы по questionnaire_index)
 */
async getMultiQuestionnaireResponses(sessionId: string): Promise<Response[]> {
  const result = await this.pool.query(
    `SELECT * FROM responses 
     WHERE session_id = $1 
     ORDER BY questionnaire_index NULLS LAST, created_at`,
    [sessionId]
  );
  
  return result.rows.map(row => this.mapResponse(row));
}

/**
 * Получить прогресс прохождения группы опросников
 * 
 * @param token - Токен сессии
 * @returns Информация о прогрессе
 */
async getMultiQuestionnaireProgress(token: string): Promise<MultiQuestionnaireProgress | null> {
  // Получить сессию
  const session = await this.getSessionByToken(token);
  if (!session) return null;
  
  // Проверить: группа или одиночный?
  const isMulti = isMultiSession(session);
  
  if (!isMulti) {
    // Одиночный опросник
    const responses = await this.getResponsesBySession(session.id);
    const completed = responses.length > 0 && responses[0].status === 'completed';
    
    return {
      is_multi: false,
      total_questionnaires: 1,
      completed_questionnaires: completed ? 1 : 0,
      current_questionnaire_index: 0,
      progress_percentage: completed ? 100 : 0,
      is_completed: completed
    };
  }
  
  // Группа опросников
  const responses = await this.getMultiQuestionnaireResponses(session.id);
  const completedCount = responses.filter(r => r.status === 'completed').length;
  const isCompleted = await this.isMultiQuestionnaireCompleted(session.id);
  
  // Получить детали по каждому ответу
  const responseDetails = await Promise.all(
    responses.map(async (response) => {
      const questionnaire = await this.getQuestionnaire(
        // Найти questionnaire_id для этого ответа
        session.questionnaire_ids![response.questionnaire_index || 0]
      );
      
      return {
        questionnaire_id: questionnaire!.id,
        questionnaire_title: questionnaire!.title,
        status: response.status,
        overall_score: response.score_json?.overall.score,
        overall_label: response.score_json?.overall.label
      };
    })
  );
  
  return {
    is_multi: true,
    total_questionnaires: session.total_questionnaires!,
    completed_questionnaires: completedCount,
    current_questionnaire_index: session.current_questionnaire_index!,
    progress_percentage: Math.round((completedCount / session.total_questionnaires!) * 100),
    is_completed: isCompleted,
    responses: responseDetails
  };
}

/**
 * Создать response с указанием индекса в группе
 * 
 * @param sessionToken - Токен сессии
 * @param questionnaireIndex - Индекс опросника в группе (опционально)
 * @returns Созданный response
 */
async createResponseWithIndex(
  sessionToken: string,
  questionnaireIndex?: number
): Promise<Response> {
  const session = await this.getSessionByToken(sessionToken);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const result = await this.pool.query(
    `INSERT INTO responses (
      session_id,
      questionnaire_index,
      status
    ) VALUES ($1, $2, $3)
    RETURNING *`,
    [session.id, questionnaireIndex || null, 'started']
  );
  
  return this.mapResponse(result.rows[0]);
}

// ============================================
// ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ МЕТОДОВ
// ============================================

/**
 * Маппинг row -> Session (обновлен для поддержки новых полей)
 */
private mapSession(row: any): Session {
  return {
    id: row.id,
    questionnaire_id: row.questionnaire_id,
    
    // Новые поля (с проверкой на существование)
    questionnaire_ids: row.questionnaire_ids 
      ? (typeof row.questionnaire_ids === 'string' 
          ? JSON.parse(row.questionnaire_ids) 
          : row.questionnaire_ids)
      : undefined,
    current_questionnaire_index: row.current_questionnaire_index,
    total_questionnaires: row.total_questionnaires,
    
    token: row.token,
    readable_id: row.readable_id,
    created_by_telegram_id: row.created_by_telegram_id,
    expires_at: new Date(row.expires_at),
    used: row.used,
    created_at: new Date(row.created_at),
    used_at: row.used_at ? new Date(row.used_at) : undefined
  };
}

/**
 * Маппинг row -> Response (обновлен для поддержки questionnaire_index)
 */
private mapResponse(row: any): Response {
  return {
    id: row.id,
    session_id: row.session_id,
    started_at: new Date(row.started_at),
    submitted_at: row.submitted_at ? new Date(row.submitted_at) : undefined,
    answers_json: row.answers_json,
    score_json: row.score_json,
    summary_text: row.summary_text,
    status: row.status as ResponseStatus,
    
    // Новое поле
    questionnaire_index: row.questionnaire_index,
    
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at)
  };
}
```

**Размер**: ~250 строк (с комментариями)  
**Новых методов**: 6

---

## 📋 D. API ENDPOINTS

**Файл**: `app/src/server.ts`

```typescript
// ============================================
// API ENDPOINTS ДЛЯ ГРУППОВЫХ ОПРОСНИКОВ
// ============================================

/**
 * POST /sessions/multi
 * Создание групповой сессии (несколько опросников)
 * 
 * Body: {
 *   questionnaire_ids: string[],  // 2-10 опросников
 *   expiry_hours?: number          // По умолчанию 48
 * }
 */
app.post('/sessions/multi', async (request, reply) => {
  // Валидация через Zod
  const createMultiSessionSchema = z.object({
    questionnaire_ids: z.array(z.string().uuid())
      .min(2, 'Минимум 2 опросника')
      .max(10, 'Максимум 10 опросников'),
    expiry_hours: z.number().int().min(1).max(168).optional().default(48),
    created_by_telegram_id: z.number().int().positive().optional()
  });
  
  try {
    const body = createMultiSessionSchema.parse(request.body);
    
    // Создать сессию
    const session = await repo.createMultiQuestionnaireSession(
      body.questionnaire_ids,
      body.expiry_hours,
      body.created_by_telegram_id
    );
    
    // Получить информацию о каждом опроснике
    const questionnaires = await Promise.all(
      body.questionnaire_ids.map(async (id) => {
        const q = await repo.getQuestionnaire(id);
        return {
          id: q!.id,
          title: q!.title,
          questions_count: q!.questions_json.length
        };
      })
    );
    
    // Подсчитать общее количество вопросов
    const totalQuestions = questionnaires.reduce(
      (sum, q) => sum + q.questions_count,
      0
    );
    
    // Сформировать ответ
    const response: CreateMultiSessionResponse = {
      session_id: session.id,
      token: session.token,
      link: `${config.public_bot_link}?start=${session.token}`,
      questionnaires,
      total_questionnaires: session.total_questionnaires!,
      total_questions: totalQuestions,
      expires_at: session.expires_at.toISOString()
    };
    
    return reply.status(201).send({
      success: true,
      data: response
    });
    
  } catch (error: any) {
    // Обработка ошибок валидации
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.errors[0].message,
          details: error.errors
        }
      });
    }
    
    // Другие ошибки
    return reply.status(400).send({
      success: false,
      error: {
        code: 'CREATE_SESSION_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * GET /sessions/:token/progress
 * Получение прогресса прохождения (для одиночных и групповых)
 * 
 * Params: token (string)
 * 
 * Response: {
 *   is_multi: boolean,
 *   total_questionnaires: number,
 *   completed_questionnaires: number,
 *   progress_percentage: number,
 *   is_completed: boolean,
 *   responses?: Array<...>
 * }
 */
app.get('/sessions/:token/progress', async (request, reply) => {
  const { token } = request.params as { token: string };
  
  try {
    // Получить прогресс
    const progress = await repo.getMultiQuestionnaireProgress(token);
    
    if (!progress) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Сессия не найдена'
        }
      });
    }
    
    return reply.send({
      success: true,
      data: progress
    });
    
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: {
        code: 'PROGRESS_ERROR',
        message: error.message
      }
    });
  }
});
```

**Размер**: ~120 строк (с комментариями)  
**Новых endpoints**: 2

---

## 📋 E. TELEGRAM БОТ

**Файл**: `app/src/bot.ts`

### E.1. Команда `/newsessions` (создание группы)

```typescript
/**
 * Команда /newsessions - создание групповой сессии
 * Только для админов
 */
bot.onText(/\/newsessions/, async (msg) => {
  const userId = msg.from?.id;
  const chatId = msg.chat.id;
  
  // Проверка: только для админов
  if (!isAdmin(userId)) {
    await bot.sendMessage(chatId, 
      '🔒 Команда доступна только специалистам.\n\n' +
      'Если вы получили ссылку для прохождения опросников, просто перейдите по ней.'
    );
    return;
  }
  
  // Получить список активных опросников
  const questionnaires = await repo.getQuestionnaires();
  const activeQuestionnaires = questionnaires.filter(q => q.is_active);
  
  if (activeQuestionnaires.length < 2) {
    await bot.sendMessage(chatId,
      '⚠️ Недостаточно активных опросников.\n\n' +
      'Для создания группы необходимо минимум 2 опросника.'
    );
    return;
  }
  
  // Создать inline keyboard с чекбоксами
  const keyboard = activeQuestionnaires.map(q => [{
    text: `☐ ${q.title} (${q.questions_json.length} вопросов)`,
    callback_data: `multi_toggle_${q.id}`
  }]);
  
  // Добавить кнопки управления
  keyboard.push([
    { text: '✅ Создать (0 выбрано)', callback_data: 'multi_create_0' },
    { text: '❌ Отмена', callback_data: 'multi_cancel' }
  ]);
  
  await bot.sendMessage(
    chatId,
    '📋 СОЗДАНИЕ ГРУППЫ ОПРОСНИКОВ\n\n' +
    'Выберите опросники, которые клиент пройдет последовательно.\n' +
    'Можно выбрать от 2 до 10 опросников.\n\n' +
    'Клиент получит одну ссылку и пройдет все опросники друг за другом.',
    { reply_markup: { inline_keyboard: keyboard } }
  );
});

// Хранилище временного выбора (userId -> Set<questionnaireId>)
const multiSelections = new Map<number, Set<string>>();

/**
 * Обработка callback для выбора опросников
 */
bot.on('callback_query', async (query) => {
  const data = query.data;
  const userId = query.from.id;
  const messageId = query.message?.message_id;
  const chatId = query.message?.chat.id;
  
  if (!data || !chatId || !messageId) return;
  
  // ============================================
  // Переключение чекбокса
  // ============================================
  if (data.startsWith('multi_toggle_')) {
    const questionnaireId = data.replace('multi_toggle_', '');
    
    // Инициализировать Set если нужно
    if (!multiSelections.has(userId)) {
      multiSelections.set(userId, new Set());
    }
    
    const selected = multiSelections.get(userId)!;
    
    // Переключить выбор
    if (selected.has(questionnaireId)) {
      selected.delete(questionnaireId);
    } else {
      if (selected.size >= 10) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ Максимум 10 опросников',
          show_alert: true
        });
        return;
      }
      selected.add(questionnaireId);
    }
    
    // Обновить keyboard
    const questionnaires = await repo.getQuestionnaires();
    const activeQuestionnaires = questionnaires.filter(q => q.is_active);
    
    const keyboard = activeQuestionnaires.map(q => [{
      text: `${selected.has(q.id) ? '☑' : '☐'} ${q.title} (${q.questions_json.length} вопросов)`,
      callback_data: `multi_toggle_${q.id}`
    }]);
    
    keyboard.push([
      { 
        text: `✅ Создать (${selected.size} выбрано)`, 
        callback_data: `multi_create_${selected.size}` 
      },
      { text: '❌ Отмена', callback_data: 'multi_cancel' }
    ]);
    
    await bot.editMessageReplyMarkup(
      { inline_keyboard: keyboard },
      { chat_id: chatId, message_id: messageId }
    );
    
    await bot.answerCallbackQuery(query.id);
    return;
  }
  
  // ============================================
  // Создание группы
  // ============================================
  if (data.startsWith('multi_create_')) {
    const selected = multiSelections.get(userId);
    
    if (!selected || selected.size < 2) {
      await bot.answerCallbackQuery(query.id, {
        text: '⚠️ Выберите минимум 2 опросника',
        show_alert: true
      });
      return;
    }
    
    try {
      // Создать групповую сессию через API
      const questionnaireIds = Array.from(selected);
      const session = await repo.createMultiQuestionnaireSession(
        questionnaireIds,
        48,
        userId
      );
      
      // Получить информацию об опросниках
      const questionnaires = await Promise.all(
        questionnaireIds.map(id => repo.getQuestionnaire(id))
      );
      
      const totalQuestions = questionnaires.reduce(
        (sum, q) => sum + (q?.questions_json.length || 0),
        0
      );
      
      // Отправить результат
      await bot.editMessageText(
        '✅ ГРУППА ОПРОСНИКОВ СОЗДАНА!\n\n' +
        `📋 Опросников: ${questionnaires.length}\n` +
        `❓ Всего вопросов: ${totalQuestions}\n` +
        `⏰ Действительна до: ${session.expires_at.toLocaleString('ru-RU')}\n\n` +
        'Опросники:\n' +
        questionnaires.map((q, i) => `${i + 1}️⃣ ${q!.title} (${q!.questions_json.length} вопросов)`).join('\n') +
        '\n\n' +
        '🔗 Ссылка для клиента:\n' +
        `${config.public_bot_link}?start=${session.token}\n\n` +
        'Отправьте эту ссылку клиенту.\n' +
        `Примерное время прохождения: ${Math.ceil(totalQuestions * 0.5)} минут.`,
        { chat_id: chatId, message_id: messageId }
      );
      
      // Очистить выбор
      multiSelections.delete(userId);
      
    } catch (error: any) {
      await bot.answerCallbackQuery(query.id, {
        text: `❌ Ошибка: ${error.message}`,
        show_alert: true
      });
    }
    
    await bot.answerCallbackQuery(query.id);
    return;
  }
  
  // ============================================
  // Отмена
  // ============================================
  if (data === 'multi_cancel') {
    multiSelections.delete(userId);
    
    await bot.editMessageText(
      '❌ Создание группы отменено',
      { chat_id: chatId, message_id: messageId }
    );
    
    await bot.answerCallbackQuery(query.id);
    return;
  }
});
```

### E.2. Расширение handleStart для групп

```typescript
/**
 * Обработка /start (расширена для групп)
 */
async function handleStart(msg: TelegramBot.Message, match: RegExpExecArray | null) {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const token = match?.[1]?.trim();
  
  if (!token) {
    await bot.sendMessage(chatId, texts.welcome);
    return;
  }
  
  // Получить сессию
  const session = await repo.getSessionByToken(token);
  
  if (!session) {
    await bot.sendMessage(chatId, '❌ Ссылка недействительна');
    return;
  }
  
  // Проверки
  if (session.expires_at < new Date()) {
    await bot.sendMessage(chatId, '⏰ Срок действия ссылки истек');
    return;
  }
  
  if (session.used) {
    await bot.sendMessage(chatId, '✅ Вы уже прошли эти опросники');
    return;
  }
  
  // ============================================
  // ГРУППА ОПРОСНИКОВ
  // ============================================
  if (isMultiSession(session)) {
    await handleMultiQuestionnaireStart(userId, chatId, session);
    return;
  }
  
  // ============================================
  // ОДИНОЧНЫЙ ОПРОСНИК (существующая логика)
  // ============================================
  // ... существующий код для одиночных опросников ...
}

/**
 * Начало прохождения группы опросников
 */
async function handleMultiQuestionnaireStart(
  userId: number,
  chatId: number,
  session: Session
) {
  // Проверить есть ли незавершенный прогресс
  const existingState = await loadUserState(userId);
  
  if (existingState && existingState.sessionToken === session.token) {
    // Продолжить с текущего места
    const currentIndex = existingState.currentQuestionnaireIndex || 0;
    
    await bot.sendMessage(
      chatId,
      `👋 С возвращением!\n\n` +
      `Вы уже начали прохождение опросников.\n\n` +
      `Прогресс: Опросник ${currentIndex + 1} из ${session.total_questionnaires}\n` +
      `Завершено: ${currentIndex} опросников\n\n` +
      'Продолжим?',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '▶️ Продолжить', callback_data: 'multi_continue' },
            { text: '🔄 Начать сначала', callback_data: 'multi_restart' }
          ]]
        }
      }
    );
    return;
  }
  
  // Начать с нуля
  const questionnaires = await Promise.all(
    session.questionnaire_ids!.map(id => repo.getQuestionnaire(id))
  );
  
  const totalQuestions = questionnaires.reduce(
    (sum, q) => sum + (q?.questions_json.length || 0),
    0
  );
  
  await bot.sendMessage(
    chatId,
    `👋 Добро пожаловать!\n\n` +
    `Вам предстоит пройти ${session.total_questionnaires} опросника:\n\n` +
    questionnaires.map((q, i) => 
      `${i + 1}️⃣ ${q!.title} (${q!.questions_json.length} вопросов)`
    ).join('\n') +
    '\n\n' +
    `❓ Всего вопросов: ${totalQuestions}\n` +
    `⏱ Примерное время: ${Math.ceil(totalQuestions * 0.5)} минут\n\n` +
    'ℹ️ Ваш прогресс сохраняется автоматически.\n\n' +
    'Готовы начать?',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '▶️ Начать', callback_data: 'multi_start' }
        ]]
      }
    }
  );
  
  // Сохранить начальное состояние
  const firstQuestionnaire = questionnaires[0]!;
  const response = await repo.createResponseWithIndex(session.token, 0);
  
  const initialState: BotUserState = {
    sessionToken: session.token,
    questionnaireId: firstQuestionnaire.id,
    questionnaireIds: session.questionnaire_ids,
    currentQuestionnaireIndex: 0,
    totalQuestionnaires: session.total_questionnaires,
    responseId: response.id,
    currentQuestionIndex: 0,
    answers: {},
    questions: firstQuestionnaire.questions_json
  };
  
  await saveUserState(userId, initialState);
}

/**
 * Обработка завершения одного опросника в группе
 */
async function handleQuestionnaireCompletedInGroup(
  userId: number,
  chatId: number,
  state: BotUserState
) {
  const currentIndex = state.currentQuestionnaireIndex!;
  const nextIndex = currentIndex + 1;
  
  // Сохранить текущий response
  await repo.submitResponse(
    state.responseId,
    state.answers,
    calculateScore(/* ... */),
    generateSummary(/* ... */)
  );
  
  // Обновить индекс в сессии
  const session = await repo.getSessionByToken(state.sessionToken);
  await repo.updateCurrentQuestionnaireIndex(session!.id, nextIndex);
  
  // Проверить: есть ли еще опросники?
  if (nextIndex < state.totalQuestionnaires!) {
    // Есть еще опросники
    const progressBar = '█'.repeat(nextIndex) + '░'.repeat(state.totalQuestionnaires! - nextIndex);
    const progressPercent = Math.round((nextIndex / state.totalQuestionnaires!) * 100);
    
    await bot.sendMessage(
      chatId,
      `🎉 ОПРОСНИК ${currentIndex + 1} ЗАВЕРШЕН!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Общий прогресс: [${progressBar}] ${progressPercent}%\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Следующий опросник:\n` +
      `📝 Опросник ${nextIndex + 1} из ${state.totalQuestionnaires}\n\n` +
      'Продолжим?',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '▶️ Продолжить', callback_data: 'multi_next' },
            { text: '⏸ Сделать перерыв', callback_data: 'multi_pause' }
          ]]
        }
      }
    );
    
    // Подготовить следующий опросник
    const nextQuestionnaireId = state.questionnaireIds![nextIndex];
    const nextQuestionnaire = await repo.getQuestionnaire(nextQuestionnaireId);
    const nextResponse = await repo.createResponseWithIndex(state.sessionToken, nextIndex);
    
    // Обновить состояние
    state.questionnaireId = nextQuestionnaireId;
    state.currentQuestionnaireIndex = nextIndex;
    state.responseId = nextResponse.id;
    state.currentQuestionIndex = 0;
    state.answers = {};
    state.questions = nextQuestionnaire!.questions_json;
    
    await saveUserState(userId, state);
    
  } else {
    // ВСЕ ОПРОСНИКИ ЗАВЕРШЕНЫ!
    await handleAllQuestionnairesCompleted(userId, chatId, state);
  }
}

/**
 * Все опросники завершены
 */
async function handleAllQuestionnairesCompleted(
  userId: number,
  chatId: number,
  state: BotUserState
) {
  await bot.sendMessage(
    chatId,
    `🎉🎉🎉 ПОЗДРАВЛЯЕМ!\n\n` +
    `Вы успешно завершили все ${state.totalQuestionnaires} опросника!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 Всего вопросов: ${state.questions.length}\n` +
    `⏱ Время прохождения: завершено\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    'Специалист получит результаты в ближайшее время и свяжется с вами.\n\n' +
    'Спасибо за участие! 💙'
  );
  
  // Отметить сессию как использованную
  const session = await repo.getSessionByToken(state.sessionToken);
  await repo.markSessionAsUsed(session!.id);
  
  // Уведомить специалиста
  if (session!.created_by_telegram_id) {
    await bot.sendMessage(
      session!.created_by_telegram_id,
      `📊 ГРУППА ОПРОСНИКОВ ЗАВЕРШЕНА!\n\n` +
      `Клиент прошел все ${state.totalQuestionnaires} опросника.\n` +
      `Дата: ${new Date().toLocaleString('ru-RU')}\n\n` +
      `Посмотреть результаты:\n` +
      `/progress ${state.sessionToken}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📊 Посмотреть результаты', callback_data: `view_progress_${state.sessionToken}` }
          ]]
        }
      }
    );
  }
  
  // Очистить состояние
  await deleteUserState(userId);
}
```

**Размер**: ~400 строк (с комментариями)

---

## ✅ VERIFICATION (Проверка дизайна)

### Критерии качества:

- [x] Минимальные изменения БД (3 поля)
- [x] Обратная совместимость (одиночные опросники работают)
- [x] Простой, понятный код (Junior-friendly)
- [x] Легко откатить (rollback скрипт готов)
- [x] API следует существующим паттернам
- [x] UX понятен и мотивирует

### Готовность к реализации:

- [x] DDL миграции готов (~30 строк)
- [x] Типы TypeScript готовы
- [x] Методы репозитория спроектированы (6 методов)
- [x] API endpoints готовы (2 endpoint)
- [x] Telegram бот логика спроектирована

---

## 📊 ИТОГОВАЯ СТАТИСТИКА

| Компонент | Оценка |
|-----------|--------|
| Миграция БД | ~30 строк SQL |
| Типы TS | ~100 строк |
| Репозиторий | ~250 строк |
| API endpoints | ~120 строк |
| Telegram бот | ~400 строк |
| **ИТОГО** | **~900 строк кода** |

**Время разработки**: 4-6 часов

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 CREATIVE PHASE END (SIMPLIFIED)

**Статус**: ✅ Готов к IMPLEMENT  
**Дата**: 2025-11-06

