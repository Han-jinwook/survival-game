-- 하나빼기 서바이벌 게임 데이터베이스 스키마
-- 네이버 카페 회원들을 위한 게임 시스템

-- 사용자 테이블 (네이버 카페 회원)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    total_games INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_eliminations INTEGER DEFAULT 0
);

-- 게임 세션 테이블
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_name VARCHAR(200) DEFAULT 'Survival Game',
    status VARCHAR(50) DEFAULT 'waiting', -- waiting, in_progress, completed, cancelled
    max_players INTEGER DEFAULT 100,
    min_players INTEGER DEFAULT 10,
    initial_lives INTEGER DEFAULT 5,
    current_round INTEGER DEFAULT 1,
    winner_id UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 게임 참가자 테이블
CREATE TABLE IF NOT EXISTS game_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(100) NOT NULL,
    current_lives INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'waiting', -- waiting, ready, playing, eliminated, winner
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    eliminated_at TIMESTAMP WITH TIME ZONE,
    final_rank INTEGER,
    UNIQUE(game_session_id, user_id)
);

-- 게임 라운드 테이블
CREATE TABLE IF NOT EXISTS game_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    phase VARCHAR(50) DEFAULT 'choosing', -- choosing, revealing, eliminating, completed
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    survivors_count INTEGER,
    eliminated_count INTEGER DEFAULT 0
);

-- 플레이어 선택 테이블 (가위바위보)
CREATE TABLE IF NOT EXISTS player_choices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES game_participants(id) ON DELETE CASCADE,
    choice VARCHAR(20) NOT NULL, -- rock, paper, scissors
    chosen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(round_id, participant_id)
);

-- 제거 기록 테이블
CREATE TABLE IF NOT EXISTS eliminations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    eliminated_participant_id UUID NOT NULL REFERENCES game_participants(id) ON DELETE CASCADE,
    eliminator_participant_id UUID REFERENCES game_participants(id) ON DELETE SET NULL,
    lives_lost INTEGER DEFAULT 1,
    eliminated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason VARCHAR(100) DEFAULT 'game_elimination'
);

-- 게임 통계 테이블
CREATE TABLE IF NOT EXISTS game_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    total_participants INTEGER NOT NULL,
    total_rounds INTEGER NOT NULL,
    game_duration_minutes INTEGER,
    winner_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_participants_session ON game_participants(game_session_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_user ON game_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_status ON game_participants(status);
CREATE INDEX IF NOT EXISTS idx_game_rounds_session ON game_rounds(game_session_id);
CREATE INDEX IF NOT EXISTS idx_player_choices_round ON player_choices(round_id);
CREATE INDEX IF NOT EXISTS idx_eliminations_round ON eliminations(round_id);
