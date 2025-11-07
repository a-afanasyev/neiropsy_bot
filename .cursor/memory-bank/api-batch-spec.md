# API СПЕЦИФИКАЦИЯ: Батч-опросники

**Базовый URL**: `http://localhost:8088`  
**Версия**: 1.0  
**Дата**: 2025-11-06

---

## 📋 ОБЩИЕ СВЕДЕНИЯ

### Аутентификация

В текущей версии MVP аутентификации нет. В будущем:
- JWT токены или
- API ключи

### Формат ответов

Все ответы в формате JSON:

```json
{
  "success": true,
  "data": { ... }
}
```

Ошибки:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Описание ошибки"
  }
}
```

### Коды ошибок

- `400` - Bad Request (невалидные данные)
- `404` - Not Found (ресурс не найден)
- `409` - Conflict (конфликт, например, дубликат)
- `410` - Gone (токен истек)
- `500` - Internal Server Error

---

## 🔌 ENDPOINTS

### 1. Создание батча

**Создает новый батч из нескольких опросников**

```http
POST /batches
Content-Type: application/json
```

#### Request Body

```typescript
{
  title: string;              // Название батча (обязательно, 1-500 символов)
  description?: string;        // Описание (опционально)
  questionnaire_ids: string[]; // Массив UUID опросников (2-10 элементов)
  created_by_telegram_id: number; // Telegram ID создателя
}
```

#### Пример запроса

```json
{
  "title": "Комплексное обследование ребенка",
  "description": "СДВГ + аутизм + эмоциональные трудности + сенсорика",
  "questionnaire_ids": [
    "b0263f2d-4345-4c31-b327-6b679cc983f4",
    "0676f6bb-b2c5-4606-a7d0-f9ce7cc1cb45",
    "37248454-8c47-4c8e-8fd7-d844bd3113a4",
    "6bc26668-9f80-43c2-8b9c-7949f20a2548"
  ],
  "created_by_telegram_id": 123456789
}
```

#### Response 201 (Created)

```json
{
  "success": true,
  "data": {
    "batch_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Комплексное обследование ребенка",
    "description": "СДВГ + аутизм + эмоциональные трудности + сенсорика",
    "questionnaires_count": 4,
    "created_at": "2025-11-06T15:30:00.000Z"
  }
}
```

#### Ошибки

```json
// 400 - Неправильные данные
{
  "success": false,
  "error": {
    "code": "INVALID_QUESTIONNAIRE_IDS",
    "message": "Необходимо выбрать от 2 до 10 опросников"
  }
}

// 404 - Опросник не найден
{
  "success": false,
  "error": {
    "code": "QUESTIONNAIRE_NOT_FOUND",
    "message": "Опросник с ID xxx не найден"
  }
}
```

---

### 2. Получение информации о батче

**Возвращает информацию о батче и список опросников**

```http
GET /batches/:batch_id
```

#### Path Parameters

- `batch_id` (UUID) - ID батча

#### Response 200 (OK)

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Комплексное обследование ребенка",
    "description": "СДВГ + аутизм + эмоциональные трудности + сенсорика",
    "created_by_telegram_id": 123456789,
    "is_active": true,
    "created_at": "2025-11-06T15:30:00.000Z",
    "questionnaires": [
      {
        "order": 1,
        "id": "b0263f2d-4345-4c31-b327-6b679cc983f4",
        "title": "Скрининг СДВГ (6-17 лет)",
        "questions_count": 22
      },
      {
        "order": 2,
        "id": "0676f6bb-b2c5-4606-a7d0-f9ce7cc1cb45",
        "title": "M-CHAT-R - Скрининг аутизма (16-30 месяцев)",
        "questions_count": 22
      },
      {
        "order": 3,
        "id": "37248454-8c47-4c8e-8fd7-d844bd3113a4",
        "title": "SDQ - Опросник сильных сторон и трудностей (4-17 лет)",
        "questions_count": 27
      },
      {
        "order": 4,
        "id": "6bc26668-9f80-43c2-8b9c-7949f20a2548",
        "title": "Краткий опросник сенсорной чувствительности (3-17 лет)",
        "questions_count": 18
      }
    ],
    "total_questions": 89
  }
}
```

#### Ошибки

```json
// 404 - Батч не найден
{
  "success": false,
  "error": {
    "code": "BATCH_NOT_FOUND",
    "message": "Батч с ID xxx не найден"
  }
}
```

---

### 3. Создание сессии для батча

**Создает одноразовую ссылку для прохождения батча**

```http
POST /batch-sessions
Content-Type: application/json
```

#### Request Body

```typescript
{
  batch_id: string;     // UUID батча
  expiry_hours?: number; // Часы до истечения (по умолчанию 48)
}
```

#### Пример запроса

```json
{
  "batch_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "expiry_hours": 48
}
```

#### Response 201 (Created)

```json
{
  "success": true,
  "data": {
    "session_id": "s1s2s3s4-s5s6-s7s8-s9s0-s1s2s3s4s5s6",
    "token": "batch_abc123xyz456def789ghi",
    "link": "https://t.me/neiropsy_bot?start=batch_abc123xyz456def789ghi",
    "batch_title": "Комплексное обследование ребенка",
    "questionnaires_count": 4,
    "total_questions": 89,
    "expires_at": "2025-11-08T15:30:00.000Z"
  }
}
```

#### Ошибки

```json
// 404 - Батч не найден
{
  "success": false,
  "error": {
    "code": "BATCH_NOT_FOUND",
    "message": "Батч с ID xxx не найден"
  }
}

// 400 - Невалидный expiry_hours
{
  "success": false,
  "error": {
    "code": "INVALID_EXPIRY_HOURS",
    "message": "expiry_hours должно быть от 1 до 168 (7 дней)"
  }
}
```

---

### 4. Проверка батч-сессии

**Проверяет статус батч-сессии по токену**

```http
GET /batch-sessions/:token
```

#### Path Parameters

- `token` (string) - Токен батч-сессии (с префиксом `batch_`)

#### Response 200 (OK)

```json
{
  "success": true,
  "data": {
    "session_id": "s1s2s3s4-s5s6-s7s8-s9s0-s1s2s3s4s5s6",
    "batch_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "batch_title": "Комплексное обследование ребенка",
    "completed": false,
    "expires_at": "2025-11-08T15:30:00.000Z",
    "is_expired": false,
    "progress": {
      "total_questionnaires": 4,
      "completed_questionnaires": 2,
      "percentage": 50
    }
  }
}
```

#### Ошибки

```json
// 404 - Сессия не найдена
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Сессия с токеном xxx не найдена"
  }
}

// 410 - Токен истек
{
  "success": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Срок действия токена истек"
  }
}

// 409 - Батч уже завершен
{
  "success": false,
  "error": {
    "code": "BATCH_COMPLETED",
    "message": "Этот батч уже завершен"
  }
}
```

---

### 5. Получение отчета по батчу

**Возвращает агрегированный отчет после завершения батча**

```http
GET /batch-reports/:batch_session_id
```

#### Path Parameters

- `batch_session_id` (UUID) - ID батч-сессии

#### Query Parameters (опционально)

- `include_responses` (boolean) - Включить детальные ответы (по умолчанию false)

#### Response 200 (OK)

```json
{
  "success": true,
  "data": {
    "batch_session_id": "s1s2s3s4-s5s6-s7s8-s9s0-s1s2s3s4s5s6",
    "batch_title": "Комплексное обследование ребенка",
    "completed_at": "2025-11-06T16:45:00.000Z",
    "duration_minutes": 28,
    
    "questionnaires": [
      {
        "order": 1,
        "title": "Скрининг СДВГ (6-17 лет)",
        "overall_score": 45,
        "overall_label": "Высокий риск СДВГ",
        "scales": [
          {
            "id": "inattention",
            "label": "Невнимательность",
            "score": 24,
            "level": "high"
          },
          {
            "id": "hyperactivity",
            "label": "Гиперактивность",
            "score": 21,
            "level": "high"
          }
        ]
      },
      {
        "order": 2,
        "title": "M-CHAT-R - Скрининг аутизма (16-30 месяцев)",
        "overall_score": 8,
        "overall_label": "Требуется внимание",
        "scales": []
      },
      {
        "order": 3,
        "title": "SDQ - Опросник сильных сторон и трудностей (4-17 лет)",
        "overall_score": 18,
        "overall_label": "Нормальный",
        "scales": [
          {
            "id": "emotional",
            "label": "Эмоциональные симптомы",
            "score": 4,
            "level": "normal"
          },
          {
            "id": "conduct",
            "label": "Проблемы поведения",
            "score": 3,
            "level": "normal"
          },
          {
            "id": "hyperactivity_sdq",
            "label": "Гиперактивность",
            "score": 6,
            "level": "borderline"
          },
          {
            "id": "peer",
            "label": "Проблемы со сверстниками",
            "score": 2,
            "level": "normal"
          },
          {
            "id": "prosocial",
            "label": "Просоциальное поведение",
            "score": 8,
            "level": "normal"
          }
        ]
      },
      {
        "order": 4,
        "title": "Краткий опросник сенсорной чувствительности (3-17 лет)",
        "overall_score": 35,
        "overall_label": "Умеренные сенсорные проблемы",
        "scales": []
      }
    ],
    
    "summary": "=== АГРЕГИРОВАННЫЙ ОТЧЕТ ===\n\n📊 Опросник 1: Скрининг СДВГ\nОбщий балл: 45 (Высокий риск СДВГ)\n• Невнимательность: 24 (высокий)\n• Гиперактивность: 21 (высокий)\n\n📊 Опросник 2: M-CHAT-R\nОбщий балл: 8 (Требуется внимание)\n\n📊 Опросник 3: SDQ\nОбщий балл: 18 (Нормальный)\n• Гиперактивность: 6 (пограничный)\n\n📊 Опросник 4: Сенсорная чувствительность\nОбщий балл: 35 (Умеренные сенсорные проблемы)\n\n=== ОБЩИЕ ВЫВОДЫ ===\n• Выявлен высокий риск СДВГ (невнимательность и гиперактивность)\n• Результаты M-CHAT требуют дополнительного внимания\n• Наблюдаются умеренные сенсорные трудности\n• Рекомендуется комплексное нейропсихологическое обследование",
    
    "flags": [
      "Высокий риск СДВГ",
      "Требуется внимание (M-CHAT)",
      "Умеренные сенсорные проблемы"
    ],
    
    "recommendations": [
      "Консультация детского психиатра по СДВГ",
      "Углубленная диагностика аутистического спектра",
      "Консультация эрготерапевта по сенсорным проблемам"
    ]
  }
}
```

#### Ошибки

```json
// 404 - Отчет не найден
{
  "success": false,
  "error": {
    "code": "REPORT_NOT_FOUND",
    "message": "Отчет для батч-сессии xxx не найден"
  }
}

// 409 - Батч еще не завершен
{
  "success": false,
  "error": {
    "code": "BATCH_NOT_COMPLETED",
    "message": "Батч еще не завершен. Завершено 2 из 4 опросников"
  }
}
```

---

### 6. Выгрузка отчета в JSON

**Скачивание полного отчета в формате JSON**

```http
GET /exports/batch-report/:batch_session_id.json
```

#### Path Parameters

- `batch_session_id` (UUID) - ID батч-сессии

#### Response 200 (OK)

Content-Type: `application/json`
Content-Disposition: `attachment; filename="batch-report-{session_id}.json"`

Структура аналогична ответу `/batch-reports/:batch_session_id`, но с дополнительными деталями:

```json
{
  "metadata": {
    "export_date": "2025-11-06T17:00:00.000Z",
    "batch_session_id": "s1s2s3s4-s5s6-s7s8-s9s0-s1s2s3s4s5s6",
    "format_version": "1.0"
  },
  "batch_info": { ... },
  "questionnaires_results": [ ... ],
  "aggregated_summary": { ... },
  "detailed_responses": [ ... ] // Все ответы на каждый вопрос
}
```

---

### 7. Выгрузка отчета в CSV

**Скачивание отчета в формате CSV**

```http
GET /exports/batch-report/:batch_session_id.csv
```

#### Path Parameters

- `batch_session_id` (UUID) - ID батч-сессии

#### Query Parameters

- `format` (string) - Формат CSV:
  - `summary` (по умолчанию) - краткая сводка
  - `detailed` - с детальными ответами

#### Response 200 (OK) - Summary Format

Content-Type: `text/csv`
Content-Disposition: `attachment; filename="batch-report-{session_id}.csv"`

```csv
batch_session_id,completed_at,questionnaire_order,questionnaire_title,overall_score,overall_label,scale_id,scale_label,scale_score,scale_level
s1s2s3s4...,2025-11-06T16:45:00Z,1,Скрининг СДВГ,45,Высокий риск СДВГ,inattention,Невнимательность,24,high
s1s2s3s4...,2025-11-06T16:45:00Z,1,Скрининг СДВГ,45,Высокий риск СДВГ,hyperactivity,Гиперактивность,21,high
s1s2s3s4...,2025-11-06T16:45:00Z,2,M-CHAT-R,8,Требуется внимание,,,
...
```

#### Response 200 (OK) - Detailed Format

```csv
batch_session_id,completed_at,questionnaire_order,questionnaire_title,question_key,question_text,answer_value,answer_label
s1s2s3s4...,2025-11-06T16:45:00Z,1,Скрининг СДВГ,q1,"Часто ли ребенок отвлекается?",4,Очень часто
s1s2s3s4...,2025-11-06T16:45:00Z,1,Скрининг СДВГ,q2,"Трудно ли сосредоточиться?",3,Часто
...
```

---

## 📚 СХЕМЫ ВАЛИДАЦИИ (Zod)

### CreateBatchRequest

```typescript
const CreateBatchRequestSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  questionnaire_ids: z.array(z.string().uuid()).min(2).max(10),
  created_by_telegram_id: z.number().int().positive()
});
```

### CreateBatchSessionRequest

```typescript
const CreateBatchSessionRequestSchema = z.object({
  batch_id: z.string().uuid(),
  expiry_hours: z.number().int().min(1).max(168).default(48)
});
```

---

## 🔒 БУДУЩИЕ УЛУЧШЕНИЯ

1. **Аутентификация**: JWT или API ключи
2. **Rate limiting**: Ограничение запросов
3. **Webhook**: Уведомления о завершении батча
4. **Pagination**: Для списка батчей
5. **Фильтрация**: По created_by_telegram_id, датам

---

**Дата создания**: 2025-11-06  
**Статус**: Готово к реализации

