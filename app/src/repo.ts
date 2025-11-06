import { Pool, PoolClient } from 'pg';
import { randomBytes } from 'crypto';
import {
  QuestionnaireDB,
  Session,
  Response,
  ResponseStatus,
  ScoringResult,
  Question,
  ScoringConfig,
  ResponseSummary,
} from './types';
import { config } from './config';

export class Repository {
  private pool: Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString || config.database_url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async init(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connection established');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // Questionnaires
  async createQuestionnaire(
    title: string,
    version: string,
    language: string,
    questions: Question[],
    scoring: ScoringConfig
  ): Promise<QuestionnaireDB> {
    const query = `
      INSERT INTO questionnaires (title, version, language, questions_json, scoring_json)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await this.pool.query(query, [
      title,
      version,
      language,
      JSON.stringify(questions),
      JSON.stringify(scoring),
    ]);
    return this.mapQuestionnaire(result.rows[0]);
  }

  async getQuestionnaire(id: string): Promise<QuestionnaireDB | null> {
    const query = 'SELECT * FROM questionnaires WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapQuestionnaire(result.rows[0]) : null;
  }

  async listQuestionnaires(activeOnly = true): Promise<QuestionnaireDB[]> {
    const query = activeOnly
      ? 'SELECT * FROM questionnaires WHERE is_active = true ORDER BY created_at DESC'
      : 'SELECT * FROM questionnaires ORDER BY created_at DESC';
    const result = await this.pool.query(query);
    return result.rows.map(this.mapQuestionnaire);
  }

  async updateQuestionnaire(
    id: string,
    updates: Partial<Pick<QuestionnaireDB, 'title' | 'version' | 'is_active'>>
  ): Promise<QuestionnaireDB | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.version !== undefined) {
      fields.push(`version = $${paramIndex++}`);
      values.push(updates.version);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      return this.getQuestionnaire(id);
    }

    values.push(id);
    const query = `
      UPDATE questionnaires
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows.length > 0 ? this.mapQuestionnaire(result.rows[0]) : null;
  }

  // Sessions
  async createSession(questionnaireId: string, expiryHours = 24): Promise<Session> {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    const query = `
      INSERT INTO sessions (questionnaire_id, token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await this.pool.query(query, [questionnaireId, token, expiresAt]);
    return this.mapSession(result.rows[0]);
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    const query = 'SELECT * FROM sessions WHERE token = $1';
    const result = await this.pool.query(query, [token]);
    return result.rows.length > 0 ? this.mapSession(result.rows[0]) : null;
  }

  async markSessionUsed(sessionId: string): Promise<void> {
    const query = `
      UPDATE sessions
      SET used = true, used_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await this.pool.query(query, [sessionId]);
  }

  async isSessionValid(token: string): Promise<boolean> {
    const session = await this.getSessionByToken(token);
    if (!session) {
      return false;
    }
    const now = new Date();
    return !session.used && session.expires_at > now;
  }

  // Responses
  async createResponse(sessionId: string): Promise<Response> {
    const query = `
      INSERT INTO responses (session_id, status)
      VALUES ($1, 'started')
      RETURNING *
    `;
    const result = await this.pool.query(query, [sessionId]);
    return this.mapResponse(result.rows[0]);
  }

  async getResponse(id: string): Promise<Response | null> {
    const query = 'SELECT * FROM responses WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapResponse(result.rows[0]) : null;
  }

  async updateResponseAnswers(
    responseId: string,
    answers: Record<string, any>,
    status: ResponseStatus = 'in_progress'
  ): Promise<Response | null> {
    const query = `
      UPDATE responses
      SET answers_json = $1, status = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await this.pool.query(query, [JSON.stringify(answers), status, responseId]);
    return result.rows.length > 0 ? this.mapResponse(result.rows[0]) : null;
  }

  async submitResponse(
    responseId: string,
    answers: Record<string, any>,
    score: ScoringResult,
    summary: string
  ): Promise<Response | null> {
    const query = `
      UPDATE responses
      SET answers_json = $1,
          score_json = $2,
          summary_text = $3,
          status = 'completed',
          submitted_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    const result = await this.pool.query(query, [
      JSON.stringify(answers),
      JSON.stringify(score),
      summary,
      responseId,
    ]);
    return result.rows.length > 0 ? this.mapResponse(result.rows[0]) : null;
  }

  async getResponseBySessionId(sessionId: string): Promise<Response | null> {
    const query = 'SELECT * FROM responses WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1';
    const result = await this.pool.query(query, [sessionId]);
    return result.rows.length > 0 ? this.mapResponse(result.rows[0]) : null;
  }

  async listResponses(
    questionnaireId?: string,
    limit = 100,
    offset = 0
  ): Promise<ResponseSummary[]> {
    let query = `
      SELECT
        r.id,
        q.title as questionnaire_title,
        r.submitted_at,
        r.summary_text,
        r.score_json->>'overall' as overall_json
      FROM responses r
      JOIN sessions s ON r.session_id = s.id
      JOIN questionnaires q ON s.questionnaire_id = q.id
      WHERE r.status = 'completed'
    `;

    const params: any[] = [];
    if (questionnaireId) {
      params.push(questionnaireId);
      query += ` AND s.questionnaire_id = $${params.length}`;
    }

    query += ' ORDER BY r.submitted_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    query += ' OFFSET $' + (params.length + 1);
    params.push(offset);

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => {
      const overall = row.overall_json ? JSON.parse(row.overall_json) : null;
      return {
        id: row.id,
        questionnaire_title: row.questionnaire_title,
        submitted_at: row.submitted_at,
        summary_text: row.summary_text,
        overall_score: overall?.score,
        overall_label: overall?.label,
      };
    });
  }

  async getResponsesForExport(questionnaireId?: string): Promise<any[]> {
    let query = `
      SELECT
        r.id,
        q.title as questionnaire_title,
        q.version as questionnaire_version,
        r.started_at,
        r.submitted_at,
        r.answers_json,
        r.score_json,
        r.summary_text,
        r.status
      FROM responses r
      JOIN sessions s ON r.session_id = s.id
      JOIN questionnaires q ON s.questionnaire_id = q.id
      WHERE r.status = 'completed'
    `;

    const params: any[] = [];
    if (questionnaireId) {
      params.push(questionnaireId);
      query += ` AND s.questionnaire_id = $${params.length}`;
    }

    query += ' ORDER BY r.submitted_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // Utility
  async cleanupExpiredSessions(): Promise<number> {
    const query = `
      UPDATE sessions
      SET used = true
      WHERE expires_at < CURRENT_TIMESTAMP
      AND used = false
      RETURNING id
    `;
    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }

  private generateToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  private mapQuestionnaire(row: any): QuestionnaireDB {
    return {
      id: row.id,
      title: row.title,
      version: row.version,
      language: row.language,
      questions_json: row.questions_json,
      scoring_json: row.scoring_json,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_active: row.is_active,
    };
  }

  private mapSession(row: any): Session {
    return {
      id: row.id,
      questionnaire_id: row.questionnaire_id,
      token: row.token,
      expires_at: row.expires_at,
      used: row.used,
      created_at: row.created_at,
      used_at: row.used_at,
    };
  }

  private mapResponse(row: any): Response {
    return {
      id: row.id,
      session_id: row.session_id,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      answers_json: row.answers_json,
      score_json: row.score_json,
      summary_text: row.summary_text,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// Singleton instance
let repoInstance: Repository | null = null;

export function getRepository(): Repository {
  if (!repoInstance) {
    repoInstance = new Repository();
  }
  return repoInstance;
}

export async function initRepository(): Promise<Repository> {
  const repo = getRepository();
  await repo.init();
  return repo;
}
