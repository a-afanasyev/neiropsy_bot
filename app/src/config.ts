import * as dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return num;
}

export const config: Config = {
  database_url: getEnv('DATABASE_URL'),
  telegram_bot_token: getEnv('TELEGRAM_BOT_TOKEN'),
  admin_tg_id: getEnv('ADMIN_TG_ID'),
  public_bot_link: getEnv('PUBLIC_BOT_LINK'),
  port: getEnvNumber('PORT', 8088),
  session_expiry_hours: getEnvNumber('SESSION_EXPIRY_HOURS', 24),
  node_env: getEnv('NODE_ENV', 'development'),
};

export function isAdmin(userId: number | string): boolean {
  return userId.toString() === config.admin_tg_id;
}
