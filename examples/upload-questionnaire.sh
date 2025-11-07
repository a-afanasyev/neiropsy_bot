#!/bin/bash

# Скрипт для загрузки опросников через REST API
# Использование: ./upload-questionnaire.sh <questionnaire-file> <scoring-file>

# Настройки
API_URL=${API_URL:-http://localhost:8088}
# Поддержка нескольких администраторов: берем первый ID из ADMIN_TELEGRAM_IDS или используем ADMIN_TELEGRAM_ID
if [ -n "$ADMIN_TELEGRAM_IDS" ]; then
    TELEGRAM_ID=${ADMIN_TELEGRAM_IDS%%,*}  # Берем первый ID из списка
else
    TELEGRAM_ID=${ADMIN_TELEGRAM_ID:-123456789}
fi

# Проверка аргументов
if [ $# -lt 2 ]; then
    echo "Использование: $0 <questionnaire-file> <scoring-file>"
    echo "Пример: $0 adhd-questionnaire.json adhd-scoring.json"
    exit 1
fi

QUESTIONNAIRE_FILE=$1
SCORING_FILE=$2

# Проверка существования файлов
if [ ! -f "$QUESTIONNAIRE_FILE" ]; then
    echo "Ошибка: файл $QUESTIONNAIRE_FILE не найден"
    exit 1
fi

if [ ! -f "$SCORING_FILE" ]; then
    echo "Ошибка: файл $SCORING_FILE не найден"
    exit 1
fi

# Проверка валидности JSON файлов перед использованием
if ! jq empty "$QUESTIONNAIRE_FILE" 2>/dev/null; then
    echo "Ошибка: файл $QUESTIONNAIRE_FILE содержит невалидный JSON"
    exit 1
fi

if ! jq empty "$SCORING_FILE" 2>/dev/null; then
    echo "Ошибка: файл $SCORING_FILE содержит невалидный JSON"
    exit 1
fi

echo "📤 Загрузка опросника..."
echo "📝 Questionnaire: $QUESTIONNAIRE_FILE"
echo "📊 Scoring: $SCORING_FILE"
echo "🌐 API URL: $API_URL"
echo "👤 Telegram ID: $TELEGRAM_ID"
echo ""

# Читаем содержимое файлов
QUESTIONNAIRE_JSON=$(cat "$QUESTIONNAIRE_FILE")
SCORING_JSON=$(cat "$SCORING_FILE")

# Формируем JSON запрос
# Используем --arg для telegram_id (это строка, не JSON), затем преобразуем в число
REQUEST_JSON=$(jq -n \
  --argjson questionnaire "$QUESTIONNAIRE_JSON" \
  --argjson scoring "$SCORING_JSON" \
  --arg telegram_id "$TELEGRAM_ID" \
  '{
    telegram_id: ($telegram_id | tonumber),
    questionnaire: $questionnaire,
    scoring: $scoring
  }')

# Отправляем запрос
RESPONSE=$(curl -s -X POST "$API_URL/questionnaires" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-ID: $TELEGRAM_ID" \
  -d "$REQUEST_JSON")

# Проверяем результат
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Опросник успешно загружен!"
    echo ""
    echo "$RESPONSE" | jq '.'
else
    echo "❌ Ошибка при загрузке опросника:"
    echo ""
    echo "$RESPONSE" | jq '.'
    exit 1
fi

