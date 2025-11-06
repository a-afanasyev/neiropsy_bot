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
  adminHelp: `Доступные команды:

/newsession <questionnaire_id> - создать новую сессию
/listq - список опросников
/listr <questionnaire_id> - список ответов
/help - эта справка`,

  sessionCreated: (link: string, expiresAt: string) =>
    `✅ Сессия создана!

🔗 Ссылка: ${link}

⏰ Истекает: ${expiresAt}

Отправьте эту ссылку клиенту.`,

  questionnairesList: (count: number) =>
    `📋 Всего опросников: ${count}`,

  questionnaireItem: (id: string, title: string, version: string, questions: number) =>
    `\n🔹 ID: ${id}\n   Название: ${title}\n   Версия: ${version}\n   Вопросов: ${questions}`,

  noQuestionnaires: '❌ Опросники не найдены.',

  responsesList: (count: number, title: string) =>
    `📊 Ответов для "${title}": ${count}`,

  responseItem: (id: string, submittedAt: string, summary: string) =>
    `\n🔸 ID: ${id}\n   Дата: ${submittedAt}\n   ${summary}`,

  noResponses: '❌ Ответы не найдены.',

  // Notifications
  newResponseNotification: (questionnaireTitle: string, responseId: string, summary: string) =>
    `📬 Новый ответ получен!

📋 Опросник: ${questionnaireTitle}
🆔 ID ответа: ${responseId}

${summary}

Используйте /listr для просмотра всех ответов.`,

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
