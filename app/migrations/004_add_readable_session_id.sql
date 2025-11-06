-- Миграция: Добавление читаемого ID для сессий
-- Дата: 2025-11-06
-- Описание: Добавляем поле readable_id для удобной идентификации сессий
--            Формат: user_{telegram_id}_{questionnaire_code}_{date}_{seq}

-- Добавляем поле для читаемого ID
ALTER TABLE sessions 
ADD COLUMN readable_id VARCHAR(200) UNIQUE;

-- Добавляем поле для хранения telegram_user_id создателя сессии
ALTER TABLE sessions 
ADD COLUMN created_by_telegram_id BIGINT;

-- Создаем индекс для быстрого поиска
CREATE INDEX idx_sessions_readable_id ON sessions(readable_id);

-- Добавляем комментарии
COMMENT ON COLUMN sessions.readable_id IS 
'Читаемый идентификатор сессии в формате: user_{telegram_id}_{code}_{date}_{seq}';

COMMENT ON COLUMN sessions.created_by_telegram_id IS 
'Telegram ID пользователя, создавшего сессию (обычно admin)';

-- Функция для генерации readable_id
CREATE OR REPLACE FUNCTION generate_readable_session_id(
  p_telegram_id BIGINT,
  p_questionnaire_id UUID
) RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR(50);
  v_date VARCHAR(8);
  v_seq INT;
  v_readable_id VARCHAR(200);
BEGIN
  -- Получаем код опросника
  SELECT code INTO v_code
  FROM questionnaires
  WHERE id = p_questionnaire_id;
  
  -- Если код не найден, используем первые 8 символов UUID
  IF v_code IS NULL THEN
    v_code := SUBSTRING(p_questionnaire_id::TEXT, 1, 8);
  END IF;
  
  -- Текущая дата в формате YYYYMMDD
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Находим следующий порядковый номер для этой даты
  SELECT COALESCE(MAX(
    SUBSTRING(readable_id FROM '.*_(\d+)$')::INT
  ), 0) + 1 INTO v_seq
  FROM sessions
  WHERE readable_id LIKE 'user_' || p_telegram_id || '_' || v_code || '_' || v_date || '_%';
  
  -- Формируем readable_id
  v_readable_id := 'user_' || p_telegram_id || '_' || v_code || '_' || v_date || '_' || LPAD(v_seq::TEXT, 3, '0');
  
  RETURN v_readable_id;
END;
$$ LANGUAGE plpgsql;

-- Успешное завершение
DO $$
BEGIN
    RAISE NOTICE 'Added readable_id field to sessions table';
END $$;

