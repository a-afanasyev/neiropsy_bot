-- Миграция 003: Таблица сессий прохождения батчей
-- Отслеживает конкретные прохождения батчей клиентами

-- Таблица сессий (сеансов прохождения) батча
-- Каждая сессия = один клиент проходит один батч
CREATE TABLE IF NOT EXISTS batch_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Ссылка на батч, который проходит клиент
    batch_id UUID NOT NULL REFERENCES questionnaire_batches(id) ON DELETE RESTRICT,
    -- Уникальный токен для запуска сессии через Telegram
    -- Формат: batch_<random_string>
    token VARCHAR(100) NOT NULL UNIQUE,
    -- Дата/время истечения срока действия токена
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Флаг завершенности (false пока не пройдены все опросники)
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    -- Временная метка завершения сессии
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Проверка: completed_at должна быть заполнена только если completed = true
    CONSTRAINT batch_sessions_completed_check CHECK (
        (completed = FALSE AND completed_at IS NULL) OR
        (completed = TRUE AND completed_at IS NOT NULL)
    )
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_batch_sessions_token ON batch_sessions(token);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_batch_id ON batch_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_expires_at ON batch_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_completed ON batch_sessions(completed) WHERE completed = FALSE;

-- Комментарии
COMMENT ON TABLE batch_sessions IS 'Сессии прохождения батчей - отслеживание конкретных прохождений';

COMMENT ON COLUMN batch_sessions.token IS 'Уникальный токен для ссылки Telegram (формат: batch_xxx)';
COMMENT ON COLUMN batch_sessions.expires_at IS 'Время истечения ссылки (по умолчанию +48 часов)';
COMMENT ON COLUMN batch_sessions.completed IS 'Флаг: все опросники пройдены и отчет сгенерирован';
COMMENT ON COLUMN batch_sessions.completed_at IS 'Время завершения последнего опросника';

