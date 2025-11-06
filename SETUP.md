# Инструкция по настройке бота

## Шаг 1: Создание Telegram бота

### 1.1. Получить токен бота

1. Откройте Telegram и найдите **@BotFather**
2. Отправьте команду `/newbot`
3. Введите имя вашего бота (например: "Neiropsy Survey Bot")
4. Введите username бота (должен заканчиваться на `bot`, например: `neiropsy_survey_bot`)
5. BotFather пришлет вам токен в формате:
   ```
   1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
   ```
6. **Скопируйте этот токен!**

### 1.2. Узнать свой Telegram ID

1. Найдите в Telegram бота **@userinfobot**
2. Нажмите "Start" или отправьте `/start`
3. Бот пришлет информацию о вас, включая ID:
   ```
   Id: 123456789
   ```
4. **Скопируйте это число!**

## Шаг 2: Настройка файла .env

Откройте файл `.env` в корне проекта и заполните:

```bash
# 1. ВСТАВЬТЕ ТОКЕН ОТ @BotFather
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ

# 2. ВСТАВЬТЕ ВАШ TELEGRAM ID (от @userinfobot)
ADMIN_TG_ID=123456789

# 3. ВСТАВЬТЕ ССЫЛКУ НА ВАШЕГО БОТА
# Используйте username, который вы создали у @BotFather
PUBLIC_BOT_LINK=https://t.me/neiropsy_survey_bot
```

### Пример заполненного .env файла:

```bash
# Database
DATABASE_URL=postgres://app:app@localhost:5439/app

# Telegram Bot
TELEGRAM_BOT_TOKEN=7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
ADMIN_TG_ID=987654321

# Server
NODE_ENV=development
PORT=8088
PUBLIC_BOT_LINK=https://t.me/my_neiropsy_bot

# Session
SESSION_EXPIRY_HOURS=24
```

## Шаг 3: Запуск бота

### С Docker Compose (рекомендуется):

```bash
# Запустить все сервисы
docker-compose up -d

# Проверить логи
docker-compose logs -f app
```

### Локально (для разработки):

```bash
# Установить зависимости
npm install

# Запустить PostgreSQL
docker-compose up -d db

# Запустить приложение
npm run dev
```

## Шаг 4: Проверка работы

1. Найдите вашего бота в Telegram (по username)
2. Отправьте команду `/help`
3. Если бот отвечает - всё настроено правильно!

## Шаг 5: Загрузка тестового опросника

```bash
cd examples
./upload-questionnaire.sh
```

Скрипт вернет ID опросника, например:
```json
{
  "success": true,
  "questionnaire": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

## Шаг 6: Создание первой сессии

В Telegram отправьте боту:
```
/newsession a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Бот вернет одноразовую ссылку для прохождения опроса.

## Устранение проблем

### Бот не отвечает:

1. Проверьте, что TELEGRAM_BOT_TOKEN правильный
2. Проверьте логи: `docker-compose logs -f app`
3. Убедитесь, что бот запущен: `docker-compose ps`

### "Эта команда доступна только администратору":

1. Проверьте, что ADMIN_TG_ID совпадает с вашим ID
2. Перезапустите бота: `docker-compose restart app`

### База данных не подключается:

1. Проверьте, что PostgreSQL запущен: `docker-compose ps db`
2. Проверьте DATABASE_URL в .env
3. Проверьте логи БД: `docker-compose logs -f db`

## Дополнительные команды бота

Для администратора:
- `/help` - справка
- `/newsession <questionnaire_id>` - создать одноразовую ссылку
- `/listq` - список опросников
- `/listr <questionnaire_id>` - список ответов

## Безопасность

⚠️ **ВАЖНО:**
- Не публикуйте файл `.env` в git (он уже в .gitignore)
- Не делитесь TELEGRAM_BOT_TOKEN ни с кем
- Только пользователь с ADMIN_TG_ID может управлять ботом
- Храните токен в безопасности

## Полезные ссылки

- Документация Telegram Bots: https://core.telegram.org/bots
- @BotFather: https://t.me/botfather
- @userinfobot: https://t.me/userinfobot
