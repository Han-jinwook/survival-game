-- ============================================================================
-- 마이그레이션: game_participants 제거 및 users 테이블 통합
-- 목적: 1회성 이벤트 게임에 최적화된 단순 구조로 재설계
-- 작성일: 2025-10-18
-- ============================================================================

-- ============================================================================
-- Phase 1: 백업
-- ============================================================================

-- 1-1. 기존 테이블 백업
CREATE TABLE IF NOT EXISTS users_backup AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS game_participants_backup AS SELECT * FROM game_participants;
CREATE TABLE IF NOT EXISTS player_choices_backup AS SELECT * FROM player_choices;

COMMENT ON TABLE users_backup IS '마이그레이션 전 users 테이블 백업';
COMMENT ON TABLE game_participants_backup IS '마이그레이션 전 game_participants 테이블 백업';
COMMENT ON TABLE player_choices_backup IS '마이그레이션 전 player_choices 테이블 백업';

-- ============================================================================
-- Phase 2: users 테이블 재구성
-- ============================================================================

-- 2-1. users 테이블의 UNIQUE 제약 제거
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_naver_id_key;

-- 2-2. 새로운 컬럼 추가
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS initial_lives INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS current_lives INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'waiting',
    ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS eliminated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- 2-3. 복합 유니크 키 생성 (핵심: naver_id + session_id)
ALTER TABLE users ADD CONSTRAINT users_naver_id_session_id_unique UNIQUE(naver_id, session_id);

-- 2-4. 인덱스 재생성
DROP INDEX IF EXISTS idx_users_naver_id;
CREATE INDEX idx_users_naver_id ON users(naver_id);
CREATE INDEX idx_users_session_id ON users(session_id);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================================
-- Phase 3: 데이터 마이그레이션 (game_participants → users)
-- ============================================================================

-- 3-1. 기존 users 테이블 데이터 임시 삭제 (중복 방지)
-- 주의: 프로덕션에서는 이 단계를 신중히 검토해야 함
TRUNCATE TABLE users CASCADE;

-- 3-2. game_participants 데이터를 users로 이관
INSERT INTO users (
    naver_id, 
    session_id, 
    nickname, 
    initial_lives, 
    current_lives, 
    status, 
    joined_at, 
    eliminated_at,
    last_active_at,
    is_active,
    created_at
)
SELECT 
    ub.naver_id,
    gp.game_session_id,
    gp.nickname,
    gp.initial_lives,
    gp.current_lives,
    gp.status,
    gp.joined_at,
    gp.eliminated_at,
    gp.last_active_at,
    ub.is_active,
    ub.created_at
FROM game_participants_backup gp
JOIN users_backup ub ON gp.user_id = ub.id
ON CONFLICT (naver_id, session_id) DO UPDATE SET
    nickname = EXCLUDED.nickname,
    current_lives = EXCLUDED.current_lives,
    status = EXCLUDED.status,
    eliminated_at = EXCLUDED.eliminated_at,
    last_active_at = EXCLUDED.last_active_at;

-- 3-3. 마이그레이션 결과 확인
DO $$
DECLARE
    old_count INTEGER;
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_count FROM game_participants_backup;
    SELECT COUNT(*) INTO new_count FROM users;
    
    RAISE NOTICE '=== 마이그레이션 결과 ===';
    RAISE NOTICE 'game_participants 원본 데이터: % 건', old_count;
    RAISE NOTICE 'users 새 데이터: % 건', new_count;
    
    IF old_count != new_count THEN
        RAISE WARNING '⚠️  데이터 수가 일치하지 않습니다. 검토가 필요합니다.';
    ELSE
        RAISE NOTICE '✅ 데이터 마이그레이션 성공';
    END IF;
END $$;

-- ============================================================================
-- Phase 4: player_choices 외래 키 변경
-- ============================================================================

-- 4-1. player_choices에 user_id 컬럼 추가
ALTER TABLE player_choices ADD COLUMN IF NOT EXISTS user_id UUID;

-- 4-2. 기존 participant_id를 user_id로 매핑
UPDATE player_choices pc
SET user_id = (
    SELECT u.id 
    FROM users u
    JOIN game_participants_backup gp ON u.naver_id = (
        SELECT naver_id FROM users_backup WHERE id = gp.user_id
    ) AND u.session_id = gp.game_session_id
    WHERE gp.id = pc.participant_id
    LIMIT 1
);

-- 4-3. user_id가 NULL인 레코드 확인
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM player_choices WHERE user_id IS NULL;
    
    IF null_count > 0 THEN
        RAISE WARNING '⚠️  player_choices에서 user_id가 NULL인 레코드가 % 건 발견되었습니다.', null_count;
        RAISE WARNING '이는 매핑되지 않은 participant_id가 있음을 의미합니다.';
    ELSE
        RAISE NOTICE '✅ player_choices.user_id 매핑 완료 (NULL 없음)';
    END IF;
END $$;

-- 4-4. user_id를 NOT NULL로 설정
ALTER TABLE player_choices ALTER COLUMN user_id SET NOT NULL;

-- 4-5. 외래 키 제약 추가
ALTER TABLE player_choices 
    ADD CONSTRAINT player_choices_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4-6. 유니크 제약 재생성
ALTER TABLE player_choices 
    DROP CONSTRAINT IF EXISTS player_choices_round_id_participant_id_key;

ALTER TABLE player_choices 
    ADD CONSTRAINT player_choices_round_id_user_id_unique 
    UNIQUE(round_id, user_id);

-- 4-7. 기존 participant_id 컬럼 제거
ALTER TABLE player_choices DROP COLUMN IF EXISTS participant_id;

-- 4-8. 인덱스 재생성
DROP INDEX IF EXISTS idx_choices_participant;
CREATE INDEX idx_choices_user ON player_choices(user_id);

-- ============================================================================
-- Phase 5: game_participants 테이블 제거
-- ============================================================================

-- 5-1. 트리거 제거
DROP TRIGGER IF EXISTS trigger_game_participants_notify ON game_participants;

-- 5-2. 테이블 제거
DROP TABLE IF EXISTS game_participants CASCADE;

RAISE NOTICE '✅ game_participants 테이블 제거 완료';

-- ============================================================================
-- Phase 6: 트리거 재생성
-- ============================================================================

-- 6-1. users 테이블에 트리거 추가
DROP TRIGGER IF EXISTS trigger_users_notify ON users;
CREATE TRIGGER trigger_users_notify
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION notify_game_update();

RAISE NOTICE '✅ users 테이블 트리거 생성 완료';

-- ============================================================================
-- Phase 7: 검증
-- ============================================================================

-- 7-1. 테이블 구조 확인
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO column_count 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name IN ('session_id', 'current_lives', 'status');
    
    IF column_count = 3 THEN
        RAISE NOTICE '✅ users 테이블 구조 변경 완료';
    ELSE
        RAISE WARNING '⚠️  users 테이블에 필요한 컬럼이 누락되었습니다.';
    END IF;
END $$;

-- 7-2. 외래 키 확인
DO $$
DECLARE
    fk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fk_count 
    FROM information_schema.table_constraints 
    WHERE table_name = 'player_choices' 
    AND constraint_name = 'player_choices_user_id_fkey';
    
    IF fk_count = 1 THEN
        RAISE NOTICE '✅ player_choices.user_id 외래 키 설정 완료';
    ELSE
        RAISE WARNING '⚠️  player_choices.user_id 외래 키가 설정되지 않았습니다.';
    END IF;
END $$;

-- 7-3. 유니크 제약 확인
DO $$
DECLARE
    unique_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unique_count 
    FROM information_schema.table_constraints 
    WHERE table_name = 'users' 
    AND constraint_name = 'users_naver_id_session_id_unique';
    
    IF unique_count = 1 THEN
        RAISE NOTICE '✅ users(naver_id, session_id) 유니크 제약 설정 완료';
    ELSE
        RAISE WARNING '⚠️  users(naver_id, session_id) 유니크 제약이 설정되지 않았습니다.';
    END IF;
END $$;

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE '🎉 마이그레이션 완료!';
RAISE NOTICE '========================================';
RAISE NOTICE '';
RAISE NOTICE '다음 단계:';
RAISE NOTICE '1. 백엔드 코드 수정 (lib/database.ts, lib/types.ts)';
RAISE NOTICE '2. API 라우트 수정 (/api/game/*, /api/participants/*)';
RAISE NOTICE '3. 프론트엔드 코드 수정 (app/lobby/page.tsx 등)';
RAISE NOTICE '4. 테스트 및 검증';
RAISE NOTICE '';
RAISE NOTICE '백업 테이블:';
RAISE NOTICE '- users_backup';
RAISE NOTICE '- game_participants_backup';
RAISE NOTICE '- player_choices_backup';
RAISE NOTICE '';
RAISE NOTICE '⚠️  문제 발생 시 롤백 스크립트를 실행하세요.';
RAISE NOTICE '';
