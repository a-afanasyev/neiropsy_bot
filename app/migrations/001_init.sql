-- Initialization script for neiropsy_bot database
-- Creates tables for questionnaires, sessions, and responses

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Questionnaires table
CREATE TABLE IF NOT EXISTS questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    language VARCHAR(10) NOT NULL DEFAULT 'ru',
    questions_json JSONB NOT NULL,
    scoring_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT valid_questions CHECK (jsonb_typeof(questions_json) = 'array'),
    CONSTRAINT valid_scoring CHECK (jsonb_typeof(scoring_json) = 'object')
);

-- Index for active questionnaires lookup
CREATE INDEX idx_questionnaires_active ON questionnaires(is_active, created_at DESC);
CREATE INDEX idx_questionnaires_language ON questionnaires(language);

-- Sessions table (one-time links)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    token VARCHAR(100) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT token_format CHECK (length(token) >= 20)
);

-- Indexes for sessions
CREATE UNIQUE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_questionnaire ON sessions(questionnaire_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_used ON sessions(used);

-- Responses table
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    answers_json JSONB,
    score_json JSONB,
    summary_text TEXT,
    status VARCHAR(50) DEFAULT 'started',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('started', 'in_progress', 'completed', 'abandoned')),
    CONSTRAINT valid_answers CHECK (answers_json IS NULL OR jsonb_typeof(answers_json) = 'object'),
    CONSTRAINT valid_score CHECK (score_json IS NULL OR jsonb_typeof(score_json) = 'object')
);

-- Indexes for responses
CREATE INDEX idx_responses_session ON responses(session_id);
CREATE INDEX idx_responses_status ON responses(status);
CREATE INDEX idx_responses_submitted ON responses(submitted_at DESC NULLS LAST);
CREATE INDEX idx_responses_created ON responses(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_questionnaires_updated_at BEFORE UPDATE ON questionnaires
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_responses_updated_at BEFORE UPDATE ON responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to mark session as used when response is submitted
CREATE OR REPLACE FUNCTION mark_session_used()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL THEN
        UPDATE sessions
        SET used = true, used_at = NEW.submitted_at
        WHERE id = NEW.session_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to mark session as used
CREATE TRIGGER mark_session_used_trigger AFTER UPDATE ON responses
    FOR EACH ROW EXECUTE FUNCTION mark_session_used();

-- Cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    -- Mark expired sessions that haven't been used
    UPDATE sessions
    SET used = true
    WHERE expires_at < CURRENT_TIMESTAMP
    AND used = false;

    -- Optionally delete old abandoned responses (older than 30 days)
    -- DELETE FROM responses
    -- WHERE status = 'abandoned'
    -- AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ language 'plpgsql';

-- Create a view for admin dashboard
CREATE OR REPLACE VIEW admin_responses_summary AS
SELECT
    r.id,
    r.session_id,
    q.title as questionnaire_title,
    q.version as questionnaire_version,
    r.started_at,
    r.submitted_at,
    r.status,
    r.score_json,
    r.summary_text,
    CASE
        WHEN r.submitted_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (r.submitted_at - r.started_at)) / 60
        ELSE NULL
    END as duration_minutes
FROM responses r
JOIN sessions s ON r.session_id = s.id
JOIN questionnaires q ON s.questionnaire_id = q.id
ORDER BY r.created_at DESC;

-- Insert sample disclaimer text (can be customized)
COMMENT ON TABLE questionnaires IS 'Stores questionnaire templates with questions and scoring rules';
COMMENT ON TABLE sessions IS 'One-time access tokens for questionnaire completion, expires after 24 hours';
COMMENT ON TABLE responses IS 'User responses to questionnaires with computed scores';

-- Grant necessary permissions (adjust if needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully';
END $$;
