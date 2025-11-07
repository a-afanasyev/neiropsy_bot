/**
 * Конфигурация приложения
 * Загружает и валидирует переменные окружения
 */

import * as dotenv from 'dotenv';
import { AppConfig } from './types';

// Загружаем переменные окружения из .env файла
dotenv.config();

/**
 * Получить обязательную переменную окружения
 * Выбрасывает ошибку если переменная не задана
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Обязательная переменная окружения ${name} не задана`);
  }
  return value;
}

/**
 * Получить опциональную переменную окружения
 */
function getOptionalEnv(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}

/**
 * Получить числовую переменную окружения
 */
function getNumberEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Переменная окружения ${name} должна быть числом, получено: ${value}`);
  }
  return parsed;
}

/**
 * Валидация Telegram Bot Token
 */
function validateBotToken(token: string): void {
  // Токен бота имеет формат: <bot_id>:<token>
  // Пример: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
  const tokenRegex = /^\d+:[A-Za-z0-9_-]{35,}$/;
  if (!tokenRegex.test(token)) {
    throw new Error('Неверный формат TELEGRAM_BOT_TOKEN');
  }
}

/**
 * Загрузка и валидация конфигурации
 */
function loadConfig(): AppConfig {
  // Загружаем обязательные параметры
  const telegram_bot_token = getRequiredEnv('TELEGRAM_BOT_TOKEN');
  validateBotToken(telegram_bot_token);

  // Поддержка нескольких администраторов через ADMIN_TELEGRAM_IDS (через запятую)
  // Если задан ADMIN_TELEGRAM_IDS, используем его, иначе используем ADMIN_TELEGRAM_ID
  let admin_telegram_ids: number[] = [];
  const admin_ids_env = getOptionalEnv('ADMIN_TELEGRAM_IDS');
  
  if (admin_ids_env) {
    // Парсим список ID через запятую
    admin_telegram_ids = admin_ids_env
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .map((id) => {
        const parsed = parseInt(id, 10);
        if (isNaN(parsed)) {
          throw new Error(`Неверный формат ADMIN_TELEGRAM_IDS: ${id} не является числом`);
        }
        return parsed;
      });
  } else {
    // Используем старый способ с одним администратором
    const admin_telegram_id = getNumberEnv('ADMIN_TELEGRAM_ID', 0);
    if (admin_telegram_id === 0) {
      throw new Error('ADMIN_TELEGRAM_ID или ADMIN_TELEGRAM_IDS должен быть задан и быть числом');
    }
    admin_telegram_ids = [admin_telegram_id];
  }

  if (admin_telegram_ids.length === 0) {
    throw new Error('Должен быть задан хотя бы один администратор (ADMIN_TELEGRAM_ID или ADMIN_TELEGRAM_IDS)');
  }

  const database_url = getRequiredEnv('DATABASE_URL');

  // Опциональные параметры
  const redis_url = getOptionalEnv('REDIS_URL');
  const port = getNumberEnv('PORT', 8088);

  // Node environment
  const node_env_raw = getOptionalEnv('NODE_ENV', 'development') || 'development';
  const node_env = ['development', 'production', 'test'].includes(node_env_raw)
    ? (node_env_raw as 'development' | 'production' | 'test')
    : 'development';

  // Log level
  const log_level_raw = getOptionalEnv('LOG_LEVEL', 'info') || 'info';
  const log_level = ['debug', 'info', 'warn', 'error'].includes(log_level_raw)
    ? (log_level_raw as 'debug' | 'info' | 'warn' | 'error')
    : 'info';

  // Возвращаем конфигурацию
  // admin_telegram_ids[0] гарантированно существует, так как мы проверили длину массива выше
  const firstAdminId = admin_telegram_ids[0];
  if (!firstAdminId) {
    throw new Error('Не удалось определить ID первого администратора');
  }

  return {
    telegram_bot_token,
    admin_telegram_id: firstAdminId, // Для обратной совместимости
    admin_telegram_ids, // Массив всех администраторов
    database_url,
    redis_url,
    port,
    node_env,
    log_level,
  };
}

// Экспортируем сконфигурированный объект
export const config: AppConfig = loadConfig();

// Экспортируем также для удобства
export default config;

