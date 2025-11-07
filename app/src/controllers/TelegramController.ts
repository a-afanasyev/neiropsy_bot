/**
 * Telegram Bot Controller
 * Обработка команд и кнопок от пользователей
 * Интеграция с BatchService и ReportGenerator
 */

import { Telegraf, Context, Markup } from 'telegraf';
import { config } from '../config';
import { batchService } from '../services/BatchService';
import { reportGenerator } from '../services/ReportGenerator';
import { questionnaireRepo, batchRepo, sessionRepo, batchResponseRepo, responseRepo } from '../db/repository';
import { AdminTexts, ClientTexts, TextFormatter } from '../texts.ru';
import { Questionnaire } from '../types';

/**
 * Создать и настроить Telegram бота
 */
export function createBot(): Telegraf {
  const bot = new Telegraf(config.telegram_bot_token);

  // Состояние для создания батча (временное хранилище)
  const batchCreationState = new Map<
    number,
    {
      selectedQuestionnaires: string[];
      allQuestionnaires: Questionnaire[];
    }
  >();

  /**
   * Проверка, является ли пользователь администратором
   */
  function isAdmin(userId: number): boolean {
    return config.admin_telegram_ids.includes(userId);
  }

  // ===============================
  // КОМАНДА /start
  // ===============================
  bot.start(async (ctx: Context) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Проверяем наличие параметра (токен батча)
    const startParam = ctx.message && 'text' in ctx.message 
      ? ctx.message.text.split(' ')[1] 
      : undefined;

    if (startParam && startParam.startsWith('batch_')) {
      // Клиент переходит по ссылке для прохождения батча
      await handleClientStart(ctx, startParam, userId);
    } else if (isAdmin(userId)) {
      // Администратор запускает бота
      await showAdminMainMenu(ctx);
    } else {
      // Обычный пользователь без токена
      await ctx.reply(
        '👋 Добро пожаловать!\n\nДля прохождения опроса используйте ссылку, полученную от специалиста.'
      );
    }
  });

  /**
   * Обработка старта для клиента (по токену)
   */
  async function handleClientStart(ctx: Context, token: string, userId: number) {
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) return;

      // Проверяем, нет ли уже активной сессии
      const existingProgress = await batchService.getProgress(userId);
      if (existingProgress) {
        await ctx.reply(
          '⚠️ У вас уже есть активная сессия прохождения.\n\n' +
          'Продолжите с того места, где остановились, или нажмите /cancel для отмены.'
        );
        return;
      }

      // Начинаем сессию
      const sessionData = await batchService.startSession(token, userId, chatId);

      // Отправляем приветственное сообщение
      const welcomeText = TextFormatter.format(ClientTexts.welcome, {
        count: TextFormatter.formatQuestionnaireCount(sessionData.total_questionnaires),
        totalQuestions: sessionData.total_questions,
        estimatedTime: TextFormatter.estimateTime(sessionData.total_questions),
      });

      await ctx.reply(
        welcomeText,
        Markup.inlineKeyboard([
          [Markup.button.callback('▶️ Начать', 'client_start')],
          [Markup.button.callback('❌ Отмена', 'client_cancel')],
        ])
      );
    } catch (error) {
      console.error('Ошибка при старте клиента:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      
      if (errorMessage.includes('не найдена')) {
        await ctx.reply(ClientTexts.sessionNotFound);
      } else if (errorMessage.includes('истек')) {
        await ctx.reply(ClientTexts.sessionExpired);
      } else if (errorMessage.includes('завершена')) {
        await ctx.reply(ClientTexts.sessionAlreadyCompleted);
      } else {
        await ctx.reply(ClientTexts.unexpectedError);
      }
    }
  }

  /**
   * Показать главное меню администратора
   */
  async function showAdminMainMenu(ctx: Context) {
    await ctx.reply(
      AdminTexts.mainMenu,
      Markup.inlineKeyboard([
        [Markup.button.callback(AdminTexts.mainMenuButtons.createBatch, 'admin_create_batch')],
        [Markup.button.callback(AdminTexts.mainMenuButtons.viewBatches, 'admin_view_batches')],
        [Markup.button.callback(AdminTexts.mainMenuButtons.viewQuestionnaires, 'admin_view_questionnaires')],
        [Markup.button.callback(AdminTexts.mainMenuButtons.help, 'admin_help')],
      ])
    );
  }

  // ===============================
  // CALLBACK ОБРАБОТЧИКИ
  // ===============================

  /**
   * Клиент: начать прохождение
   */
  bot.action('client_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId) return;

      // Получаем прогресс
      const progress = await batchService.getProgress(userId);
      if (!progress) {
        await ctx.reply(ClientTexts.unexpectedError);
        return;
      }

      // Отправляем первый вопрос
      await sendQuestion(ctx, userId);
    } catch (error) {
      console.error('Ошибка при старте прохождения:', error);
      await ctx.reply(ClientTexts.unexpectedError);
    }
  });

  /**
   * Клиент: отмена прохождения
   */
  bot.action('client_cancel', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId) return;

      await batchService.cancelSession(userId);
      await ctx.reply(ClientTexts.cancelled);
    } catch (error) {
      console.error('Ошибка при отмене:', error);
    }
  });

  /**
   * Отправить текущий вопрос клиенту
   */
  async function sendQuestion(ctx: Context, userId: number) {
    const progress = await batchService.getProgress(userId);
    if (!progress) {
      await ctx.reply(ClientTexts.unexpectedError);
      return;
    }

    const currentQuestionnaire = progress.questionnaires[progress.current_questionnaire_index];
    if (!currentQuestionnaire) {
      await ctx.reply(ClientTexts.unexpectedError);
      return;
    }

    const currentQuestion = currentQuestionnaire.questions_json[progress.current_question_index];
    if (!currentQuestion) {
      await ctx.reply(ClientTexts.unexpectedError);
      return;
    }

    // Формируем текст вопроса
    let questionText = '';
    
    // Показываем прогресс опросника
    if (progress.current_question_index === 0) {
      questionText += TextFormatter.format(ClientTexts.questionnaireStart, {
        current: progress.current_questionnaire_index + 1,
        total: progress.total_questionnaires,
        title: currentQuestionnaire.title,
        questions: currentQuestionnaire.questions_json.length,
      });
      questionText += '\n\n';
    }

    // Добавляем вопрос
    questionText += TextFormatter.format(ClientTexts.question, {
      current: progress.current_question_index + 1,
      total: currentQuestionnaire.questions_json.length,
      text: currentQuestion.text,
    });

    // Формируем кнопки с вариантами ответа
    const buttons = currentQuestion.options.map((option) =>
      Markup.button.callback(option.label, `answer_${option.value}`)
    );

    // Разбиваем на строки по 2 кнопки
    const keyboard: any[] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      keyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply(questionText, Markup.inlineKeyboard(keyboard));
  }

  /**
   * Обработка ответа клиента
   */
  bot.action(/^answer_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId) return;

      // Извлекаем значение ответа из callback_data
      const match = ctx.match;
      const answer = match ? match[1] : null;
      if (!answer) return;

      // Парсим ответ (может быть число или строка)
      const answerValue = isNaN(Number(answer)) ? answer : Number(answer);

      // Обрабатываем ответ
      const result = await batchService.handleAnswer(userId, answerValue);

      // Проверяем что дальше
      if (result.batch_completed) {
        // Весь батч завершен
        await ctx.reply(ClientTexts.allCompleted);
        
        // Генерируем отчет
        const progress = await batchService.getProgress(userId);
        if (progress) {
          try {
            await reportGenerator.generateBatchReport(progress.session_id);
            
            // Уведомляем администратора
            await notifyAdminAboutCompletion(ctx, progress.session_id);
          } catch (error) {
            console.error('Ошибка генерации отчета:', error);
          }
        }
      } else if (result.questionnaire_completed) {
        // Опросник завершен, переходим к следующему
        const progress = await batchService.getProgress(userId);
        if (progress) {
          const nextQuestionnaire = progress.questionnaires[result.current_questionnaire_index];
          if (nextQuestionnaire) {
            // result.current_questionnaire_index уже указывает на следующий опросник (инкремент на строке 304 BatchService)
            // Поэтому для отображения завершенного нужно вычесть 1
            // А для отображения следующего используем как есть (без +1)
            const completedText = TextFormatter.format(ClientTexts.questionnaireCompleted, {
              current: result.current_questionnaire_index - 1, // Завершенный опросник
              total: result.total_questionnaires,
              next: result.current_questionnaire_index, // Следующий опросник (уже инкрементирован)
              nextTitle: nextQuestionnaire.title,
            });
            await ctx.reply(completedText);
          }
        }
        
        // Отправляем первый вопрос следующего опросника
        await sendQuestion(ctx, userId);
      } else {
        // Продолжаем текущий опросник
        await sendQuestion(ctx, userId);
      }
    } catch (error) {
      console.error('Ошибка обработки ответа:', error);
      await ctx.reply(ClientTexts.unexpectedError);
    }
  });

  /**
   * Уведомить администратора о завершении батча
   */
  async function notifyAdminAboutCompletion(ctx: Context, sessionId: string) {
    try {
      const session = await sessionRepo.findById(sessionId);
      if (!session || !session.completed_at) return;

      const batch = await batchRepo.findByIdWithQuestionnaires(session.batch_id);
      if (!batch) return;

      const durationMs = session.completed_at.getTime() - session.created_at.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      const notificationText = TextFormatter.format(AdminTexts.batchCompleted, {
        completedAt: TextFormatter.formatDate(session.completed_at),
        count: batch.questionnaires.length,
        duration: durationMinutes,
      });

      await ctx.telegram.sendMessage(
        config.admin_telegram_id,
        notificationText,
        Markup.inlineKeyboard([
          [Markup.button.callback(
            AdminTexts.batchCompletedButtons.viewReport,
            `admin_view_report_${sessionId}`
          )],
          [
            Markup.button.callback(
              AdminTexts.batchCompletedButtons.exportJSON,
              `admin_export_json_${sessionId}`
            ),
            Markup.button.callback(
              AdminTexts.batchCompletedButtons.exportCSV,
              `admin_export_csv_${sessionId}`
            ),
          ],
        ])
      );
    } catch (error) {
      console.error('Ошибка уведомления администратора:', error);
    }
  }

  /**
   * Админ: создать опрос
   */
  bot.action('admin_create_batch', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId || !isAdmin(userId)) {
        await ctx.reply('❌ Недостаточно прав');
        return;
      }

      // Очищаем предыдущее состояние (если было)
      batchCreationState.delete(userId);

      // Загружаем все опросники заново из базы
      const questionnaires = await questionnaireRepo.findAll();
      
      if (questionnaires.length === 0) {
        await ctx.reply(AdminTexts.createBatch.noQuestionnaires);
        return;
      }

      // Инициализируем состояние создания батча
      batchCreationState.set(userId, {
        selectedQuestionnaires: [],
        allQuestionnaires: questionnaires,
      });

      // Показываем список опросников
      await showQuestionnaireSelection(ctx, userId);
    } catch (error) {
      console.error('Ошибка создания опроса:', error);
      await ctx.reply('❌ Ошибка при создании опроса');
    }
  });

  /**
   * Показать выбор опросников
   */
  async function showQuestionnaireSelection(ctx: Context, userId: number) {
    const state = batchCreationState.get(userId);
    if (!state) return;

    const buttons = state.allQuestionnaires.map((q) => {
      const isSelected = state.selectedQuestionnaires.includes(q.id);
      const label = isSelected ? `✅ ${q.title}` : q.title;
      return [Markup.button.callback(label, `toggle_q_${q.id}`)];
    });

    // Добавляем кнопки действий
    buttons.push([
      Markup.button.callback(
        AdminTexts.createBatch.buttons.create,
        'admin_confirm_batch'
      ),
    ]);
    buttons.push([
      Markup.button.callback(
        AdminTexts.createBatch.buttons.cancel,
        'admin_cancel_batch'
      ),
    ]);

    await ctx.reply(AdminTexts.createBatch.selectQuestionnaires, Markup.inlineKeyboard(buttons));
  }

  /**
   * Переключение выбора опросника
   */
  bot.action(/^toggle_q_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId || !isAdmin(userId)) return;

      const match = ctx.match;
      const questionnaireId = match ? match[1] : null;
      if (!questionnaireId) return;

      const state = batchCreationState.get(userId);
      if (!state) return;

      // Переключаем выбор
      const index = state.selectedQuestionnaires.indexOf(questionnaireId);
      if (index > -1) {
        state.selectedQuestionnaires.splice(index, 1);
      } else {
        state.selectedQuestionnaires.push(questionnaireId);
      }

      // Обновляем отображение
      await showQuestionnaireSelection(ctx, userId);
    } catch (error) {
      console.error('Ошибка переключения опросника:', error);
    }
  });

  /**
   * Подтверждение создания батча
   */
  bot.action('admin_confirm_batch', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId || !isAdmin(userId)) return;

      const state = batchCreationState.get(userId);
      if (!state) return;

      if (state.selectedQuestionnaires.length < 2 || state.selectedQuestionnaires.length > 10) {
        await ctx.reply('❌ Выберите от 2 до 10 опросников');
        return;
      }

      // Создаем батч
      const batchId = await batchService.createBatch(
        'Батч ' + new Date().toLocaleDateString('ru-RU'),
        state.selectedQuestionnaires,
        userId
      );

      // Создаем сессию
      const session = await batchService.createSession(batchId, 48);

      // Получаем информацию о батче
      const batch = await batchRepo.findByIdWithQuestionnaires(batchId);
      if (!batch) {
        await ctx.reply('❌ Ошибка получения информации о батче');
        return;
      }

      // Формируем ссылку
      const botUsername = ctx.botInfo?.username || 'neiropsy_bot';
      const link = `https://t.me/${botUsername}?start=${session.token}`;

      // Отправляем результат
      const resultText = TextFormatter.format(AdminTexts.batchCreated, {
        count: batch.questionnaires.length,
        title: batch.title,
        link: link,
        expiresAt: TextFormatter.formatDate(session.expiresAt),
        totalQuestions: batch.total_questions,
      });

      await ctx.reply(resultText);

      // Очищаем состояние
      batchCreationState.delete(userId);
    } catch (error) {
      console.error('Ошибка подтверждения батча:', error);
      await ctx.reply('❌ Ошибка при создании батча');
    }
  });

  /**
   * Отмена создания батча
   */
  bot.action('admin_cancel_batch', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId || !isAdmin(userId)) return;

      batchCreationState.delete(userId);
      
      // Переход в главное меню после отмены (с сообщением об отмене)
      await ctx.reply(AdminTexts.batchCancelled);
      await showAdminMainMenu(ctx);
    } catch (error) {
      console.error('Ошибка отмены батча:', error);
      await ctx.reply('❌ Ошибка при отмене создания опроса');
    }
  });

  /**
   * Админ: просмотр завершенных опросов
   */
  bot.action('admin_view_batches', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId || !isAdmin(userId)) return;

      const completedSessions = await sessionRepo.findCompletedByAdmin(userId, 10);
      
      if (completedSessions.length === 0) {
        await ctx.reply('📭 У вас пока нет завершенных опросов.');
        return;
      }

      // Формируем список с кнопками
      const buttons = completedSessions.map((session) => [
        Markup.button.callback(
          `📊 ${session.batch_title} (${TextFormatter.formatDate(session.completed_at || session.created_at)})`,
          `admin_view_report_${session.id}`
        ),
      ]);

      buttons.push([Markup.button.callback('◀️ Назад', 'admin_back_to_menu')]);

      await ctx.reply(
        `📊 Завершенные опросы (${completedSessions.length}):\n\nВыберите опрос для просмотра отчета:`,
        Markup.inlineKeyboard(buttons)
      );
    } catch (error) {
      console.error('Ошибка просмотра опросов:', error);
      await ctx.reply('❌ Ошибка при получении списка опросов');
    }
  });

  /**
   * Админ: возврат в главное меню
   */
  bot.action('admin_back_to_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showAdminMainMenu(ctx);
    } catch (error) {
      console.error('Ошибка возврата в меню:', error);
    }
  });

  /**
   * Админ: просмотр отчета
   */
  bot.action(/^admin_view_report_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const match = ctx.match;
      const sessionId = match ? match[1] : null;
      if (!sessionId) return;

      // Проверяем наличие отчета, если нет - генерируем
      let report = await reportGenerator.getReportBySessionId(sessionId);
      
      if (!report) {
        // Проверяем, завершена ли сессия
        const session = await sessionRepo.findById(sessionId);
        if (!session) {
          await ctx.reply('❌ Сессия не найдена');
          return;
        }
        
        if (!session.completed) {
          await ctx.reply('❌ Сессия еще не завершена');
          return;
        }
        
        // Генерируем отчет
        await ctx.reply('⏳ Генерирую отчет...');
        try {
          await reportGenerator.generateBatchReport(sessionId);
          report = await reportGenerator.getReportBySessionId(sessionId);
          
          if (!report) {
            await ctx.reply('❌ Не удалось сгенерировать отчет');
            return;
          }
        } catch (error) {
          console.error('Ошибка генерации отчета:', error);
          await ctx.reply('❌ Ошибка при генерации отчета. Попробуйте позже.');
          return;
        }
      }

      // Отправляем отчет (может быть длинным, разбиваем на части если нужно)
      const reportText = report.summary_text;
      const maxLength = 4096; // Максимальная длина сообщения Telegram
      
      if (reportText.length > maxLength) {
        // Разбиваем на части
        for (let i = 0; i < reportText.length; i += maxLength) {
          const chunk = reportText.slice(i, i + maxLength);
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(reportText);
      }

      // Добавляем кнопки для экспорта и детального просмотра
      const apiBaseUrl = process.env.API_URL || 'http://localhost:8088';
      const buttons: any[] = [
        [Markup.button.callback('📋 Ответы на вопросы', `admin_view_details_${sessionId}`)],
      ];

      // Добавляем кнопки экспорта только если URL не localhost
      if (apiBaseUrl && !apiBaseUrl.includes('localhost') && !apiBaseUrl.includes('127.0.0.1')) {
        buttons.push([
          Markup.button.url(
            '📄 JSON',
            `${apiBaseUrl}/exports/batch-report/${sessionId}.json`
          ),
          Markup.button.url(
            '📊 CSV',
            `${apiBaseUrl}/exports/batch-report/${sessionId}.csv`
          ),
        ]);
      } else {
        // Если localhost, отправляем ссылки в тексте
        buttons.push([
          Markup.button.callback('📄 Получить JSON', `admin_get_json_${sessionId}`),
          Markup.button.callback('📊 Получить CSV', `admin_get_csv_${sessionId}`),
        ]);
      }

      buttons.push([Markup.button.callback('◀️ Назад к списку', 'admin_view_batches')]);

      await ctx.reply(
        '💾 Дополнительные действия:',
        Markup.inlineKeyboard(buttons)
      );
    } catch (error) {
      console.error('Ошибка просмотра отчета:', error);
      await ctx.reply('❌ Ошибка при получении отчета');
    }
  });

  /**
   * Админ: просмотр детальных ответов
   */
  bot.action(/^admin_view_details_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const match = ctx.match;
      const sessionId = match ? match[1] : null;
      if (!sessionId) return;

      // Получаем все ответы для сессии
      const batchResponses = await batchResponseRepo.findBySessionId(sessionId);
      
      if (batchResponses.length === 0) {
        await ctx.reply('❌ Ответы не найдены');
        return;
      }

      // Формируем детальный отчет по каждому опроснику
      for (const batchResponse of batchResponses) {
        // Получаем response с ответами
        const response = await responseRepo.findById(batchResponse.response_id);
        if (!response) continue;

        // Получаем опросник для текстов вопросов
        const questionnaire = await questionnaireRepo.findById(batchResponse.questionnaire_id);
        if (!questionnaire) continue;

        // Формируем текст с детальными ответами
        let detailsText = `📋 ${questionnaire.title}\n`;
        detailsText += `Порядок: ${batchResponse.order_index}\n`;
        detailsText += `Дата: ${TextFormatter.formatDate(response.created_at)}\n\n`;
        detailsText += '📝 Ответы на вопросы:\n\n';

        // Проходим по всем вопросам опросника
        for (const question of questionnaire.questions_json) {
          const answer = response.answers_json[question.id];
          
          if (answer) {
            detailsText += `❓ ${question.text}\n`;
            
            // Форматируем ответ в зависимости от типа
            if (Array.isArray(answer.value)) {
              // Множественный выбор
              const selectedOptions = answer.value
                .map((val: string | number) => {
                  const option = question.options.find(opt => opt.value === val);
                  return option ? option.label : String(val);
                })
                .join(', ');
              detailsText += `   ✅ ${selectedOptions}\n\n`;
            } else {
              // Одиночный выбор или шкала
              const option = question.options.find(opt => opt.value === answer.value);
              const answerLabel = option ? option.label : String(answer.value);
              detailsText += `   ✅ ${answerLabel}\n\n`;
            }
          } else {
            // Ответ не найден (не должно быть, но на всякий случай)
            detailsText += `❓ ${question.text}\n`;
            detailsText += `   ⚠️ Ответ не найден\n\n`;
          }
        }

        // Добавляем баллы если есть
        if (response.score_json) {
          detailsText += '\n📊 Результаты:\n';
          detailsText += `Общий балл: ${response.score_json.overall_score}`;
          if (response.score_json.overall_label) {
            detailsText += ` (${response.score_json.overall_label})`;
          }
          detailsText += '\n';
          
          if (response.score_json.scales && response.score_json.scales.length > 0) {
            detailsText += '\nШкалы:\n';
            for (const scale of response.score_json.scales) {
              detailsText += `• ${scale.scale_label}: ${scale.score}`;
              if (scale.level) {
                detailsText += ` (${scale.level})`;
              }
              detailsText += '\n';
            }
          }
        }

        // Отправляем детали (разбиваем на части если нужно)
        const maxLength = 4096;
        if (detailsText.length > maxLength) {
          for (let i = 0; i < detailsText.length; i += maxLength) {
            const chunk = detailsText.slice(i, i + maxLength);
            await ctx.reply(chunk);
          }
        } else {
          await ctx.reply(detailsText);
        }
      }

      // Кнопка возврата
      await ctx.reply(
        '◀️ Вернуться к отчету:',
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Назад к отчету', `admin_view_report_${sessionId}`)],
        ])
      );
    } catch (error) {
      console.error('Ошибка просмотра деталей:', error);
      await ctx.reply('❌ Ошибка при получении детальных ответов');
    }
  });

  /**
   * Админ: получить JSON экспорт
   */
  bot.action(/^admin_get_json_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const match = ctx.match;
      const sessionId = match ? match[1] : null;
      if (!sessionId) return;

      const apiBaseUrl = process.env.API_URL || 'http://localhost:8088';
      const url = `${apiBaseUrl}/exports/batch-report/${sessionId}.json`;
      
      await ctx.reply(
        `📄 Ссылка для скачивания JSON:\n\n${url}\n\nСкопируйте ссылку и откройте в браузере.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Назад к отчету', `admin_view_report_${sessionId}`)],
        ])
      );
    } catch (error) {
      console.error('Ошибка получения JSON ссылки:', error);
      await ctx.reply('❌ Ошибка при получении ссылки');
    }
  });

  /**
   * Админ: получить CSV экспорт
   */
  bot.action(/^admin_get_csv_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const match = ctx.match;
      const sessionId = match ? match[1] : null;
      if (!sessionId) return;

      const apiBaseUrl = process.env.API_URL || 'http://localhost:8088';
      const url = `${apiBaseUrl}/exports/batch-report/${sessionId}.csv`;
      
      await ctx.reply(
        `📊 Ссылка для скачивания CSV:\n\n${url}\n\nСкопируйте ссылку и откройте в браузере.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Назад к отчету', `admin_view_report_${sessionId}`)],
        ])
      );
    } catch (error) {
      console.error('Ошибка получения CSV ссылки:', error);
      await ctx.reply('❌ Ошибка при получении ссылки');
    }
  });

  /**
   * Админ: просмотр списка опросников
   */
  bot.action('admin_view_questionnaires', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId || !isAdmin(userId)) return;

      const questionnaires = await questionnaireRepo.findAll();
      
      if (questionnaires.length === 0) {
        await ctx.reply(
          AdminTexts.questionnairesList.empty,
          Markup.inlineKeyboard([
            [Markup.button.callback('◀️ Назад', 'admin_back_to_menu')],
          ])
        );
        return;
      }

      // Формируем список с кнопками
      const buttons = questionnaires.map((q) => [
        Markup.button.callback(
          `📋 ${q.title}`,
          `admin_view_questionnaire_${q.id}`
        ),
      ]);

      buttons.push([Markup.button.callback('◀️ Назад', 'admin_back_to_menu')]);

      await ctx.reply(
        `${AdminTexts.questionnairesList.title}\n\n${TextFormatter.format(AdminTexts.questionnairesList.count, { count: questionnaires.length })}\n\n${AdminTexts.questionnairesList.select}`,
        Markup.inlineKeyboard(buttons)
      );
    } catch (error) {
      console.error('Ошибка просмотра опросников:', error);
      await ctx.reply('❌ Ошибка при получении списка опросников');
    }
  });

  /**
   * Админ: просмотр деталей опросника
   */
  bot.action(/^admin_view_questionnaire_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const match = ctx.match;
      const questionnaireId = match ? match[1] : null;
      if (!questionnaireId) return;

      const userId = ctx.from?.id;
      if (!userId || !isAdmin(userId)) return;

      const questionnaire = await questionnaireRepo.findById(questionnaireId);
      
      if (!questionnaire) {
        await ctx.reply('❌ Опросник не найден');
        return;
      }

      // Формируем детальную информацию об опроснике
      let detailsText = `${TextFormatter.format(AdminTexts.questionnaireDetails.title, { title: questionnaire.title })}\n\n`;
      detailsText += `${TextFormatter.format(AdminTexts.questionnaireDetails.questionsCount, { count: questionnaire.questions_json.length })}\n\n`;

      // Добавляем информацию о вопросах
      detailsText += `${AdminTexts.questionnaireDetails.questionsTitle}\n`;
      for (let i = 0; i < questionnaire.questions_json.length; i++) {
        const question = questionnaire.questions_json[i];
        if (!question) continue;
        
        detailsText += `${TextFormatter.format(AdminTexts.questionnaireDetails.question, {
          num: i + 1,
          text: question.text,
        })}\n`;
        detailsText += `${TextFormatter.format(AdminTexts.questionnaireDetails.questionType, {
          type: question.type,
        })}\n`;
        
        if (question.options && question.options.length > 0) {
          detailsText += `${AdminTexts.questionnaireDetails.questionOptions}\n`;
          for (const option of question.options) {
            detailsText += `${TextFormatter.format(AdminTexts.questionnaireDetails.option, {
              label: option.label,
              value: option.value,
            })}\n`;
          }
        }
        detailsText += '\n';
      }

      // Добавляем информацию о шкалах оценки
      if (questionnaire.scoring_json && questionnaire.scoring_json.scales) {
        detailsText += `${AdminTexts.questionnaireDetails.scalesTitle}\n`;
        for (const scale of questionnaire.scoring_json.scales) {
          const questionIds = scale.questions.join(', ');
          detailsText += `${TextFormatter.format(AdminTexts.questionnaireDetails.scale, {
            label: scale.label,
            questions: questionIds,
          })}\n`;
        }
        detailsText += '\n';
      }

      // Добавляем информацию об общей оценке
      if (questionnaire.scoring_json && questionnaire.scoring_json.overall) {
        detailsText += `${AdminTexts.questionnaireDetails.overallTitle}\n`;
        detailsText += `${TextFormatter.format(AdminTexts.questionnaireDetails.overallStrategy, {
          strategy: questionnaire.scoring_json.overall.strategy || 'sum',
        })}\n`;
      }

      // Разбиваем длинные сообщения на части (Telegram ограничение 4096 символов)
      const maxLength = 4096;
      if (detailsText.length > maxLength) {
        // Разбиваем на части
        for (let i = 0; i < detailsText.length; i += maxLength) {
          const chunk = detailsText.slice(i, i + maxLength);
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(detailsText);
      }

      // Кнопка возврата
      await ctx.reply(
        AdminTexts.questionnaireDetails.back,
        Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Назад к списку', 'admin_view_questionnaires')],
          [Markup.button.callback('🏠 Главное меню', 'admin_back_to_menu')],
        ])
      );
    } catch (error) {
      console.error('Ошибка просмотра деталей опросника:', error);
      await ctx.reply('❌ Ошибка при получении деталей опросника');
    }
  });

  /**
   * Админ: помощь
   */
  bot.action('admin_help', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply(AdminTexts.help);
    } catch (error) {
      console.error('Ошибка показа помощи:', error);
    }
  });

  // Обработка ошибок
  bot.catch((err: any) => {
    console.error('Telegram bot error:', err);
  });

  return bot;
}

/**
 * Запустить бота (polling)
 */
export async function startBot(bot: Telegraf): Promise<void> {
  try {
    await bot.launch();
    console.log('✅ Telegram бот запущен');

    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('Ошибка запуска бота:', error);
    throw error;
  }
}

