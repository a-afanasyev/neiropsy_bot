import {
  ScoringConfig,
  ScoringResult,
  Scale,
  ScaleRule,
  Question,
  ScaleResult,
} from './types';

export class ScoringEngine {
  private config: ScoringConfig;
  private questions: Question[];

  constructor(config: ScoringConfig, questions: Question[]) {
    this.config = config;
    this.questions = questions;
  }

  /**
   * Calculate scores based on answers
   */
  score(answers: Record<string, any>): ScoringResult {
    const scaleResults: ScaleResult[] = [];

    // Calculate each scale
    for (const scale of this.config.scales) {
      const score = this.calculateScale(scale, answers);
      const level = this.determineLevel(score, scale.thresholds);
      scaleResults.push({
        id: scale.id,
        score,
        level,
      });
    }

    // Calculate overall score
    const overallScore = this.calculateOverall(scaleResults);
    const overallLabel = this.determineOverallLabel(overallScore);

    // Check flags
    const flags = this.checkFlags(answers);

    return {
      scales: scaleResults,
      overall: {
        score: overallScore,
        label: overallLabel,
      },
      flags,
    };
  }

  /**
   * Calculate score for a single scale
   */
  private calculateScale(scale: Scale, answers: Record<string, any>): number {
    let score = 0;

    for (const rule of scale.rules) {
      if (this.ruleMatches(rule, answers)) {
        score += rule.add;
      }
    }

    return score;
  }

  /**
   * Check if a rule matches the answers
   */
  private ruleMatches(rule: ScaleRule, answers: Record<string, any>): boolean {
    // Check 'when' condition (exact match)
    if (rule.when) {
      for (const [key, expectedValue] of Object.entries(rule.when)) {
        const actualValue = answers[key];

        // Convert both to strings for comparison
        const actualStr = String(actualValue);
        const expectedStr = String(expectedValue);

        if (actualStr !== expectedStr) {
          return false;
        }
      }
      return true;
    }

    // Check 'when_range' condition (numeric comparison)
    if (rule.when_range) {
      for (const [key, range] of Object.entries(rule.when_range)) {
        const value = answers[key];
        const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);

        if (isNaN(numValue)) {
          return false;
        }

        if (range.gte !== undefined && numValue < range.gte) {
          return false;
        }
        if (range.gt !== undefined && numValue <= range.gt) {
          return false;
        }
        if (range.lte !== undefined && numValue > range.lte) {
          return false;
        }
        if (range.lt !== undefined && numValue >= range.lt) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Determine level based on score and thresholds
   */
  private determineLevel(score: number, thresholds: any[]): string {
    for (const threshold of thresholds) {
      const meetsGte = score >= threshold.gte;
      const meetsLt = threshold.lt === undefined || score < threshold.lt;

      if (meetsGte && meetsLt) {
        return threshold.level;
      }
    }
    return 'неопределено';
  }

  /**
   * Calculate overall score by combining scale scores
   */
  private calculateOverall(scaleResults: ScaleResult[]): number {
    if (scaleResults.length === 0) {
      return 0;
    }

    switch (this.config.overall.combine) {
      case 'sum_scales':
        return scaleResults.reduce((sum, scale) => sum + scale.score, 0);

      case 'average_scales':
        const sum = scaleResults.reduce((sum, scale) => sum + scale.score, 0);
        return Math.round((sum / scaleResults.length) * 100) / 100;

      case 'custom':
        // For custom logic, we can extend this later
        return scaleResults.reduce((sum, scale) => sum + scale.score, 0);

      default:
        return scaleResults.reduce((sum, scale) => sum + scale.score, 0);
    }
  }

  /**
   * Determine overall label based on overall score
   */
  private determineOverallLabel(overallScore: number): string {
    return this.determineLevel(overallScore, this.config.overall.overall_thresholds);
  }

  /**
   * Check all flag conditions
   */
  private checkFlags(answers: Record<string, any>): string[] {
    const flags: string[] = [];

    for (const flagCondition of this.config.overall.flags) {
      // Check for missing required answers
      if (flagCondition.if_missing_required) {
        const missingRequired = this.questions.some(
          (q) =>
            q.required &&
            (answers[q.key] === undefined || answers[q.key] === null || answers[q.key] === '')
        );

        if (missingRequired) {
          flags.push('неполные ответы');
        }
      }

      // Check for text contains
      if (flagCondition.if_text_contains) {
        for (const [questionKey, keywords] of Object.entries(flagCondition.if_text_contains)) {
          const answerText = String(answers[questionKey] || '').toLowerCase();

          for (const keyword of keywords) {
            if (answerText.includes(keyword.toLowerCase())) {
              flags.push(`внимание: содержит "${keyword}" в вопросе ${questionKey}`);
            }
          }
        }
      }
    }

    return flags;
  }

  /**
   * Generate a summary text from scoring results
   */
  static generateSummary(result: ScoringResult): string {
    const lines: string[] = [];

    lines.push('📊 Результаты опроса:');
    lines.push('');

    // Scale results
    if (result.scales.length > 0) {
      lines.push('Шкалы:');
      for (const scale of result.scales) {
        lines.push(`  • ${scale.id}: ${scale.score} баллов - ${scale.level}`);
      }
      lines.push('');
    }

    // Overall result
    lines.push(`Общий результат: ${result.overall.score} баллов`);
    lines.push(`Интерпретация: ${result.overall.label}`);

    // Flags
    if (result.flags.length > 0) {
      lines.push('');
      lines.push('⚠️ Важно:');
      for (const flag of result.flags) {
        lines.push(`  • ${flag}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Calculate and return scoring result
 */
export function calculateScore(
  answers: Record<string, any>,
  scoringConfig: ScoringConfig,
  questions: Question[]
): ScoringResult {
  const engine = new ScoringEngine(scoringConfig, questions);
  return engine.score(answers);
}

/**
 * Generate human-readable summary from scoring result
 */
export function generateSummary(result: ScoringResult): string {
  return ScoringEngine.generateSummary(result);
}
