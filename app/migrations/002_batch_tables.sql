-- Миграция 002: Таблицы для батчевых опросов
-- Добавляет возможность объединять несколько опросников в батчи

-- ======================
-- ТАБЛИЦЫ ДЛЯ БАТЧЕЙ
-- ======================

-- Таблица батчей опросников
-- Группирует несколько опросников под одним ID
CREATE TABLE IF NOT EXISTS questionnaire_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Название батча, задается специалистом
    title VARCHAR(500) NOT NULL,
    -- Telegram ID специалиста, создавшего батч
    created_by_telegram_id BIGINT NOT NULL,
    -- Флаг активности: можно ли создавать новые сессии
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Связующая таблица: какие опросники входят в батч
-- Определяет состав и порядок опросников в батче
CREATE TABLE IF NOT EXISTS batch_questionnaires (
    id SERIAL PRIMARY KEY,
    -- Ссылка на батч
    batch_id UUID NOT NULL REFERENCES questionnaire_batches(id) ON DELETE CASCADE,
    -- Ссылка на опросник
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE RESTRICT,
    -- Порядок данного опросника в батче (1, 2, 3, ...)
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Уникальность: один опросник не может быть дважды в одном батче
    CONSTRAINT batch_questionnaires_unique UNIQUE (batch_id, questionnaire_id),
    -- Проверка: порядковый номер должен быть положительным
    CONSTRAINT batch_questionnaires_order_positive CHECK (order_index > 0)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_batch_questionnaires_batch_id ON batch_questionnaires(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_questionnaires_order ON batch_questionnaires(batch_id, order_index);
CREATE INDEX IF NOT EXISTS idx_batches_telegram_id ON questionnaire_batches(created_by_telegram_id);
CREATE INDEX IF NOT EXISTS idx_batches_active ON questionnaire_batches(is_active) WHERE is_active = TRUE;

-- Комментарии
COMMENT ON TABLE questionnaire_batches IS 'Батчи опросников - наборы опросников для последовательного прохождения';
COMMENT ON TABLE batch_questionnaires IS 'Связь между батчами и опросниками с указанием порядка';

COMMENT ON COLUMN questionnaire_batches.created_by_telegram_id IS 'Telegram ID специалиста-администратора';
COMMENT ON COLUMN questionnaire_batches.is_active IS 'Можно ли создавать новые сессии по этому батчу';
COMMENT ON COLUMN batch_questionnaires.order_index IS 'Порядковый номер опросника в батче (начиная с 1)';

