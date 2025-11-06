import { calculateScore, generateSummary } from '../src/scoring';
import { ScoringConfig, Question } from '../src/types';

describe('Scoring Engine', () => {
  const questions: Question[] = [
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
    {
      key: 'q2',
      text: 'Question 2',
      type: 'likert_5',
      required: true,
    },
    {
      key: 'q3',
      text: 'Question 3',
      type: 'text',
      required: false,
    },
  ];

  const scoringConfig: ScoringConfig = {
    scales: [
      {
        id: 'scale1',
        label: 'Scale 1',
        rules: [
          { when: { q1: 'yes' }, add: 0 },
          { when: { q1: 'no' }, add: 2 },
          { when_range: { q2: { gte: 4 } }, add: 2 },
          { when_range: { q2: { lt: 3 } }, add: 0 },
        ],
        thresholds: [
          { gte: 0, lt: 2, level: 'low' },
          { gte: 2, lt: 4, level: 'medium' },
          { gte: 4, level: 'high' },
        ],
      },
    ],
    overall: {
      combine: 'sum_scales',
      overall_thresholds: [
        { gte: 0, lt: 2, label: 'normal' },
        { gte: 2, lt: 4, label: 'attention needed' },
        { gte: 4, label: 'consultation recommended' },
      ],
      flags: [
        { if_missing_required: true },
        { if_text_contains: { q3: ['concern', 'problem'] } },
      ],
    },
  };

  test('should calculate scores correctly - low risk', () => {
    const answers = {
      q1: 'yes',
      q2: 2,
      q3: 'no concerns',
    };

    const result = calculateScore(answers, scoringConfig, questions);

    expect(result.scales).toHaveLength(1);
    expect(result.scales[0].id).toBe('scale1');
    expect(result.scales[0].score).toBe(0);
    expect(result.scales[0].level).toBe('low');
    expect(result.overall.score).toBe(0);
    expect(result.overall.label).toBe('normal');
    expect(result.flags).toHaveLength(0);
  });

  test('should calculate scores correctly - high risk', () => {
    const answers = {
      q1: 'no',
      q2: 5,
      q3: 'some concerns here',
    };

    const result = calculateScore(answers, scoringConfig, questions);

    expect(result.scales[0].score).toBe(4); // 2 from q1=no + 2 from q2>=4
    expect(result.scales[0].level).toBe('high');
    expect(result.overall.score).toBe(4);
    expect(result.overall.label).toBe('consultation recommended');
    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.flags.some((f) => f.includes('concern'))).toBe(true);
  });

  test('should detect missing required answers', () => {
    const answers = {
      q1: 'yes',
      // q2 is missing (required)
      q3: 'test',
    };

    const result = calculateScore(answers, scoringConfig, questions);

    expect(result.flags).toContain('неполные ответы');
  });

  test('should handle when_range conditions', () => {
    const answers = {
      q1: 'yes',
      q2: 4,
    };

    const result = calculateScore(answers, scoringConfig, questions);

    expect(result.scales[0].score).toBe(2); // Only from q2>=4
  });

  test('should generate summary text', () => {
    const answers = {
      q1: 'no',
      q2: 5,
      q3: '',
    };

    const result = calculateScore(answers, scoringConfig, questions);
    const summary = generateSummary(result);

    expect(summary).toContain('Результаты опроса');
    expect(summary).toContain('scale1');
    expect(summary).toContain('Общий результат');
    expect(summary).toContain('consultation recommended');
  });

  test('should handle empty answers', () => {
    const answers = {};

    const result = calculateScore(answers, scoringConfig, questions);

    expect(result.scales[0].score).toBe(0);
    expect(result.flags).toContain('неполные ответы');
  });
});
