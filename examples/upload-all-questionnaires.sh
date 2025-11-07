#!/bin/bash

# Скрипт для массовой загрузки опросников через REST API
# Использование: 
#   ./upload-all-questionnaires.sh                    # Загрузить все опросники
#   ./upload-all-questionnaires.sh adhd mchat        # Загрузить конкретные опросники

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Настройки
API_URL=${API_URL:-http://localhost:8088}
TELEGRAM_ID=${ADMIN_TELEGRAM_ID:-${ADMIN_TELEGRAM_IDS%%,*}}  # Берем первый ID из списка

# Проверка наличия jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Ошибка: jq не установлен${NC}"
    echo "Установите jq: brew install jq (macOS) или apt-get install jq (Linux)"
    exit 1
fi

# Проверка наличия curl
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ Ошибка: curl не установлен${NC}"
    exit 1
fi

# Функция для загрузки одного опросника
upload_questionnaire() {
    local questionnaire_file=$1
    local scoring_file=$2
    local name=$(basename "$questionnaire_file" -questionnaire.json)
    
    echo -e "${BLUE}📤 Загрузка: ${name}${NC}"
    
    # Проверка существования файлов
    if [ ! -f "$questionnaire_file" ]; then
        echo -e "${RED}  ❌ Файл $questionnaire_file не найден${NC}"
        return 1
    fi
    
    if [ ! -f "$scoring_file" ]; then
        echo -e "${RED}  ❌ Файл $scoring_file не найден${NC}"
        return 1
    fi
    
    # Читаем содержимое файлов
    local questionnaire_json=$(cat "$questionnaire_file")
    local scoring_json=$(cat "$scoring_file")
    
    # Формируем JSON запрос
    local request_json=$(jq -n \
      --argjson questionnaire "$questionnaire_json" \
      --argjson scoring "$scoring_json" \
      --argjson telegram_id "$TELEGRAM_ID" \
      '{
        telegram_id: $telegram_id,
        questionnaire: $questionnaire,
        scoring: $scoring
      }')
    
    # Отправляем запрос
    local response=$(curl -s -X POST "$API_URL/questionnaires" \
      -H "Content-Type: application/json" \
      -H "X-Telegram-ID: $TELEGRAM_ID" \
      -d "$request_json")
    
    # Проверяем результат
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        local title=$(echo "$response" | jq -r '.data.questionnaire.title // "N/A"')
        echo -e "${GREEN}  ✅ Успешно загружен: ${title}${NC}"
        return 0
    else
        local error=$(echo "$response" | jq -r '.error.message // "Неизвестная ошибка"')
        echo -e "${RED}  ❌ Ошибка: ${error}${NC}"
        return 1
    fi
}

# Получаем список всех опросников
get_all_questionnaires() {
    find . -maxdepth 1 -name "*-questionnaire.json" -type f | \
    sed 's/-questionnaire.json$//' | \
    sed 's|^\./||' | \
    sort
}

# Получаем список опросников из аргументов или все
if [ $# -eq 0 ]; then
    # Загружаем все опросники
    QUESTIONNAIRES=($(get_all_questionnaires))
    echo -e "${YELLOW}📋 Найдено опросников: ${#QUESTIONNAIRES[@]}${NC}"
else
    # Загружаем указанные опросники
    QUESTIONNAIRES=("$@")
    echo -e "${YELLOW}📋 Загрузка опросников: ${QUESTIONNAIRES[*]}${NC}"
fi

echo -e "${BLUE}🌐 API URL: ${API_URL}${NC}"
echo -e "${BLUE}👤 Telegram ID: ${TELEGRAM_ID}${NC}"
echo ""

# Счетчики
SUCCESS=0
FAILED=0
FAILED_LIST=()

# Загружаем каждый опросник
for name in "${QUESTIONNAIRES[@]}"; do
    questionnaire_file="${name}-questionnaire.json"
    scoring_file="${name}-scoring.json"
    
    if upload_questionnaire "$questionnaire_file" "$scoring_file"; then
        ((SUCCESS++))
    else
        ((FAILED++))
        FAILED_LIST+=("$name")
    fi
    echo ""
done

# Итоговая статистика
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Успешно загружено: ${SUCCESS}${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Ошибок: ${FAILED}${NC}"
    echo -e "${RED}Не удалось загрузить: ${FAILED_LIST[*]}${NC}"
else
    echo -e "${GREEN}❌ Ошибок: 0${NC}"
fi
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Возвращаем код ошибки если были неудачи
if [ $FAILED -gt 0 ]; then
    exit 1
fi

exit 0

