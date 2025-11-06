// Core types for the neiropsy bot

export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'likert_5'
  | 'numeric'
  | 'text'
  | 'date';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  key: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  labels?: string[]; // For likert_5
  max_len?: number; // For text
  min?: number; // For numeric
  max?: number; // For numeric
  required: boolean;
}

export interface Questionnaire {
  title: string;
  version: string;
  language: string;
  questions: Question[];
}

export interface ScaleRule {
  when?: Record<string, string | number>;
  when_range?: Record<string, { gte?: number; gt?: number; lte?: number; lt?: number }>;
  add: number;
}

export interface ScaleThreshold {
  gte: number;
  lt?: number;
  level: string;
}

export interface Scale {
  id: string;
  label: string;
  rules: ScaleRule[];
  thresholds: ScaleThreshold[];
}

export interface OverallThreshold {
  gte: number;
  lt?: number;
  label: string;
}

export interface FlagCondition {
  if_missing_required?: boolean;
  if_text_contains?: Record<string, string[]>;
}

export interface Overall {
  combine: 'sum_scales' | 'average_scales' | 'custom';
  overall_thresholds: OverallThreshold[];
  flags: FlagCondition[];
}

export interface ScoringConfig {
  scales: Scale[];
  overall: Overall;
}

export interface ScaleResult {
  id: string;
  score: number;
  level: string;
}

export interface ScoringResult {
  scales: ScaleResult[];
  overall: {
    score: number;
    label: string;
  };
  flags: string[];
}

export interface QuestionnaireDB {
  id: string;
  title: string;
  version: string;
  language: string;
  questions_json: Question[];
  scoring_json: ScoringConfig;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface Session {
  id: string;
  questionnaire_id: string;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
  used_at?: Date;
}

export type ResponseStatus = 'started' | 'in_progress' | 'completed' | 'abandoned';

export interface Response {
  id: string;
  session_id: string;
  started_at: Date;
  submitted_at?: Date;
  answers_json?: Record<string, any>;
  score_json?: ScoringResult;
  summary_text?: string;
  status: ResponseStatus;
  created_at: Date;
  updated_at: Date;
}

export interface BotUserState {
  sessionToken: string;
  questionnaireId: string;
  responseId: string;
  currentQuestionIndex: number;
  answers: Record<string, any>;
  questions: Question[];
}

export interface UserStateDB {
  id: string;
  telegram_user_id: number;
  response_id: string;
  session_token: string;
  questionnaire_id: string;
  current_question_index: number;
  answers_json: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  last_activity: Date;
}

export interface CreateSessionRequest {
  questionnaire_id: string;
}

export interface CreateSessionResponse {
  link: string;
  token: string;
  expires_at: string;
}

export interface ResponseSummary {
  id: string;
  questionnaire_title: string;
  submitted_at?: Date;
  summary_text?: string;
  overall_score?: number;
  overall_label?: string;
}

export interface Config {
  database_url: string;
  telegram_bot_token: string;
  admin_tg_id: string;
  public_bot_link: string;
  port: number;
  session_expiry_hours: number;
  node_env: string;
}
