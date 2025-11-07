/**
 * Express сервер для REST API
 * Настройка middleware и запуск HTTP сервера
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { config } from './config';
import { ApiErrorResponse, ErrorCode } from './types';

/**
 * Создать и настроить Express приложение
 */
export function createApp(): Express {
  const app = express();

  // Middleware для парсинга JSON
  app.use(express.json({ limit: '10mb' }));

  // Middleware для парсинга URL-encoded данных
  app.use(express.urlencoded({ extended: true }));

  // CORS (для development и тестирования)
  if (config.node_env === 'development') {
    app.use((_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });
  }

  // Middleware для логирования запросов
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Маршруты будут подключены в index.ts после создания app
  // 404 обработчик будет добавлен после подключения маршрутов

  // Централизованный обработчик ошибок
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Ошибка сервера:', err);

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: config.node_env === 'production' 
          ? 'Внутренняя ошибка сервера' 
          : err.message,
      },
    };

    res.status(500).json(errorResponse);
  });

  return app;
}

/**
 * Запустить HTTP сервер
 */
export function startServer(app: Express): void {
  const port = config.port;

  const server = app.listen(port, () => {
    console.log(`✅ API сервер запущен на порту ${port}`);
    console.log(`📡 Health check: http://localhost:${port}/health`);
    console.log(`🌍 Окружение: ${config.node_env}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM получен, завершаем сервер...');
    server.close(() => {
      console.log('Сервер закрыт');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT получен, завершаем сервер...');
    server.close(() => {
      console.log('Сервер закрыт');
      process.exit(0);
    });
  });
}

