/**
 * Database Repository
 * CRUD операции для всех таблиц базы данных
 * Все методы используют prepared statements для безопасности
 */

import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { db } from './connection';
import {
  Questionnaire,
  QuestionnaireResponse,
  Batch,
  BatchSession,
  BatchResponse,
  BatchReport,
  BatchWithQuestionnaires,
  Question,
  ScoringRules,
  ScoreResult,
  Answer,
} from '../types';

/**
 * Repository для работы с опросниками
 */
export class QuestionnaireRepository {
  /**
   * Создать новый опросник
   */
  async create(
    title: string,
    questions: Question[],
    scoring: ScoringRules
  ): Promise<Questionnaire> {
    const id = uuidv4();
    const query = `
      INSERT INTO questionnaires (id, title, questions_json, scoring_json)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query<Questionnaire>(query, [
      id,
      title,
      JSON.stringify(questions),
      JSON.stringify(scoring),
    ]);

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить опросник по ID
   */
  async findById(id: string): Promise<Questionnaire | null> {
    const query = 'SELECT * FROM questionnaires WHERE id = $1';
    const result = await db.query<Questionnaire>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить опросник по названию
   */
  async findByTitle(title: string): Promise<Questionnaire | null> {
    const query = 'SELECT * FROM questionnaires WHERE title = $1';
    const result = await db.query<Questionnaire>(query, [title]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить все опросники
   */
  async findAll(): Promise<Questionnaire[]> {
    const query = 'SELECT * FROM questionnaires ORDER BY title';
    const result = await db.query<Questionnaire>(query);

    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Получить несколько опросников по ID
   */
  async findByIds(ids: string[]): Promise<Questionnaire[]> {
    if (ids.length === 0) {
      return [];
    }

    const query = 'SELECT * FROM questionnaires WHERE id = ANY($1::uuid[])';
    const result = await db.query<Questionnaire>(query, [ids]);

    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Обновить опросник
   */
  async update(
    id: string,
    title: string,
    questions: Question[],
    scoring: ScoringRules
  ): Promise<Questionnaire | null> {
    const query = `
      UPDATE questionnaires 
      SET title = $2, questions_json = $3, scoring_json = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query<Questionnaire>(query, [
      id,
      title,
      JSON.stringify(questions),
      JSON.stringify(scoring),
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Удалить опросник
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM questionnaires WHERE id = $1';
    const result = await db.query(query, [id]);

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Маппинг строки БД в объект Questionnaire
   */
  private mapRow(row: any): Questionnaire {
    return {
      id: row.id,
      title: row.title,
      questions_json: typeof row.questions_json === 'string' 
        ? JSON.parse(row.questions_json) 
        : row.questions_json,
      scoring_json: typeof row.scoring_json === 'string'
        ? JSON.parse(row.scoring_json)
        : row.scoring_json,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}

/**
 * Repository для работы с ответами на опросники
 */
export class ResponseRepository {
  /**
   * Создать новый ответ
   */
  async create(
    sessionId: string | null,
    answers: Record<string, Answer>,
    score: ScoreResult | null,
    summary: string | null
  ): Promise<QuestionnaireResponse> {
    const id = uuidv4();
    const query = `
      INSERT INTO responses (id, session_id, answers_json, score_json, summary_text)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query<QuestionnaireResponse>(query, [
      id,
      sessionId,
      JSON.stringify(answers),
      score ? JSON.stringify(score) : null,
      summary,
    ]);

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить ответ по ID
   */
  async findById(id: string): Promise<QuestionnaireResponse | null> {
    const query = 'SELECT * FROM responses WHERE id = $1';
    const result = await db.query<QuestionnaireResponse>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить все ответы по session_id
   */
  async findBySessionId(sessionId: string): Promise<QuestionnaireResponse[]> {
    const query = 'SELECT * FROM responses WHERE session_id = $1 ORDER BY created_at';
    const result = await db.query<QuestionnaireResponse>(query, [sessionId]);

    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Обновить score и summary
   */
  async updateScore(
    id: string,
    score: ScoreResult,
    summary: string
  ): Promise<QuestionnaireResponse | null> {
    const query = `
      UPDATE responses 
      SET score_json = $2, summary_text = $3
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query<QuestionnaireResponse>(query, [
      id,
      JSON.stringify(score),
      summary,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Маппинг строки БД в объект QuestionnaireResponse
   */
  private mapRow(row: any): QuestionnaireResponse {
    return {
      id: row.id,
      session_id: row.session_id,
      answers_json: typeof row.answers_json === 'string'
        ? JSON.parse(row.answers_json)
        : row.answers_json,
      score_json: row.score_json
        ? typeof row.score_json === 'string'
          ? JSON.parse(row.score_json)
          : row.score_json
        : undefined,
      summary_text: row.summary_text,
      created_at: new Date(row.created_at),
    };
  }
}

/**
 * Repository для работы с батчами
 */
export class BatchRepository {
  /**
   * Создать новый батч с опросниками (транзакция)
   */
  async create(
    title: string,
    telegramId: number,
    questionnaireIds: string[]
  ): Promise<Batch> {
    return await db.transaction(async (client: PoolClient) => {
      const batchId = uuidv4();

      // Создаем батч
      const batchQuery = `
        INSERT INTO questionnaire_batches (id, title, created_by_telegram_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const batchResult = await client.query<Batch>(batchQuery, [
        batchId,
        title,
        telegramId,
      ]);

      // Добавляем опросники в батч
      for (let i = 0; i < questionnaireIds.length; i++) {
        const questionnaireQuery = `
          INSERT INTO batch_questionnaires (batch_id, questionnaire_id, order_index)
          VALUES ($1, $2, $3)
        `;
        await client.query(questionnaireQuery, [batchId, questionnaireIds[i], i + 1]);
      }

      return this.mapBatchRow(batchResult.rows[0]);
    });
  }

  /**
   * Получить батч по ID
   */
  async findById(id: string): Promise<Batch | null> {
    const query = 'SELECT * FROM questionnaire_batches WHERE id = $1';
    const result = await db.query<Batch>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapBatchRow(result.rows[0]);
  }

  /**
   * Получить батч с опросниками
   */
  async findByIdWithQuestionnaires(id: string): Promise<BatchWithQuestionnaires | null> {
    const batchQuery = 'SELECT * FROM questionnaire_batches WHERE id = $1';
    const batchResult = await db.query<Batch>(batchQuery, [id]);

    if (batchResult.rows.length === 0) {
      return null;
    }

    const batch = this.mapBatchRow(batchResult.rows[0]);

    // Получаем опросники батча
    const questionnairesQuery = `
      SELECT 
        bq.order_index,
        q.id,
        q.title,
        jsonb_array_length(q.questions_json) as questions_count
      FROM batch_questionnaires bq
      JOIN questionnaires q ON bq.questionnaire_id = q.id
      WHERE bq.batch_id = $1
      ORDER BY bq.order_index
    `;
    const questionnairesResult = await db.query(questionnairesQuery, [id]);

    const questionnaires = questionnairesResult.rows.map((row: any) => ({
      order: row.order_index,
      id: row.id,
      title: row.title,
      questions_count: parseInt(row.questions_count, 10),
    }));

    const total_questions = questionnaires.reduce(
      (sum, q) => sum + q.questions_count,
      0
    );

    return {
      ...batch,
      questionnaires,
      total_questions,
    };
  }

  /**
   * Получить опросники батча в порядке следования
   */
  async getQuestionnaires(batchId: string): Promise<Questionnaire[]> {
    const query = `
      SELECT q.*
      FROM questionnaires q
      JOIN batch_questionnaires bq ON q.id = bq.questionnaire_id
      WHERE bq.batch_id = $1
      ORDER BY bq.order_index
    `;
    const result = await db.query<Questionnaire>(query, [batchId]);

    const questionnaireRepo = new QuestionnaireRepository();
    return result.rows.map((row) => questionnaireRepo['mapRow'](row));
  }

  /**
   * Обновить статус активности батча
   */
  async setActive(id: string, isActive: boolean): Promise<boolean> {
    const query = `
      UPDATE questionnaire_batches 
      SET is_active = $2, updated_at = NOW()
      WHERE id = $1
    `;
    const result = await db.query(query, [id, isActive]);

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Маппинг строки БД в объект Batch
   */
  private mapBatchRow(row: any): Batch {
    return {
      id: row.id,
      title: row.title,
      created_by_telegram_id: row.created_by_telegram_id,
      is_active: row.is_active,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}

/**
 * Repository для работы с сессиями батчей
 */
export class SessionRepository {
  /**
   * Создать новую сессию
   */
  async create(
    batchId: string,
    token: string,
    expiryHours: number = 48
  ): Promise<BatchSession> {
    const id = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    const query = `
      INSERT INTO batch_sessions (id, batch_id, token, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query<BatchSession>(query, [
      id,
      batchId,
      token,
      expiresAt,
    ]);

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить завершенные сессии для администратора
   */
  async findCompletedByAdmin(adminTelegramId: number, limit: number = 20): Promise<Array<BatchSession & { batch_title: string }>> {
    const query = `
      SELECT bs.*, qb.title as batch_title
      FROM batch_sessions bs
      JOIN questionnaire_batches qb ON qb.id = bs.batch_id
      WHERE qb.created_by_telegram_id = $1
        AND bs.completed = TRUE
      ORDER BY bs.completed_at DESC
      LIMIT $2
    `;
    
    const result = await db.query<any>(query, [adminTelegramId, limit]);
    
    return result.rows.map((row) => ({
      ...this.mapRow(row),
      batch_title: row.batch_title,
    }));
  }

  /**
   * Получить сессию по токену
   */
  async findByToken(token: string): Promise<BatchSession | null> {
    const query = 'SELECT * FROM batch_sessions WHERE token = $1';
    const result = await db.query<BatchSession>(query, [token]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить сессию по ID
   */
  async findById(id: string): Promise<BatchSession | null> {
    const query = 'SELECT * FROM batch_sessions WHERE id = $1';
    const result = await db.query<BatchSession>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Отметить сессию как завершенную
   */
  async markCompleted(id: string): Promise<BatchSession | null> {
    const query = `
      UPDATE batch_sessions 
      SET completed = TRUE, completed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query<BatchSession>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Проверить, истекла ли сессия
   */
  async isExpired(id: string): Promise<boolean> {
    const session = await this.findById(id);
    if (!session) {
      return true;
    }

    return new Date() > session.expires_at;
  }

  /**
   * Маппинг строки БД в объект BatchSession
   */
  private mapRow(row: any): BatchSession {
    return {
      id: row.id,
      batch_id: row.batch_id,
      token: row.token,
      expires_at: new Date(row.expires_at),
      completed: row.completed,
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      created_at: new Date(row.created_at),
    };
  }
}

/**
 * Repository для работы с batch_responses
 */
export class BatchResponseRepository {
  /**
   * Создать связь между сессией и ответом
   */
  async create(
    batchSessionId: string,
    questionnaireId: string,
    responseId: string,
    orderIndex: number
  ): Promise<BatchResponse> {
    const query = `
      INSERT INTO batch_responses (batch_session_id, questionnaire_id, response_id, order_index)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query<BatchResponse>(query, [
      batchSessionId,
      questionnaireId,
      responseId,
      orderIndex,
    ]);

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить все ответы для сессии
   */
  async findBySessionId(sessionId: string): Promise<BatchResponse[]> {
    const query = `
      SELECT * FROM batch_responses 
      WHERE batch_session_id = $1 
      ORDER BY order_index
    `;
    const result = await db.query<BatchResponse>(query, [sessionId]);

    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Получить количество завершенных опросников в сессии
   */
  async getCompletedCount(sessionId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM batch_responses 
      WHERE batch_session_id = $1
    `;
    const result = await db.query<{ count: string }>(query, [sessionId]);

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Маппинг строки БД в объект BatchResponse
   */
  private mapRow(row: any): BatchResponse {
    return {
      id: row.id,
      batch_session_id: row.batch_session_id,
      questionnaire_id: row.questionnaire_id,
      response_id: row.response_id,
      order_index: row.order_index,
      created_at: new Date(row.created_at),
    };
  }
}

/**
 * Repository для работы с отчетами
 */
export class ReportRepository {
  /**
   * Создать отчет
   */
  async create(
    batchSessionId: string,
    summaryText: string,
    aggregatedScores: any,
    flags: string[]
  ): Promise<BatchReport> {
    const id = uuidv4();
    const query = `
      INSERT INTO batch_reports (id, batch_session_id, summary_text, aggregated_scores, flags_json)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query<BatchReport>(query, [
      id,
      batchSessionId,
      summaryText,
      JSON.stringify(aggregatedScores),
      JSON.stringify(flags),
    ]);

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить отчет по session_id
   */
  async findBySessionId(sessionId: string): Promise<BatchReport | null> {
    const query = 'SELECT * FROM batch_reports WHERE batch_session_id = $1';
    const result = await db.query<BatchReport>(query, [sessionId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Получить отчет по ID
   */
  async findById(id: string): Promise<BatchReport | null> {
    const query = 'SELECT * FROM batch_reports WHERE id = $1';
    const result = await db.query<BatchReport>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Маппинг строки БД в объект BatchReport
   */
  private mapRow(row: any): BatchReport {
    return {
      id: row.id,
      batch_session_id: row.batch_session_id,
      summary_text: row.summary_text,
      aggregated_scores: typeof row.aggregated_scores === 'string'
        ? JSON.parse(row.aggregated_scores)
        : row.aggregated_scores,
      flags_json: typeof row.flags_json === 'string'
        ? JSON.parse(row.flags_json)
        : row.flags_json || [],
      created_at: new Date(row.created_at),
    };
  }
}

// Экспортируем единственные экземпляры repository
export const questionnaireRepo = new QuestionnaireRepository();
export const responseRepo = new ResponseRepository();
export const batchRepo = new BatchRepository();
export const sessionRepo = new SessionRepository();
export const batchResponseRepo = new BatchResponseRepository();
export const reportRepo = new ReportRepository();

