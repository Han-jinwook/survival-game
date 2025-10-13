-- 하나빼기 서바이벌 게임 유틸리티 함수들

-- 사용자 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_user_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- 게임 완료 시 사용자 통계 업데이트
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- 모든 참가자의 게임 수 증가
        UPDATE users 
        SET total_games = total_games + 1
        WHERE id IN (
            SELECT user_id 
            FROM game_participants 
            WHERE game_session_id = NEW.id
        );
        
        -- 승자의 승리 수 증가
        IF NEW.winner_id IS NOT NULL THEN
            UPDATE users 
            SET total_wins = total_wins + 1
            WHERE id = NEW.winner_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 제거 시 사용자 제거 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_elimination_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- 제거된 플레이어의 제거 통계 업데이트
    UPDATE users 
    SET total_eliminations = total_eliminations + NEW.lives_lost
    WHERE id = (
        SELECT user_id 
        FROM game_participants 
        WHERE id = NEW.eliminated_participant_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 게임 참가자 순위 계산 함수
CREATE OR REPLACE FUNCTION calculate_final_rankings(session_id UUID)
RETURNS VOID AS $$
DECLARE
    participant_record RECORD;
    current_rank INTEGER := 1;
BEGIN
    -- 생존 시간과 라운드 기준으로 순위 계산
    FOR participant_record IN
        SELECT id, eliminated_at, current_lives
        FROM game_participants 
        WHERE game_session_id = session_id
        ORDER BY 
            CASE WHEN current_lives > 0 THEN 1 ELSE 2 END, -- 생존자 우선
            eliminated_at DESC NULLS FIRST, -- 늦게 제거된 순
            current_lives DESC -- 남은 생명 많은 순
    LOOP
        UPDATE game_participants 
        SET final_rank = current_rank
        WHERE id = participant_record.id;
        
        current_rank := current_rank + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_user_statistics ON game_sessions;
CREATE TRIGGER trigger_update_user_statistics
    AFTER UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_statistics();

DROP TRIGGER IF EXISTS trigger_update_elimination_statistics ON eliminations;
CREATE TRIGGER trigger_update_elimination_statistics
    AFTER INSERT ON eliminations
    FOR EACH ROW
    EXECUTE FUNCTION update_elimination_statistics();
