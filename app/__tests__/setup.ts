/**
 * Настройка Jest для тестирования
 * Этот файл выполняется перед запуском всех тестов
 */

// Увеличиваем таймаут для тестов с базой данных
jest.setTimeout(10000);

// Подавляем логи во время тестов
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

