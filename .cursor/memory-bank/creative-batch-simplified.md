📌 CREATIVE PHASE: Упрощенная система батч-опросников
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# УПРОЩЕННЫЙ ДИЗАЙН: Последовательная отправка опросников

**Дата**: 2025-11-06 (пересмотрено)  
**Подход**: Минимальные изменения существующей системы

---

## 1️⃣ PROBLEM (Уточнение проблемы)

### Что действительно нужно?

**Простая задача**: Специалист должен иметь возможность отправить клиенту несколько опросников, которые клиент пройдет **последовательно друг за другом** по одной ссылке.

**НЕ нужно:**
- ❌ Сложная система "батчей" как отдельных сущностей
- ❌ Специальный интерфейс создания батчей
- ❌ Агрегированные отчеты (можно просто смотреть отдельные результаты)
- ❌ Множество новых таблиц

**Нужно:**
- ✅ Возможность создать несколько сессий для одного клиента разом
- ✅ Одна ссылка для прохождения всех опросников
- ✅ Последовательное прохождение (опросник 1 → опросник 2 → опросник 3)
- ✅ Возможность посмотреть все результаты клиента вместе

---

## 2️⃣ OPTIONS (Упрощенные варианты)

### Вариант A: Минимальные изменения БД

**Описание**: Добавить одно поле `group_id` в существующую таблицу `sessions`.

**Изменения**:
- Добавить `group_id` (UUID, nullable) в таблицу `sessions`
- Несколько сессий с одинаковым `group_id` = группа опросников
- Одна ссылка ведет на первую сессию, после завершения автоматически переход к следующей

**Плюсы:**
- ✅ Минимальные изменения БД (1 поле)
- ✅ Не ломает существующий функционал
- ✅ Простая логика

**Минусы:**
- ❌ Нужно отслеживать порядок сессий

### Вариант B: Одна "главная" сессия + связанные

**Описание**: Добавить поле `parent_session_id` в таблицу `sessions`.

**Изменения**:
- Главная сессия (parent_session_id = NULL)
- Дочерние сессии ссылаются на главную через `parent_session_id`
- Токен главной сессии используется для всех опросников

**Плюсы:**
- ✅ Четкая иерархия
- ✅ Один токен для всех

**Минусы:**
- ❌ Сложнее логика создания
- ❌ Нужно модифицировать токен-систему

### Вариант C: Простой массив в одной сессии ⭐ (выбран)

**Описание**: Добавить `questionnaire_ids` (JSONB массив) в таблицу `sessions`.

**Изменения**:
- Одна сессия может содержать несколько `questionnaire_id` в массиве
- `current_questionnaire_index` отслеживает текущий опросник
- Создается один `response` на каждый завершенный опросник

**Плюсы:**
- ✅ Максимально простая реализация
- ✅ Одна сессия, один токен
- ✅ Легко отслеживать прогресс
- ✅ Не ломает существующий функционал (одиночные опросники)

**Минусы:**
- ❌ Денормализация (но для MVP это ок)

---

## 3️⃣ ANALYSIS (Анализ)

| Критерий | Вариант A | Вариант B | Вариант C ⭐ |
|----------|-----------|-----------|-------------|
| Простота реализации | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Изменения в БД | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Изменения в коде | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Простота использования | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Обратная совместимость | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Вывод**: Вариант C самый простой и элегантный!

---

## 4️⃣ DECISION (Решение)

### Выбран: Вариант C - Массив опросников в одной сессии

**Обоснование:**
- Минимум кода
- Максимум простоты
- Полная обратная совместимость
- Одна миграция, несколько полей

---

## 5️⃣ IMPLEMENTATION (Детальная реализация)

### A. Изменения в БД (Миграция 006)

#### Изменить таблицу `sessions`:

```sql
-- Миграция 006: Упрощенная поддержка множественных опросников
ALTER TABLE sessions
  ADD COLUMN questionnaire_ids JSONB DEFAULT NULL,
  ADD COLUMN current_questionnaire_index INTEGER DEFAULT 0,
  ADD COLUMN total_questionnaires INTEGER DEFAULT 1;

-- Проверка: questionnaire_ids должен быть массивом
ALTER TABLE sessions
  ADD CONSTRAINT valid_questionnaire_ids 
  CHECK (questionnaire_ids IS NULL OR jsonb_typeof(questionnaire_ids) = 'array');

-- Индекс для быстрого поиска мультисессий
CREATE INDEX idx_sessions_multi 
  ON sessions(questionnaire_ids) 
  WHERE questionnaire_ids IS NOT NULL;

-- Комментарии
COMMENT ON COLUMN sessions.questionnaire_ids IS 
  'Массив UUID опросников для последовательного прохождения. NULL = одиночный опросник';
COMMENT ON COLUMN sessions.current_questionnaire_index IS 
  'Индекс текущего опросника в массиве (0-based)';
COMMENT ON COLUMN sessions.total_questionnaires IS 
  'Общее количество опросников (1 = одиночный, >1 = группа)';
```

**Изменить таблицу `responses`:**

```sql
-- Добавить связь с сессией для отслеживания
ALTER TABLE responses
  ADD COLUMN questionnaire_index INTEGER DEFAULT NULL;

-- Комментарий
COMMENT ON COLUMN responses.questionnaire_index IS 
  'Индекс опросника в группе (NULL для одиночных опросников)';
```

**View для просмотра групп опросников:**

```sql
-- View для удобного просмотра групповых сессий
CREATE OR REPLACE VIEW multi_questionnaire_sessions AS
SELECT
    s.id as session_id,
    s.token,
    s.questionnaire_ids,
    s.current_questionnaire_index,
    s.total_questionnaires,
    s.expires_at,
    s.used,
    COUNT(r.id) as completed_questionnaires,
    ARRAY_AGG(r.id ORDER BY r.created_at) as response_ids
FROM sessions s
LEFT JOIN responses r ON r.session_id = s.id
WHERE s.questionnaire_ids IS NOT NULL
GROUP BY s.id;
```

**Итого изменений**: 3 поля + 1 индекс + 1 view = ~30 строк SQL (вместо 400!)

---

### B. Изменения в типах (types.ts)

```typescript
// Расширить существующий интерфейс Session
export interface Session {
  id: string;
  questionnaire_id: string; // Для обратной совместимости (первый в группе)
  questionnaire_ids?: string[]; // ⭐ НОВОЕ: массив опросников
  current_questionnaire_index?: number; // ⭐ НОВОЕ: текущий индекс
  total_questionnaires?: number; // ⭐ НОВОЕ: общее количество
  token: string;
  readable_id?: string;
  created_by_telegram_id?: number;
  expires_at: Date;
  used: boolean;
  created_at: Date;
  used_at?: Date;
}

// Расширить BotUserState
export interface BotUserState {
  sessionToken: string;
  questionnaireId: string;
  questionnaireIds?: string[]; // ⭐ НОВОЕ: если группа опросников
  currentQuestionnaireIndex?: number; // ⭐ НОВОЕ: индекс в группе
  totalQuestionnaires?: number; // ⭐ НОВОЕ: всего опросников
  responseId: string;
  currentQuestionIndex: number;
  answers: Record<string, any>;
  questions: Question[];
}

// Новый интерфейс для создания группы сессий
export interface CreateMultiSessionRequest {
  questionnaire_ids: string[]; // 2-10 опросников
  expiry_hours?: number;
  created_by_telegram_id?: number;
}
```

**Итого**: Расширение 2 существующих интерфейсов + 1 новый = ~20 строк (вместо 100+!)

---

### C. Изменения в репозитории (repo.ts)

```typescript
/**
 * Создать сессию для группы опросников
 * 
 * @param questionnaireIds - Массив UUID опросников (2-10)
 * @param expiryHours - Часы до истечения
 * @param createdByTelegramId - Telegram ID создателя (опционально)
 * @returns Созданная сессия
 */
async createMultiQuestionnaireSession(
  questionnaireIds: string[],
  expiryHours: number = 48,
  createdByTelegramId?: number
): Promise<Session> {
  
  // Валидация
  if (questionnaireIds.length < 2 || questionnaireIds.length > 10) {
    throw new Error('Необходимо от 2 до 10 опросников');
  }
  
  // Проверить что все опросники существуют
  for (const id of questionnaireIds) {
    const q = await this.getQuestionnaire(id);
    if (!q) {
      throw new Error(`Опросник ${id} не найден`);
    }
  }
  
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  
  const result = await this.pool.query(
    `INSERT INTO sessions (
      questionnaire_id, 
      questionnaire_ids, 
      current_questionnaire_index,
      total_questionnaires,
      token, 
      expires_at,
      created_by_telegram_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      questionnaireIds[0], // Первый опросник как основной (для совместимости)
      JSON.stringify(questionnaireIds), // Массив
      0, // Начинаем с первого
      questionnaireIds.length,
      token,
      expiresAt,
      createdByTelegramId
    ]
  );
  
  return this.mapSession(result.rows[0]);
}

/**
 * Получить сессию с проверкой типа (одиночная vs группа)
 */
async getSession(token: string): Promise<Session | null> {
  const result = await this.pool.query(
    'SELECT * FROM sessions WHERE token = $1',
    [token]
  );
  
  if (result.rows.length === 0) return null;
  
  return this.mapSession(result.rows[0]);
}

/**
 * Обновить индекс текущего опросника в группе
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
 */
async isMultiQuestionnaireCompleted(sessionId: string): Promise<boolean> {
  const result = await this.pool.query(
    `SELECT 
      current_questionnaire_index,
      total_questionnaires,
      COUNT(r.id) as completed_count
     FROM sessions s
     LEFT JOIN responses r ON r.session_id = s.id AND r.status = 'completed'
     WHERE s.id = $1
     GROUP BY s.id`,
    [sessionId]
  );
  
  if (result.rows.length === 0) return false;
  
  const row = result.rows[0];
  return row.completed_count >= row.total_questionnaires;
}

/**
 * Получить все ответы для группы опросников
 */
async getMultiQuestionnaireResponses(sessionId: string): Promise<Response[]> {
  const result = await this.pool.query(
    `SELECT * FROM responses 
     WHERE session_id = $1 
     ORDER BY questionnaire_index, created_at`,
    [sessionId]
  );
  
  return result.rows.map(row => this.mapResponse(row));
}

// Вспомогательная функция маппинга
private mapSession(row: any): Session {
  return {
    id: row.id,
    questionnaire_id: row.questionnaire_id,
    questionnaire_ids: row.questionnaire_ids ? JSON.parse(row.questionnaire_ids) : undefined,
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
```

**Итого**: 6 методов = ~150 строк (вместо 400+!)

---

### D. API endpoints (server.ts)

```typescript
/**
 * POST /sessions/multi
 * Создать сессию для группы опросников
 */
app.post('/sessions/multi', async (request, reply) => {
  const schema = z.object({
    questionnaire_ids: z.array(z.string().uuid()).min(2).max(10),
    expiry_hours: z.number().int().min(1).max(168).optional().default(48),
    created_by_telegram_id: z.number().int().positive().optional()
  });
  
  const body = schema.parse(request.body);
  
  try {
    const session = await repo.createMultiQuestionnaireSession(
      body.questionnaire_ids,
      body.expiry_hours,
      body.created_by_telegram_id
    );
    
    // Получить заголовки опросников
    const questionnaires = await Promise.all(
      body.questionnaire_ids.map(id => repo.getQuestionnaire(id))
    );
    
    const totalQuestions = questionnaires.reduce(
      (sum, q) => sum + (q?.questions_json.length || 0),
      0
    );
    
    return reply.status(201).send({
      success: true,
      data: {
        session_id: session.id,
        token: session.token,
        link: `${config.public_bot_link}?start=${session.token}`,
        questionnaires: questionnaires.map(q => ({
          id: q!.id,
          title: q!.title,
          questions_count: q!.questions_json.length
        })),
        total_questionnaires: session.total_questionnaires,
        total_questions: totalQuestions,
        expires_at: session.expires_at
      }
    });
    
  } catch (error: any) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'MULTI_SESSION_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * GET /sessions/:token/progress
 * Получить прогресс прохождения группы опросников
 */
app.get('/sessions/:token/progress', async (request, reply) => {
  const { token } = request.params as { token: string };
  
  const session = await repo.getSession(token);
  
  if (!session) {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Сессия не найдена'
      }
    });
  }
  
  // Если одиночный опросник
  if (!session.questionnaire_ids || session.total_questionnaires === 1) {
    const responses = await repo.getResponsesBySession(session.id);
    return reply.send({
      success: true,
      data: {
        is_multi: false,
        completed: responses.length > 0 && responses[0].status === 'completed'
      }
    });
  }
  
  // Группа опросников
  const responses = await repo.getMultiQuestionnaireResponses(session.id);
  const isCompleted = await repo.isMultiQuestionnaireCompleted(session.id);
  
  return reply.send({
    success: true,
    data: {
      is_multi: true,
      total_questionnaires: session.total_questionnaires,
      current_index: session.current_questionnaire_index,
      completed_questionnaires: responses.filter(r => r.status === 'completed').length,
      is_completed: isCompleted,
      progress_percentage: Math.round(
        (responses.filter(r => r.status === 'completed').length / session.total_questionnaires!) * 100
      )
    }
  });
});
```

**Итого**: 2 endpoint = ~100 строк (вместо 200+!)

---

### E. Telegram бот (bot.ts)

#### Команда `/newsessions` (для админа):

```typescript
bot.onText(/\/newsessions/, async (msg) => {
  if (!isAdmin(msg.from?.id)) {
    await bot.sendMessage(msg.chat.id, '🔒 Команда доступна только администраторам');
    return;
  }
  
  // Получить список опросников
  const questionnaires = await repo.getQuestionnaires();
  
  if (questionnaires.length < 2) {
    await bot.sendMessage(msg.chat.id, '⚠️ Недостаточно опросников (нужно минимум 2)');
    return;
  }
  
  // Показать inline keyboard с чекбоксами
  const keyboard = questionnaires.map(q => [{
    text: `☐ ${q.title} (${q.questions_json.length} вопросов)`,
    callback_data: `toggle_q_${q.id}`
  }]);
  
  keyboard.push([
    { text: '✅ Создать (0 выбрано)', callback_data: 'create_multi_0' },
    { text: '❌ Отмена', callback_data: 'cancel_multi' }
  ]);
  
  await bot.sendMessage(
    msg.chat.id,
    '📋 Выберите опросники для отправки клиенту:\n\n' +
    'Клиент пройдет их последовательно по одной ссылке.',
    { reply_markup: { inline_keyboard: keyboard } }
  );
});
```

#### Обработка выбора опросников:

```typescript
// Храним временное состояние выбора
const multiSelections = new Map<number, Set<string>>(); // userId -> Set<questionnaireId>

bot.on('callback_query', async (query) => {
  const data = query.data;
  const userId = query.from.id;
  
  // Переключение чекбокса
  if (data?.startsWith('toggle_q_')) {
    const qId = data.replace('toggle_q_', '');
    
    if (!multiSelections.has(userId)) {
      multiSelections.set(userId, new Set());
    }
    
    const selected = multiSelections.get(userId)!;
    
    if (selected.has(qId)) {
      selected.delete(qId);
    } else {
      selected.add(qId);
    }
    
    // Обновить keyboard
    const questionnaires = await repo.getQuestionnaires();
    const keyboard = questionnaires.map(q => [{
      text: `${selected.has(q.id) ? '☑' : '☐'} ${q.title} (${q.questions_json.length} вопросов)`,
      callback_data: `toggle_q_${q.id}`
    }]);
    
    keyboard.push([
      { 
        text: `✅ Создать (${selected.size} выбрано)`, 
        callback_data: `create_multi_${selected.size}` 
      },
      { text: '❌ Отмена', callback_data: 'cancel_multi' }
    ]);
    
    await bot.editMessageReplyMarkup(
      { inline_keyboard: keyboard },
      { chat_id: query.message!.chat.id, message_id: query.message!.message_id }
    );
    
    await bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Создание группы сессий
  if (data?.startsWith('create_multi_')) {
    const selected = multiSelections.get(userId);
    
    if (!selected || selected.size < 2) {
      await bot.answerCallbackQuery(query.id, {
        text: '⚠️ Выберите минимум 2 опросника',
        show_alert: true
      });
      return;
    }
    
    try {
      // Создать сессию
      const session = await repo.createMultiQuestionnaireSession(
        Array.from(selected),
        48,
        userId
      );
      
      // Получить названия опросников
      const questionnaires = await Promise.all(
        Array.from(selected).map(id => repo.getQuestionnaire(id))
      );
      
      const totalQuestions = questionnaires.reduce(
        (sum, q) => sum + (q?.questions_json.length || 0),
        0
      );
      
      await bot.editMessageText(
        `✅ ГРУППА ОПРОСНИКОВ СОЗДАНА!\n\n` +
        `📋 Опросников: ${questionnaires.length}\n` +
        `❓ Всего вопросов: ${totalQuestions}\n` +
        `⏰ Действительна до: ${session.expires_at.toLocaleString('ru')}\n\n` +
        `Опросники:\n` +
        questionnaires.map((q, i) => `${i+1}️⃣ ${q!.title}`).join('\n') + '\n\n' +
        `🔗 Ссылка для клиента:\n` +
        `${config.public_bot_link}?start=${session.token}\n\n` +
        `Отправьте эту ссылку клиенту.`,
        { chat_id: query.message!.chat.id, message_id: query.message!.message_id }
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
});
```

#### Прохождение группы опросников:

```typescript
async function handleStart(msg: Message, match: RegExpExecArray | null) {
  const token = match?.[1]?.trim();
  
  if (!token) {
    await bot.sendMessage(msg.chat.id, texts.welcome);
    return;
  }
  
  // Получить сессию
  const session = await repo.getSession(token);
  
  if (!session) {
    await bot.sendMessage(msg.chat.id, '❌ Ссылка недействительна');
    return;
  }
  
  // Проверка истечения
  if (session.expires_at < new Date()) {
    await bot.sendMessage(msg.chat.id, '⏰ Срок действия ссылки истек');
    return;
  }
  
  // Проверка использования
  if (session.used) {
    await bot.sendMessage(msg.chat.id, '✅ Вы уже прошли этот опросник');
    return;
  }
  
  const userId = msg.from!.id;
  
  // Проверить: группа опросников или одиночный?
  const isMulti = session.questionnaire_ids && session.total_questionnaires! > 1;
  
  if (isMulti) {
    // ГРУППА ОПРОСНИКОВ
    
    // Проверить есть ли незавершенный прогресс
    const existingState = await loadUserState(userId);
    
    if (existingState && existingState.sessionToken === token) {
      // Продолжить с текущего места
      await bot.sendMessage(
        msg.chat.id,
        `👋 С возвращением!\n\n` +
        `Вы уже начали прохождение опросников.\n\n` +
        `Прогресс: Опросник ${existingState.currentQuestionnaireIndex! + 1} из ${session.total_questionnaires}\n\n` +
        `[▶️ Продолжить]`
      );
      
      // Отправить следующий вопрос
      await sendQuestion(userId, msg.chat.id);
      return;
    }
    
    // Начать с первого опросника
    const questionnaires = await Promise.all(
      session.questionnaire_ids!.map(id => repo.getQuestionnaire(id))
    );
    
    const totalQuestions = questionnaires.reduce(
      (sum, q) => sum + (q?.questions_json.length || 0),
      0
    );
    
    await bot.sendMessage(
      msg.chat.id,
      `👋 Добро пожаловать!\n\n` +
      `Вам предстоит пройти ${session.total_questionnaires} опросника:\n\n` +
      questionnaires.map((q, i) => `${i+1}️⃣ ${q!.title} (${q!.questions_json.length} вопросов)`).join('\n') + '\n\n' +
      `❓ Всего вопросов: ${totalQuestions}\n` +
      `⏱ Примерное время: ${Math.ceil(totalQuestions * 0.5)} минут\n\n` +
      `ℹ️ Ваш прогресс сохраняется автоматически.\n\n` +
      `Готовы начать?`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '▶️ Начать', callback_data: 'start_multi' }
          ]]
        }
      }
    );
    
  } else {
    // ОДИНОЧНЫЙ ОПРОСНИК (существующая логика)
    // ... существующий код ...
  }
}

// Обработка начала группы
bot.on('callback_query', async (query) => {
  if (query.data === 'start_multi') {
    const userId = query.from.id;
    const chatId = query.message!.chat.id;
    
    // Загрузить сессию из контекста
    // (нужно сохранить токен сессии при показе кнопки "Начать")
    
    // Начать первый опросник
    await startQuestionnaireInGroup(userId, chatId, 0);
    
    await bot.answerCallbackQuery(query.id);
  }
});

async function startQuestionnaireInGroup(
  userId: number,
  chatId: number,
  questionnaireIndex: number
) {
  const state = await loadUserState(userId);
  
  if (!state || !state.questionnaireIds) {
    await bot.sendMessage(chatId, '❌ Ошибка: состояние не найдено');
    return;
  }
  
  const questionnaireId = state.questionnaireIds[questionnaireIndex];
  const questionnaire = await repo.getQuestionnaire(questionnaireId);
  
  if (!questionnaire) {
    await bot.sendMessage(chatId, '❌ Опросник не найден');
    return;
  }
  
  // Обновить состояние
  state.questionnaireId = questionnaireId;
  state.currentQuestionnaireIndex = questionnaireIndex;
  state.currentQuestionIndex = 0;
  state.answers = {};
  state.questions = questionnaire.questions_json;
  
  // Создать новый response для этого опросника
  const response = await repo.createResponse(state.sessionToken);
  state.responseId = response.id;
  
  await saveUserState(userId, state);
  
  // Отправить сообщение о начале опросника
  await bot.sendMessage(
    chatId,
    `📝 ОПРОСНИК ${questionnaireIndex + 1} из ${state.totalQuestionnaires}\n` +
    `🔹 ${questionnaire.title}\n\n` +
    `[▶️ Начать]`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '▶️ Начать', callback_data: 'start_current_q' }
        ]]
      }
    }
  );
}

// Обработка завершения опросника в группе
async function onQuestionnaireCompleted(userId: number, chatId: number) {
  const state = await loadUserState(userId);
  
  if (!state) return;
  
  // Проверить: группа или одиночный?
  if (!state.questionnaireIds || state.totalQuestionnaires === 1) {
    // Одиночный - существующая логика
    // ...
    return;
  }
  
  // Группа опросников
  const currentIndex = state.currentQuestionnaireIndex!;
  const nextIndex = currentIndex + 1;
  
  // Обновить индекс в БД
  await repo.updateCurrentQuestionnaireIndex(
    state.responseId, // TODO: нужен session_id
    nextIndex
  );
  
  if (nextIndex < state.totalQuestionnaires!) {
    // Есть еще опросники
    await bot.sendMessage(
      chatId,
      `🎉 ОПРОСНИК ${currentIndex + 1} ЗАВЕРШЕН!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Общий прогресс: [${progressBar(nextIndex, state.totalQuestionnaires!)}] ${Math.round(nextIndex / state.totalQuestionnaires! * 100)}%\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Следующий опросник:\n` +
      `📝 Опросник ${nextIndex + 1} из ${state.totalQuestionnaires}\n\n` +
      `[▶️ Продолжить]`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '▶️ Продолжить', callback_data: 'continue_next_q' }
          ]]
        }
      }
    );
  } else {
    // Все опросники завершены!
    await bot.sendMessage(
      chatId,
      `🎉🎉🎉 ПОЗДРАВЛЯЕМ!\n\n` +
      `Вы успешно завершили все ${state.totalQuestionnaires} опросника!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Специалист получит результаты в ближайшее время.\n\n` +
      `Спасибо за участие! 💙`
    );
    
    // Уведомить админа
    if (state.createdByTelegramId) {
      await bot.sendMessage(
        state.createdByTelegramId,
        `📊 Клиент завершил группу опросников!\n\n` +
        `Опросников: ${state.totalQuestionnaires}\n` +
        `Дата: ${new Date().toLocaleString('ru')}\n\n` +
        `[📊 Посмотреть результаты]`
      );
    }
    
    // Очистить состояние
    await deleteUserState(userId);
  }
}

function progressBar(current: number, total: number): string {
  const filled = Math.floor((current / total) * 12);
  const empty = 12 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
```

**Итого бот**: ~300 строк новой логики (вместо 600!)

---

## 📊 СРАВНЕНИЕ: Сложная vs Упрощенная система

| Аспект | Сложная (5 таблиц) | Упрощенная (3 поля) |
|--------|-------------------|---------------------|
| **Новых таблиц БД** | 5 | 0 |
| **Новых полей** | ~20 | 3 |
| **Строк миграции** | ~400 | ~30 |
| **Новых типов TS** | 7 | 1 расширение |
| **Методов репозитория** | 12 | 6 |
| **API endpoints** | 7 | 2 |
| **Строк кода бота** | 600+ | 300 |
| **Агрегированные отчеты** | Да | Нет (просто список) |
| **Сложность** | Высокая | Низкая |
| **Время реализации** | 16-23 часа | 4-6 часов |

---

## ✅ ПРЕИМУЩЕСТВА УПРОЩЕННОЙ СИСТЕМЫ

1. ✅ **Минимальные изменения БД** - 3 поля вместо 5 таблиц
2. ✅ **Простая логика** - понятна даже Junior разработчику
3. ✅ **Быстрая реализация** - 4-6 часов вместо 20+
4. ✅ **Легко тестировать** - меньше компонентов
5. ✅ **Обратная совместимость** - не ломает существующий функционал
6. ✅ **Легко откатить** - если что-то пойдет не так

---

## 📋 СЛЕДУЮЩИЕ ШАГИ

Если пользователь одобрит упрощенный подход:

1. Создать миграцию 006 (упрощенную)
2. Расширить типы
3. Добавить методы в репозиторий
4. Добавить 2 API endpoint
5. Расширить бота для групп
6. Протестировать

**Оценка**: 4-6 часов разработки

---

**Дата**: 2025-11-06 (пересмотрено)  
**Статус**: Ожидает одобрения пользователя

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 CREATIVE PHASE END (SIMPLIFIED)

