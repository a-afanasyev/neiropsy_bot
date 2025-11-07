/**
 * Report Generator
 * Агрегация результатов, расчет баллов и генерация отчетов
 */

import {
  batchResponseRepo,
  responseRepo,
  questionnaireRepo,
  reportRepo,
  sessionRepo,
} from '../db/repository';
import {
  ScoreResult,
  ScaleResult,
  ScoringRules,
  ScoringScale,
  Answer,
  QuestionnaireResult,
} from '../types';

/**
 * Сервис для генерации отчетов
 */
export class ReportGenerator {
  /**
   * Сгенерировать агрегированный отчет для завершенной батч-сессии
   */
  async generateBatchReport(batchSessionId: string): Promise<string> {
    // Получаем сессию
    const session = await sessionRepo.findById(batchSessionId);
    if (!session) {
      throw new Error('Сессия не найдена');
    }

    if (!session.completed) {
      throw new Error('Сессия еще не завершена');
    }

    // Получаем все ответы по этой сессии
    const batchResponses = await batchResponseRepo.findBySessionId(batchSessionId);

    // Массив для хранения результатов по каждому опроснику
    const questionnaireResults: QuestionnaireResult[] = [];
    const allFlags: string[] = [];

    // Обрабатываем каждый ответ
    for (const batchResponse of batchResponses) {
      // Получаем детали ответа
      const response = await responseRepo.findById(batchResponse.response_id);
      if (!response) {
        console.error(`Response ${batchResponse.response_id} не найден`);
        continue;
      }

      // Получаем опросник
      const questionnaire = await questionnaireRepo.findById(
        batchResponse.questionnaire_id
      );
      if (!questionnaire) {
        console.error(`Questionnaire ${batchResponse.questionnaire_id} не найден`);
        continue;
      }

      // Рассчитываем баллы
      const scoreResult = this.calculateScore(
        response.answers_json,
        questionnaire.scoring_json
      );

      // Обновляем response с рассчитанными баллами
      const summary = this.generateQuestionnareSummary(
        questionnaire.title,
        scoreResult
      );
      await responseRepo.updateScore(response.id, scoreResult, summary);

      // Добавляем в результаты
      questionnaireResults.push({
        order: batchResponse.order_index,
        title: questionnaire.title,
        overall_score: scoreResult.overall_score,
        overall_label: scoreResult.overall_label,
        scales: scoreResult.scales,
      });

      // Собираем флаги
      allFlags.push(...scoreResult.flags);
    }

    // Сортируем результаты по порядку
    questionnaireResults.sort((a, b) => a.order - b.order);

    // Генерируем текстовый отчет
    const summaryText = this.generateBatchSummaryText(questionnaireResults, allFlags);

    // Преобразуем результаты в объект для aggregated_scores
    const aggregatedScores: Record<string, QuestionnaireResult> = {};
    questionnaireResults.forEach((result) => {
      aggregatedScores[`questionnaire_${result.order}`] = result;
    });

    // Сохраняем отчет в БД
    const report = await reportRepo.create(
      batchSessionId,
      summaryText,
      aggregatedScores,
      allFlags
    );

    return report.id;
  }

  /**
   * Рассчитать баллы по правилам scoring
   */
  private calculateScore(
    answers: Record<string, Answer>,
    scoringRules: ScoringRules
  ): ScoreResult {
    const scaleResults: ScaleResult[] = [];
    const flags: string[] = [];

    // Рассчитываем баллы по каждой шкале
    for (const scale of scoringRules.scales) {
      const scaleResult = this.calculateScaleScore(answers, scale);
      scaleResults.push(scaleResult);
    }

    // Рассчитываем общий балл
    let overallScore = 0;
    
    // Проверка на пустой массив шкал (валидно для опросников типа M-CHAT без подшкал)
    if (scaleResults.length === 0) {
      // Если нет шкал, общий балл рассчитывается из ответов напрямую
      // Для простоты используем сумму числовых значений всех ответов
      overallScore = Object.values(answers).reduce((sum, answer) => {
        const value = typeof answer.value === 'number' ? answer.value : 0;
        return sum + value;
      }, 0);
    } else if (scoringRules.overall.strategy === 'sum') {
      overallScore = scaleResults.reduce((sum, scale) => sum + scale.score, 0);
    } else if (scoringRules.overall.strategy === 'average') {
      const sum = scaleResults.reduce((sum, scale) => sum + scale.score, 0);
      // Защита от деления на ноль (хотя проверка выше уже обрабатывает length === 0)
      overallScore = Math.round(sum / scaleResults.length);
    } else if (scoringRules.overall.strategy === 'max') {
      // Защита от Math.max на пустом массиве (возвращает -Infinity)
      if (scaleResults.length > 0) {
        overallScore = Math.max(...scaleResults.map((scale) => scale.score));
      }
    } else if (scoringRules.overall.strategy === 'weighted') {
      // Взвешенная сумма
      overallScore = scaleResults.reduce((sum, scale) => {
        const weight = scoringRules.overall.weights?.[scale.scale_id] || 1;
        return sum + scale.score * weight;
      }, 0);
    }

    // Определяем общую категорию
    const overallLabel = this.getLabelForScore(
      overallScore,
      scoringRules.overall.thresholds,
      scoringRules.overall.labels
    );

    // Проверяем флаги (если есть)
    if (scoringRules.flags) {
      for (const flagRule of scoringRules.flags) {
        // Простая проверка условий флагов
        // В реальной реализации нужна более сложная логика оценки условий
        const shouldFlag = this.evaluateFlagCondition(
          flagRule.condition,
          scaleResults,
          overallScore
        );
        if (shouldFlag) {
          flags.push(flagRule.message);
        }
      }
    }

    return {
      overall_score: overallScore,
      overall_label: overallLabel,
      scales: scaleResults,
      flags: flags,
    };
  }

  /**
   * Рассчитать балл по одной шкале
   */
  private calculateScaleScore(
    answers: Record<string, Answer>,
    scale: ScoringScale
  ): ScaleResult {
    let score = 0;
    let count = 0;

    // Собираем баллы по вопросам шкалы
    for (const questionId of scale.questions) {
      const answer = answers[questionId];
      if (!answer) {
        continue;
      }

      // Получаем числовое значение ответа
      const value = typeof answer.value === 'number' ? answer.value : 0;
      score += value;
      count++;
    }

    // Применяем метод агрегации
    let finalScore = score;
    if (scale.aggregation === 'average' && count > 0) {
      finalScore = Math.round(score / count);
    } else if (scale.aggregation === 'max') {
      // Для max нужно найти максимальное значение
      const values = scale.questions.map((qId) => {
        const answer = answers[qId];
        return typeof answer?.value === 'number' ? answer.value : 0;
      });
      
      // Защита от Math.max на пустом массиве (возвращает -Infinity)
      if (values.length === 0) {
        finalScore = 0;
      } else {
        finalScore = Math.max(...values);
      }
    }
    // sum и count уже обработаны

    // Определяем уровень (если есть пороги)
    let level: string | undefined = undefined;
    if (scale.thresholds && scale.labels) {
      level = this.getLabelForScore(finalScore, scale.thresholds, scale.labels);
    }

    return {
      scale_id: scale.id,
      scale_label: scale.label,
      score: finalScore,
      level: level,
    };
  }

  /**
   * Получить текстовую метку для балла по порогам
   */
  private getLabelForScore(
    score: number,
    thresholds: number[],
    labels: string[]
  ): string {
    // Пороги должны быть отсортированы по возрастанию
    for (let i = 0; i < thresholds.length; i++) {
      if (score < thresholds[i]!) {
        return labels[i] || 'Неопределено';
      }
    }
    // Если балл выше всех порогов
    return labels[thresholds.length] || 'Высокий';
  }

  /**
   * Оценить условие флага (безопасная реализация)
   * Поддерживает простые операции сравнения: >, <, >=, <=, ==, !=
   */
  private evaluateFlagCondition(
    condition: string,
    scaleResults: ScaleResult[],
    overallScore: number
  ): boolean {
    try {
      // Заменяем названия шкал на их значения
      let expression = condition.trim();

      scaleResults.forEach((scale) => {
        const pattern = new RegExp(`scale\\.${scale.scale_id}`, 'g');
        expression = expression.replace(pattern, scale.score.toString());
      });

      // Заменяем overall на значение
      expression = expression.replace(/overall/g, overallScore.toString());

      // Безопасный парсер для простых операций сравнения
      // Поддерживаем: >, <, >=, <=, ==, !=, &&, ||
      return this.safeEvaluateComparison(expression);
    } catch (error) {
      console.error('Ошибка оценки условия флага:', condition, error);
      return false;
    }
  }

  /**
   * Безопасная оценка выражений сравнения
   * Поддерживает только числа и операторы сравнения
   */
  private safeEvaluateComparison(expression: string): boolean {
    // Убираем пробелы
    expression = expression.trim();

    // Обрабатываем логические операторы && и ||
    if (expression.includes('&&')) {
      const parts = expression.split('&&');
      return parts.every(part => this.safeEvaluateComparison(part.trim()));
    }
    
    if (expression.includes('||')) {
      const parts = expression.split('||');
      return parts.some(part => this.safeEvaluateComparison(part.trim()));
    }

    // Проверяем операторы сравнения в порядке от более длинных к коротким
    const operators = ['>=', '<=', '==', '!=', '>', '<'];
    
    for (const op of operators) {
      if (expression.includes(op)) {
        const parts = expression.split(op).map(s => s.trim());
        
        // Проверка минимального количества частей
        if (parts.length < 2) {
          console.error('Неполное выражение:', expression);
          return false;
        }
        
        // Для цепочечных сравнений (например, "5 > 3 > 2") проверяем все последовательные пары
        // Все пары должны быть истинными (логика AND)
        for (let i = 0; i < parts.length - 1; i++) {
          const left = parts[i];
          const right = parts[i + 1];
          
          // Проверка наличия обеих частей
          if (!left || !right) {
            console.error('Неполное выражение в паре:', left, op, right);
            return false;
          }
          
          // Валидация: должны быть только числа
          const leftNum = this.parseNumber(left);
          const rightNum = this.parseNumber(right);
          
          if (leftNum === null || rightNum === null) {
            console.error('Невалидные числа в выражении:', left, op, right);
            return false;
          }

          // Выполняем сравнение для текущей пары
          let pairResult = false;
          switch (op) {
            case '>': pairResult = leftNum > rightNum; break;
            case '<': pairResult = leftNum < rightNum; break;
            case '>=': pairResult = leftNum >= rightNum; break;
            case '<=': pairResult = leftNum <= rightNum; break;
            case '==': pairResult = leftNum === rightNum; break;
            case '!=': pairResult = leftNum !== rightNum; break;
          }
          
          // Если хотя бы одна пара ложна, всё выражение ложно
          if (!pairResult) {
            return false;
          }
        }
        
        // Все пары истинны
        return true;
      }
    }

    console.error('Не найдено оператора сравнения в выражении:', expression);
    return false;
  }

  /**
   * Безопасный парсинг числа
   */
  private parseNumber(str: string): number | null {
    // Разрешаем только числа (целые и с плавающей точкой)
    const num = parseFloat(str);
    if (isNaN(num)) {
      return null;
    }
    return num;
  }

  /**
   * Сгенерировать резюме для одного опросника
   */
  private generateQuestionnareSummary(
    title: string,
    scoreResult: ScoreResult
  ): string {
    let summary = `=== ${title} ===\n`;
    summary += `Общий балл: ${scoreResult.overall_score}\n`;
    summary += `Уровень: ${scoreResult.overall_label}\n`;

    if (scoreResult.scales.length > 0) {
      summary += '\nДетали:\n';
      scoreResult.scales.forEach((scale) => {
        summary += `• ${scale.scale_label}: ${scale.score}`;
        if (scale.level) {
          summary += ` (${scale.level})`;
        }
        summary += '\n';
      });
    }

    if (scoreResult.flags.length > 0) {
      summary += '\nФлаги:\n';
      scoreResult.flags.forEach((flag) => {
        summary += `⚠️ ${flag}\n`;
      });
    }

    return summary;
  }

  /**
   * Сгенерировать текстовый отчет по батчу
   */
  private generateBatchSummaryText(
    questionnaireResults: QuestionnaireResult[],
    allFlags: string[]
  ): string {
    let summary = '📊 АГРЕГИРОВАННЫЙ ОТЧЕТ\n\n';

    // Результаты по каждому опроснику
    questionnaireResults.forEach((result) => {
      summary += `=== Опросник ${result.order}: ${result.title} ===\n`;
      summary += `Общий балл: ${result.overall_score}\n`;
      summary += `Уровень: ${result.overall_label}\n`;

      if (result.scales.length > 0) {
        summary += '\nДетали:\n';
        result.scales.forEach((scale) => {
          summary += `• ${scale.scale_label}: ${scale.score}`;
          if (scale.level) {
            summary += ` (${scale.level})`;
          }
          summary += '\n';
        });
      }

      summary += '\n';
    });

    // Общие выводы
    summary += '=== ОБЩИЕ ВЫВОДЫ ===\n';

    if (allFlags.length > 0) {
      // Удаляем дубликаты флагов
      const uniqueFlags = Array.from(new Set(allFlags));
      uniqueFlags.forEach((flag) => {
        summary += `• ${flag}\n`;
      });
    } else {
      summary += '• Значительных отклонений не выявлено\n';
    }

    // Рекомендации (можно расширить логику)
    summary += '\nРекомендации:\n';
    if (allFlags.length > 0) {
      summary += '• Рекомендуется консультация специалиста\n';
      summary += '• Проведение углубленной диагностики\n';
    } else {
      summary += '• Результаты в пределах нормы\n';
      summary += '• При необходимости - повторное обследование через 6 месяцев\n';
    }

    return summary;
  }

  /**
   * Получить существующий отчет по session_id
   */
  async getReportBySessionId(sessionId: string) {
    return await reportRepo.findBySessionId(sessionId);
  }
}

// Экспортируем единственный экземпляр
export const reportGenerator = new ReportGenerator();

