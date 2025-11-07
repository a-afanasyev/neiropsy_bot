/**
 * Тесты для безопасного парсера выражений
 * Проверка корректности обработки цепочечных сравнений
 */

import { ReportGenerator } from '../src/services/ReportGenerator';

describe('Expression Parser - safeEvaluateComparison', () => {
  const reportGenerator = new ReportGenerator();

  // Используем приватный метод через any для тестирования
  const safeEval = (expr: string) => 
    (reportGenerator as any).safeEvaluateComparison(expr);

  describe('Простые сравнения', () => {
    it('должен правильно оценивать простое сравнение >', () => {
      expect(safeEval('5 > 3')).toBe(true);
      expect(safeEval('3 > 5')).toBe(false);
      expect(safeEval('5 > 5')).toBe(false);
    });

    it('должен правильно оценивать простое сравнение <', () => {
      expect(safeEval('3 < 5')).toBe(true);
      expect(safeEval('5 < 3')).toBe(false);
      expect(safeEval('5 < 5')).toBe(false);
    });

    it('должен правильно оценивать >=', () => {
      expect(safeEval('5 >= 3')).toBe(true);
      expect(safeEval('5 >= 5')).toBe(true);
      expect(safeEval('3 >= 5')).toBe(false);
    });

    it('должен правильно оценивать <=', () => {
      expect(safeEval('3 <= 5')).toBe(true);
      expect(safeEval('5 <= 5')).toBe(true);
      expect(safeEval('5 <= 3')).toBe(false);
    });

    it('должен правильно оценивать ==', () => {
      expect(safeEval('5 == 5')).toBe(true);
      expect(safeEval('5 == 3')).toBe(false);
    });

    it('должен правильно оценивать !=', () => {
      expect(safeEval('5 != 3')).toBe(true);
      expect(safeEval('5 != 5')).toBe(false);
    });
  });

  describe('Цепочечные сравнения (fix для Bug)', () => {
    it('должен правильно оценивать цепочку: 5 > 3 > 2 (все истинны)', () => {
      // 5 > 3 = true, 3 > 2 = true → итог: true
      expect(safeEval('5 > 3 > 2')).toBe(true);
    });

    it('должен правильно оценивать цепочку: 5 > 3 > 4 (одна ложна)', () => {
      // 5 > 3 = true, 3 > 4 = false → итог: false
      expect(safeEval('5 > 3 > 4')).toBe(false);
    });

    it('должен правильно оценивать цепочку: 10 > 5 > 3 > 1 (все истинны)', () => {
      // 10 > 5 = true, 5 > 3 = true, 3 > 1 = true → итог: true
      expect(safeEval('10 > 5 > 3 > 1')).toBe(true);
    });

    it('должен правильно оценивать цепочку: 1 < 3 < 5 (все истинны)', () => {
      // 1 < 3 = true, 3 < 5 = true → итог: true
      expect(safeEval('1 < 3 < 5')).toBe(true);
    });

    it('должен правильно оценивать цепочку: 1 < 3 < 2 (одна ложна)', () => {
      // 1 < 3 = true, 3 < 2 = false → итог: false
      expect(safeEval('1 < 3 < 2')).toBe(false);
    });

    it('должен правильно оценивать цепочку: 5 >= 5 >= 5 (все истинны)', () => {
      // 5 >= 5 = true, 5 >= 5 = true → итог: true
      expect(safeEval('5 >= 5 >= 5')).toBe(true);
    });
  });

  describe('Логические операторы', () => {
    it('должен правильно оценивать &&', () => {
      expect(safeEval('5 > 3 && 2 < 4')).toBe(true);
      expect(safeEval('5 > 3 && 4 < 2')).toBe(false);
      expect(safeEval('3 > 5 && 2 < 4')).toBe(false);
    });

    it('должен правильно оценивать ||', () => {
      expect(safeEval('5 > 3 || 4 < 2')).toBe(true);
      expect(safeEval('3 > 5 || 2 < 4')).toBe(true);
      expect(safeEval('3 > 5 || 4 < 2')).toBe(false);
    });
  });

  describe('Обработка ошибок', () => {
    it('должен возвращать false для невалидных чисел', () => {
      expect(safeEval('abc > 5')).toBe(false);
      expect(safeEval('5 > xyz')).toBe(false);
    });

    it('должен возвращать false для неполных выражений', () => {
      expect(safeEval('5 >')).toBe(false);
      expect(safeEval('> 5')).toBe(false);
    });

    it('должен возвращать false для выражений без оператора', () => {
      expect(safeEval('5')).toBe(false);
      expect(safeEval('abc')).toBe(false);
    });
  });

  describe('Числа с плавающей точкой', () => {
    it('должен поддерживать десятичные числа', () => {
      expect(safeEval('5.5 > 3.2')).toBe(true);
      expect(safeEval('2.5 < 3.7')).toBe(true);
      expect(safeEval('3.14 == 3.14')).toBe(true);
    });
  });
});

