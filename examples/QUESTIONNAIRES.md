# Примеры опросников

Этот каталог содержит примеры опросников для психологического скрининга детей и взрослых.

## Доступные опросники

### СДВГ (Синдром дефицита внимания и гиперактивности)

#### 1. СДВГ скрининг (6-17 лет)
- **Файлы**: `adhd-questionnaire.json`, `adhd-scoring.json`
- **Вопросов**: 6 (упрощенная версия)
- **Описание**: Скрининг синдрома дефицита внимания и гиперактивности
- **Шкалы**: Невнимательность, Гиперактивность

#### 2. Conners 3 (6-18 лет)
- **Файлы**: `conners3-questionnaire.json`, `conners3-scoring.json`
- **Вопросов**: 20
- **Описание**: Оценка СДВГ и сопутствующих расстройств

#### 3. Vanderbilt ADHD Diagnostic Rating Scale (6-12 лет)
- **Файлы**: `vanderbilt-questionnaire.json`, `vanderbilt-scoring.json`
- **Вопросов**: 18
- **Описание**: Диагностическая шкала оценки СДВГ

#### 4. ADHD Rating Scale IV/V (DuPaul) (5-17 лет)
- **Файлы**: `dupaul-questionnaire.json`, `dupaul-scoring.json`
- **Вопросов**: 18
- **Описание**: Оценка симптомов СДВГ

#### 5. SNAP-IV (6-18 лет)
- **Файлы**: `snap4-questionnaire.json`, `snap4-scoring.json`
- **Вопросов**: 18
- **Описание**: Оценка СДВГ и оппозиционно-вызывающего расстройства

#### 6. Barkley Home Situations Questionnaire (HSQ) (5-18 лет)
- **Файлы**: `barkley-hsq-questionnaire.json`, `barkley-hsq-scoring.json`
- **Вопросов**: 16
- **Описание**: Поведение в домашних ситуациях

#### 7. Barkley School Situations Questionnaire (SSQ) (5-18 лет)
- **Файлы**: `barkley-ssq-questionnaire.json`, `barkley-ssq-scoring.json`
- **Вопросов**: 12
- **Описание**: Поведение в школьных ситуациях

#### 8. Brown Attention-Deficit Disorder Scales (Brown ADD) (8-18 лет)
- **Файлы**: `brown-add-questionnaire.json`, `brown-add-scoring.json`
- **Вопросов**: 20
- **Описание**: Оценка исполнительных функций и внимания

#### 9. WURS - Wender Utah Rating Scale
- **Файлы**: `wurs-questionnaire.json`, `wurs-scoring.json`
- **Вопросов**: 25
- **Описание**: Ретроспективная оценка СДВГ в детстве (для взрослых)

### Аутизм (РАС)

#### 10. M-CHAT-R - Скрининг аутизма (16-30 месяцев)
- **Файлы**: `mchat-questionnaire.json`, `mchat-scoring.json`
- **Вопросов**: 6 (упрощенная версия)
- **Описание**: Модифицированный опросник для раннего выявления риска аутизма

#### 11. CARS-2 - Childhood Autism Rating Scale (2+ лет)
- **Файлы**: `cars2-questionnaire.json`, `cars2-scoring.json`
- **Вопросов**: 15
- **Описание**: Оценка детского аутизма на основе наблюдения

#### 12. GARS-3 - Gilliam Autism Rating Scale (3-22 лет)
- **Файлы**: `gars3-questionnaire.json`, `gars3-scoring.json`
- **Вопросов**: 15
- **Описание**: Оценка вероятности наличия аутизма

#### 13. ADOS-2 - Autism Diagnostic Observation Schedule
- **Файлы**: `ados2-questionnaire.json`, `ados2-scoring.json`
- **Вопросов**: 15
- **Описание**: Наблюдательная диагностика аутизма (требует профессионального проведения)

#### 14. ADI-R - Autism Diagnostic Interview - Revised
- **Файлы**: `adir-questionnaire.json`, `adir-scoring.json`
- **Вопросов**: 25
- **Описание**: Диагностическое интервью по аутизму (требует профессионального проведения)

#### 15. SRS-2 - Social Responsiveness Scale
- **Файлы**: `srs2-questionnaire.json`, `srs2-scoring.json`
- **Вопросов**: 15
- **Описание**: Шкала социальной отзывчивости

#### 16. SCQ - Social Communication Questionnaire
- **Файлы**: `scq-questionnaire.json`, `scq-scoring.json`
- **Вопросов**: 20
- **Описание**: Опросник социальной коммуникации

#### 17. AQ - Autism Spectrum Quotient
- **Файлы**: `aq-questionnaire.json`, `aq-scoring.json`
- **Вопросов**: 20
- **Описание**: Коэффициент аутистического спектра

#### 18. ASSQ - Autism Spectrum Screening Questionnaire
- **Файлы**: `assq-questionnaire.json`, `assq-scoring.json`
- **Вопросов**: 15
- **Описание**: Опросник скрининга аутистического спектра

#### 19. CAST - Childhood Autism Spectrum Test
- **Файлы**: `cast-questionnaire.json`, `cast-scoring.json`
- **Вопросов**: 15
- **Описание**: Тест детского аутистического спектра

### Исполнительные функции

#### 20. BRIEF-2 - Behavior Rating Inventory of Executive Function
- **Файлы**: `brief2-questionnaire.json`, `brief2-scoring.json`
- **Вопросов**: 15
- **Описание**: Инвентарь оценки исполнительных функций

## Структура файлов

### Файл опросника (questionnaire)

```json
{
  "title": "Название опросника",
  "version": "1.0",
  "language": "ru",
  "questions": [
    {
      "id": "q1",
      "text": "Текст вопроса?",
      "type": "scale | yes-no | single-choice",
      "options": [
        { "value": 0, "label": "Никогда", "score": 0 },
        { "value": 1, "label": "Редко", "score": 1 }
      ],
      "required": true
    }
  ]
}
```

### Файл правил подсчета (scoring)

```json
{
  "scales": [
    {
      "id": "scale_id",
      "label": "Название шкалы",
      "questions": ["q1", "q2"],
      "aggregation": "sum | average | max",
      "thresholds": [5, 10, 15],
      "labels": ["Низкий", "Средний", "Высокий", "Очень высокий"]
    }
  ],
  "overall": {
    "strategy": "sum | average | max | weighted",
    "thresholds": [10, 20, 30],
    "labels": ["Норма", "Легкий риск", "Высокий риск", "Критический"]
  },
  "flags": [
    {
      "id": "flag_id",
      "condition": "scale.scale_id > 10",
      "message": "Текст предупреждения",
      "severity": "low | medium | high"
    }
  ]
}
```

## Загрузка опросников

### Через bash скрипт

```bash
# Сделайте скрипт исполняемым
chmod +x upload-questionnaire.sh

# Установите переменные окружения
export API_URL=http://localhost:8088
export ADMIN_TELEGRAM_ID=ваш_id

# Загрузите опросник (пример)
./upload-questionnaire.sh adhd-questionnaire.json adhd-scoring.json

# Загрузить все опросники можно последовательно:
./upload-questionnaire.sh mchat-questionnaire.json mchat-scoring.json
./upload-questionnaire.sh conners3-questionnaire.json conners3-scoring.json
./upload-questionnaire.sh vanderbilt-questionnaire.json vanderbilt-scoring.json
# ... и так далее для всех опросников
```

### Через curl напрямую

```bash
curl -X POST http://localhost:8088/questionnaires \
  -H "Content-Type: application/json" \
  -H "X-Telegram-ID: 123456789" \
  -d '{
    "telegram_id": 123456789,
    "questionnaire": '$(cat adhd-questionnaire.json)',
    "scoring": '$(cat adhd-scoring.json)'
  }'
```

## Интерпретация результатов

### СДВГ
- **0-6**: Норма
- **7-12**: Легкий риск, требуется наблюдение
- **13-18**: Высокий риск СДВГ, рекомендуется консультация
- **19-24**: Критический риск, необходима диагностика

### M-CHAT
- **0-1**: Норма
- **2**: Низкий риск, повторный скрининг через 1 месяц
- **3-4**: Умеренный риск, требуется углубленная оценка
- **5-6**: Высокий риск РАС, необходима полная диагностика

## Примечания

1. **Все опросники являются упрощенными версиями** для демонстрации системы
2. Полные версии содержат больше вопросов и требуют профессиональной интерпретации
3. **Для клинического использования необходимо:**
   - Использовать валидированные версии опросников
   - Получить разрешения правообладателей
   - Соблюдать этические нормы
   - Обеспечить профессиональную интерпретацию результатов

4. **Результаты скрининга не являются диагнозом** - они указывают на необходимость дальнейшей оценки специалистом

5. **ADOS-2 и ADI-R** требуют профессионального проведения квалифицированными специалистами

6. **Нейропсихологические тесты** (NEPSY-II, CANTAB, WISC-V/WAIS-IV, D-KEFS, Stroop, Trail Making, Wisconsin Card Sorting) не могут быть адаптированы для формата Telegram-бота, так как требуют специального оборудования и программного обеспечения

## Лицензии

- M-CHAT-R: свободное использование для клинических и исследовательских целей
- SDQ: бесплатное использование для некоммерческих целей
- Другие опросники: проверьте лицензии оригинальных версий

