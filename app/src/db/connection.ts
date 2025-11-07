/**
 * Database Connection Pool
 * Настройка пула подключений к PostgreSQL
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

/**
 * Пул подключений к PostgreSQL
 * Singleton pattern для единственного пула в приложении
 */
class DatabasePool {
  private pool: Pool | null = null;

  /**
   * Получить или создать пул подключений
   */
  public getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: config.database_url,
        // Настройки пула
        max: 20, // Максимум подключений
        idleTimeoutMillis: 30000, // Таймаут простоя
        connectionTimeoutMillis: 5000, // Таймаут подключения
      });

      // Обработка ошибок пула
      this.pool.on('error', (err: Error) => {
        console.error('Неожиданная ошибка в пуле подключений:', err);
      });

      // Логирование подключения
      this.pool.on('connect', () => {
        console.log('Новое подключение к базе данных установлено');
      });
    }

    return this.pool;
  }

  /**
   * Выполнить запрос к базе данных
   */
  public async query<T extends QueryResultRow = any>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const pool = this.getPool();
    const start = Date.now();

    try {
      const result = await pool.query<T>(text, params);
      const duration = Date.now() - start;

      // Логируем медленные запросы (> 100ms)
      if (duration > 100) {
        console.warn(`Медленный запрос (${duration}ms):`, text.substring(0, 100));
      }

      return result;
    } catch (error) {
      console.error('Ошибка выполнения запроса:', error);
      console.error('Запрос:', text);
      console.error('Параметры:', params);
      throw error;
    }
  }

  /**
   * Получить клиента из пула для транзакции
   */
  public async getClient(): Promise<PoolClient> {
    const pool = this.getPool();
    return await pool.connect();
  }

  /**
   * Выполнить транзакцию
   * Автоматически обрабатывает BEGIN, COMMIT и ROLLBACK
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Закрыть все подключения (для graceful shutdown)
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Пул подключений к базе данных закрыт');
    }
  }

  /**
   * Проверить подключение к базе данных
   */
  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('Подключение к базе данных успешно:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('Не удалось подключиться к базе данных:', error);
      return false;
    }
  }
}

// Экспортируем единственный экземпляр
export const db = new DatabasePool();

// Экспортируем также типы для использования в других модулях
export { Pool, PoolClient, QueryResult } from 'pg';

