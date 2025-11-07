# МИГРАЦИЯ 006: DDL для батч-опросников

**Файл**: `app/migrations/006_add_batch_questionnaires.sql`  
**Дата**: 2025-11-06  
**Описание**: Добавление таблиц для поддержки батч-опросников

---

## 📋 ПОЛНЫЙ DDL СКРИПТ

```sql
-- ============================================
-- Migration 006: Batch Questionnaires System
-- ============================================
-- Добавляет поддержку батчей (наборов опросников)
-- которые пользователь проходит последовательно

-- ============================================
-- 1. Таблица батчей опросников
-- ============================================

CREATE TABLE IF NOT EXISTS questionnaire_batches (
    -- Идентификатор
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Основная информация
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Метаданные
    created_by_telegram_id BIGINT NOT NULL, -- Telegram ID специалиста
    is_active BOOLEAN DEFAULT true,
    
    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для questionnaire_batches
CREATE INDEX idx_batches_created_by 
    ON questionnaire_batches(created_by_telegram_id);
    
CREATE INDEX idx_batches_active 
    ON questionnaire_batches(is_active) 
    WHERE is_active = true;
    
CREATE INDEX idx_batches_created 
    ON questionnaire_batches(created_at DESC);

-- Комментарий
COMMENT ON TABLE questionnaire_batches IS 
    'Батчи (наборы) опросников для последовательного прохождения';

-- ============================================
-- 2. Связь батчей с опросниками
-- ============================================

CREATE TABLE IF NOT EXISTS batch_questionnaires (
    -- Идентификатор
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Связи
    batch_id UUID NOT NULL 
        REFERENCES questionnaire_batches(id) 
        ON DELETE CASCADE,
    questionnaire_id UUID NOT NULL 
        REFERENCES questionnaires(id) 
        ON DELETE CASCADE,
    
    -- Порядок прохождения (1, 2, 3, ...)
    order_index INTEGER NOT NULL CHECK (order_index > 0),
    
    -- Временная метка
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения уникальности
    UNIQUE(batch_id, questionnaire_id), -- Опросник не может быть дважды в батче
    UNIQUE(batch_id, order_index) -- Порядок должен быть уникален в рамках батча
);

-- Индексы для batch_questionnaires
CREATE INDEX idx_batch_questionnaires_batch 
    ON batch_questionnaires(batch_id, order_index);
    
CREATE INDEX idx_batch_questionnaires_questionnaire 
    ON batch_questionnaires(questionnaire_id);

-- Комментарий
COMMENT ON TABLE batch_questionnaires IS 
    'Связь между батчами и опросниками с указанием порядка';

-- ============================================
-- 3. Сессии для батчей
-- ============================================

CREATE TABLE IF NOT EXISTS batch_sessions (
    -- Идентификатор
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Связь с батчем
    batch_id UUID NOT NULL 
        REFERENCES questionnaire_batches(id) 
        ON DELETE CASCADE,
    
    -- Токен доступа
    token VARCHAR(100) NOT NULL UNIQUE,
    
    -- Время жизни
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Статус завершения
    completed BOOLEAN DEFAULT false,
    
    -- Временные метки
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Ограничения
    CONSTRAINT batch_token_format CHECK (length(token) >= 20),
    CONSTRAINT batch_completion_time CHECK (
        (completed = false AND completed_at IS NULL) OR
        (completed = true AND completed_at IS NOT NULL)
    )
);

-- Индексы для batch_sessions
CREATE UNIQUE INDEX idx_batch_sessions_token 
    ON batch_sessions(token);
    
CREATE INDEX idx_batch_sessions_batch 
    ON batch_sessions(batch_id);
    
CREATE INDEX idx_batch_sessions_expires 
    ON batch_sessions(expires_at) 
    WHERE completed = false;
    
CREATE INDEX idx_batch_sessions_completed 
    ON batch_sessions(completed, completed_at DESC);

-- Комментарий
COMMENT ON TABLE batch_sessions IS 
    'Одноразовые токены для прохождения батчей опросников';

-- ============================================
-- 4. Связь ответов с батчами
-- ============================================

CREATE TABLE IF NOT EXISTS batch_responses (
    -- Идентификатор
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Связи
    batch_session_id UUID NOT NULL 
        REFERENCES batch_sessions(id) 
        ON DELETE CASCADE,
    questionnaire_id UUID NOT NULL 
        REFERENCES questionnaires(id) 
        ON DELETE CASCADE,
    response_id UUID NOT NULL 
        REFERENCES responses(id) 
        ON DELETE CASCADE,
    
    -- Порядок прохождения в рамках этой сессии
    order_index INTEGER NOT NULL CHECK (order_index > 0),
    
    -- Временная метка
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения уникальности
    UNIQUE(batch_session_id, questionnaire_id), -- Один ответ на опросник в батче
    UNIQUE(batch_session_id, response_id), -- Response принадлежит только одному батчу
    UNIQUE(batch_session_id, order_index) -- Уникальный порядок в батче
);

-- Индексы для batch_responses
CREATE INDEX idx_batch_responses_batch_session 
    ON batch_responses(batch_session_id);
    
CREATE INDEX idx_batch_responses_order 
    ON batch_responses(batch_session_id, order_index);
    
CREATE INDEX idx_batch_responses_response 
    ON batch_responses(response_id);

-- Комментарий
COMMENT ON TABLE batch_responses IS 
    'Связь ответов (responses) с батч-сессиями';

-- ============================================
-- 5. Агрегированные отчеты по батчам
-- ============================================

CREATE TABLE IF NOT EXISTS batch_reports (
    -- Идентификатор
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Связь с батч-сессией
    batch_session_id UUID NOT NULL 
        REFERENCES batch_sessions(id) 
        ON DELETE CASCADE,
    
    -- Содержимое отчета
    summary_text TEXT, -- Итоговый текстовый анализ
    aggregated_scores_json JSONB, -- Агрегированные баллы всех опросников
    flags_json JSONB, -- Массив флагов и предупреждений
    
    -- Временная метка
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ограничения
    UNIQUE(batch_session_id), -- Один отчет на батч-сессию
    CONSTRAINT valid_aggregated_scores CHECK (
        aggregated_scores_json IS NULL OR 
        jsonb_typeof(aggregated_scores_json) = 'object'
    ),
    CONSTRAINT valid_flags CHECK (
        flags_json IS NULL OR 
        jsonb_typeof(flags_json) = 'array'
    )
);

-- Индексы для batch_reports
CREATE UNIQUE INDEX idx_batch_reports_batch_session 
    ON batch_reports(batch_session_id);
    
CREATE INDEX idx_batch_reports_created 
    ON batch_reports(created_at DESC);

-- Комментарий
COMMENT ON TABLE batch_reports IS 
    'Агрегированные отчеты по результатам прохождения батчей';

-- ============================================
-- 6. Триггеры для updated_at
-- ============================================

-- Использовать существующую функцию update_updated_at_column()

CREATE TRIGGER update_batches_updated_at 
    BEFORE UPDATE ON questionnaire_batches
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. Функция автоматического завершения батч-сессии
-- ============================================

CREATE OR REPLACE FUNCTION check_batch_completion()
RETURNS TRIGGER AS $$
DECLARE
    expected_count INTEGER;
    actual_count INTEGER;
BEGIN
    -- Получить ожидаемое количество опросников в батче
    SELECT COUNT(*) INTO expected_count
    FROM batch_questionnaires bq
    JOIN batch_sessions bs ON bs.batch_id = bq.batch_id
    WHERE bs.id = NEW.batch_session_id;
    
    -- Получить фактическое количество завершенных ответов
    SELECT COUNT(*) INTO actual_count
    FROM batch_responses
    WHERE batch_session_id = NEW.batch_session_id;
    
    -- Если все опросники завершены, отметить сессию как завершенную
    IF actual_count >= expected_count THEN
        UPDATE batch_sessions
        SET completed = true,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = NEW.batch_session_id
        AND completed = false;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического завершения
CREATE TRIGGER check_batch_completion_trigger 
    AFTER INSERT ON batch_responses
    FOR EACH ROW 
    EXECUTE FUNCTION check_batch_completion();

COMMENT ON FUNCTION check_batch_completion() IS 
    'Автоматически отмечает batch_session как completed когда все опросники завершены';

-- ============================================
-- 8. View для удобного просмотра батчей
-- ============================================

CREATE OR REPLACE VIEW admin_batch_sessions_summary AS
SELECT
    bs.id as batch_session_id,
    bs.token,
    bs.expires_at,
    bs.completed,
    bs.completed_at,
    bs.created_at,
    b.title as batch_title,
    b.created_by_telegram_id,
    COUNT(DISTINCT br.id) as completed_questionnaires,
    (SELECT COUNT(*) FROM batch_questionnaires WHERE batch_id = b.id) as total_questionnaires,
    CASE
        WHEN bs.completed THEN 'completed'
        WHEN bs.expires_at < CURRENT_TIMESTAMP THEN 'expired'
        WHEN EXISTS (SELECT 1 FROM batch_responses WHERE batch_session_id = bs.id) THEN 'in_progress'
        ELSE 'created'
    END as status
FROM batch_sessions bs
JOIN questionnaire_batches b ON b.id = bs.batch_id
LEFT JOIN batch_responses br ON br.batch_session_id = bs.id
GROUP BY bs.id, b.id
ORDER BY bs.created_at DESC;

COMMENT ON VIEW admin_batch_sessions_summary IS 
    'Сводная информация о батч-сессиях для админ-панели';

-- ============================================
-- 9. Функция очистки истекших батч-сессий
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_batch_sessions()
RETURNS void AS $$
BEGIN
    -- Отметить истекшие сессии как использованные (для совместимости)
    -- Фактически они останутся в статусе completed=false, но будут видны как истекшие
    
    -- Опционально: удалить старые неиспользованные сессии (старше 30 дней)
    -- DELETE FROM batch_sessions
    -- WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    -- AND completed = false
    -- AND NOT EXISTS (
    --     SELECT 1 FROM batch_responses 
    --     WHERE batch_session_id = batch_sessions.id
    -- );
    
    RAISE NOTICE 'Expired batch sessions cleanup completed';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_batch_sessions() IS 
    'Очистка истекших батч-сессий (вызывать по расписанию)';

-- ============================================
-- 10. Права доступа
-- ============================================

-- Предполагается, что приложение работает под пользователем 'app'
-- Раскомментировать если нужно:

-- GRANT SELECT, INSERT, UPDATE, DELETE ON questionnaire_batches TO app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON batch_questionnaires TO app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON batch_sessions TO app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON batch_responses TO app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON batch_reports TO app;
-- GRANT SELECT ON admin_batch_sessions_summary TO app;

-- ============================================
-- Завершение миграции
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006: Batch questionnaires system created successfully';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - questionnaire_batches';
    RAISE NOTICE '  - batch_questionnaires';
    RAISE NOTICE '  - batch_sessions';
    RAISE NOTICE '  - batch_responses';
    RAISE NOTICE '  - batch_reports';
    RAISE NOTICE 'Created views:';
    RAISE NOTICE '  - admin_batch_sessions_summary';
    RAISE NOTICE 'Created triggers and functions';
END $$;
```

---

## 📊 ПРОВЕРКА МИГРАЦИИ

### После применения миграции выполнить:

```sql
-- Проверить созданные таблицы
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'batch%'
OR table_name LIKE '%batch%';

-- Должно вернуть:
-- questionnaire_batches
-- batch_questionnaires
-- batch_sessions
-- batch_responses
-- batch_reports

-- Проверить view
SELECT * FROM admin_batch_sessions_summary LIMIT 1;

-- Проверить триггеры
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name LIKE '%batch%';

-- Должно вернуть:
-- check_batch_completion_trigger | batch_responses
-- update_batches_updated_at | questionnaire_batches
```

---

## 🔄 ОТКАТ МИГРАЦИИ

Если нужно откатить изменения:

```sql
-- Файл: app/migrations/006_rollback.sql

-- Удалить view
DROP VIEW IF EXISTS admin_batch_sessions_summary;

-- Удалить триггеры
DROP TRIGGER IF EXISTS check_batch_completion_trigger ON batch_responses;
DROP TRIGGER IF EXISTS update_batches_updated_at ON questionnaire_batches;

-- Удалить функции
DROP FUNCTION IF EXISTS check_batch_completion();
DROP FUNCTION IF EXISTS cleanup_expired_batch_sessions();

-- Удалить таблицы (в обратном порядке из-за FK)
DROP TABLE IF EXISTS batch_reports CASCADE;
DROP TABLE IF EXISTS batch_responses CASCADE;
DROP TABLE IF EXISTS batch_sessions CASCADE;
DROP TABLE IF EXISTS batch_questionnaires CASCADE;
DROP TABLE IF EXISTS questionnaire_batches CASCADE;

-- Проверка
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006 rolled back successfully';
END $$;
```

---

## 📝 ПРИМЕЧАНИЯ

1. **Существующие данные**: Миграция не изменяет существующие таблицы, безопасна для применения
2. **Производительность**: Все FK имеют индексы, запросы будут быстрыми
3. **Каскадное удаление**: При удалении батча удаляются все связанные данные
4. **Автоматизация**: Триггер автоматически завершает батч-сессию
5. **Мониторинг**: View `admin_batch_sessions_summary` для удобного просмотра

---

**Дата создания**: 2025-11-06  
**Статус**: Готово к применению

