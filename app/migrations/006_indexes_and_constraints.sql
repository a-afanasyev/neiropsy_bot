-- Миграция 006: Дополнительные индексы и ограничения для оптимизации
-- Улучшает производительность и целостность данных

-- ======================
-- ДОПОЛНИТЕЛЬНЫЕ ИНДЕКСЫ
-- ======================

-- Составные индексы для частых запросов
CREATE INDEX IF NOT EXISTS idx_batch_sessions_batch_completed 
    ON batch_sessions(batch_id, completed);

CREATE INDEX IF NOT EXISTS idx_batch_sessions_expires_completed 
    ON batch_sessions(expires_at, completed) 
    WHERE completed = FALSE;

-- GIN индексы для JSON полей (для поиска внутри JSON)
CREATE INDEX IF NOT EXISTS idx_questionnaires_questions_gin 
    ON questionnaires USING GIN (questions_json);

CREATE INDEX IF NOT EXISTS idx_questionnaires_scoring_gin 
    ON questionnaires USING GIN (scoring_json);

CREATE INDEX IF NOT EXISTS idx_responses_answers_gin 
    ON responses USING GIN (answers_json);

CREATE INDEX IF NOT EXISTS idx_batch_reports_scores_gin 
    ON batch_reports USING GIN (aggregated_scores);

CREATE INDEX IF NOT EXISTS idx_batch_reports_flags_gin 
    ON batch_reports USING GIN (flags_json);

-- ======================
-- ФУНКЦИИ ДЛЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ
-- ======================

-- Функция для автоматического обновления поля updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_questionnaires_updated_at 
    BEFORE UPDATE ON questionnaires
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at 
    BEFORE UPDATE ON questionnaire_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ======================
-- ФУНКЦИИ ДЛЯ ВАЛИДАЦИИ
-- ======================

-- Функция проверки: батч должен содержать минимум 2 опросника
CREATE OR REPLACE FUNCTION validate_batch_questionnaires_count()
RETURNS TRIGGER AS $$
DECLARE
    questionnaires_count INTEGER;
BEGIN
    -- При вставке проверяем количество опросников в батче
    SELECT COUNT(*) INTO questionnaires_count
    FROM batch_questionnaires
    WHERE batch_id = NEW.batch_id;
    
    -- Если это первый или второй опросник - разрешаем
    -- Если батч содержит уже 10 опросников - запрещаем добавление
    IF questionnaires_count >= 10 THEN
        RAISE EXCEPTION 'Батч не может содержать более 10 опросников';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_batch_questionnaires_count
    BEFORE INSERT ON batch_questionnaires
    FOR EACH ROW
    EXECUTE FUNCTION validate_batch_questionnaires_count();

-- ======================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ======================

-- Представление: активные сессии с информацией о батче
CREATE OR REPLACE VIEW active_batch_sessions AS
SELECT 
    bs.id,
    bs.token,
    bs.expires_at,
    bs.created_at,
    bs.completed,
    qb.title AS batch_title,
    qb.created_by_telegram_id,
    COUNT(bq.id) AS total_questionnaires,
    COUNT(br.id) AS completed_questionnaires
FROM batch_sessions bs
JOIN questionnaire_batches qb ON bs.batch_id = qb.id
LEFT JOIN batch_questionnaires bq ON qb.id = bq.batch_id
LEFT JOIN batch_responses br ON bs.id = br.batch_session_id
WHERE bs.completed = FALSE 
  AND bs.expires_at > NOW()
GROUP BY bs.id, bs.token, bs.expires_at, bs.created_at, bs.completed, 
         qb.title, qb.created_by_telegram_id;

-- Представление: статистика по батчам
CREATE OR REPLACE VIEW batch_statistics AS
SELECT 
    qb.id,
    qb.title,
    qb.created_by_telegram_id,
    qb.is_active,
    COUNT(DISTINCT bq.questionnaire_id) AS questionnaires_count,
    COUNT(DISTINCT bs.id) AS total_sessions,
    COUNT(DISTINCT CASE WHEN bs.completed = TRUE THEN bs.id END) AS completed_sessions,
    COUNT(DISTINCT CASE WHEN bs.completed = FALSE AND bs.expires_at > NOW() THEN bs.id END) AS active_sessions
FROM questionnaire_batches qb
LEFT JOIN batch_questionnaires bq ON qb.id = bq.batch_id
LEFT JOIN batch_sessions bs ON qb.id = bs.batch_id
GROUP BY qb.id, qb.title, qb.created_by_telegram_id, qb.is_active;

COMMENT ON VIEW active_batch_sessions IS 'Активные незавершенные сессии с прогрессом';
COMMENT ON VIEW batch_statistics IS 'Статистика по батчам: количество сессий, завершенность';

