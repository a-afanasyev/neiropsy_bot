-- Migration: Add user states table for persistent bot session management
-- This allows users to resume survey completion after disconnection

CREATE TABLE IF NOT EXISTS user_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_user_id BIGINT NOT NULL,
    response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    session_token VARCHAR(100) NOT NULL REFERENCES sessions(token) ON DELETE CASCADE,
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    current_question_index INTEGER NOT NULL DEFAULT 0,
    answers_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_response UNIQUE(telegram_user_id, response_id),
    CONSTRAINT valid_question_index CHECK (current_question_index >= 0)
);

-- Index for fast lookup by telegram user
CREATE INDEX idx_user_states_telegram_user ON user_states(telegram_user_id);
CREATE INDEX idx_user_states_response ON user_states(response_id);
CREATE INDEX idx_user_states_last_activity ON user_states(last_activity);

-- Trigger to update updated_at
CREATE TRIGGER update_user_states_updated_at BEFORE UPDATE ON user_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update last_activity on any change
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_states_last_activity BEFORE UPDATE ON user_states
    FOR EACH ROW EXECUTE FUNCTION update_last_activity();

-- Function to cleanup old inactive states (older than 48 hours)
CREATE OR REPLACE FUNCTION cleanup_old_user_states()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_states
    WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '48 hours'
    RETURNING * INTO deleted_count;

    RETURN COALESCE(deleted_count, 0);
END;
$$ language 'plpgsql';

-- Add index for session token lookup
CREATE INDEX idx_user_states_session_token ON user_states(session_token);

COMMENT ON TABLE user_states IS 'Stores persistent user session states for Telegram bot, allowing resume after disconnection';
COMMENT ON COLUMN user_states.current_question_index IS 'Index of current question (0-based), -1 means not started';
COMMENT ON COLUMN user_states.answers_json IS 'JSON object with question keys and user answers';
COMMENT ON COLUMN user_states.last_activity IS 'Timestamp of last user interaction, used for cleanup';
