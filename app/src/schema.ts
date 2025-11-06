import { z } from 'zod';

// Question schemas
export const QuestionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

export const QuestionTypeSchema = z.enum([
  'single_choice',
  'multi_choice',
  'likert_5',
  'numeric',
  'text',
  'date',
]);

export const QuestionSchema = z.object({
  key: z.string().min(1).max(100),
  text: z.string().min(1).max(1000),
  type: QuestionTypeSchema,
  options: z.array(QuestionOptionSchema).optional(),
  labels: z.array(z.string()).optional(),
  max_len: z.number().int().positive().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  required: z.boolean(),
});

export const QuestionnaireSchema = z.object({
  title: z.string().min(1).max(500),
  version: z.string().min(1).max(50),
  language: z.string().min(2).max(10),
  questions: z.array(QuestionSchema).min(1),
});

// Scoring schemas
export const ScaleRuleSchema = z.object({
  when: z.record(z.union([z.string(), z.number()])).optional(),
  when_range: z
    .record(
      z.object({
        gte: z.number().optional(),
        gt: z.number().optional(),
        lte: z.number().optional(),
        lt: z.number().optional(),
      })
    )
    .optional(),
  add: z.number(),
});

export const ScaleThresholdSchema = z.object({
  gte: z.number(),
  lt: z.number().optional(),
  level: z.string(),
});

export const ScaleSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(500),
  rules: z.array(ScaleRuleSchema),
  thresholds: z.array(ScaleThresholdSchema),
});

export const OverallThresholdSchema = z.object({
  gte: z.number(),
  lt: z.number().optional(),
  label: z.string(),
});

export const FlagConditionSchema = z.object({
  if_missing_required: z.boolean().optional(),
  if_text_contains: z.record(z.array(z.string())).optional(),
});

export const OverallSchema = z.object({
  combine: z.enum(['sum_scales', 'average_scales', 'custom']),
  overall_thresholds: z.array(OverallThresholdSchema),
  flags: z.array(FlagConditionSchema),
});

export const ScoringConfigSchema = z.object({
  scales: z.array(ScaleSchema),
  overall: OverallSchema,
});

// Validation functions
export function validateQuestionnaire(data: unknown): {
  success: boolean;
  data?: any;
  errors?: string[];
} {
  try {
    const result = QuestionnaireSchema.parse(data);

    // Additional validations
    const errors: string[] = [];

    // Check unique keys
    const keys = new Set<string>();
    result.questions.forEach((q, idx) => {
      if (keys.has(q.key)) {
        errors.push(`Duplicate question key: ${q.key}`);
      }
      keys.add(q.key);

      // Type-specific validations
      if ((q.type === 'single_choice' || q.type === 'multi_choice') && !q.options) {
        errors.push(`Question ${idx + 1} (${q.key}): ${q.type} requires options`);
      }

      if (q.type === 'likert_5' && q.labels && q.labels.length !== 5) {
        errors.push(`Question ${idx + 1} (${q.key}): likert_5 requires 5 labels`);
      }

      if (q.type === 'text' && q.max_len && q.max_len > 5000) {
        errors.push(`Question ${idx + 1} (${q.key}): max_len cannot exceed 5000`);
      }
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

export function validateScoringConfig(
  data: unknown,
  questionnaire?: any
): {
  success: boolean;
  data?: any;
  errors?: string[];
} {
  try {
    const result = ScoringConfigSchema.parse(data);

    const errors: string[] = [];

    // If questionnaire is provided, validate references
    if (questionnaire) {
      const questionKeys = new Set(questionnaire.questions.map((q: any) => q.key));

      result.scales.forEach((scale) => {
        scale.rules.forEach((rule) => {
          if (rule.when) {
            Object.keys(rule.when).forEach((key) => {
              if (!questionKeys.has(key)) {
                errors.push(
                  `Scale ${scale.id}: references unknown question key '${key}' in 'when' condition`
                );
              }
            });
          }
          if (rule.when_range) {
            Object.keys(rule.when_range).forEach((key) => {
              if (!questionKeys.has(key)) {
                errors.push(
                  `Scale ${scale.id}: references unknown question key '${key}' in 'when_range' condition`
                );
              }
            });
          }
        });
      });

      // Validate flag conditions
      result.overall.flags.forEach((flag, idx) => {
        if (flag.if_text_contains) {
          Object.keys(flag.if_text_contains).forEach((key) => {
            if (!questionKeys.has(key)) {
              errors.push(`Flag ${idx + 1}: references unknown question key '${key}'`);
            }
          });
        }
      });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

export function validateAnswer(question: any, answer: any): { valid: boolean; error?: string } {
  if (question.required && (answer === undefined || answer === null || answer === '')) {
    return { valid: false, error: 'Обязательный вопрос' };
  }

  if (!answer) {
    return { valid: true };
  }

  switch (question.type) {
    case 'single_choice':
      if (!question.options?.some((opt: any) => opt.value === answer)) {
        return { valid: false, error: 'Недопустимое значение' };
      }
      break;

    case 'multi_choice':
      if (!Array.isArray(answer)) {
        return { valid: false, error: 'Ожидается массив' };
      }
      const validValues = new Set(question.options?.map((opt: any) => opt.value));
      if (!answer.every((val) => validValues.has(val))) {
        return { valid: false, error: 'Недопустимые значения' };
      }
      break;

    case 'likert_5':
      const likertValue = typeof answer === 'string' ? parseInt(answer, 10) : answer;
      if (!Number.isInteger(likertValue) || likertValue < 1 || likertValue > 5) {
        return { valid: false, error: 'Значение должно быть от 1 до 5' };
      }
      break;

    case 'numeric':
      const numValue = typeof answer === 'string' ? parseFloat(answer) : answer;
      if (isNaN(numValue)) {
        return { valid: false, error: 'Ожидается число' };
      }
      if (question.min !== undefined && numValue < question.min) {
        return { valid: false, error: `Минимум: ${question.min}` };
      }
      if (question.max !== undefined && numValue > question.max) {
        return { valid: false, error: `Максимум: ${question.max}` };
      }
      break;

    case 'text':
      if (typeof answer !== 'string') {
        return { valid: false, error: 'Ожидается текст' };
      }
      if (question.max_len && answer.length > question.max_len) {
        return { valid: false, error: `Максимум ${question.max_len} символов` };
      }
      break;

    case 'date':
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(answer)) {
        return { valid: false, error: 'Формат даты: YYYY-MM-DD' };
      }
      const date = new Date(answer);
      if (isNaN(date.getTime())) {
        return { valid: false, error: 'Некорректная дата' };
      }
      break;
  }

  return { valid: true };
}
