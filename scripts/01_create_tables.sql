-- 가위바위보 서바이벌 게임 데이터베이스 스키마 (최소 필수 버전)
-- Replit PostgreSQL

-- 1. 사용자 테이블 (네이버 카페 회원)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    naver_id VARCHAR(100) UNIQUE NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- 2. 게임 세션 테이블
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_name VARCHAR(200) DEFAULT '가위바위보 서바이벌',
    status VARCHAR(50) DEFAULT 'waiting', -- waiting, in_progress, completed
    initial_lives INTEGER DEFAULT 5,
    current_round INTEGER DEFAULT 0,
    winner_id UUID REFERENCES users(id),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 게임 참가자 테이블
CREATE TABLE IF NOT EXISTS game_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(100) NOT NULL,
    initial_lives INTEGER DEFAULT 5,
    current_lives INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'waiting', -- waiting, playing, eliminated, winner
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    eliminated_at TIMESTAMPTZ,
    UNIQUE(game_session_id, user_id)
);

-- 4. 게임 라운드 테이블
CREATE TABLE IF NOT EXISTS game_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    phase VARCHAR(50) DEFAULT 'waiting', -- waiting, selectTwo, excludeOne, revealing
    survivors_count INTEGER,
    rock_count INTEGER DEFAULT 0,
    paper_count INTEGER DEFAULT 0,
    scissors_count INTEGER DEFAULT 0,
    losing_choice VARCHAR(20), -- rock, paper, scissors (null이면 무승부)
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- 5. 플레이어 선택 테이블
CREATE TABLE IF NOT EXISTS player_choices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES game_participants(id) ON DELETE CASCADE,
    selected_choices TEXT[], -- 2개 선택 단계: ['rock', 'paper']
    final_choice VARCHAR(20), -- 하나 빼기 후: 'rock'
    chosen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(round_id, participant_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_naver_id ON users(naver_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_participants_session ON game_participants(game_session_id);
CREATE INDEX IF NOT EXISTS idx_participants_status ON game_participants(status);
CREATE INDEX IF NOT EXISTS idx_rounds_session ON game_rounds(game_session_id);
CREATE INDEX IF NOT EXISTS idx_choices_round ON player_choices(round_id);

-- 실시간 동기화용 NOTIFY 함수
CREATE OR REPLACE FUNCTION notify_game_update()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'game_update',
        json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'data', row_to_json(NEW)
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (실시간 업데이트 알림)
DROP TRIGGER IF EXISTS trigger_game_sessions_notify ON game_sessions;
CREATE TRIGGER trigger_game_sessions_notify
    AFTER INSERT OR UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION notify_game_update();

DROP TRIGGER IF EXISTS trigger_game_rounds_notify ON game_rounds;
CREATE TRIGGER trigger_game_rounds_notify
    AFTER INSERT OR UPDATE ON game_rounds
    FOR EACH ROW
    EXECUTE FUNCTION notify_game_update();

DROP TRIGGER IF EXISTS trigger_player_choices_notify ON player_choices;
CREATE TRIGGER trigger_player_choices_notify
    AFTER INSERT OR UPDATE ON player_choices
    FOR EACH ROW
    EXECUTE FUNCTION notify_game_update();

DROP TRIGGER IF EXISTS trigger_game_participants_notify ON game_participants;
CREATE TRIGGER trigger_game_participants_notify
    AFTER INSERT OR UPDATE ON game_participants
    FOR EACH ROW
    EXECUTE FUNCTION notify_game_update();
