import TelegramBot from 'node-telegram-bot-api';
import { config, isAdmin } from './config';
import { getRepository } from './repo';
import { calculateScore, generateSummary } from './scoring';
import { validateAnswer } from './schema';
import texts from './texts.ru';
import { BotUserState } from './types';

const repo = getRepository();

export class NeiropsyBot {
  private bot: TelegramBot;

  constructor() {
    this.bot = new TelegramBot(config.telegram_bot_token, { polling: true });
    this.setupHandlers();
  }

  // Load user state from database
  private async loadUserState(userId: number): Promise<BotUserState | null> {
    const dbState = await repo.getUserState(userId);
    if (!dbState) {
      return null;
    }

    // Load questionnaire to get questions array
    const questionnaire = await repo.getQuestionnaire(dbState.questionnaire_id);
    if (!questionnaire) {
      return null;
    }

    return {
      sessionToken: dbState.session_token,
      questionnaireId: dbState.questionnaire_id,
      responseId: dbState.response_id,
      currentQuestionIndex: dbState.current_question_index,
      answers: dbState.answers_json,
      questions: questionnaire.questions_json,
    };
  }

  // Save user state to database
  private async saveUserState(userId: number, state: BotUserState): Promise<void> {
    await repo.saveUserState(
      userId,
      state.responseId,
      state.sessionToken,
      state.questionnaireId,
      state.currentQuestionIndex,
      state.answers
    );
  }

  private setupHandlers() {
    // Handle /start command with token
    this.bot.onText(/\/start(.*)/, async (msg, match) => {
      await this.handleStart(msg, match);
    });

    // Handle admin commands
    this.bot.onText(/\/help/, async (msg) => {
      await this.handleHelp(msg);
    });

    this.bot.onText(/\/newsession (.+)/, async (msg, match) => {
      await this.handleNewSession(msg, match);
    });

    this.bot.onText(/\/listq/, async (msg) => {
      await this.handleListQuestionnaires(msg);
    });

    this.bot.onText(/\/listr (.+)/, async (msg, match) => {
      await this.handleListResponses(msg, match);
    });

    // Handle text messages (answers)
    this.bot.on('message', async (msg) => {
      // Skip if it's a command
      if (msg.text?.startsWith('/')) {
        return;
      }

      await this.handleMessage(msg);
    });

    // Handle callback queries (button clicks)
    this.bot.on('callback_query', async (query) => {
      await this.handleCallbackQuery(query);
    });

    console.log('Telegram bot started');
  }

  private async handleStart(msg: TelegramBot.Message, match: RegExpExecArray | null) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) {
      return;
    }

    // Extract token from /start command
    const params = match?.[1]?.trim();
    const token = params?.replace(/^[=\s]+/, '');

    if (!token) {
      // No token provided
      if (isAdmin(userId)) {
        await this.bot.sendMessage(chatId, texts.adminWelcome + '\n\n' + texts.adminHelp);
      } else {
        await this.bot.sendMessage(chatId, texts.invalidLink);
      }
      return;
    }

    // Validate session token
    const isValid = await repo.isSessionValid(token);
    if (!isValid) {
      const session = await repo.getSessionByToken(token);
      if (!session) {
        await this.bot.sendMessage(chatId, texts.invalidLink);
      } else if (session.used) {
        await this.bot.sendMessage(chatId, texts.linkUsed);
      } else {
        await this.bot.sendMessage(chatId, texts.linkExpired);
      }
      return;
    }

    // Get session and questionnaire
    const session = await repo.getSessionByToken(token);
    if (!session) {
      await this.bot.sendMessage(chatId, texts.sessionError);
      return;
    }

    const questionnaire = await repo.getQuestionnaire(session.questionnaire_id);
    if (!questionnaire) {
      await this.bot.sendMessage(chatId, texts.sessionError);
      return;
    }

    // Create response record
    const response = await repo.createResponse(session.id);

    // Initialize user state
    const userState: BotUserState = {
      sessionToken: token,
      questionnaireId: session.questionnaire_id,
      responseId: response.id,
      currentQuestionIndex: -1, // -1 means not started yet
      answers: {},
      questions: questionnaire.questions_json,
    };

    // Save state to database
    await this.saveUserState(userId, userState);

    // Send welcome message
    await this.bot.sendMessage(chatId, texts.welcome, {
      reply_markup: {
        inline_keyboard: [[{ text: texts.startButton, callback_data: 'start_survey' }]],
      },
    });
  }

  private async handleMessage(msg: TelegramBot.Message) {
    // chatId доступен через msg.chat.id при необходимости
    const userId = msg.from?.id;

    if (!userId || !msg.text) {
      return;
    }

    const userState = await this.loadUserState(userId);
    if (!userState) {
      return;
    }

    // User is answering a question
    if (userState.currentQuestionIndex >= 0) {
      await this.handleAnswer(msg, userState, userId);
    }
  }

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const data = query.data;

    console.log(`[CALLBACK] User ${userId}, data: ${data}`);

    if (!chatId || !data) {
      return;
    }

    await this.bot.answerCallbackQuery(query.id);

    const userState = await this.loadUserState(userId);
    console.log(`[CALLBACK] User state loaded: ${userState ? 'YES' : 'NO'}`);

    if (data === 'start_survey') {
      if (!userState) {
        await this.bot.sendMessage(chatId, texts.sessionError);
        return;
      }
      userState.currentQuestionIndex = 0;
      await this.saveUserState(userId, userState);
      await this.askQuestion(chatId, userState);
    } else if (data === 'next_question') {
      if (!userState) {
        return;
      }
      userState.currentQuestionIndex++;
      await this.saveUserState(userId, userState);
      await this.askQuestion(chatId, userState);
    } else if (data.startsWith('answer_')) {
      // Handle inline button answers (for single_choice)
      if (!userState) {
        return;
      }
      const answerValue = data.replace('answer_', '');
      const question = userState.questions[userState.currentQuestionIndex];
      userState.answers[question.key] = answerValue;

      // Move to next question
      userState.currentQuestionIndex++;

      // Save progress (both answer and index)
      await this.saveUserState(userId, userState);
      await repo.updateResponseAnswers(userState.responseId, userState.answers);

      await this.askQuestion(chatId, userState);
    } else if (data === 'submit_answers') {
      if (!userState) {
        return;
      }
      await this.submitAnswers(chatId, userState, userId);
    }
  }

  private async askQuestion(chatId: number, userState: BotUserState) {
    console.log(`[ASK_QUESTION] Question ${userState.currentQuestionIndex + 1}/${userState.questions.length}`);
    
    if (userState.currentQuestionIndex >= userState.questions.length) {
      // All questions answered, show review
      console.log(`[ASK_QUESTION] All questions answered, showing review`);
      await this.showReview(chatId, userState);
      return;
    }

    const question = userState.questions[userState.currentQuestionIndex];
    console.log(`[ASK_QUESTION] Question key: ${question.key}, type: ${question.type}`);
    const progress = texts.questionProgress(
      userState.currentQuestionIndex + 1,
      userState.questions.length
    );

    let messageText = `${progress}\n\n${question.text}`;

    // Add type-specific hint
    switch (question.type) {
      case 'single_choice':
        messageText += '\n\n' + texts.singleChoiceHint;
        break;
      case 'multi_choice':
        messageText += '\n\n' + texts.multiChoiceHint;
        // Показываем варианты для multi_choice
        if (question.options) {
          messageText += '\n\n' + question.options.map((opt) => 
            `${opt.value} - ${opt.label}`
          ).join('\n');
        }
        break;
      case 'likert_5':
        messageText += '\n\n' + texts.likertHint;
        if (question.labels) {
          messageText += '\n' + question.labels.map((l, i) => `${i + 1} - ${l}`).join('\n');
        }
        break;
      case 'numeric':
        messageText += '\n\n' + texts.numericHint;
        if (question.min !== undefined || question.max !== undefined) {
          const range = [];
          if (question.min !== undefined) range.push(`мин: ${question.min}`);
          if (question.max !== undefined) range.push(`макс: ${question.max}`);
          messageText += ` (${range.join(', ')})`;
        }
        break;
      case 'text':
        messageText += '\n\n' + texts.textHint;
        if (question.max_len) {
          messageText += ` (макс. ${question.max_len} символов)`;
        }
        break;
      case 'date':
        messageText += '\n\n' + texts.dateHint;
        break;
    }

    if (question.required) {
      messageText += '\n\n*Обязательный вопрос';
    }

    // For single_choice, show inline buttons
    if (question.type === 'single_choice' && question.options) {
      const keyboard = question.options.map((opt) => [
        {
          text: opt.label,
          callback_data: `answer_${opt.value}`,
        },
      ]);

      await this.bot.sendMessage(chatId, messageText, {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    } else if (question.type === 'likert_5') {
      // Show 1-5 buttons
      const keyboard = [
        [1, 2, 3, 4, 5].map((num) => ({
          text: String(num),
          callback_data: `answer_${num}`,
        })),
      ];

      await this.bot.sendMessage(chatId, messageText, {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    } else {
      // For other types, expect text input
      await this.bot.sendMessage(chatId, messageText);
    }
  }

  private async handleAnswer(msg: TelegramBot.Message, userState: BotUserState, userId: number) {
    const chatId = msg.chat.id;
    const answerText = msg.text || '';

    console.log(`[ANSWER] User ${userId}, Question ${userState.currentQuestionIndex + 1}/${userState.questions.length}, Text: "${answerText}"`);

    const question = userState.questions[userState.currentQuestionIndex];

    // Parse answer based on question type
    let answer: any = answerText;

    if (question.type === 'multi_choice') {
      // Parse comma-separated values
      answer = answerText.split(',').map((v) => v.trim());
      console.log(`[ANSWER] Parsed multi_choice: ${JSON.stringify(answer)}`);
    } else if (question.type === 'numeric') {
      answer = parseFloat(answerText);
      console.log(`[ANSWER] Parsed numeric: ${answer}`);
    } else if (question.type === 'likert_5') {
      answer = parseInt(answerText, 10);
      console.log(`[ANSWER] Parsed likert_5: ${answer}`);
    }

    // Validate answer
    console.log(`[ANSWER] Validating answer...`);
    const validation = validateAnswer(question, answer);
    if (!validation.valid) {
      console.log(`[ANSWER] ❌ Validation failed: ${validation.error}`);
      await this.bot.sendMessage(chatId, `${texts.invalidAnswer}\n${validation.error}`);
      return;
    }

    console.log(`[ANSWER] ✅ Valid, saving answer...`);

    // Save answer
    userState.answers[question.key] = answer;

    // Move to next question
    userState.currentQuestionIndex++;

    // Save progress to database (both answer and index)
    console.log(`[ANSWER] Saving to database...`);
    await this.saveUserState(userId, userState);
    await repo.updateResponseAnswers(userState.responseId, userState.answers);
    
    console.log(`[ANSWER] ✅ Saved, moving to next question...`);

    await this.askQuestion(chatId, userState);
  }

  private async showReview(chatId: number, userState: BotUserState) {
    let reviewText = texts.reviewTitle + '\n\n' + texts.reviewIntro + '\n\n';

    userState.questions.forEach((q) => {
      const answer = userState.answers[q.key];
      const answerDisplay =
        answer !== undefined && answer !== null && answer !== ''
          ? Array.isArray(answer)
            ? answer.join(', ')
            : String(answer)
          : texts.noAnswer;

      reviewText += `❓ ${q.text}\n💬 ${answerDisplay}\n\n`;
    });

    reviewText += texts.confirmSubmit;

    await this.bot.sendMessage(chatId, reviewText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: texts.submitButton, callback_data: 'submit_answers' },
            // { text: texts.backButton, callback_data: 'back_to_questions' },
          ],
        ],
      },
    });
  }

  private async submitAnswers(chatId: number, userState: BotUserState, userId: number) {
    try {
      // Get questionnaire for scoring
      const questionnaire = await repo.getQuestionnaire(userState.questionnaireId);
      if (!questionnaire) {
        await this.bot.sendMessage(chatId, texts.serverError);
        return;
      }

      // Calculate scores
      const scoringResult = calculateScore(
        userState.answers,
        questionnaire.scoring_json,
        questionnaire.questions_json
      );

      const summary = generateSummary(scoringResult);

      // Submit to database
      await repo.submitResponse(userState.responseId, userState.answers, scoringResult, summary);

      // Mark session as used
      const session = await repo.getSessionByToken(userState.sessionToken);
      if (session) {
        await repo.markSessionUsed(session.id);
      }

      // Send thank you message
      await this.bot.sendMessage(chatId, texts.thankYou);

      // Notify admin с передачей readable_id
      await this.notifyAdmin(
        questionnaire.title, 
        userState.responseId, 
        summary,
        session?.readable_id // Передаем читаемый ID сессии
      );

      // Clear user state from database
      await repo.deleteUserState(userId);
    } catch (error) {
      console.error('Error submitting answers:', error);
      await this.bot.sendMessage(chatId, texts.serverError);
    }
  }

  private async notifyAdmin(
    questionnaireTitle: string,
    responseId: string,
    summary: string,
    readableSessionId?: string
  ) {
    try {
      const adminId = parseInt(config.admin_tg_id, 10);
      const message = texts.newResponseNotification(
        questionnaireTitle, 
        responseId, 
        summary,
        readableSessionId
      );
      await this.bot.sendMessage(adminId, message);
    } catch (error) {
      console.error('Error notifying admin:', error);
    }
  }

  // Admin commands
  private async handleHelp(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    console.log(`[HELP] User ${userId} requested help. Is admin: ${isAdmin(userId || 0)}`);

    if (!userId || !isAdmin(userId)) {
      console.log(`[HELP] Access denied for user ${userId}`);
      await this.bot.sendMessage(chatId, texts.adminOnly);
      return;
    }

    await this.bot.sendMessage(chatId, texts.adminHelp);
  }

  private async handleNewSession(msg: TelegramBot.Message, match: RegExpExecArray | null) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    console.log(`[NEWSESSION] User ${userId} requested new session. Is admin: ${isAdmin(userId || 0)}`);

    if (!userId || !isAdmin(userId)) {
      console.log(`[NEWSESSION] Access denied for user ${userId}`);
      await this.bot.sendMessage(chatId, texts.adminOnly);
      return;
    }

    const questionnaireId = match?.[1]?.trim();
    if (!questionnaireId) {
      await this.bot.sendMessage(chatId, texts.missingParameter('questionnaire_id'));
      return;
    }

    try {
      // Check if questionnaire exists
      const questionnaire = await repo.getQuestionnaire(questionnaireId);
      if (!questionnaire) {
        await this.bot.sendMessage(chatId, texts.questionnaireNotFound);
        return;
      }

      // Create session с передачей telegram user ID
      const session = await repo.createSession(
        questionnaireId, 
        config.session_expiry_hours,
        userId // Передаем telegram ID для генерации readable_id
      );
      const link = `${config.public_bot_link}?start=${session.token}`;
      const expiresAt = texts.formatDate(session.expires_at);

      await this.bot.sendMessage(chatId, texts.sessionCreated(link, expiresAt, session.readable_id));
    } catch (error) {
      console.error('Error creating session:', error);
      await this.bot.sendMessage(chatId, texts.serverError);
    }
  }

  private async handleListQuestionnaires(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    console.log(`[LISTQ] User ${userId} requested questionnaires list. Is admin: ${isAdmin(userId || 0)}`);

    if (!userId || !isAdmin(userId)) {
      console.log(`[LISTQ] Access denied for user ${userId}`);
      await this.bot.sendMessage(chatId, texts.adminOnly);
      return;
    }

    try {
      const questionnaires = await repo.listQuestionnaires(true);

      if (questionnaires.length === 0) {
        await this.bot.sendMessage(chatId, texts.noQuestionnaires);
        return;
      }

      let message = texts.questionnairesList(questionnaires.length);

      questionnaires.forEach((q) => {
        message += texts.questionnaireItem(
          q.id,
          q.title,
          q.version,
          q.questions_json.length,
          q.code // Передаем короткий код
        );
      });

      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error('Error listing questionnaires:', error);
      await this.bot.sendMessage(chatId, texts.serverError);
    }
  }

  private async handleListResponses(msg: TelegramBot.Message, match: RegExpExecArray | null) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId || !isAdmin(userId)) {
      await this.bot.sendMessage(chatId, texts.adminOnly);
      return;
    }

    const questionnaireId = match?.[1]?.trim();
    if (!questionnaireId) {
      await this.bot.sendMessage(chatId, texts.missingParameter('questionnaire_id'));
      return;
    }

    try {
      const questionnaire = await repo.getQuestionnaire(questionnaireId);
      if (!questionnaire) {
        await this.bot.sendMessage(chatId, texts.questionnaireNotFound);
        return;
      }

      const responses = await repo.listResponses(questionnaireId, 10);

      if (responses.length === 0) {
        await this.bot.sendMessage(chatId, texts.noResponses);
        return;
      }

      let message = texts.responsesList(responses.length, questionnaire.title);

      responses.forEach((r) => {
        const submittedAt = r.submitted_at
          ? texts.formatShortDate(r.submitted_at)
          : 'не завершен';
        const summary = r.summary_text || 'нет данных';
        message += texts.responseItem(r.id, submittedAt, summary);
      });

      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error('Error listing responses:', error);
      await this.bot.sendMessage(chatId, texts.serverError);
    }
  }

  public getBot(): TelegramBot {
    return this.bot;
  }
}

export async function startBot() {
  const bot = new NeiropsyBot();
  return bot;
}
