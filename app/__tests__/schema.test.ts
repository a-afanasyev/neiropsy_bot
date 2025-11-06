import { validateQuestionnaire, validateScoringConfig, validateAnswer } from '../src/schema';

describe('Schema Validation', () => {
  describe('validateQuestionnaire', () => {
    test('should validate a correct questionnaire', () => {
      const questionnaire = {
        title: 'Test Survey',
        version: '1.0',
        language: 'ru',
        questions: [
          {
            key: 'q1',
            text: 'Question 1',
            type: 'single_choice',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
            required: true,
          },
        ],
      };

      const result = validateQuestionnaire(questionnaire);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    test('should reject questionnaire with missing title', () => {
      const questionnaire = {
        version: '1.0',
        language: 'ru',
        questions: [],
      };

      const result = validateQuestionnaire(questionnaire);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should reject questionnaire with duplicate keys', () => {
      const questionnaire = {
        title: 'Test',
        version: '1.0',
        language: 'ru',
        questions: [
          {
            key: 'q1',
            text: 'Q1',
            type: 'text',
            required: true,
          },
          {
            key: 'q1',
            text: 'Q2',
            type: 'text',
            required: true,
          },
        ],
      };

      const result = validateQuestionnaire(questionnaire);

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('Duplicate'))).toBe(true);
    });

    test('should reject single_choice without options', () => {
      const questionnaire = {
        title: 'Test',
        version: '1.0',
        language: 'ru',
        questions: [
          {
            key: 'q1',
            text: 'Q1',
            type: 'single_choice',
            required: true,
          },
        ],
      };

      const result = validateQuestionnaire(questionnaire);

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('requires options'))).toBe(true);
    });
  });

  describe('validateAnswer', () => {
    test('should validate single_choice answer', () => {
      const question = {
        key: 'q1',
        text: 'Test',
        type: 'single_choice' as const,
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
        required: true,
      };

      const validAnswer = validateAnswer(question, 'a');
      expect(validAnswer.valid).toBe(true);

      const invalidAnswer = validateAnswer(question, 'c');
      expect(invalidAnswer.valid).toBe(false);
    });

    test('should validate likert_5 answer', () => {
      const question = {
        key: 'q1',
        text: 'Test',
        type: 'likert_5' as const,
        required: true,
      };

      expect(validateAnswer(question, 1).valid).toBe(true);
      expect(validateAnswer(question, 5).valid).toBe(true);
      expect(validateAnswer(question, 0).valid).toBe(false);
      expect(validateAnswer(question, 6).valid).toBe(false);
    });

    test('should validate numeric answer with range', () => {
      const question = {
        key: 'q1',
        text: 'Test',
        type: 'numeric' as const,
        min: 0,
        max: 100,
        required: true,
      };

      expect(validateAnswer(question, 50).valid).toBe(true);
      expect(validateAnswer(question, 0).valid).toBe(true);
      expect(validateAnswer(question, 100).valid).toBe(true);
      expect(validateAnswer(question, -1).valid).toBe(false);
      expect(validateAnswer(question, 101).valid).toBe(false);
    });

    test('should validate required field', () => {
      const question = {
        key: 'q1',
        text: 'Test',
        type: 'text' as const,
        required: true,
      };

      expect(validateAnswer(question, '').valid).toBe(false);
      expect(validateAnswer(question, 'answer').valid).toBe(true);
    });

    test('should allow empty answer for non-required field', () => {
      const question = {
        key: 'q1',
        text: 'Test',
        type: 'text' as const,
        required: false,
      };

      expect(validateAnswer(question, '').valid).toBe(true);
    });
  });
});
