-- ============================================================================
-- 롤백 스크립트: 마이그레이션 이전 상태로 복원
-- 목적: 마이그레이션 중 문제 발생 시 원래 상태로 되돌리기
-- 작성일: 2025-10-18
-- ============================================================================

-- ⚠️  경고: 이 스크립트는 마이그레이션을 완전히 되돌립니다.
-- 실행 전 반드시 현재 상태를 확인하세요.

-- ============================================================================
-- Phase 1: 백업 테이블 존재 여부 확인
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users_backup') THEN
        RAISE EXCEPTION '❌ users_backup 테이블이 존재하지 않습니다. 롤백할 수 없습니다.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'game_participants_backup') THEN
        RAISE EXCEPTION '❌ game_participants_backup 테이블이 존재하지 않습니다. 롤백할 수 없습니다.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_choices_backup') THEN
        RAISE EXCEPTION '❌ player_choices_backup 테이블이 존재하지 않습니다. 롤백할 수 없습니다.';
    END IF;
    
    RAISE NOTICE '✅ 모든 백업 테이블 확인 완료';
END $$;

-- ============================================================================
-- Phase 2: player_choices 롤백
-- ============================================================================

-- 2-1. 트리거 제거
DROP TRIGGER IF EXISTS trigger_player_choices_notify ON player_choices;

-- 2-2. player_choices 테이블 복원
DROP TABLE IF EXISTS player_choices CASCADE;
CREATE TABLE player_choices AS SELECT * FROM player_choices_backup;

-- 2-3. 기본 키 재생성
ALTER TABLE player_choices ADD PRIMARY KEY (id);

-- 2-4. 외래 키 재생성
ALTER TABLE player_choices 
    ADD CONSTRAINT player_choices_round_id_fkey 
    FOREIGN KEY (round_id) REFERENCES game_rounds(id) ON DELETE CASCADE;

-- 2-5. 유니크 제약 재생성
ALTER TABLE player_choices 
    ADD CONSTRAINT player_choices_round_id_participant_id_key 
    UNIQUE(round_id, participant_id);

-- 2-6. 인덱스 재생성
CREATE INDEX idx_choices_round ON player_choices(round_id);
CREATE INDEX idx_choices_participant ON player_choices(participant_id);

-- 2-7. 트리거 재생성
CREATE TRIGGER trigger_player_choices_notify
    AFTER INSERT OR UPDATE ON player_choices
    FOR EACH ROW
    EXECUTE FUNCTION notify_game_update();

RAISE NOTICE '✅ player_choices 테이블 롤백 완료';

-- ============================================================================
-- Phase 3: game_participants 복원
-- ============================================================================

-- 3-1. game_participants 테이블 재생성
CREATE TABLE IF NOT EXISTS game_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(100) NOT NULL,
    initial_lives INTEGER DEFAULT 5,
    current_lives INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'waiting',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    eliminated_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    UNIQUE(game_session_id, user_id)
);

-- 3-2. 백업 데이터 복원
INSERT INTO game_participants SELECT * FROM game_participants_backup
ON CONFLICT (game_session_id, user_id) DO NOTHING;

-- 3-3. 인덱스 재생성
CREATE INDEX idx_participants_session ON game_participants(game_session_id);
CREATE INDEX idx_participants_status ON game_participants(status);

-- 3-4. 트리거 재생성
DROP TRIGGER IF EXISTS trigger_game_participants_notify ON game_participants;
CREATE TRIGGER trigger_game_participants_notify
    AFTER INSERT OR UPDATE ON game_participants
    FOR EACH ROW
    EXECUTE FUNCTION notify_game_update();

-- 3-5. player_choices 외래 키 재연결
ALTER TABLE player_choices 
    ADD CONSTRAINT player_choices_participant_id_fkey 
    FOREIGN KEY (participant_id) REFERENCES game_participants(id) ON DELETE CASCADE;

RAISE NOTICE '✅ game_participants 테이블 복원 완료';

-- ============================================================================
-- Phase 4: users 테이블 롤백
-- ============================================================================

-- 4-1. users 트리거 제거
DROP TRIGGER IF EXISTS trigger_users_notify ON users;

-- 4-2. users 테이블 복원
TRUNCATE TABLE users CASCADE;
INSERT INTO users SELECT * FROM users_backup;

-- 4-3. 기본 키 재생성 (이미 있으므로 스킵)
-- ALTER TABLE users ADD PRIMARY KEY (id);

-- 4-4. UNIQUE 제약 재생성
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_naver_id_session_id_unique;
ALTER TABLE users ADD CONSTRAINT users_naver_id_key UNIQUE(naver_id);

-- 4-5. 추가된 컬럼 제거
ALTER TABLE users 
    DROP COLUMN IF EXISTS session_id,
    DROP COLUMN IF EXISTS initial_lives,
    DROP COLUMN IF EXISTS current_lives,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS joined_at,
    DROP COLUMN IF EXISTS eliminated_at,
    DROP COLUMN IF EXISTS last_active_at;

-- 4-6. 인덱스 재생성
DROP INDEX IF EXISTS idx_users_session_id;
DROP INDEX IF EXISTS idx_users_status;
CREATE INDEX idx_users_naver_id ON users(naver_id);

RAISE NOTICE '✅ users 테이블 롤백 완료';

-- ============================================================================
-- Phase 5: 검증
-- ============================================================================

DO $$
DECLARE
    users_count INTEGER;
    participants_count INTEGER;
    choices_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO users_count FROM users;
    SELECT COUNT(*) INTO participants_count FROM game_participants;
    SELECT COUNT(*) INTO choices_count FROM player_choices;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== 롤백 결과 ===';
    RAISE NOTICE 'users: % 건', users_count;
    RAISE NOTICE 'game_participants: % 건', participants_count;
    RAISE NOTICE 'player_choices: % 건', choices_count;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- Phase 6: 백업 테이블 정리 (선택 사항)
-- ============================================================================

-- 주의: 롤백이 완전히 확인된 후에만 실행하세요.
-- DROP TABLE IF EXISTS users_backup;
-- DROP TABLE IF EXISTS game_participants_backup;
-- DROP TABLE IF EXISTS player_choices_backup;

-- ============================================================================
-- 롤백 완료
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE '🔙 롤백 완료!';
RAISE NOTICE '========================================';
RAISE NOTICE '';
RAISE NOTICE '데이터베이스가 마이그레이션 이전 상태로 복원되었습니다.';
RAISE NOTICE '';
RAISE NOTICE '⚠️  백업 테이블은 수동으로 삭제하세요:';
RAISE NOTICE '  - DROP TABLE users_backup;';
RAISE NOTICE '  - DROP TABLE game_participants_backup;';
RAISE NOTICE '  - DROP TABLE player_choices_backup;';
RAISE NOTICE '';
