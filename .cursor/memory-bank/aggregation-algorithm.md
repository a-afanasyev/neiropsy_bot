# АЛГОРИТМ АГРЕГИРОВАНИЯ: Батч-опросники

**Файл**: `app/src/scoring.ts` (новая функция)  
**Дата**: 2025-11-06

---

## 🎯 ЦЕЛЬ АЛГОРИТМА

Объединить результаты нескольких опросников в единый агрегированный отчет с:
- Сводкой по каждому опроснику
- Общими выводами и паттернами
- Списком всех флагов и предупреждений
- Рекомендациями для специалиста

---

## 📋 ВХОДНЫЕ ДАННЫЕ

```typescript
interface AggregationInput {
  responses: Array<{
    questionnaire: Questionnaire;  // Информация об опроснике
    response: Response;             // Ответы пользователя
    scoringResult: ScoringResult;   // Результаты scoring
  }>;
}
```

**Пример**:
```json
{
  "responses": [
    {
      "questionnaire": {
        "id": "uuid-1",
        "title": "Скрининг СДВГ (6-17 лет)",
        "questions": [...]
      },
      "response": {
        "id": "response-1",
        "answers_json": { "q1": 4, "q2": 3, ... },
        "submitted_at": "2025-11-06T16:30:00Z"
      },
      "scoringResult": {
        "scales": [
          { "id": "inattention", "score": 24, "level": "high" },
          { "id": "hyperactivity", "score": 21, "level": "high" }
        ],
        "overall": { "score": 45, "label": "Высокий риск СДВГ" },
        "flags": ["Высокий риск СДВГ"]
      }
    },
    {
      "questionnaire": { ... },
      "response": { ... },
      "scoringResult": { ... }
    }
  ]
}
```

---

## 📤 ВЫХОДНЫЕ ДАННЫЕ

```typescript
interface AggregationOutput {
  summary_text: string;                    // Итоговый текстовый отчет
  aggregated_scores: Record<string, any>;  // Структурированные баллы
  flags: string[];                         // Все флаги
  recommendations: string[];               // Рекомендации
}
```

**Пример**:
```json
{
  "summary_text": "=== АГРЕГИРОВАННЫЙ ОТЧЕТ ===\n\n📊 Опросник 1: СДВГ...",
  "aggregated_scores": {
    "uuid-1": { "score": 45, "label": "Высокий риск СДВГ" },
    "uuid-2": { "score": 8, "label": "Требуется внимание" }
  },
  "flags": [
    "Высокий риск СДВГ",
    "Требуется внимание (M-CHAT)"
  ],
  "recommendations": [
    "Консультация детского психиатра по СДВГ",
    "Углубленная диагностика аутистического спектра"
  ]
}
```

---

## 🔢 АЛГОРИТМ (Псевдокод)

```typescript
/**
 * Агрегирует результаты множественных опросников в единый отчет
 * 
 * @param responses - Массив результатов опросников
 * @returns Агрегированный отчет
 */
export function aggregateBatchScores(
  responses: Array<{
    questionnaire: Questionnaire;
    response: Response;
    scoringResult: ScoringResult;
  }>
): AggregationOutput {
  
  // ========================================
  // ШАГ 1: Инициализация структур данных
  // ========================================
  
  const aggregated_scores: Record<string, any> = {};
  const all_flags: string[] = [];
  const summary_sections: string[] = [];
  const recommendations: string[] = [];
  
  
  // ========================================
  // ШАГ 2: Обработка каждого опросника
  // ========================================
  
  responses.forEach((item, index) => {
    const order = index + 1;
    const { questionnaire, scoringResult } = item;
    
    // 2.1. Сохранить агрегированные баллы
    aggregated_scores[questionnaire.id] = {
      order: order,
      title: questionnaire.title,
      overall_score: scoringResult.overall.score,
      overall_label: scoringResult.overall.label,
      scales: scoringResult.scales
    };
    
    // 2.2. Собрать флаги
    scoringResult.flags.forEach(flag => {
      all_flags.push(flag);
    });
    
    // 2.3. Сгенерировать секцию отчета
    const section = generateQuestionnaireSection(order, questionnaire, scoringResult);
    summary_sections.push(section);
  });
  
  
  // ========================================
  // ШАГ 3: Генерация общих выводов
  // ========================================
  
  const overall_conclusions = generateOverallConclusions(
    responses,
    aggregated_scores,
    all_flags
  );
  
  
  // ========================================
  // ШАГ 4: Генерация рекомендаций
  // ========================================
  
  const generated_recommendations = generateRecommendations(
    responses,
    all_flags
  );
  
  
  // ========================================
  // ШАГ 5: Сборка итогового текста
  // ========================================
  
  const summary_text = [
    '=== АГРЕГИРОВАННЫЙ ОТЧЕТ ===',
    '',
    ...summary_sections,
    '',
    '=== ОБЩИЕ ВЫВОДЫ ===',
    overall_conclusions,
    '',
    '=== РЕКОМЕНДАЦИИ ===',
    ...generated_recommendations.map((rec, i) => `${i + 1}. ${rec}`)
  ].join('\n');
  
  
  // ========================================
  // ШАГ 6: Возврат результата
  // ========================================
  
  return {
    summary_text,
    aggregated_scores,
    flags: all_flags,
    recommendations: generated_recommendations
  };
}
```

---

## 📝 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

### 1. Генерация секции по опроснику

```typescript
/**
 * Генерирует текстовую секцию для одного опросника
 */
function generateQuestionnaireSection(
  order: number,
  questionnaire: Questionnaire,
  scoringResult: ScoringResult
): string {
  
  const lines: string[] = [
    `📝 ОПРОСНИК ${order}: ${questionnaire.title}`,
    `🔹 Общий балл: ${scoringResult.overall.score}`,
    `🔹 Уровень: ${getLevelEmoji(scoringResult.overall.label)} ${scoringResult.overall.label}`,
  ];
  
  // Добавить детали по шкалам (если есть)
  if (scoringResult.scales && scoringResult.scales.length > 0) {
    lines.push('');
    lines.push('Детали:');
    
    scoringResult.scales.forEach(scale => {
      lines.push(`• ${scale.label}: ${scale.score} (${scale.level})`);
    });
  }
  
  // Добавить флаги (если есть)
  if (scoringResult.flags && scoringResult.flags.length > 0) {
    lines.push('');
    lines.push('Флаги:');
    
    scoringResult.flags.forEach(flag => {
      lines.push(`⚠️ ${flag}`);
    });
  }
  
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return lines.join('\n');
}

/**
 * Возвращает эмодзи в зависимости от уровня
 */
function getLevelEmoji(level: string): string {
  const lowerLevel = level.toLowerCase();
  
  if (lowerLevel.includes('высокий') || lowerLevel.includes('high')) {
    return '⚠️';
  }
  
  if (lowerLevel.includes('средний') || lowerLevel.includes('пограничный') || 
      lowerLevel.includes('borderline') || lowerLevel.includes('moderate')) {
    return '⚡';
  }
  
  if (lowerLevel.includes('низкий') || lowerLevel.includes('норм') || 
      lowerLevel.includes('low') || lowerLevel.includes('normal')) {
    return '✅';
  }
  
  return '🔹';
}
```

---

### 2. Генерация общих выводов

```typescript
/**
 * Генерирует общие выводы на основе всех результатов
 */
function generateOverallConclusions(
  responses: Array<any>,
  aggregated_scores: Record<string, any>,
  flags: string[]
): string {
  
  const conclusions: string[] = [];
  
  // 2.1. Анализ флагов
  const high_risk_flags = flags.filter(f => 
    f.toLowerCase().includes('высокий') || 
    f.toLowerCase().includes('риск')
  );
  
  const attention_flags = flags.filter(f => 
    f.toLowerCase().includes('внимание') || 
    f.toLowerCase().includes('требуется')
  );
  
  // 2.2. Добавить выводы о высоких рисках
  high_risk_flags.forEach(flag => {
    conclusions.push(`• ${flag}`);
  });
  
  // 2.3. Добавить выводы о необходимости внимания
  attention_flags.forEach(flag => {
    conclusions.push(`• ${flag}`);
  });
  
  // 2.4. Проверить паттерны по нескольким опросникам
  const hyperactivity_keywords = ['гиперактивность', 'hyperactivity', 'сдвг', 'adhd'];
  const hyperactivity_mentions = responses.filter(r => {
    const title_lower = r.questionnaire.title.toLowerCase();
    const label_lower = r.scoringResult.overall.label.toLowerCase();
    
    return hyperactivity_keywords.some(kw => 
      title_lower.includes(kw) || label_lower.includes(kw)
    );
  });
  
  if (hyperactivity_mentions.length >= 2) {
    conclusions.push('• Признаки гиперактивности наблюдаются в нескольких опросниках');
  }
  
  // 2.5. Общая рекомендация (если есть высокие риски)
  if (high_risk_flags.length > 0) {
    conclusions.push('• Рекомендуется комплексное нейропсихологическое обследование');
  }
  
  // 2.6. Если нет значимых проблем
  if (high_risk_flags.length === 0 && attention_flags.length === 0) {
    conclusions.push('• Результаты в пределах возрастной нормы');
    conclusions.push('• Рекомендуется профилактический мониторинг');
  }
  
  return conclusions.join('\n');
}
```

---

### 3. Генерация рекомендаций

```typescript
/**
 * Генерирует рекомендации на основе флагов и результатов
 */
function generateRecommendations(
  responses: Array<any>,
  flags: string[]
): string[] {
  
  const recommendations: string[] = [];
  const added = new Set<string>(); // Для избежания дубликатов
  
  // 3.1. Рекомендации на основе ключевых слов в флагах
  
  // СДВГ
  if (flags.some(f => f.toLowerCase().includes('сдвг') || f.toLowerCase().includes('adhd'))) {
    const rec = 'Консультация детского психиатра по вопросам СДВГ';
    if (!added.has(rec)) {
      recommendations.push(rec);
      added.add(rec);
    }
  }
  
  // Аутизм
  if (flags.some(f => f.toLowerCase().includes('аутизм') || f.toLowerCase().includes('autism') || f.toLowerCase().includes('m-chat'))) {
    const rec = 'Углубленная диагностика расстройств аутистического спектра';
    if (!added.has(rec)) {
      recommendations.push(rec);
      added.add(rec);
    }
  }
  
  // Эмоциональные проблемы
  if (flags.some(f => f.toLowerCase().includes('эмоцион') || f.toLowerCase().includes('emotional'))) {
    const rec = 'Консультация детского психолога по эмоциональным трудностям';
    if (!added.has(rec)) {
      recommendations.push(rec);
      added.add(rec);
    }
  }
  
  // Сенсорные проблемы
  if (flags.some(f => f.toLowerCase().includes('сенсорн') || f.toLowerCase().includes('sensory'))) {
    const rec = 'Консультация эрготерапевта по сенсорной интеграции';
    if (!added.has(rec)) {
      recommendations.push(rec);
      added.add(rec);
    }
  }
  
  // 3.2. Общие рекомендации
  
  // Если много флагов - комплексное обследование
  if (flags.length >= 3) {
    const rec = 'Комплексное нейропсихологическое обследование';
    if (!added.has(rec)) {
      recommendations.push(rec);
      added.add(rec);
    }
  }
  
  // Повторное тестирование
  if (flags.length > 0) {
    const rec = 'Повторное тестирование через 3 месяца для отслеживания динамики';
    if (!added.has(rec)) {
      recommendations.push(rec);
      added.add(rec);
    }
  }
  
  // 3.3. Если нет рекомендаций - добавить общую
  if (recommendations.length === 0) {
    recommendations.push('Профилактический мониторинг развития');
    recommendations.push('Поддержка позитивного развития ребенка');
  }
  
  return recommendations;
}
```

---

## 🧪 ПРИМЕРЫ РАБОТЫ

### Пример 1: Высокий риск СДВГ + Аутизм

**Вход**:
```typescript
{
  responses: [
    {
      questionnaire: { title: "Скрининг СДВГ" },
      scoringResult: {
        overall: { score: 45, label: "Высокий риск СДВГ" },
        scales: [
          { id: "inattention", label: "Невнимательность", score: 24, level: "high" },
          { id: "hyperactivity", label: "Гиперактивность", score: 21, level: "high" }
        ],
        flags: ["Высокий риск СДВГ"]
      }
    },
    {
      questionnaire: { title: "M-CHAT" },
      scoringResult: {
        overall: { score: 8, label: "Требуется внимание" },
        scales: [],
        flags: ["Требуется внимание (аутизм)"]
      }
    }
  ]
}
```

**Выход**:
```typescript
{
  summary_text: `
=== АГРЕГИРОВАННЫЙ ОТЧЕТ ===

📝 ОПРОСНИК 1: Скрининг СДВГ
🔹 Общий балл: 45
🔹 Уровень: ⚠️ Высокий риск СДВГ

Детали:
• Невнимательность: 24 (high)
• Гиперактивность: 21 (high)

Флаги:
⚠️ Высокий риск СДВГ

━━━━━━━━━━━━━━━━━━━━━━━━

📝 ОПРОСНИК 2: M-CHAT
🔹 Общий балл: 8
🔹 Уровень: ⚠️ Требуется внимание

Флаги:
⚠️ Требуется внимание (аутизм)

━━━━━━━━━━━━━━━━━━━━━━━━

=== ОБЩИЕ ВЫВОДЫ ===
• Высокий риск СДВГ
• Требуется внимание (аутизм)
• Рекомендуется комплексное нейропсихологическое обследование

=== РЕКОМЕНДАЦИИ ===
1. Консультация детского психиатра по вопросам СДВГ
2. Углубленная диагностика расстройств аутистического спектра
3. Комплексное нейропсихологическое обследование
4. Повторное тестирование через 3 месяца для отслеживания динамики
`,
  aggregated_scores: { ... },
  flags: ["Высокий риск СДВГ", "Требуется внимание (аутизм)"],
  recommendations: [
    "Консультация детского психиатра по вопросам СДВГ",
    "Углубленная диагностика расстройств аутистического спектра",
    "Комплексное нейропсихологическое обследование",
    "Повторное тестирование через 3 месяца для отслеживания динамики"
  ]
}
```

---

### Пример 2: Все в норме

**Вход**:
```typescript
{
  responses: [
    {
      questionnaire: { title: "SDQ" },
      scoringResult: {
        overall: { score: 10, label: "Нормальный" },
        flags: []
      }
    },
    {
      questionnaire: { title: "Сенсорная чувствительность" },
      scoringResult: {
        overall: { score: 15, label: "Норма" },
        flags: []
      }
    }
  ]
}
```

**Выход**:
```typescript
{
  summary_text: `...`,
  flags: [],
  recommendations: [
    "Профилактический мониторинг развития",
    "Поддержка позитивного развития ребенка"
  ]
}
```

---

## ⚡ ОПТИМИЗАЦИЯ

### Производительность
- Все операции O(n) где n - количество опросников
- Нет сложных вычислений
- Минимальное использование памяти

### Расширяемость
- Легко добавить новые паттерны распознавания
- Модульная структура (отдельные функции)
- Простые правила (if/else, keywords)

### Тестируемость
- Чистые функции без side effects
- Легко создать unit тесты
- Предсказуемые входы и выходы

---

## 🧪 ТЕСТЫ

### Unit тесты

```typescript
describe('aggregateBatchScores', () => {
  
  it('должен агрегировать 2 опросника с высокими рисками', () => {
    const input = createTestInput([
      { flags: ['Высокий риск СДВГ'] },
      { flags: ['Требуется внимание'] }
    ]);
    
    const result = aggregateBatchScores(input);
    
    expect(result.flags).toHaveLength(2);
    expect(result.recommendations).toContain('Консультация детского психиатра');
  });
  
  it('должен генерировать рекомендации для нормальных результатов', () => {
    const input = createTestInput([
      { flags: [] },
      { flags: [] }
    ]);
    
    const result = aggregateBatchScores(input);
    
    expect(result.recommendations).toContain('Профилактический мониторинг');
  });
  
  it('должен обнаружить паттерн гиперактивности в нескольких опросниках', () => {
    const input = createTestInput([
      { title: 'СДВГ', label: 'Высокий риск СДВГ' },
      { title: 'SDQ', label: 'Гиперактивность пограничная' }
    ]);
    
    const result = aggregateBatchScores(input);
    
    expect(result.summary_text).toContain('гиперактивности наблюдаются');
  });
  
});
```

---

**Дата создания**: 2025-11-06  
**Статус**: Готово к реализации

