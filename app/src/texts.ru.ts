/**
 * Русскоязычные тексты для Telegram бота
 * Все сообщения, инструкции и шаблоны для пользователей
 */

/**
 * Тексты для администратора
 */
export const AdminTexts = {
  // Главное меню
  mainMenu: '👋 Добро пожаловать в панель управления!\n\nВыберите действие:',
  mainMenuButtons: {
    createBatch: '📋 Создать опрос',
    viewBatches: '📊 Мои опросы',
    viewQuestionnaires: '📚 Список опросников',
    help: '❓ Помощь',
  },

  // Создание батча
  createBatch: {
    selectQuestionnaires:
      '📋 Создание опроса\n\nВыберите опросники (можно несколько):',
    noQuestionnaires:
      '❌ В системе пока нет опросников.\n\nЗагрузите опросники через API.',
    confirmCreation:
      '✅ Вы выбрали {count} опросников.\n\nПодтвердите создание опроса:',
    buttons: {
      create: '✅ Создать опрос',
      cancel: '❌ Отмена',
    },
  },

  // Успешное создание батча
  batchCreated:
    '✅ Опрос из {count} опросников создан!\n\n' +
    '📝 Название: {title}\n' +
    '🔗 Ссылка для клиента:\n{link}\n\n' +
    '⏰ Действительна до: {expiresAt}\n' +
    '📊 Всего вопросов: {totalQuestions}',

  batchCancelled: '❌ Создание опроса отменено.',

  // Уведомление о завершении батча
  batchCompleted:
    '📊 Клиент завершил опрос!\n\n' +
    '📅 Дата: {completedAt}\n' +
    '📝 Опросников: {count}\n' +
    '⏱ Время прохождения: {duration} минут',

  batchCompletedButtons: {
    viewReport: '📄 Посмотреть отчет',
    exportJSON: '💾 Выгрузить JSON',
    exportCSV: '📊 Выгрузить CSV',
  },

  // Помощь
  help:
    '❓ Справка по использованию бота\n\n' +
    '1. Нажмите "Создать опрос" для создания нового набора опросников\n' +
    '2. Выберите нужные опросники из списка\n' +
    '3. Получите ссылку и отправьте её клиенту\n' +
    '4. После прохождения вы получите уведомление и отчет\n\n' +
    '📧 Вопросы? Обратитесь к администратору.',

  // Просмотр опросников
  questionnairesList: {
    title: '📚 Список опросников в системе',
    empty: '❌ В системе пока нет опросников.\n\nЗагрузите опросники через API.',
    count: 'Всего опросников: {count}',
    select: 'Выберите опросник для просмотра деталей:',
  },

  questionnaireDetails: {
    title: '📋 {title}',
    questionsCount: 'Всего вопросов: {count}',
    questionsTitle: '📝 Вопросы:',
    question: '{num}. {text}',
    questionType: 'Тип: {type}',
    questionOptions: 'Варианты ответов:',
    option: '  • {label} (значение: {value})',
    scalesTitle: '📊 Шкалы оценки:',
    scale: '• {label}: вопросы {questions}',
    overallTitle: '📈 Общая оценка:',
    overallStrategy: 'Стратегия: {strategy}',
    back: '◀️ Назад к списку',
  },
};

/**
 * Тексты для клиента (респондента)
 */
export const ClientTexts = {
  // Приветствие
  welcome:
    '👋 Добро пожаловать!\n\n' +
    'Вам предстоит пройти {count} опросников ({totalQuestions} вопросов).\n' +
    'Это займет примерно {estimatedTime} минут.\n\n' +
    '💡 Вы можете делать перерывы – ваш прогресс сохраняется.',

  welcomeButtons: {
    start: '▶️ Начать',
    cancel: '❌ Отмена',
  },

  // Прохождение опросов
  questionnaireStart:
    '📝 Опросник {current} из {total}: {title}\n\n' +
    'Всего вопросов в этом опроснике: {questions}',

  question: '❓ Вопрос {current} из {total}:\n\n{text}',

  questionnaireCompleted:
    '✅ Опросник {current} из {total} завершен!\n\n' +
    '📝 Переходим к опроснику {next} из {total}: {nextTitle}',

  // Завершение всех опросников
  allCompleted:
    '🎉 Поздравляем! Все опросники завершены!\n\n' +
    'Спасибо за участие. Специалист получит результаты в ближайшее время.',

  // Отмена
  cancelled: '❌ Прохождение опросов отменено.\n\nВы можете начать заново по ссылке.',

  // Ошибки
  sessionNotFound:
    '❌ Сессия не найдена.\n\n' +
    'Возможно, ссылка неверна или устарела. Обратитесь к специалисту.',

  sessionExpired:
    '❌ Срок действия ссылки истек.\n\n' + 'Обратитесь к специалисту для получения новой ссылки.',

  sessionAlreadyCompleted:
    '✅ Этот опрос уже пройден.\n\n' + 'Если нужно пройти заново, обратитесь к специалисту.',

  unexpectedError:
    '❌ Произошла ошибка.\n\n' + 'Пожалуйста, попробуйте позже или обратитесь к специалисту.',
};

/**
 * Общие тексты
 */
export const CommonTexts = {
  loading: '⏳ Загрузка...',
  processing: '⚙️ Обработка...',
  error: '❌ Ошибка',
  success: '✅ Успешно',
  cancel: '❌ Отмена',
  back: '◀️ Назад',
  next: '▶️ Далее',
  done: '✅ Готово',
};

/**
 * Форматирование текстов (вспомогательные функции)
 */
export class TextFormatter {
  /**
   * Заменить плейсхолдеры в тексте
   * Пример: formatText("Привет, {name}!", {name: "Иван"}) => "Привет, Иван!"
   */
  static format(text: string, params: Record<string, string | number>): string {
    let result = text;
    Object.entries(params).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    });
    return result;
  }

  /**
   * Форматировать дату в читаемый вид
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Форматировать длительность в минутах
   */
  static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} минут`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} ч ${mins} мин`;
  }

  /**
   * Оценить время прохождения (примерно 1 минута на 3 вопроса)
   */
  static estimateTime(questionsCount: number): string {
    const minutes = Math.ceil(questionsCount / 3);
    if (minutes < 60) {
      return `${minutes}`;
    }
    return `${Math.ceil(minutes / 60)}`;
  }

  /**
   * Форматировать число опросников с правильным склонением
   */
  static formatQuestionnaireCount(count: number): string {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return `${count} опросников`;
    }

    if (lastDigit === 1) {
      return `${count} опросник`;
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
      return `${count} опросника`;
    }

    return `${count} опросников`;
  }

  /**
   * Форматировать число вопросов с правильным склонением
   */
  static formatQuestionCount(count: number): string {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return `${count} вопросов`;
    }

    if (lastDigit === 1) {
      return `${count} вопрос`;
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
      return `${count} вопроса`;
    }

    return `${count} вопросов`;
  }
}

/**
 * Примеры использования:
 * 
 * // Для админа при создании батча
 * const message = TextFormatter.format(AdminTexts.batchCreated, {
 *   count: 4,
 *   title: "Комплексное обследование",
 *   link: "https://t.me/bot?start=batch_xyz",
 *   expiresAt: TextFormatter.formatDate(new Date()),
 *   totalQuestions: 89
 * });
 * 
 * // Для клиента при старте
 * const welcomeMsg = TextFormatter.format(ClientTexts.welcome, {
 *   count: TextFormatter.formatQuestionnaireCount(4),
 *   totalQuestions: 89,
 *   estimatedTime: TextFormatter.estimateTime(89)
 * });
 */

