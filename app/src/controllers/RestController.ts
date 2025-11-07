/**
 * REST API Controller
 * Все HTTP эндпоинты для управления батчами и получения отчетов
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Parser } from 'json2csv';
import {
  batchRepo,
  sessionRepo,
  questionnaireRepo,
  batchResponseRepo,
  reportRepo,
} from '../db/repository';
import { config } from '../config';
import {
  ApiSuccessResponse,
  ApiErrorResponse,
  ErrorCode,
  CreateBatchRequest,
  CreateBatchResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  SessionStatusResponse,
  UploadQuestionnaireRequest,
  BatchWithQuestionnaires,
  DetailedBatchReport,
} from '../types';

/**
 * Создать маршрутизатор с API эндпоинтами
 */
export function createApiRouter(): Router {
  const router = Router();

  // ======================
  // ЭНДПОИНТЫ ДЛЯ БАТЧЕЙ
  // ======================

  /**
   * POST /batches - создание нового батча опросников
   */
  router.post('/batches', async (req: Request, res: Response) => {
    try {
      const body = req.body as CreateBatchRequest;

      // Валидация
      if (!body.title || body.title.length === 0 || body.title.length > 500) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.INVALID_BATCH_DATA,
            message: 'Название батча должно быть от 1 до 500 символов',
          },
        };
        return res.status(400).json(errorResponse);
      }

      if (
        !body.questionnaire_ids ||
        !Array.isArray(body.questionnaire_ids) ||
        body.questionnaire_ids.length < 2 ||
        body.questionnaire_ids.length > 10
      ) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.INVALID_QUESTIONNAIRE_IDS,
            message: 'Батч должен содержать от 2 до 10 опросников',
          },
        };
        return res.status(400).json(errorResponse);
      }

      // Проверяем существование всех опросников
      const questionnaires = await questionnaireRepo.findByIds(body.questionnaire_ids);
      if (questionnaires.length !== body.questionnaire_ids.length) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.QUESTIONNAIRE_NOT_FOUND,
            message: 'Один или несколько опросников не найдены',
          },
        };
        return res.status(404).json(errorResponse);
      }

      // Создаем батч
      const batch = await batchRepo.create(
        body.title,
        body.created_by_telegram_id,
        body.questionnaire_ids
      );

      // Формируем ответ
      const responseData: CreateBatchResponse = {
        batch_id: batch.id,
        title: batch.title,
        description: body.description,
        questionnaires_count: body.questionnaire_ids.length,
        created_at: batch.created_at.toISOString(),
      };

      const successResponse: ApiSuccessResponse<CreateBatchResponse> = {
        success: true,
        data: responseData,
      };

      return res.status(201).json(successResponse);
    } catch (error) {
      console.error('Ошибка при создании батча:', error);
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Не удалось создать батч',
        },
      };
      return res.status(500).json(errorResponse);
    }
  });

  /**
   * GET /batches/:batch_id - получение информации о батче
   */
  router.get('/batches/:batch_id', async (req: Request, res: Response) => {
    try {
      const { batch_id } = req.params;
      if (!batch_id) {
        return res.status(400).json({
          success: false,
          error: { code: ErrorCode.INVALID_BATCH_DATA, message: 'batch_id обязателен' }
        });
      }

      const batch = await batchRepo.findByIdWithQuestionnaires(batch_id);

      if (!batch) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.BATCH_NOT_FOUND,
            message: 'Батч не найден',
          },
        };
        return res.status(404).json(errorResponse);
      }

      const successResponse: ApiSuccessResponse<BatchWithQuestionnaires> = {
        success: true,
        data: batch,
      };

      return res.json(successResponse);
    } catch (error) {
      console.error('Ошибка при получении батча:', error);
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Не удалось получить информацию о батче',
        },
      };
      return res.status(500).json(errorResponse);
    }
  });

  // ======================
  // ЭНДПОИНТЫ ДЛЯ СЕССИЙ
  // ======================

  /**
   * POST /batch-sessions - создание сессии для батча (генерация ссылки)
   */
  router.post('/batch-sessions', async (req: Request, res: Response) => {
    try {
      const body = req.body as CreateSessionRequest;

      // Валидация
      if (!body.batch_id) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.INVALID_BATCH_DATA,
            message: 'batch_id обязателен',
          },
        };
        return res.status(400).json(errorResponse);
      }

      // Проверяем существование батча
      const batch = await batchRepo.findByIdWithQuestionnaires(body.batch_id);
      if (!batch) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.BATCH_NOT_FOUND,
            message: 'Батч не найден',
          },
        };
        return res.status(404).json(errorResponse);
      }

      // Проверяем активность батча
      if (!batch.is_active) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.BATCH_INACTIVE,
            message: 'Батч неактивен, нельзя создать новую сессию',
          },
        };
        return res.status(409).json(errorResponse);
      }

      // Валидация expiry_hours
      const expiryHours = body.expiry_hours || 48;
      if (expiryHours <= 0 || expiryHours > 168) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.INVALID_EXPIRY_HOURS,
            message: 'expiry_hours должен быть от 1 до 168 (7 дней)',
          },
        };
        return res.status(400).json(errorResponse);
      }

      // Генерируем уникальный токен
      const token = `batch_${uuidv4().replace(/-/g, '')}`;

      // Создаем сессию
      const session = await sessionRepo.create(body.batch_id, token, expiryHours);

      // Формируем ссылку для Telegram
      const botUsername = 'neiropsy_bot'; // TODO: получать из конфигурации
      const link = `https://t.me/${botUsername}?start=${token}`;

      // Формируем ответ
      const responseData: CreateSessionResponse = {
        session_id: session.id,
        token: session.token,
        link: link,
        batch_title: batch.title,
        questionnaires_count: batch.questionnaires.length,
        total_questions: batch.total_questions,
        expires_at: session.expires_at.toISOString(),
      };

      const successResponse: ApiSuccessResponse<CreateSessionResponse> = {
        success: true,
        data: responseData,
      };

      return res.status(201).json(successResponse);
    } catch (error) {
      console.error('Ошибка при создании сессии:', error);
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Не удалось создать сессию',
        },
      };
      return res.status(500).json(errorResponse);
    }
  });

  /**
   * GET /batch-sessions/:token - проверка статуса батч-сессии
   */
  router.get('/batch-sessions/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({
          success: false,
          error: { code: ErrorCode.INVALID_BATCH_DATA, message: 'token обязателен' }
        });
      }

      const session = await sessionRepo.findByToken(token);

      if (!session) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.SESSION_NOT_FOUND,
            message: 'Сессия не найдена',
          },
        };
        return res.status(404).json(errorResponse);
      }

      // Проверяем истечение срока
      const isExpired = new Date() > session.expires_at;
      if (isExpired && !session.completed) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.SESSION_EXPIRED,
            message: 'Срок действия сессии истек',
          },
        };
        return res.status(410).json(errorResponse);
      }

      // Получаем информацию о батче
      const batch = await batchRepo.findByIdWithQuestionnaires(session.batch_id);
      if (!batch) {
        throw new Error('Батч не найден для сессии');
      }

      // Получаем прогресс
      const completedCount = await batchResponseRepo.getCompletedCount(session.id);
      const totalCount = batch.questionnaires.length;
      const percentage = Math.round((completedCount / totalCount) * 100);

      // Формируем ответ
      const responseData: SessionStatusResponse = {
        session_id: session.id,
        batch_id: session.batch_id,
        batch_title: batch.title,
        completed: session.completed,
        expires_at: session.expires_at.toISOString(),
        is_expired: isExpired,
        progress: {
          total_questionnaires: totalCount,
          completed_questionnaires: completedCount,
          percentage: percentage,
        },
      };

      const successResponse: ApiSuccessResponse<SessionStatusResponse> = {
        success: true,
        data: responseData,
      };

      return res.json(successResponse);
    } catch (error) {
      console.error('Ошибка при получении статуса сессии:', error);
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Не удалось получить статус сессии',
        },
      };
      return res.status(500).json(errorResponse);
    }
  });

  // ======================
  // ЭНДПОИНТЫ ДЛЯ ОТЧЕТОВ
  // ======================

  /**
   * GET /batch-reports/:batch_session_id - получение агрегированного отчета
   */
  router.get('/batch-reports/:batch_session_id', async (req: Request, res: Response) => {
    try {
      const { batch_session_id } = req.params;
      if (!batch_session_id) {
        return res.status(400).json({
          success: false,
          error: { code: ErrorCode.INVALID_BATCH_DATA, message: 'batch_session_id обязателен' }
        });
      }
      // TODO: если req.query.include_responses === 'true', добавить детальные ответы

      // Получаем сессию
      const session = await sessionRepo.findById(batch_session_id);
      if (!session) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.SESSION_NOT_FOUND,
            message: 'Сессия не найдена',
          },
        };
        return res.status(404).json(errorResponse);
      }

      // Проверяем завершенность
      if (!session.completed) {
        const completedCount = await batchResponseRepo.getCompletedCount(session.id);
        const batchWithQ = await batchRepo.findByIdWithQuestionnaires(session.batch_id);
        const totalCount = batchWithQ?.questionnaires.length || 0;

        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.BATCH_NOT_COMPLETED,
            message: `Батч не завершен. Пройдено ${completedCount} из ${totalCount} опросников`,
          },
        };
        return res.status(409).json(errorResponse);
      }

      // Получаем отчет
      const report = await reportRepo.findBySessionId(batch_session_id);
      if (!report) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.REPORT_NOT_FOUND,
            message: 'Отчет не найден',
          },
        };
        return res.status(404).json(errorResponse);
      }

      // Получаем дополнительную информацию
      const batch = await batchRepo.findById(session.batch_id);
      if (!batch) {
        throw new Error('Батч не найден');
      }

      // Рассчитываем длительность
      const durationMs = session.completed_at
        ? session.completed_at.getTime() - session.created_at.getTime()
        : 0;
      const durationMinutes = Math.round(durationMs / 60000);

      // Формируем детальный отчет
      const questionnaires = Object.values(report.aggregated_scores);

      const responseData: DetailedBatchReport = {
        ...report,
        batch_title: batch.title,
        completed_at: session.completed_at || new Date(),
        duration_minutes: durationMinutes,
        questionnaires: questionnaires,
      };

      // TODO: если includeResponses === true, добавить детальные ответы

      const successResponse: ApiSuccessResponse<DetailedBatchReport> = {
        success: true,
        data: responseData,
      };

      return res.json(successResponse);
    } catch (error) {
      console.error('Ошибка при получении отчета:', error);
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Не удалось получить отчет',
        },
      };
      return res.status(500).json(errorResponse);
    }
  });

  /**
   * GET /exports/batch-report/:batch_session_id.json - экспорт отчета в JSON
   */
  router.get(
    '/exports/batch-report/:batch_session_id.json',
    async (req: Request, res: Response) => {
      try {
        const { batch_session_id } = req.params;
        if (!batch_session_id) {
          return res.status(400).json({
            success: false,
            error: { code: ErrorCode.INVALID_BATCH_DATA, message: 'batch_session_id обязателен' }
          });
        }

        // Получаем отчет (повторное использование логики)
        const session = await sessionRepo.findById(batch_session_id);
        if (!session || !session.completed) {
          return res.status(409).json({ error: 'Батч не завершен' });
        }

        const report = await reportRepo.findBySessionId(batch_session_id);
        if (!report) {
          return res.status(404).json({ error: 'Отчет не найден' });
        }

        const batch = await batchRepo.findById(session.batch_id);

        // Формируем JSON для экспорта
        const exportData = {
          metadata: {
            export_date: new Date().toISOString(),
            batch_session_id: batch_session_id,
            format_version: '1.0',
          },
          batch_info: {
            id: batch?.id,
            title: batch?.title,
            created_at: batch?.created_at.toISOString(),
          },
          session_info: {
            id: session.id,
            started_at: session.created_at.toISOString(),
            completed_at: session.completed_at?.toISOString(),
          },
          questionnaires_results: report.aggregated_scores,
          aggregated_summary: {
            summary_text: report.summary_text,
            flags: report.flags_json,
          },
        };

        // Устанавливаем заголовки для скачивания
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="batch-report-${batch_session_id}.json"`
        );

        return res.json(exportData);
      } catch (error) {
        console.error('Ошибка при экспорте JSON:', error);
        return res.status(500).json({ error: 'Не удалось экспортировать отчет' });
      }
    }
  );

  /**
   * GET /exports/batch-report/:batch_session_id.csv - экспорт отчета в CSV
   */
  router.get(
    '/exports/batch-report/:batch_session_id.csv',
    async (req: Request, res: Response) => {
      try {
        const { batch_session_id } = req.params;
        if (!batch_session_id) {
          return res.status(400).json({
            success: false,
            error: { code: ErrorCode.INVALID_BATCH_DATA, message: 'batch_session_id обязателен' }
          });
        }
        
        const format = (req.query.format as string) || 'summary';

        const session = await sessionRepo.findById(batch_session_id);
        if (!session || !session.completed) {
          return res.status(409).send('Батч не завершен');
        }

        const report = await reportRepo.findBySessionId(batch_session_id);
        if (!report) {
          return res.status(404).send('Отчет не найден');
        }

        let csvData: any[] = [];

        if (format === 'summary') {
          // Сводный формат
          const questionnaires = Object.values(report.aggregated_scores);
          questionnaires.forEach((q: any) => {
            csvData.push({
              batch_session_id: batch_session_id,
              completed_at: session.completed_at?.toISOString(),
              questionnaire_order: q.order,
              questionnaire_title: q.title,
              overall_score: q.overall_score,
              overall_label: q.overall_label,
            });

            // Добавляем строки для каждой шкалы
            if (q.scales && Array.isArray(q.scales)) {
              q.scales.forEach((scale: any) => {
                csvData.push({
                  batch_session_id: batch_session_id,
                  completed_at: session.completed_at?.toISOString(),
                  questionnaire_order: q.order,
                  questionnaire_title: q.title,
                  overall_score: q.overall_score,
                  overall_label: q.overall_label,
                  scale_id: scale.scale_id,
                  scale_label: scale.scale_label,
                  scale_score: scale.score,
                  scale_level: scale.level,
                });
              });
            }
          });
        } else if (format === 'detailed') {
          // Детальный формат - TODO: реализовать с ответами на каждый вопрос
          csvData = [
            {
              batch_session_id: batch_session_id,
              message: 'Детальный формат пока не реализован',
            },
          ];
        }

        // Конвертируем в CSV
        const parser = new Parser();
        const csv = parser.parse(csvData);

        // Устанавливаем заголовки для скачивания
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="batch-report-${batch_session_id}.csv"`
        );

        return res.send(csv);
      } catch (error) {
        console.error('Ошибка при экспорте CSV:', error);
        return res.status(500).send('Не удалось экспортировать отчет');
      }
    }
  );

  // ======================
  // ЭНДПОИНТ ДЛЯ ЗАГРУЗКИ ОПРОСНИКОВ
  // ======================

  /**
   * POST /questionnaires - загрузка опросника с проверкой Telegram ID
   */
  router.post('/questionnaires', async (req: Request, res: Response) => {
    try {
      const body = req.body as UploadQuestionnaireRequest;

      // Проверка Telegram ID
      const telegramId = body.telegram_id || parseInt(req.header('X-Telegram-ID') || '0', 10);

      if (!telegramId || !config.admin_telegram_ids.includes(telegramId)) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: 'Недостаточно прав для загрузки опросника',
          },
        };
        return res.status(403).json(errorResponse);
      }

      // Валидация данных
      if (!body.questionnaire || !body.scoring) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.INVALID_BATCH_DATA,
            message: 'Необходимо предоставить questionnaire и scoring',
          },
        };
        return res.status(400).json(errorResponse);
      }

      const { title, questions } = body.questionnaire;
      if (!title || !questions || questions.length === 0) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.INVALID_BATCH_DATA,
            message: 'Опросник должен содержать title и questions',
          },
        };
        return res.status(400).json(errorResponse);
      }

      // Проверяем существование опросника с таким названием
      const existing = await questionnaireRepo.findByTitle(title);

      let questionnaire;
      if (existing) {
        // Обновляем существующий
        questionnaire = await questionnaireRepo.update(
          existing.id,
          title,
          questions,
          body.scoring
        );
      } else {
        // Создаем новый
        questionnaire = await questionnaireRepo.create(title, questions, body.scoring);
      }

      const successResponse: ApiSuccessResponse<{ id: string; title: string }> = {
        success: true,
        data: {
          id: questionnaire!.id,
          title: questionnaire!.title,
        },
      };

      return res.status(201).json(successResponse);
    } catch (error) {
      console.error('Ошибка при загрузке опросника:', error);
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Не удалось загрузить опросник',
        },
      };
      return res.status(500).json(errorResponse);
    }
  });

  return router;
}

