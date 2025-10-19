-- ============================================================================
-- 마이그레이션: game_rounds 테이블에 타이머 관련 필드 추가
-- 목적: 서버에서 타이머를 중앙 관리하여 모든 클라이언트 동기화
-- 작성일: 2025-10-19
-- ============================================================================

-- Step 1: 타이머 관련 필드 추가
ALTER TABLE public.game_rounds 
ADD COLUMN IF NOT EXISTS time_left INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS phase_message TEXT DEFAULT '';

-- Step 2: 기존 레코드에 기본값 설정
UPDATE public.game_rounds 
SET 
  time_left = CASE 
    WHEN phase = 'selectTwo' THEN 10
    WHEN phase = 'excludeOne' THEN 10
    WHEN phase = 'revealing' THEN 5
    ELSE 0
  END,
  phase_message = CASE 
    WHEN phase = 'selectTwo' THEN '무기 2개를 선택하세요!'
    WHEN phase = 'excludeOne' THEN '하나 빼기! 선택한 2개 중 하나를 빼세요!'
    WHEN phase = 'revealing' THEN '결과를 확인하세요!'
    ELSE ''
  END
WHERE time_left = 0;

-- Step 3: 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_rounds_phase_time ON game_rounds(phase, time_left);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ game_rounds 테이블에 타이머 필드 추가 완료';
    RAISE NOTICE '   - time_left: 남은 시간(초)';
    RAISE NOTICE '   - phase_started_at: 현재 단계 시작 시간';
    RAISE NOTICE '   - phase_message: 현재 단계 메시지';
END $$;
