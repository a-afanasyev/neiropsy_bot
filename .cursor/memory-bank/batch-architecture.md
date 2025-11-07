# АРХИТЕКТУРА: Батч-опросники

## 🗺️ Общая схема системы

```
┌─────────────────────────────────────────────────────────────────┐
│                        СПЕЦИАЛИСТ                                │
│                      (через Telegram)                            │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    │ /newbatch
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   СОЗДАНИЕ БАТЧА                                 │
│                                                                  │
│  1. Выбор опросников: [ADHD] [M-CHAT] [SDQ] [Sensory]          │
│  2. Создание записей в БД:                                      │
│     • questionnaire_batches (batch_id)                          │
│     • batch_questionnaires (порядок: 1,2,3,4)                   │
│  3. Генерация токена: batch_abc123xyz                           │
│     • batch_sessions (token, expires_at)                        │
│  4. Формирование ссылки:                                        │
│     https://t.me/bot?start=batch_abc123xyz                      │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    │ Отправка ссылки
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ПОЛЬЗОВАТЕЛЬ                                  │
│                  (родитель/клиент)                               │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    │ /start batch_abc123xyz
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              ПОСЛЕДОВАТЕЛЬНОЕ ПРОХОЖДЕНИЕ                        │
│                                                                  │
│  Опросник 1 из 4: ADHD                                          │
│  ├─ Вопрос 1/22: "Часто ли ребенок..."                         │
│  ├─ Вопрос 2/22: ...                                            │
│  └─ Завершен → сохранить response_1                            │
│                                                                  │
│  Опросник 2 из 4: M-CHAT                                        │
│  ├─ Вопрос 1/22: ...                                            │
│  └─ Завершен → сохранить response_2                            │
│                                                                  │
│  Опросник 3 из 4: SDQ                                           │
│  └─ Завершен → сохранить response_3                            │
│                                                                  │
│  Опросник 4 из 4: Sensory                                       │
│  └─ Завершен → сохранить response_4                            │
│                                                                  │
│  ✅ Все опросники завершены!                                    │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    │ Автоматически
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│           ГЕНЕРАЦИЯ АГРЕГИРОВАННОГО ОТЧЕТА                       │
│                                                                  │
│  1. Собрать все responses (1,2,3,4)                             │
│  2. Агрегировать результаты:                                    │
│     • Баллы по каждому опроснику                                │
│     • Общие паттерны и выводы                                   │
│     • Флаги и предупреждения                                    │
│  3. Создать batch_report                                        │
│  4. Отметить batch_session.completed = true                     │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    │ Уведомление
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    СПЕЦИАЛИСТ                                    │
│                  (получение отчета)                              │
│                                                                  │
│  📊 Батч опросников завершен!                                   │
│  Клиент прошел 4 опросника                                      │
│                                                                  │
│  [Посмотреть отчет]  [Выгрузить JSON]  [Выгрузить CSV]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Схема базы данных

```
┌──────────────────────────┐
│  questionnaires          │  ← Существующая таблица
│  ├─ id (PK)              │
│  ├─ title                │
│  ├─ questions_json       │
│  └─ scoring_json         │
└────────┬─────────────────┘
         │
         │
         ▼
┌──────────────────────────┐
│  questionnaire_batches   │  ← НОВАЯ
│  ├─ id (PK)              │
│  ├─ title                │
│  ├─ created_by_telegram_id
│  └─ is_active            │
└────────┬─────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────────┐
│  batch_questionnaires    │  ← НОВАЯ (связующая таблица)
│  ├─ id (PK)              │
│  ├─ batch_id (FK) ───────┼──→ questionnaire_batches.id
│  ├─ questionnaire_id (FK)┼──→ questionnaires.id
│  └─ order_index          │     (1, 2, 3, 4...)
└────────┬─────────────────┘
         │
         │
         ▼
┌──────────────────────────┐
│  batch_sessions          │  ← НОВАЯ
│  ├─ id (PK)              │
│  ├─ batch_id (FK) ───────┼──→ questionnaire_batches.id
│  ├─ token (unique)       │
│  ├─ expires_at           │
│  ├─ completed            │     (false → true)
│  └─ completed_at         │
└────────┬─────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│  batch_responses         │────▶│  responses               │  ← Существующая
│  ├─ id (PK)              │     │  ├─ id (PK)              │
│  ├─ batch_session_id (FK)│     │  ├─ session_id (FK)      │
│  ├─ questionnaire_id (FK)│     │  ├─ answers_json         │
│  ├─ response_id (FK) ────┼─────┼─▶│  ├─ score_json         │
│  └─ order_index          │     │  └─ summary_text         │
└──────────────────────────┘     └──────────────────────────┘
         │
         │ После завершения всех
         ▼
┌──────────────────────────┐
│  batch_reports           │  ← НОВАЯ
│  ├─ id (PK)              │
│  ├─ batch_session_id (FK)│
│  ├─ summary_text         │
│  ├─ aggregated_scores    │     (JSON)
│  └─ flags_json           │
└──────────────────────────┘
```

---

## 🔄 Диаграмма состояний батч-сессии

```
     ┌─────────┐
     │ CREATED │  ← Сессия создана
     └────┬────┘
          │
          │ Пользователь перешел по ссылке
          ▼
   ┌──────────────┐
   │  IN_PROGRESS │  ← Пользователь проходит опросники
   └──────┬───────┘
          │
          │ ┌─ Опросник 1 завершен → batch_responses (1)
          │ ├─ Опросник 2 завершен → batch_responses (2)
          │ ├─ Опросник 3 завершен → batch_responses (3)
          │ └─ Опросник 4 завершен → batch_responses (4)
          │
          │ Все опросники завершены
          ▼
   ┌──────────────┐
   │  COMPLETED   │  ← Генерация отчета
   └──────┬───────┘
          │
          │ Отчет создан
          ▼
   ┌──────────────┐
   │   REPORTED   │  ← Уведомление отправлено
   └──────────────┘
```

---

## 📱 UX Flow (Telegram бот)

### Создание батча

```
Специалист: /newbatch

Бот: 📋 Создание батча опросников
     Выберите опросники (можно несколько):
     
     [✅ СДВГ скрининг (22 вопроса)]
     [✅ M-CHAT аутизм (22 вопроса)]
     [✅ SDQ трудности (27 вопросов)]
     [✅ Сенсорная чувствительность (18 вопросов)]
     
     [Создать батч]  [Отмена]

Специалист: [нажимает "Создать батч"]

Бот: ✅ Батч из 4 опросников создан!
     
     Ссылка для клиента:
     https://t.me/neiropsy_bot?start=batch_abc123xyz
     
     Действительна до: 2025-11-08 15:30
     Всего вопросов: 89
```

### Прохождение батча

```
Пользователь: /start batch_abc123xyz

Бот: 👋 Добро пожаловать!
     
     Вам предстоит пройти 4 опросника (89 вопросов).
     Это займет примерно 20-30 минут.
     
     Вы можете делать перерывы - ваш прогресс сохраняется.
     
     [Начать] [Отмена]

Пользователь: [Начать]

Бот: 📝 Опросник 1 из 4: СДВГ скрининг
     
     Вопрос 1 из 22:
     "Часто ли ребенок отвлекается?"
     
     [Никогда] [Редко] [Иногда] [Часто] [Всегда]

... пользователь отвечает на 22 вопроса ...

Бот: ✅ Опросник 1 из 4 завершен!
     
     📝 Переходим к опроснику 2 из 4: M-CHAT (аутизм)
     
     Вопрос 1 из 22:
     "Смотрит ли ребенок в глаза?"
     ...

... после всех опросников ...

Бот: 🎉 Поздравляем! Все опросники завершены!
     
     Специалист получит результаты в ближайшее время.
     Спасибо за участие!
```

### Получение отчета

```
[Автоматическое уведомление специалисту]

Бот: 📊 Клиент завершил батч опросников!
     
     Дата: 2025-11-06 16:30
     Опросников: 4
     Время прохождения: 28 минут
     
     [Посмотреть отчет]

Специалист: [Посмотреть отчет]

Бот: 📊 АГРЕГИРОВАННЫЙ ОТЧЕТ
     
     === Опросник 1: СДВГ скрининг ===
     Общий балл: 45/60 (75%)
     Уровень: Высокий риск СДВГ
     
     Детали:
     • Невнимательность: 24/30 (высокий)
     • Гиперактивность: 21/30 (высокий)
     
     === Опросник 2: M-CHAT (аутизм) ===
     Общий балл: 8/20
     Уровень: Требуется внимание
     
     Флаги:
     ⚠️ Проблемы с социальным взаимодействием
     
     === Опросник 3: SDQ ===
     ...
     
     === ОБЩИЕ ВЫВОДЫ ===
     • Выявлен высокий риск СДВГ
     • Наблюдаются некоторые признаки РАС
     • Рекомендуется комплексное обследование
     
     [Выгрузить JSON] [Выгрузить CSV] [Детальные ответы]
```

---

## 🔌 API Endpoints

### Создание батча
```http
POST /batches
Content-Type: application/json

{
  "title": "Комплексное обследование",
  "questionnaire_ids": [
    "uuid-adhd",
    "uuid-mchat",
    "uuid-sdq",
    "uuid-sensory"
  ],
  "created_by_telegram_id": 123456789
}

Response 201:
{
  "batch_id": "uuid-batch-1",
  "title": "Комплексное обследование",
  "questionnaires_count": 4
}
```

### Создание сессии для батча
```http
POST /batch-sessions
Content-Type: application/json

{
  "batch_id": "uuid-batch-1"
}

Response 201:
{
  "session_id": "uuid-session-1",
  "token": "batch_abc123xyz",
  "link": "https://t.me/bot?start=batch_abc123xyz",
  "expires_at": "2025-11-08T15:30:00Z"
}
```

### Получение отчета
```http
GET /batch-reports/:batch_session_id

Response 200:
{
  "batch_session_id": "uuid-session-1",
  "completed_at": "2025-11-06T16:30:00Z",
  "summary_text": "...",
  "questionnaires": [
    {
      "title": "СДВГ скрининг",
      "overall_score": 45,
      "overall_label": "Высокий риск"
    },
    ...
  ],
  "flags": [
    "Высокий риск СДВГ",
    "Требуется внимание (аутизм)"
  ]
}
```

### Выгрузка в CSV
```http
GET /exports/batch-report/:batch_session_id.csv

Response 200:
batch_session_id,questionnaire_title,overall_score,overall_label,...
uuid-session-1,СДВГ скрининг,45,Высокий риск,...
uuid-session-1,M-CHAT,8,Требуется внимание,...
...
```

---

## 🧩 Ключевые алгоритмы

### Алгоритм последовательного прохождения

```typescript
async function handleBatchProgress(userId: number, answer: any) {
  // 1. Загрузить состояние батча
  const state = await loadBatchUserState(userId);
  
  // 2. Сохранить ответ на текущий вопрос
  state.answers[state.currentQuestionIndex] = answer;
  state.currentQuestionIndex++;
  
  // 3. Проверить: завершен ли текущий опросник?
  const currentQuestionnaire = state.questionnaireIds[state.currentQuestionnaireOrder - 1];
  const questions = await loadQuestions(currentQuestionnaire);
  
  if (state.currentQuestionIndex >= questions.length) {
    // Опросник завершен
    
    // 4. Сохранить response
    const response = await saveResponse(state);
    
    // 5. Создать batch_response
    await createBatchResponse(
      state.batchSessionId,
      currentQuestionnaire,
      response.id,
      state.currentQuestionnaireOrder
    );
    
    // 6. Перейти к следующему опроснику
    state.currentQuestionnaireOrder++;
    state.currentQuestionIndex = 0;
    state.answers = {};
    
    // 7. Проверить: все ли опросники завершены?
    if (state.currentQuestionnaireOrder > state.totalQuestionnaires) {
      // ВСЕ ЗАВЕРШЕНО!
      await completeBatchSession(state.batchSessionId);
      await generateBatchReport(state.batchSessionId);
      await notifySpecialist(state.batchSessionId);
      return { completed: true };
    }
    
    // Перейти к следующему опроснику
    return { 
      nextQuestionnaire: true,
      currentOrder: state.currentQuestionnaireOrder,
      total: state.totalQuestionnaires
    };
  }
  
  // Продолжить текущий опросник
  await saveBatchUserState(userId, state);
  return { continue: true };
}
```

### Алгоритм агрегирования результатов

```typescript
function aggregateBatchResults(responses: Response[]): BatchReport {
  const results = {
    summary: [],
    aggregatedScores: {},
    flags: []
  };
  
  // 1. Для каждого опросника
  for (const response of responses) {
    const questionnaire = response.questionnaire;
    const score = response.score_json;
    
    // Добавить информацию по опроснику
    results.summary.push({
      title: questionnaire.title,
      overall_score: score.overall.score,
      overall_label: score.overall.label,
      scales: score.scales
    });
    
    // Собрать флаги
    results.flags.push(...score.flags);
    
    // Агрегировать баллы
    results.aggregatedScores[questionnaire.id] = {
      score: score.overall.score,
      label: score.overall.label
    };
  }
  
  // 2. Генерировать общие выводы
  const summaryText = generateOverallSummary(results);
  
  return {
    summary_text: summaryText,
    aggregated_scores_json: results.aggregatedScores,
    flags_json: results.flags
  };
}
```

---

**Дата создания**: 2025-11-06  
**Статус**: Архитектурный документ для фазы CREATIVE

