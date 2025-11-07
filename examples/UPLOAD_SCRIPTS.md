# Скрипты для загрузки опросников

В этой директории находятся скрипты для загрузки опросников в систему через REST API.

## Доступные скрипты

### 1. `upload-questionnaire.sh` - Загрузка одного опросника

Загружает один опросник с его правилами подсчета.

**Использование:**
```bash
export API_URL=http://localhost:8088
export ADMIN_TELEGRAM_ID=ваш_id
# или для нескольких администраторов:
export ADMIN_TELEGRAM_IDS=123456,789012

./upload-questionnaire.sh adhd-questionnaire.json adhd-scoring.json
```

**Параметры:**
- `API_URL` - URL API сервера (по умолчанию: `http://localhost:8088`)
- `ADMIN_TELEGRAM_ID` - Telegram ID администратора
- `ADMIN_TELEGRAM_IDS` - Список Telegram ID администраторов через запятую (приоритет над ADMIN_TELEGRAM_ID)

### 2. `upload-all-questionnaires.sh` - Массовая загрузка опросников

Загружает все опросники из текущей директории или указанные опросники.

**Использование:**

```bash
# Настройка переменных окружения
export API_URL=http://localhost:8088
export ADMIN_TELEGRAM_ID=ваш_id
# или для нескольких администраторов:
export ADMIN_TELEGRAM_IDS=123456,789012

# Загрузить все опросники
./upload-all-questionnaires.sh

# Загрузить конкретные опросники
./upload-all-questionnaires.sh adhd mchat conners3
```

**Особенности:**
- Автоматически находит все пары файлов `*-questionnaire.json` и `*-scoring.json`
- Показывает прогресс загрузки с цветным выводом
- Выводит статистику успешных и неудачных загрузок
- Продолжает работу даже при ошибках отдельных опросников

**Пример вывода:**
```
📋 Найдено опросников: 20
🌐 API URL: http://localhost:8088
👤 Telegram ID: 123456789

📤 Загрузка: adhd
  ✅ Успешно загружен: СДВГ скрининг

📤 Загрузка: mchat
  ✅ Успешно загружен: M-CHAT-R

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Успешно загружено: 20
❌ Ошибок: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Требования

- `bash` (обычно предустановлен)
- `curl` - для отправки HTTP запросов
- `jq` - для работы с JSON

**Установка зависимостей:**

macOS:
```bash
brew install jq
```

Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install jq curl
```

## Примеры использования

### Загрузка всех опросников в Docker окружении

```bash
cd examples
export API_URL=http://localhost:8088
export ADMIN_TELEGRAM_ID=48617336
./upload-all-questionnaires.sh
```

### Загрузка конкретных опросников

```bash
cd examples
export API_URL=http://localhost:8088
export ADMIN_TELEGRAM_ID=48617336
./upload-all-questionnaires.sh adhd mchat conners3 vanderbilt
```

### Загрузка одного опросника

```bash
cd examples
export API_URL=http://localhost:8088
export ADMIN_TELEGRAM_ID=48617336
./upload-questionnaire.sh adhd-questionnaire.json adhd-scoring.json
```

## Устранение неполадок

### Ошибка: "jq не установлен"
Установите `jq` согласно инструкциям выше.

### Ошибка: "curl не установлен"
Установите `curl`:
- macOS: обычно предустановлен
- Ubuntu/Debian: `sudo apt-get install curl`

### Ошибка: "Ошибка при загрузке опросника"
1. Проверьте, что API сервер запущен: `curl http://localhost:8088/health`
2. Проверьте правильность Telegram ID в переменных окружения
3. Проверьте формат JSON файлов: `jq . questionnaire-file.json`
4. Проверьте логи сервера: `docker-compose logs -f app`

### Ошибка: "Недостаточно прав для загрузки опросника"
Убедитесь, что ваш Telegram ID указан в `ADMIN_TELEGRAM_ID` или `ADMIN_TELEGRAM_IDS` в файле `.env` на сервере.

## Примечания

- Скрипты автоматически определяют формат имен файлов (`*-questionnaire.json` и `*-scoring.json`)
- При использовании `ADMIN_TELEGRAM_IDS` скрипты автоматически берут первый ID из списка
- Все скрипты проверяют наличие необходимых зависимостей перед запуском
- Скрипты продолжают работу даже при ошибках отдельных опросников (для массовой загрузки)

