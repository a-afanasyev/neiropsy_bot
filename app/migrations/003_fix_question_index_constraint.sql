-- Миграция: Исправление constraint для current_question_index
-- Дата: 2025-11-06
-- Описание: Разрешаем current_question_index = -1 для обозначения "опрос не начат"

-- Проверяем существование constraint перед удалением
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_question_index'
        AND table_name = 'user_states'
    ) THEN
        -- Удаляем старый constraint
        ALTER TABLE user_states DROP CONSTRAINT valid_question_index;
        RAISE NOTICE 'Dropped old constraint valid_question_index';
    END IF;
END $$;

-- Добавляем новый constraint который разрешает -1
ALTER TABLE user_states 
ADD CONSTRAINT valid_question_index 
CHECK (current_question_index >= -1);

-- Добавляем комментарий
COMMENT ON CONSTRAINT valid_question_index ON user_states IS 
'Разрешает индексы от -1 (опрос не начат) до N (количество вопросов)';

-- Успешное завершение
DO $$
BEGIN
    RAISE NOTICE 'Constraint valid_question_index updated successfully';
END $$;

