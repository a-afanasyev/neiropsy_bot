-- Миграция 004: Связь между батч-сессиями и индивидуальными ответами
-- Позволяет собрать все ответы по конкретной батч-сессии

-- Таблица связей между батч-сессией и результатами responses
-- Хранит ссылки на результаты каждого опросника внутри сессии
CREATE TABLE IF NOT EXISTS batch_responses (
    id SERIAL PRIMARY KEY,
    -- Ссылка на сессию прохождения
    batch_session_id UUID NOT NULL REFERENCES batch_sessions(id) ON DELETE CASCADE,
    -- Какой опросник из батча
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE RESTRICT,
    -- Ссылка на запись в responses с ответами на этот опросник
    response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    -- Порядковый номер опросника в батче (дублирует для удобства)
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Уникальность: один опросник один раз в сессии
    CONSTRAINT batch_responses_unique_session_questionnaire UNIQUE (batch_session_id, questionnaire_id),
    -- Уникальность response_id: один response не может быть в нескольких батчах
    CONSTRAINT batch_responses_unique_response UNIQUE (response_id),
    -- Проверка: порядковый номер должен быть положительным
    CONSTRAINT batch_responses_order_positive CHECK (order_index > 0)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_batch_responses_session_id ON batch_responses(batch_session_id);
CREATE INDEX IF NOT EXISTS idx_batch_responses_questionnaire_id ON batch_responses(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_batch_responses_response_id ON batch_responses(response_id);
CREATE INDEX IF NOT EXISTS idx_batch_responses_order ON batch_responses(batch_session_id, order_index);

-- Комментарии
COMMENT ON TABLE batch_responses IS 'Связь между батч-сессиями и индивидуальными результатами опросников';

COMMENT ON COLUMN batch_responses.batch_session_id IS 'К какой сессии батча относятся ответы';
COMMENT ON COLUMN batch_responses.questionnaire_id IS 'Какой опросник был пройден';
COMMENT ON COLUMN batch_responses.response_id IS 'Ссылка на детальные ответы в таблице responses';
COMMENT ON COLUMN batch_responses.order_index IS 'Порядковый номер опросника в батче (начиная с 1)';

