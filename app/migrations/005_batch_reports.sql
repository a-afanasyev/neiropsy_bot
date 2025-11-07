-- Миграция 005: Таблица агрегированных отчетов по батч-сессиям
-- Хранит итоговые результаты анализа по завершенному батчу

-- Таблица агрегированных отчетов по батчам
-- Содержит итоговые выводы и агрегированные показатели
CREATE TABLE IF NOT EXISTS batch_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Ссылка на сессию, для которой подготовлен отчет
    batch_session_id UUID NOT NULL UNIQUE REFERENCES batch_sessions(id) ON DELETE CASCADE,
    -- Текстовое резюме результатов батча (для человека)
    -- Включает основные выводы, суммарные баллы, рекомендации
    summary_text TEXT NOT NULL,
    -- JSON с агрегированными количественными показателями
    -- Например: {опросник_id: {score: X, label: "высокий риск"}, ...}
    aggregated_scores JSONB NOT NULL,
    -- JSON с перечнем флагов/классификаций
    -- Например: ["Высокий риск СДВГ", "Умеренные сенсорные проблемы"]
    flags_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_batch_reports_session_id ON batch_reports(batch_session_id);
CREATE INDEX IF NOT EXISTS idx_batch_reports_created_at ON batch_reports(created_at);

-- Комментарии
COMMENT ON TABLE batch_reports IS 'Агрегированные отчеты по завершенным батч-сессиям';

COMMENT ON COLUMN batch_reports.summary_text IS 'Человекочитаемый текст отчета с выводами и рекомендациями';
COMMENT ON COLUMN batch_reports.aggregated_scores IS 'JSON с агрегированными баллами по всем опросникам';
COMMENT ON COLUMN batch_reports.flags_json IS 'JSON массив флагов риска и классификаций';

