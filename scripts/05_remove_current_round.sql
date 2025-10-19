-- ============================================================================
-- 마이그레이션: game_sessions.current_round 컬럼 제거
-- 목적: 라운드 관리를 game_rounds 테이블로 완전히 일원화
-- 작성일: 2025-10-19
-- ============================================================================

-- Phase 1: 백업
-- ============================================================================

-- 1-1. game_sessions 테이블 백업 (현재 상태)
CREATE TABLE IF NOT EXISTS game_sessions_backup_20251019 AS SELECT * FROM game_sessions;

COMMENT ON TABLE game_sessions_backup_20251019 IS '2025-10-19 current_round 제거 전 백업';

DO $$
BEGIN
    RAISE NOTICE '✅ game_sessions 백업 완료 (game_sessions_backup_20251019)';
END $$;

-- ============================================================================
-- Phase 2: current_round 컬럼 제거
-- ============================================================================

-- 2-1. current_round 컬럼 삭제
ALTER TABLE game_sessions DROP COLUMN IF EXISTS current_round;

DO $$
BEGIN
    RAISE NOTICE '✅ game_sessions.current_round 컬럼 제거 완료';
    RAISE NOTICE '';
    RAISE NOTICE '📌 이제부터 라운드 정보는 game_rounds 테이블에서만 관리됩니다.';
    RAISE NOTICE '   - 현재 라운드 조회: getCurrentRound(sessionId)';
    RAISE NOTICE '   - 라운드 번호: round.round_number';
    RAISE NOTICE '   - 페이즈 정보: round.phase';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- Phase 3: 검증
-- ============================================================================

-- 3-1. 컬럼 제거 확인
DO $$
DECLARE
    column_exists INTEGER;
BEGIN
    SELECT COUNT(*) INTO column_exists 
    FROM information_schema.columns 
    WHERE table_name = 'game_sessions' AND column_name = 'current_round';
    
    IF column_exists = 0 THEN
        RAISE NOTICE '✅ game_sessions.current_round 컬럼이 정상적으로 제거되었습니다.';
    ELSE
        RAISE WARNING '⚠️  game_sessions.current_round 컬럼이 아직 남아있습니다.';
    END IF;
END $$;

-- 3-2. game_rounds 테이블 확인
DO $$
DECLARE
    rounds_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rounds_count FROM game_rounds;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 현재 game_rounds 레코드 수: %', rounds_count;
    
    IF rounds_count > 0 THEN
        RAISE NOTICE '✅ game_rounds 테이블에 데이터가 있습니다.';
    ELSE
        RAISE NOTICE 'ℹ️  game_rounds 테이블이 비어있습니다. (게임 시작 전 정상 상태)';
    END IF;
END $$;

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 마이그레이션 완료!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ 완료된 작업:';
    RAISE NOTICE '   1. game_sessions.current_round 컬럼 제거';
    RAISE NOTICE '   2. 백업 테이블 생성 (game_sessions_backup_20251019)';
    RAISE NOTICE '';
    RAISE NOTICE '📝 다음 단계 (백엔드 코드 수정):';
    RAISE NOTICE '   1. app/api/game/session/route.ts';
    RAISE NOTICE '      - current_round: 0, 1 제거';
    RAISE NOTICE '   2. 모든 current_round 참조 제거';
    RAISE NOTICE '   3. getCurrentRound() 사용으로 변경';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  롤백이 필요한 경우:';
    RAISE NOTICE '   ALTER TABLE game_sessions ADD COLUMN current_round INTEGER DEFAULT 0;';
    RAISE NOTICE '   INSERT INTO game_sessions SELECT * FROM game_sessions_backup_20251019;';
    RAISE NOTICE '';
END $$;
