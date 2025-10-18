-- ========================================
-- 사용자 상태 단순화 마이그레이션
-- ========================================
-- 목적: in_lobby, playing → player 통합
-- 작성일: 2025-10-18
-- 
-- 변경 사항:
-- - in_lobby, playing 상태를 player로 통합
-- - 로비 입장 = 게임 참가 확정 (상태 전환 제거)
-- ========================================

-- ✅ 1단계: 기존 데이터 백업 (선택사항)
-- CREATE TABLE IF NOT EXISTS users_backup_20251018 AS 
-- SELECT * FROM users;

-- ✅ 2단계: in_lobby와 playing을 player로 통합
UPDATE users 
SET status = 'player' 
WHERE status IN ('in_lobby', 'playing');

-- ✅ 3단계: CHECK 제약조건 확인 (있다면 수정 필요)
-- Supabase는 일반적으로 테이블 레벨에서 제약조건을 설정하지 않으므로
-- 애플리케이션 레벨에서 처리

-- ✅ 4단계: 검증 쿼리
SELECT 
  status, 
  COUNT(*) as count,
  array_agg(nickname) as users
FROM users
GROUP BY status
ORDER BY status;

-- 예상 결과:
-- status      | count | users
-- ------------|-------|----------------
-- waiting     | X     | [...]
-- player      | X     | [in_lobby + playing 합산]
-- eliminated  | X     | [...]
-- winner      | X     | [...]

-- ✅ 5단계: 롤백 SQL (필요시 사용)
-- UPDATE users 
-- SET status = 'in_lobby' 
-- WHERE status = 'player' AND last_active_at > NOW() - INTERVAL '10 minutes';
-- 
-- (정확한 롤백은 백업 테이블 사용 권장)
