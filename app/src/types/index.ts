/**
 * Типы и интерфейсы для neiropsy_bot
 * Определяет структуры данных для всей системы
 */

// ======================
// БАЗОВЫЕ ТИПЫ
// ======================

/**
 * Тип вопроса в опроснике
 */
export type QuestionType =
  | 'single-choice' // Один вариант ответа
  | 'multiple-choice' // Несколько вариантов
  | 'scale' // Шкала (например, 1-5)
  | 'yes-no' // Да/Нет
  | 'text'; // Текстовый ответ (редко используется)

/**
 * Опция ответа на вопрос
 */
export interface QuestionOption {
  value: string | number; // Значение для расчетов
  label: string; // Текст, отображаемый пользователю
  score?: number; // Опциональный балл за этот ответ
}

/**
 * Вопрос в опроснике
 */
export interface Question {
  id: string; // Уникальный ID вопроса (например, "q1", "q2")
  text: string; // Текст вопроса
  type: QuestionType; // Тип вопроса
  options: QuestionOption[]; // Варианты ответов
  required?: boolean; // Обязателен ли ответ (по умолчанию true)
}

/**
 * Правила подсчета для одной шкалы
 */
export interface ScoringScale {
  id: string; // ID шкалы (например, "inattention", "hyperactivity")
  label: string; // Название шкалы для отчета
  questions: string[]; // Массив ID вопросов, входящих в эту шкалу
  aggregation: 'sum' | 'average' | 'max' | 'count'; // Метод агрегации
  thresholds?: number[]; // Пороги для категорий (например, [10, 20, 30])
  labels?: string[]; // Метки категорий (например, ["низкий", "средний", "высокий"])
}

/**
 * Правила общего подсчета баллов
 */
export interface ScoringOverall {
  strategy: 'sum' | 'average' | 'max' | 'weighted'; // Стратегия подсчета
  thresholds: number[]; // Пороги для общих категорий
  labels: string[]; // Метки общих категорий
  weights?: Record<string, number>; // Веса для взвешенного подсчета (ID шкалы -> вес)
}

/**
 * Правила подсчета баллов для опросника
 */
export interface ScoringRules {
  scales: ScoringScale[]; // Подшкалы
  overall: ScoringOverall; // Общий подсчет
  flags?: ScoringFlag[]; // Опциональные флаги/предупреждения
}

/**
 * Флаг/предупреждение в результатах
 */
export interface ScoringFlag {
  id: string; // ID флага
  condition: string; // Условие для активации (например, "scale.inattention > 20")
  message: string; // Сообщение флага
  severity: 'low' | 'medium' | 'high'; // Уровень серьезности
}

// ======================
// ОПРОСНИКИ
// ======================

/**
 * Опросник (шаблон)
 */
export interface Questionnaire {
  id: string; // UUID
  title: string; // Название опросника
  questions_json: Question[]; // Массив вопросов
  scoring_json: ScoringRules; // Правила подсчета баллов
  created_at: Date;
  updated_at: Date;
}

/**
 * Ответ на один вопрос
 */
export interface Answer {
  question_id: string; // ID вопроса
  value: string | number | string[]; // Значение ответа
  label?: string; // Текстовая метка ответа (опционально)
}

/**
 * Результат подсчета по одной шкале
 */
export interface ScaleResult {
  scale_id: string; // ID шкалы
  scale_label: string; // Название шкалы
  score: number; // Набранный балл
  max_score?: number; // Максимально возможный балл
  level?: string; // Уровень (низкий/средний/высокий)
  percentage?: number; // Процент от максимума
}

/**
 * Результаты подсчета баллов
 */
export interface ScoreResult {
  overall_score: number; // Общий балл
  overall_label: string; // Общая категория (например, "Высокий риск")
  scales: ScaleResult[]; // Результаты по подшкалам
  flags: string[]; // Активированные флаги
}

/**
 * Ответ на опросник (запись в таблице responses)
 */
export interface QuestionnaireResponse {
  id: string; // UUID
  session_id?: string; // UUID сессии (может быть null)
  answers_json: Record<string, Answer>; // Ответы (ключ - question_id)
  score_json?: ScoreResult; // Рассчитанные баллы
  summary_text?: string; // Текстовое резюме
  created_at: Date;
}

// ======================
// БАТЧИ
// ======================

/**
 * Батч опросников
 */
export interface Batch {
  id: string; // UUID
  title: string; // Название батча
  created_by_telegram_id: number; // Telegram ID создателя
  is_active: boolean; // Активен ли батч
  created_at: Date;
  updated_at: Date;
}

/**
 * Связь батча с опросником
 */
export interface BatchQuestionnaire {
  id: number; // Serial ID
  batch_id: string; // UUID батча
  questionnaire_id: string; // UUID опросника
  order_index: number; // Порядковый номер (1, 2, 3, ...)
  created_at: Date;
}

/**
 * Детальная информация о батче с опросниками
 */
export interface BatchWithQuestionnaires extends Batch {
  questionnaires: Array<{
    order: number;
    id: string;
    title: string;
    questions_count: number;
  }>;
  total_questions: number;
}

// ======================
// СЕССИИ
// ======================

/**
 * Состояния FSM для сессии
 */
export enum SessionState {
  CREATED = 'CREATED', // Сессия создана, клиент еще не начал
  IN_PROGRESS = 'IN_PROGRESS', // Клиент проходит опросники
  COMPLETED = 'COMPLETED', // Все опросники пройдены
  REPORTED = 'REPORTED', // Отчет сгенерирован и отправлен
}

/**
 * Сессия прохождения батча
 */
export interface BatchSession {
  id: string; // UUID
  batch_id: string; // UUID батча
  token: string; // Уникальный токен (batch_xxx)
  expires_at: Date; // Время истечения
  completed: boolean; // Флаг завершенности
  completed_at?: Date; // Время завершения
  created_at: Date;
}

/**
 * Состояние прохождения опроса (хранится в Redis/памяти)
 */
export interface SessionProgress {
  session_id: string; // UUID сессии
  batch_id: string; // UUID батча
  user_id: number; // Telegram user ID
  chat_id: number; // Telegram chat ID
  state: SessionState; // Текущее состояние FSM
  current_questionnaire_index: number; // Индекс текущего опросника (0-based)
  current_question_index: number; // Индекс текущего вопроса (0-based)
  current_answers: Record<string, Answer>; // Ответы на текущий опросник
  total_questionnaires: number; // Всего опросников в батче
  questionnaires: Questionnaire[]; // Опросники батча (загружены в начале)
}

/**
 * Связь сессии с ответами
 */
export interface BatchResponse {
  id: number; // Serial ID
  batch_session_id: string; // UUID сессии
  questionnaire_id: string; // UUID опросника
  response_id: string; // UUID ответа в responses
  order_index: number; // Порядковый номер
  created_at: Date;
}

// ======================
// ОТЧЕТЫ
// ======================

/**
 * Результат по одному опроснику в батче
 */
export interface QuestionnaireResult {
  order: number; // Порядковый номер в батче
  title: string; // Название опросника
  overall_score: number; // Общий балл
  overall_label: string; // Общая категория
  scales: ScaleResult[]; // Результаты по шкалам
}

/**
 * Агрегированный отчет по батчу
 */
export interface BatchReport {
  id: string; // UUID
  batch_session_id: string; // UUID сессии
  summary_text: string; // Текстовое резюме
  aggregated_scores: Record<string, QuestionnaireResult>; // Баллы по опросникам
  flags_json: string[]; // Список флагов
  created_at: Date;
}

/**
 * Детальный отчет для API
 */
export interface DetailedBatchReport extends BatchReport {
  batch_title: string; // Название батча
  completed_at: Date; // Время завершения
  duration_minutes: number; // Длительность прохождения
  questionnaires: QuestionnaireResult[]; // Результаты по опросникам
  recommendations?: string[]; // Рекомендации (опционально)
}

// ======================
// API ТИПЫ
// ======================

/**
 * Стандартный успешный ответ API
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Стандартная ошибка API
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string; // Код ошибки для программной обработки
    message: string; // Описание ошибки на русском
  };
}

/**
 * Объединенный тип ответа API
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Коды ошибок API
 */
export enum ErrorCode {
  // Валидация
  INVALID_QUESTIONNAIRE_IDS = 'INVALID_QUESTIONNAIRE_IDS',
  INVALID_EXPIRY_HOURS = 'INVALID_EXPIRY_HOURS',
  INVALID_BATCH_DATA = 'INVALID_BATCH_DATA',

  // Не найдено
  QUESTIONNAIRE_NOT_FOUND = 'QUESTIONNAIRE_NOT_FOUND',
  BATCH_NOT_FOUND = 'BATCH_NOT_FOUND',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  REPORT_NOT_FOUND = 'REPORT_NOT_FOUND',

  // Состояние
  BATCH_INACTIVE = 'BATCH_INACTIVE',
  BATCH_COMPLETED = 'BATCH_COMPLETED',
  BATCH_NOT_COMPLETED = 'BATCH_NOT_COMPLETED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Авторизация
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Внутренние ошибки
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

// ======================
// ЗАПРОСЫ И ОТВЕТЫ API
// ======================

/**
 * Запрос на создание батча
 */
export interface CreateBatchRequest {
  title: string;
  description?: string;
  questionnaire_ids: string[];
  created_by_telegram_id: number;
}

/**
 * Ответ при создании батча
 */
export interface CreateBatchResponse {
  batch_id: string;
  title: string;
  description?: string;
  questionnaires_count: number;
  created_at: string; // ISO 8601
}

/**
 * Запрос на создание сессии
 */
export interface CreateSessionRequest {
  batch_id: string;
  expiry_hours?: number; // По умолчанию 48
}

/**
 * Ответ при создании сессии
 */
export interface CreateSessionResponse {
  session_id: string;
  token: string;
  link: string; // Полная ссылка для Telegram
  batch_title: string;
  questionnaires_count: number;
  total_questions: number;
  expires_at: string; // ISO 8601
}

/**
 * Статус сессии
 */
export interface SessionStatusResponse {
  session_id: string;
  batch_id: string;
  batch_title: string;
  completed: boolean;
  expires_at: string; // ISO 8601
  is_expired: boolean;
  progress: {
    total_questionnaires: number;
    completed_questionnaires: number;
    percentage: number;
  };
}

/**
 * Запрос на загрузку опросника
 */
export interface UploadQuestionnaireRequest {
  telegram_id: number;
  questionnaire?: {
    title: string;
    version: string;
    language: string;
    questions: Question[];
  };
  scoring?: ScoringRules;
}

// ======================
// УТИЛИТАРНЫЕ ТИПЫ
// ======================

/**
 * Параметры конфигурации приложения
 */
export interface AppConfig {
  // Telegram
  telegram_bot_token: string;
  admin_telegram_id: number; // Для обратной совместимости
  admin_telegram_ids: number[]; // Массив ID администраторов

  // Database
  database_url: string;

  // Redis (опционально)
  redis_url?: string;

  // Server
  port: number;
  node_env: 'development' | 'production' | 'test';

  // Logging
  log_level: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Опции логирования
 */
export interface LogContext {
  module?: string;
  function?: string;
  user_id?: number;
  session_id?: string;
  batch_id?: string;
  [key: string]: unknown;
}

