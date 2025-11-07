/**
 * Batch Service
 * Бизнес-логика для управления батчами, сессиями и прохождением опросов
 * Реализует FSM (конечный автомат состояний) для прохождения опросов
 */

import Redis from 'ioredis';
import { config } from '../config';
import {
  batchRepo,
  sessionRepo,
  questionnaireRepo,
  responseRepo,
  batchResponseRepo,
} from '../db/repository';
import {
  SessionState,
  SessionProgress,
  Answer,
  Questionnaire,
  Question,
} from '../types';

/**
 * Хранилище состояний сессий
 * Поддерживает как Redis, так и in-memory хранение
 */
class StateStorage {
  private redis: Redis | null = null;
  private memoryStorage: Map<string, SessionProgress> = new Map();

  constructor() {
    // Пытаемся подключиться к Redis, если указан URL
    if (config.redis_url) {
      try {
        this.redis = new Redis(config.redis_url);
        this.redis.on('error', (err) => {
          console.error('Redis ошибка:', err);
          console.log('Переключаемся на in-memory хранение');
          this.redis = null;
        });
        console.log('✅ Redis подключен для хранения состояний');
      } catch (error) {
        console.error('Не удалось подключиться к Redis:', error);
        console.log('Используем in-memory хранение');
      }
    } else {
      console.log('Redis URL не задан, используем in-memory хранение');
    }
  }

  /**
   * Сохранить состояние сессии
   */
  async set(userId: number, progress: SessionProgress): Promise<void> {
    const key = `session:${userId}`;

    if (this.redis) {
      // Сохраняем в Redis (TTL = 48 часов)
      await this.redis.setex(key, 48 * 3600, JSON.stringify(progress));
    } else {
      // Сохраняем в памяти
      this.memoryStorage.set(key, progress);
    }
  }

  /**
   * Получить состояние сессии
   */
  async get(userId: number): Promise<SessionProgress | null> {
    const key = `session:${userId}`;

    if (this.redis) {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } else {
      return this.memoryStorage.get(key) || null;
    }
  }

  /**
   * Удалить состояние сессии
   */
  async delete(userId: number): Promise<void> {
    const key = `session:${userId}`;

    if (this.redis) {
      await this.redis.del(key);
    } else {
      this.memoryStorage.delete(key);
    }
  }

  /**
   * Закрыть соединения (для graceful shutdown)
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memoryStorage.clear();
  }
}

/**
 * Сервис для управления батчами и сессиями
 */
export class BatchService {
  private stateStorage: StateStorage;

  constructor() {
    this.stateStorage = new StateStorage();
  }

  /**
   * Создать новый батч
   */
  async createBatch(
    title: string,
    questionnaireIds: string[],
    telegramId: number
  ): Promise<string> {
    // Валидация существования опросников
    const questionnaires = await questionnaireRepo.findByIds(questionnaireIds);
    if (questionnaires.length !== questionnaireIds.length) {
      throw new Error('Один или несколько опросников не найдены');
    }

    // Создаем батч
    const batch = await batchRepo.create(title, telegramId, questionnaireIds);

    return batch.id;
  }

  /**
   * Получить информацию о батче
   */
  async getBatchInfo(batchId: string) {
    return await batchRepo.findByIdWithQuestionnaires(batchId);
  }

  /**
   * Создать сессию для батча (генерация токена)
   */
  async createSession(batchId: string, expiryHours: number = 48): Promise<{
    sessionId: string;
    token: string;
    expiresAt: Date;
  }> {
    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('Батч не найден');
    }

    if (!batch.is_active) {
      throw new Error('Батч неактивен');
    }

    // Генерируем уникальный токен
    const token = this.generateToken();

    // Создаем сессию в БД
    const session = await sessionRepo.create(batchId, token, expiryHours);

    return {
      sessionId: session.id,
      token: session.token,
      expiresAt: session.expires_at,
    };
  }

  /**
   * Начать прохождение батча (по токену)
   * Загружает опросники и инициализирует FSM
   */
  async startSession(
    token: string,
    userId: number,
    chatId: number
  ): Promise<{
    session_id: string;
    batch_title: string;
    total_questionnaires: number;
    total_questions: number;
    first_question: Question;
  }> {
    // Находим сессию по токену
    const session = await sessionRepo.findByToken(token);
    if (!session) {
      throw new Error('Сессия не найдена');
    }

    // Проверяем истечение срока
    if (new Date() > session.expires_at) {
      throw new Error('Срок действия ссылки истек');
    }

    // Проверяем, не завершена ли уже сессия
    if (session.completed) {
      throw new Error('Эта сессия уже завершена');
    }

    // Загружаем батч и опросники
    const batch = await batchRepo.findByIdWithQuestionnaires(session.batch_id);
    if (!batch) {
      throw new Error('Батч не найден');
    }

    const questionnaires = await batchRepo.getQuestionnaires(session.batch_id);

    // Подсчитываем общее количество вопросов
    const totalQuestions = questionnaires.reduce(
      (sum, q) => sum + q.questions_json.length,
      0
    );

    // Инициализируем состояние FSM
    const progress: SessionProgress = {
      session_id: session.id,
      batch_id: session.batch_id,
      user_id: userId,
      chat_id: chatId,
      state: SessionState.IN_PROGRESS,
      current_questionnaire_index: 0,
      current_question_index: 0,
      current_answers: {},
      total_questionnaires: questionnaires.length,
      questionnaires: questionnaires,
    };

    // Сохраняем состояние
    await this.stateStorage.set(userId, progress);

    // Возвращаем первый вопрос
    const firstQuestion = questionnaires[0]!.questions_json[0]!;

    return {
      session_id: session.id,
      batch_title: batch.title,
      total_questionnaires: questionnaires.length,
      total_questions: totalQuestions,
      first_question: firstQuestion,
    };
  }

  /**
   * Обработать ответ пользователя
   * Возвращает следующий вопрос или null, если опросник/батч завершен
   */
  async handleAnswer(
    userId: number,
    answer: string | number
  ): Promise<{
    next_question: Question | null;
    questionnaire_completed: boolean;
    batch_completed: boolean;
    current_questionnaire_index: number;
    current_question_index: number;
    total_questionnaires: number;
  }> {
    // Получаем текущее состояние
    const progress = await this.stateStorage.get(userId);
    if (!progress) {
      throw new Error('Состояние сессии не найдено. Начните сначала.');
    }

    if (progress.state !== SessionState.IN_PROGRESS) {
      throw new Error('Сессия не в состоянии прохождения');
    }

    // Получаем текущий опросник и вопрос
    const currentQuestionnaire = progress.questionnaires[progress.current_questionnaire_index];
    if (!currentQuestionnaire) {
      throw new Error('Опросник не найден');
    }

    const currentQuestion = currentQuestionnaire.questions_json[progress.current_question_index];
    if (!currentQuestion) {
      throw new Error('Вопрос не найден');
    }

    // Сохраняем ответ
    const answerData: Answer = {
      question_id: currentQuestion.id,
      value: answer,
      label: this.getAnswerLabel(currentQuestion, answer),
    };
    progress.current_answers[currentQuestion.id] = answerData;

    // Переходим к следующему вопросу
    progress.current_question_index++;

    let questionnaireCompleted = false;
    let batchCompleted = false;
    let nextQuestion: Question | null = null;

    // Проверяем, завершен ли текущий опросник
    if (progress.current_question_index >= currentQuestionnaire.questions_json.length) {
      // Опросник завершен - сохраняем результаты
      await this.saveQuestionnaireResponse(progress, currentQuestionnaire);

      questionnaireCompleted = true;
      progress.current_questionnaire_index++;
      progress.current_question_index = 0;
      progress.current_answers = {};

      // Проверяем, завершен ли весь батч
      if (progress.current_questionnaire_index >= progress.total_questionnaires) {
        // Батч завершен
        batchCompleted = true;
        progress.state = SessionState.COMPLETED;

        // Отмечаем сессию как завершенную в БД
        await sessionRepo.markCompleted(progress.session_id);

        // Очищаем состояние
        await this.stateStorage.delete(userId);
      } else {
        // Переходим к следующему опроснику
        const nextQuestionnaire = progress.questionnaires[progress.current_questionnaire_index];
        nextQuestion = nextQuestionnaire!.questions_json[0]!;

        // Сохраняем обновленное состояние
        await this.stateStorage.set(userId, progress);
      }
    } else {
      // Продолжаем текущий опросник
      nextQuestion = currentQuestionnaire.questions_json[progress.current_question_index]!;

      // Сохраняем обновленное состояние
      await this.stateStorage.set(userId, progress);
    }

    return {
      next_question: nextQuestion,
      questionnaire_completed: questionnaireCompleted,
      batch_completed: batchCompleted,
      current_questionnaire_index: progress.current_questionnaire_index,
      current_question_index: progress.current_question_index,
      total_questionnaires: progress.total_questionnaires,
    };
  }

  /**
   * Получить текущее состояние прогресса
   */
  async getProgress(userId: number): Promise<SessionProgress | null> {
    return await this.stateStorage.get(userId);
  }

  /**
   * Отменить текущую сессию
   */
  async cancelSession(userId: number): Promise<void> {
    await this.stateStorage.delete(userId);
  }

  /**
   * Сохранить результаты завершенного опросника
   */
  private async saveQuestionnaireResponse(
    progress: SessionProgress,
    questionnaire: Questionnaire
  ): Promise<void> {
    // Создаем запись в responses
    const response = await responseRepo.create(
      progress.session_id,
      progress.current_answers,
      null, // score будет рассчитан позже в ReportGenerator
      null // summary будет сгенерирован позже
    );

    // Создаем связь в batch_responses
    // ВАЖНО: Этот метод вызывается ПЕРЕД инкрементом current_questionnaire_index (строка 304)
    // Поэтому current_questionnaire_index содержит 0-based индекс ЗАВЕРШАЕМОГО опросника
    // Добавляем +1 для получения 1-based order_index, который совпадает с batch_questionnaires.order_index
    // Пример: первый опросник (index 0) → order_index = 0 + 1 = 1
    await batchResponseRepo.create(
      progress.session_id,
      questionnaire.id,
      response.id,
      progress.current_questionnaire_index + 1
    );
  }

  /**
   * Получить текстовую метку ответа
   */
  private getAnswerLabel(question: Question, answer: string | number): string | undefined {
    const option = question.options.find((opt) => opt.value === answer);
    return option?.label;
  }

  /**
   * Генерировать уникальный токен для сессии
   */
  private generateToken(): string {
    // Генерируем случайную строку
    const randomPart = Math.random().toString(36).substring(2, 15);
    const timestampPart = Date.now().toString(36);
    return `batch_${randomPart}${timestampPart}`;
  }

  /**
   * Закрыть сервис (для graceful shutdown)
   */
  async close(): Promise<void> {
    await this.stateStorage.close();
  }
}

// Экспортируем единственный экземпляр
export const batchService = new BatchService();

