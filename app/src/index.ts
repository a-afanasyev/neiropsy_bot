/**
 * Точка входа в приложение
 * Запуск Telegram бота и REST API сервера
 */

import { config } from './config';
import { db } from './db/connection';
import { createApp, startServer } from './server';
import { createBot, startBot } from './controllers/TelegramController';
import { createApiRouter } from './controllers/RestController';
import { batchService } from './services/BatchService';
import { ApiErrorResponse, ErrorCode } from './types';
import { Request, Response } from 'express';

/**
 * Главная функция запуска приложения
 */
async function main() {
  console.log('🚀 Запуск neiropsy_bot...');
  console.log(`📌 Окружение: ${config.node_env}`);

  try {
    // 1. Проверяем подключение к базе данных
    console.log('📊 Подключение к базе данных...');
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('Не удалось подключиться к базе данных');
    }

    // 2. Создаем и запускаем REST API сервер
    console.log('🌐 Запуск REST API сервера...');
    const app = createApp();
    
    // Подключаем API маршруты
    const apiRouter = createApiRouter();
    app.use('/api', apiRouter);
    app.use('/', apiRouter); // Также доступ без префикса /api
    
    // 404 обработчик (после всех маршрутов)
    app.use((_req: Request, res: Response) => {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.BATCH_NOT_FOUND,
          message: 'Эндпоинт не найден',
        },
      };
      res.status(404).json(errorResponse);
    });
    
    startServer(app);

    // 3. Создаем и запускаем Telegram бота
    console.log('🤖 Запуск Telegram бота...');
    const bot = createBot();
    await startBot(bot);

    console.log('✅ Все компоненты запущены успешно!');
    console.log('');
    console.log('📡 REST API доступен на порту:', config.port);
    console.log('🤖 Telegram бот активен');
    console.log('');
    console.log('💡 Для остановки нажмите Ctrl+C');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  Получен сигнал ${signal}, завершаем работу...`);

      // Останавливаем бота
      console.log('Останавливаем Telegram бота...');
      bot.stop(signal);

      // Закрываем сервисы
      console.log('Закрываем сервисы...');
      await batchService.close();

      // Закрываем подключение к БД
      console.log('Закрываем подключение к базе данных...');
      await db.close();

      console.log('✅ Приложение остановлено');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Критическая ошибка при запуске:', error);
    process.exit(1);
  }
}

// Запускаем приложение
main().catch((error) => {
  console.error('❌ Необработанная ошибка:', error);
  process.exit(1);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (error) => {
  console.error('❌ Необработанное отклонение промиса:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Необработанное исключение:', error);
  process.exit(1);
});

