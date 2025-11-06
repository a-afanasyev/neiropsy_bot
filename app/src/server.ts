import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Parser } from 'json2csv';
import { config } from './config';
import { getRepository } from './repo';
import { validateQuestionnaire, validateScoringConfig } from './schema';

const fastify = Fastify({
  logger: config.node_env === 'development',
});

// Enable CORS
fastify.register(cors, {
  origin: true,
});

const repo = getRepository();

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Create or update questionnaire
fastify.post('/questionnaires', async (request, reply) => {
  try {
    const body = request.body as any;

    const { questionnaire, scoring } = body;

    if (!questionnaire || !scoring) {
      return reply.status(400).send({
        error: 'Missing questionnaire or scoring in request body',
      });
    }

    // Validate questionnaire
    const qValidation = validateQuestionnaire(questionnaire);
    if (!qValidation.success) {
      return reply.status(400).send({
        error: 'Invalid questionnaire',
        details: qValidation.errors,
      });
    }

    // Validate scoring
    const sValidation = validateScoringConfig(scoring, qValidation.data);
    if (!sValidation.success) {
      return reply.status(400).send({
        error: 'Invalid scoring config',
        details: sValidation.errors,
      });
    }

    const result = await repo.createQuestionnaire(
      qValidation.data.title,
      qValidation.data.version,
      qValidation.data.language,
      qValidation.data.questions,
      sValidation.data
    );

    return reply.status(201).send({
      success: true,
      questionnaire: {
        id: result.id,
        title: result.title,
        version: result.version,
        language: result.language,
        questions_count: result.questions_json.length,
        created_at: result.created_at,
      },
    });
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Failed to create questionnaire',
      message: error.message,
    });
  }
});

// List questionnaires
fastify.get('/questionnaires', async (request, reply) => {
  try {
    const { active_only } = request.query as any;
    const activeOnly = active_only === 'true' || active_only === '1';

    const questionnaires = await repo.listQuestionnaires(activeOnly);

    return reply.send({
      success: true,
      count: questionnaires.length,
      questionnaires: questionnaires.map((q) => ({
        id: q.id,
        title: q.title,
        version: q.version,
        language: q.language,
        questions_count: q.questions_json.length,
        is_active: q.is_active,
        created_at: q.created_at,
      })),
    });
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Failed to list questionnaires',
      message: error.message,
    });
  }
});

// Get questionnaire by ID
fastify.get('/questionnaires/:id', async (request, reply) => {
  try {
    const { id } = request.params as any;
    const questionnaire = await repo.getQuestionnaire(id);

    if (!questionnaire) {
      return reply.status(404).send({
        error: 'Questionnaire not found',
      });
    }

    return reply.send({
      success: true,
      questionnaire,
    });
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Failed to get questionnaire',
      message: error.message,
    });
  }
});

// Create session (one-time link)
fastify.post('/sessions', async (request, reply) => {
  try {
    const body = request.body as any;
    const { questionnaire_id, telegram_user_id } = body;

    if (!questionnaire_id) {
      return reply.status(400).send({
        error: 'Missing questionnaire_id',
      });
    }

    // Check if questionnaire exists
    const questionnaire = await repo.getQuestionnaire(questionnaire_id);
    if (!questionnaire) {
      return reply.status(404).send({
        error: 'Questionnaire not found',
      });
    }

    // Создаем сессию с опциональным telegram_user_id для readable_id
    const session = await repo.createSession(
      questionnaire_id, 
      config.session_expiry_hours,
      telegram_user_id // Опциональный параметр
    );

    const link = `${config.public_bot_link}?start=${session.token}`;

    return reply.status(201).send({
      success: true,
      link,
      token: session.token,
      readable_id: session.readable_id || null, // Добавляем readable_id в ответ
      expires_at: session.expires_at.toISOString(),
    });
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Failed to create session',
      message: error.message,
    });
  }
});

// List responses
fastify.get('/responses', async (request, reply) => {
  try {
    const { questionnaire_id, limit = '100', offset = '0' } = request.query as any;

    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    if (isNaN(limitNum) || isNaN(offsetNum)) {
      return reply.status(400).send({
        error: 'Invalid limit or offset',
      });
    }

    const responses = await repo.listResponses(questionnaire_id, limitNum, offsetNum);

    return reply.send({
      success: true,
      count: responses.length,
      responses,
    });
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Failed to list responses',
      message: error.message,
    });
  }
});

// Get response by ID
fastify.get('/responses/:id', async (request, reply) => {
  try {
    const { id } = request.params as any;
    const response = await repo.getResponse(id);

    if (!response) {
      return reply.status(404).send({
        error: 'Response not found',
      });
    }

    return reply.send({
      success: true,
      response,
    });
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Failed to get response',
      message: error.message,
    });
  }
});

// Export responses as CSV
fastify.get('/exports/responses.csv', async (request, reply) => {
  try {
    const { questionnaire_id } = request.query as any;

    const responses = await repo.getResponsesForExport(questionnaire_id);

    if (responses.length === 0) {
      return reply.status(404).send({
        error: 'No responses found',
      });
    }

    // Flatten the data for CSV
    const flattenedData = responses.map((r) => {
      // Используем Record<string, any> для динамических свойств
      const base: Record<string, any> = {
        id: r.id,
        questionnaire_title: r.questionnaire_title,
        questionnaire_version: r.questionnaire_version,
        started_at: r.started_at,
        submitted_at: r.submitted_at,
        status: r.status,
        summary: r.summary_text || '',
      };

      // Добавляем общий балл если есть
      if (r.score_json && r.score_json.overall) {
        base['overall_score'] = r.score_json.overall.score;
        base['overall_label'] = r.score_json.overall.label;
      }

      // Добавляем баллы по шкалам
      if (r.score_json && r.score_json.scales) {
        r.score_json.scales.forEach((scale: any) => {
          base[`scale_${scale.id}_score`] = scale.score;
          base[`scale_${scale.id}_level`] = scale.level;
        });
      }

      // Добавляем флаги
      if (r.score_json && r.score_json.flags) {
        base['flags'] = r.score_json.flags.join('; ');
      }

      // Добавляем ответы
      if (r.answers_json) {
        Object.entries(r.answers_json).forEach(([key, value]) => {
          base[`answer_${key}`] = Array.isArray(value) ? value.join(', ') : String(value);
        });
      }

      return base;
    });

    const parser = new Parser();
    const csv = parser.parse(flattenedData);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="responses_${Date.now()}.csv"`);

    return reply.send('\uFEFF' + csv); // Add BOM for Excel compatibility
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Failed to export responses',
      message: error.message,
    });
  }
});

// Export responses as JSON
fastify.get('/exports/responses.json', async (request, reply) => {
  try {
    const { questionnaire_id } = request.query as any;

    const responses = await repo.getResponsesForExport(questionnaire_id);

    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="responses_${Date.now()}.json"`);

    return reply.send({
      success: true,
      count: responses.length,
      exported_at: new Date().toISOString(),
      responses,
    });
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Failed to export responses',
      message: error.message,
    });
  }
});

// Cleanup expired sessions (can be called manually or via cron)
fastify.post('/admin/cleanup-sessions', async (_, reply) => {
  try {
    const count = await repo.cleanupExpiredSessions();
    return reply.send({
      success: true,
      cleaned_sessions: count,
    });
  } catch (error: any) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: 'Failed to cleanup sessions',
      message: error.message,
    });
  }
});

export async function startServer() {
  try {
    await fastify.listen({
      port: config.port,
      host: '0.0.0.0',
    });
    console.log(`Server listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

export { fastify };
