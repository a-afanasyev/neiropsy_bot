/**
 * Тесты для алгоритмов подсчета баллов
 */

import { ReportGenerator } from '../src/services/ReportGenerator';
import { Answer, ScoringRules } from '../src/types';

describe('ReportGenerator', () => {
  const reportGenerator = new ReportGenerator();

  describe('calculateScore', () => {
    it('должен правильно рассчитывать баллы по шкалам', () => {
      const answers: Record<string, Answer> = {
        q1: { question_id: 'q1', value: 2 },
        q2: { question_id: 'q2', value: 3 },
        q3: { question_id: 'q3', value: 1 },
      };

      const scoringRules: ScoringRules = {
        scales: [
          {
            id: 'test_scale',
            label: 'Тестовая шкала',
            questions: ['q1', 'q2', 'q3'],
            aggregation: 'sum',
          },
        ],
        overall: {
          strategy: 'sum',
          thresholds: [3, 6],
          labels: ['Низкий', 'Средний', 'Высокий'],
        },
      };

      const result = (reportGenerator as any).calculateScore(answers, scoringRules);

      expect(result.overall_score).toBe(6);
      expect(result.scales).toHaveLength(1);
      expect(result.scales[0]?.score).toBe(6);
    });

    it('должен определять правильные категории по порогам', () => {
      const answers: Record<string, Answer> = {
        q1: { question_id: 'q1', value: 1 },
        q2: { question_id: 'q2', value: 1 },
      };

      const scoringRules: ScoringRules = {
        scales: [],
        overall: {
          strategy: 'sum',
          thresholds: [3, 6, 9],
          labels: ['Норма', 'Легкий', 'Средний', 'Высокий'],
        },
      };

      const result = (reportGenerator as any).calculateScore(answers, scoringRules);

      // Балл 2 < 3, должна быть первая категория
      expect(result.overall_label).toBe('Норма');
    });

    it('должен корректно обрабатывать опросники без шкал (M-CHAT)', () => {
      // Опросник типа M-CHAT: нет подшкал, только общий балл
      const answers: Record<string, Answer> = {
        q1: { question_id: 'q1', value: 1 },
        q2: { question_id: 'q2', value: 0 },
        q3: { question_id: 'q3', value: 1 },
      };

      const scoringRules: ScoringRules = {
        scales: [], // Нет подшкал
        overall: {
          strategy: 'sum',
          thresholds: [2, 3, 5],
          labels: ['Норма', 'Низкий риск', 'Умеренный риск', 'Высокий риск'],
        },
      };

      const result = (reportGenerator as any).calculateScore(answers, scoringRules);

      // Должен посчитать общий балл как сумму ответов
      expect(result.overall_score).toBe(2); // 1 + 0 + 1
      expect(result.overall_label).toBe('Норма');
      expect(result.scales).toHaveLength(0);
    });

    it('должен корректно обрабатывать average стратегию с пустыми шкалами', () => {
      const answers: Record<string, Answer> = {
        q1: { question_id: 'q1', value: 2 },
        q2: { question_id: 'q2', value: 3 },
      };

      const scoringRules: ScoringRules = {
        scales: [],
        overall: {
          strategy: 'average',
          thresholds: [3, 6],
          labels: ['Низкий', 'Средний', 'Высокий'],
        },
      };

      const result = (reportGenerator as any).calculateScore(answers, scoringRules);

      // Не должно быть NaN
      expect(result.overall_score).not.toBeNaN();
      expect(result.overall_score).toBe(5); // 2 + 3
    });

    it('должен корректно обрабатывать max стратегию с пустыми шкалами', () => {
      const answers: Record<string, Answer> = {
        q1: { question_id: 'q1', value: 2 },
      };

      const scoringRules: ScoringRules = {
        scales: [],
        overall: {
          strategy: 'max',
          thresholds: [1],
          labels: ['Низкий', 'Высокий'],
        },
      };

      const result = (reportGenerator as any).calculateScore(answers, scoringRules);

      // Не должно быть -Infinity
      expect(result.overall_score).not.toBe(-Infinity);
      expect(result.overall_score).toBe(2);
    });
  });

  describe('Защита от пустых массивов в шкалах', () => {
    it('должен обрабатывать шкалу с пустым списком вопросов (max aggregation)', () => {
      const answers: Record<string, Answer> = {
        q1: { question_id: 'q1', value: 5 },
      };

      const scoringRules: ScoringRules = {
        scales: [
          {
            id: 'empty_scale',
            label: 'Пустая шкала',
            questions: [], // Пустой список вопросов
            aggregation: 'max',
          },
        ],
        overall: {
          strategy: 'sum',
          thresholds: [1],
          labels: ['Низкий', 'Высокий'],
        },
      };

      const result = (reportGenerator as any).calculateScore(answers, scoringRules);

      // Шкала должна вернуть 0, а не -Infinity
      expect(result.scales[0]?.score).toBe(0);
      expect(result.scales[0]?.score).not.toBe(-Infinity);
    });

    it('должен обрабатывать average aggregation с нулевым count', () => {
      const answers: Record<string, Answer> = {};

      const scoringRules: ScoringRules = {
        scales: [
          {
            id: 'test_scale',
            label: 'Тестовая шкала',
            questions: ['q1', 'q2'], // Вопросы есть, но ответов нет
            aggregation: 'average',
          },
        ],
        overall: {
          strategy: 'sum',
          thresholds: [1],
          labels: ['Низкий', 'Высокий'],
        },
      };

      const result = (reportGenerator as any).calculateScore(answers, scoringRules);

      // Должен вернуть 0, а не NaN
      expect(result.scales[0]?.score).toBe(0);
      expect(result.scales[0]?.score).not.toBeNaN();
    });
  });
});

