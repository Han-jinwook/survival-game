-- Step 1: 중복된 라운드 데이터 정리
-- 동일한 game_session_id와 round_number를 가진 레코드 중, 가장 먼저 생성된(started_at이 가장 빠른) 레코드 하나만 남기고 모두 삭제합니다.
DELETE FROM public.game_rounds
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      row_number() OVER (PARTITION BY game_session_id, round_number ORDER BY started_at ASC) as rn
    FROM
      public.game_rounds
  ) t
  WHERE t.rn > 1
);

-- Step 2: UNIQUE 제약 조건 추가
-- 제약 조건이 없는 경우에만 추가하여, 스크립트를 여러 번 실행해도 오류가 발생하지 않도록 합니다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'game_rounds_session_id_round_number_unique'
  ) THEN
    ALTER TABLE public.game_rounds
    ADD CONSTRAINT game_rounds_session_id_round_number_unique UNIQUE (game_session_id, round_number);
  END IF;
END;
$$;
