-- Инициализация базы данных для neiropsy_bot
-- Миграция 001: Основные таблицы для опросников и ответов

-- Включаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================
-- СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ
-- ======================

-- Таблица шаблонов опросников
-- Хранит структуру опросников (вопросы, варианты ответов)
CREATE TABLE IF NOT EXISTS questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    -- JSON с перечнем вопросов данного опросника
    questions_json JSONB NOT NULL,
    -- JSON с описанием правил подсчета баллов/результатов
    scoring_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT questionnaires_title_unique UNIQUE (title)
);

-- Таблица индивидуальных результатов прохождения одного опросника
-- Хранит ответы пользователя на конкретный опросник
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- ID сессии пользователя (может быть NULL для старых записей)
    session_id UUID,
    -- JSON с ответами пользователя на вопросы
    answers_json JSONB NOT NULL,
    -- JSON с рассчитанными баллами или категориями
    score_json JSONB,
    -- Текстовое резюме/вывод по результатам этого опросника
    summary_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT responses_session_id_check CHECK (session_id IS NOT NULL OR session_id IS NULL)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_questionnaires_title ON questionnaires(title);
CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_created_at ON responses(created_at);

-- Комментарии к таблицам
COMMENT ON TABLE questionnaires IS 'Шаблоны опросников с вопросами и правилами подсчета баллов';
COMMENT ON TABLE responses IS 'Результаты прохождения отдельного опросника';

COMMENT ON COLUMN questionnaires.questions_json IS 'JSON массив вопросов с вариантами ответов';
COMMENT ON COLUMN questionnaires.scoring_json IS 'JSON правила подсчета баллов и интерпретации';
COMMENT ON COLUMN responses.answers_json IS 'JSON с ответами пользователя (ключ - id вопроса, значение - ответ)';
COMMENT ON COLUMN responses.score_json IS 'JSON с вычисленными баллами по шкалам';
COMMENT ON COLUMN responses.summary_text IS 'Человекочитаемое резюме результатов';

