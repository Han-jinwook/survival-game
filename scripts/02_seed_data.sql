-- 하나빼기 서바이벌 게임 초기 데이터
-- 테스트용 네이버 카페 회원 데이터

-- 테스트 사용자 추가
INSERT INTO users (email, nickname, total_games, total_wins, total_eliminations) VALUES
('test@naver.com', '테스터', 15, 3, 45),
('player1@naver.com', '게임마스터', 25, 8, 67),
('player2@naver.com', '서바이벌킹', 30, 12, 89),
('player3@naver.com', '행운의여신', 18, 5, 34),
('player4@naver.com', '최후의생존자', 22, 7, 56),
('player5@naver.com', '전략가', 20, 6, 48),
('player6@naver.com', '운빨왕', 12, 2, 28),
('player7@naver.com', '침착맨', 28, 9, 72),
('player8@naver.com', '긴장왕', 8, 1, 19),
('player9@naver.com', '베테랑', 35, 15, 95),
('player10@naver.com', '신입생', 3, 0, 8),
('player11@naver.com', '도전자', 14, 4, 38),
('player12@naver.com', '승부사', 26, 10, 64),
('player13@naver.com', '행운아', 16, 6, 42),
('player14@naver.com', '끈기왕', 19, 5, 51),
('player15@naver.com', '마지막희망', 21, 8, 58)
ON CONFLICT (email) DO NOTHING;

-- 완료된 게임 세션 예시 (통계용)
INSERT INTO game_sessions (session_name, status, max_players, min_players, initial_lives, current_round, started_at, ended_at) VALUES
('서바이벌 게임 #001', 'completed', 50, 10, 5, 8, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 30 minutes'),
('서바이벌 게임 #002', 'completed', 30, 10, 5, 6, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 20 minutes'),
('서바이벌 게임 #003', 'completed', 80, 10, 5, 12, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 10 minutes');

-- 현재 진행 중인 게임 세션
INSERT INTO game_sessions (session_name, status, max_players, min_players, initial_lives, current_round, started_at) VALUES
('서바이벌 게임 #004', 'waiting', 100, 10, 5, 1, NULL);
