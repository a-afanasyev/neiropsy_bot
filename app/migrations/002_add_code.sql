-- Миграция: Добавление короткого кода для опросников
-- Дата: 2025-11-06
-- Описание: Добавляем поле code для удобных коротких идентификаторов

-- Добавляем поле code (короткий идентификатор)
ALTER TABLE questionnaires 
ADD COLUMN code VARCHAR(50) UNIQUE;

-- Создаем индекс для быстрого поиска по коду
CREATE INDEX idx_questionnaires_code ON questionnaires(code);

-- Обновляем существующие опросники короткими кодами
-- ADHD
UPDATE questionnaires 
SET code = 'adhd' 
WHERE title LIKE '%СДВГ%';

-- M-CHAT
UPDATE questionnaires 
SET code = 'mchat' 
WHERE title LIKE '%M-CHAT%' OR title LIKE '%аутизм%';

-- SDQ
UPDATE questionnaires 
SET code = 'sdq' 
WHERE title LIKE '%SDQ%' OR title LIKE '%сильных сторон%';

-- Sensory
UPDATE questionnaires 
SET code = 'sensory' 
WHERE title LIKE '%сенсорн%';

-- Demo
UPDATE questionnaires 
SET code = 'demo' 
WHERE title LIKE '%демо%';

-- Добавляем комментарий к полю
COMMENT ON COLUMN questionnaires.code IS 'Короткий идентификатор для удобного использования (например: adhd, mchat, sdq)';

