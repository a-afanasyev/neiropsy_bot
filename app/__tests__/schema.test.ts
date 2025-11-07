/**
 * Тесты для валидации структуры данных
 */

import { Question, ScoringRules, Questionnaire } from '../src/types';

describe('Schema Validation', () => {
  describe('Question', () => {
    it('должен иметь все обязательные поля', () => {
      const question: Question = {
        id: 'q1',
        text: 'Тестовый вопрос?',
        type: 'single-choice',
        options: [
          { value: 0, label: 'Нет' },
          { value: 1, label: 'Да' },
        ],
      };

      expect(question.id).toBeDefined();
      expect(question.text).toBeDefined();
      expect(question.type).toBeDefined();
      expect(question.options).toBeDefined();
      expect(question.options.length).toBeGreaterThan(0);
    });
  });

  describe('ScoringRules', () => {
    it('должен иметь корректную структуру', () => {
      const scoring: ScoringRules = {
        scales: [
          {
            id: 'test',
            label: 'Тест',
            questions: ['q1', 'q2'],
            aggregation: 'sum',
          },
        ],
        overall: {
          strategy: 'sum',
          thresholds: [5, 10],
          labels: ['Низкий', 'Средний', 'Высокий'],
        },
      };

      expect(scoring.scales).toBeDefined();
      expect(scoring.overall).toBeDefined();
      expect(scoring.overall.thresholds.length).toBe(scoring.overall.labels.length - 1);
    });
  });

  describe('Questionnaire', () => {
    it('должен содержать вопросы и правила подсчета', () => {
      const questionnaire: Partial<Questionnaire> = {
        title: 'Тестовый опросник',
        questions_json: [
          {
            id: 'q1',
            text: 'Вопрос 1',
            type: 'yes-no',
            options: [
              { value: 0, label: 'Нет' },
              { value: 1, label: 'Да' },
            ],
          },
        ],
        scoring_json: {
          scales: [],
          overall: {
            strategy: 'sum',
            thresholds: [1],
            labels: ['Низкий', 'Высокий'],
          },
        },
      };

      expect(questionnaire.title).toBeDefined();
      expect(questionnaire.questions_json).toBeDefined();
      expect(questionnaire.scoring_json).toBeDefined();
      expect(Array.isArray(questionnaire.questions_json)).toBe(true);
    });
  });
});

