// All database-related type definitions

export interface User {
  id: string; // UUID
  naver_id: string;
  session_id: number; // 어떤 게임 세션에 참여했는지
  nickname: string;
  initial_lives: number;
  current_lives: number;
  status: 'waiting' | 'in_lobby' | 'playing' | 'eliminated' | 'winner';
  joined_at: string;
  eliminated_at?: string;
  last_active_at?: string;
  created_at: string;
  is_active: boolean;
}

export interface GameSession {
  id: number; // Serial
  session_name: string;
  cafe_name?: string;
  prize?: string;
  status: 'waiting' | 'starting' | 'in_progress' | 'completed' | 'closed';
  initial_lives: number;
  current_round: number;
  winner_id?: string; // UUID
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

// ⚠️ GameParticipant 타입 제거됨 - User 타입으로 통합

export interface GameRound {
  id: string; // UUID
  game_session_id: number;
  round_number: number;
  phase: 'waiting' | 'selectTwo' | 'excludeOne' | 'revealing';
  survivors_count?: number;
  rock_count: number;
  paper_count: number;
  scissors_count: number;
  losing_choice?: 'rock' | 'paper' | 'scissors';
  started_at: string;
  ended_at?: string;
}

export interface PlayerChoice {
  id: string; // UUID
  round_id: string; // UUID
  user_id: string; // UUID (기존 participant_id에서 변경)
  selected_choices?: string[];
  final_choice?: 'rock' | 'paper' | 'scissors';
  chosen_at: string;
}
