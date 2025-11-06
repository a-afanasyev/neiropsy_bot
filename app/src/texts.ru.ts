// Russian text messages for the bot

export const texts = {
  // Welcome and disclaimer
  welcome: `👋 Добро пожаловать!

Это анонимный психологический опрос. Ваши ответы будут видны только специалисту.

⚠️ Важно:
• Ссылка действует 24 часа
• Опрос можно пройти только один раз
• Все ответы полностью анонимны

📋 Дисклеймер:
Этот опрос предназначен для первичного сбора информации и не является диагнозом. Интерпретацию результатов выполняет специалист.`,

  // Button labels
  startButton: '▶️ Начать опрос',
  nextButton: '➡️ Далее',
  backButton: '⬅️ Назад',
  submitButton: '✅ Отправить ответы',
  reviewButton: '👁 Просмотреть ответы',
  cancelButton: '❌ Отменить',

  // Errors
  invalidLink: '❌ Ссылка недействительна или просрочена.',
  linkExpired: '⏰ Срок действия ссылки истек (24 часа).',
  linkUsed: '✓ Эта ссылка уже использована.',
  sessionError: '❌ Ошибка сессии. Пожалуйста, запросите новую ссылку у специалиста.',
  invalidAnswer: '❌ Некорректный ответ. Пожалуйста, попробуйте снова.',
  requiredAnswer: '⚠️ Этот вопрос обязателен для ответа.',
  serverError: '❌ Произошла ошибка сервера. Попробуйте позже.',

  // Progress
  questionProgress: (current: number, total: number) =>
    `Вопрос ${current} из ${total}`,

  // Question types
  singleChoiceHint: '👇 Выберите один вариант ответа:',
  multiChoiceHint: '👇 Выберите один или несколько вариантов (через запятую):',
  likertHint: '👇 Оцените по шкале от 1 до 5:',
  numericHint: '👇 Введите число:',
  textHint: '👇 Введите текст:',
  dateHint: '👇 Введите дату в формате ГГГГ-ММ-ДД (например, 2024-01-15):',

  // Review and submission
  reviewTitle: '📝 Просмотр ответов',
  reviewIntro: 'Вы ответили на все вопросы. Проверьте свои ответы:',
  noAnswer: '(не отвечено)',
  confirmSubmit: 'Вы уверены, что хотите отправить ответы? После отправки изменения будут невозможны.',

  // Completion
  thankYou: `✅ Спасибо!

Ваши ответы успешно отправлены специалисту.
Сессия закрыта.

Если у вас есть вопросы, обратитесь к специалисту, который предоставил вам ссылку.`,

  // Admin commands
  adminWelcome: '👨‍⚕️ Панель администратора',
  adminHelp: `📋 Доступные команды:

/newsession <код> - создать новую сессию
/listq - список опросников
/listr <код> - список ответов
/help - эта справка

💡 Используйте короткие коды:
adhd, mchat, sdq, sensory, demo

Примеры:
/newsession adhd
/newsession mchat`,

  sessionCreated: (link: string, expiresAt: string, readableId?: string) => {
    let message = `✅ Сессия создана!`;
    
    if (readableId) {
      message += `\n\n🆔 ID: ${readableId}`;
    }
    
    message += `\n\n🔗 Ссылка: ${link}`;
    message += `\n\n⏰ Истекает: ${expiresAt}`;
    message += `\n\nОтправьте эту ссылку клиенту.`;
    
    return message;
  },

  questionnairesList: (count: number) =>
    `📋 Всего опросников: ${count}`,

  questionnaireItem: (id: string, title: string, version: string, questions: number, code?: string) =>
    `\n🔹 Код: ${code || id}\n   Название: ${title}\n   Версия: ${version}\n   Вопросов: ${questions}`,

  noQuestionnaires: '❌ Опросники не найдены.',

  responsesList: (count: number, title: string) =>
    `📊 Ответов для "${title}": ${count}`,

  responseItem: (id: string, submittedAt: string, summary: string) =>
    `\n🔸 ID: ${id}\n   Дата: ${submittedAt}\n   ${summary}`,

  noResponses: '❌ Ответы не найдены.',

  // Notifications
  newResponseNotification: (
    questionnaireTitle: string, 
    responseId: string, 
    summary: string,
    readableSessionId?: string
  ) => {
    let message = `📬 Новый ответ получен!`;
    message += `\n\n📋 Опросник: ${questionnaireTitle}`;
    
    if (readableSessionId) {
      message += `\n🆔 Сессия: ${readableSessionId}`;
    }
    
    message += `\n🆔 ID ответа: ${responseId}`;
    message += `\n\n📊 Результаты опроса:\n\n${summary}`;
    message += `\n\nИспользуйте /listr для просмотра всех ответов.`;
    
    return message;
  },

  // Errors for admin
  adminOnly: '❌ Эта команда доступна только администратору.',
  invalidCommand: '❌ Неизвестная команда. Используйте /help для справки.',
  missingParameter: (param: string) =>
    `❌ Отсутствует параметр: ${param}`,
  questionnaireNotFound: '❌ Опросник не найден.',

  // Formatting helpers
  formatDate: (date: Date): string => {
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  },

  formatShortDate: (date: Date): string => {
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  },
};

export default texts;
