// 데이터베이스 연결 및 쿼리 유틸리티
// Supabase 통합이 완료되면 실제 데이터베이스와 연결됩니다.

export interface User {
  id: string
  naver_id: string
  nickname: string
  initial_lives: number
  created_at: string
  total_games: number
  total_wins: number
  total_eliminations: number
}

export interface GameSession {
  id: string
  session_name: string
  status: "waiting" | "in_progress" | "completed" | "cancelled"
  max_players: number
  min_players: number
  initial_lives: number
  current_round: number
  winner_id?: string
  started_at?: string
  ended_at?: string
  created_at: string
}

export interface GameParticipant {
  id: string
  game_session_id: string
  user_id: string
  nickname: string
  current_lives: number
  status: "waiting" | "ready" | "playing" | "eliminated" | "winner"
  joined_at: string
  eliminated_at?: string
  final_rank?: number
}

export interface GameRound {
  id: string
  game_session_id: string
  round_number: number
  phase: "choosing" | "revealing" | "eliminating" | "completed"
  started_at: string
  ended_at?: string
  survivors_count: number
  eliminated_count: number
}

export interface PlayerChoice {
  id: string
  round_id: string
  participant_id: string
  choice: "rock" | "paper" | "scissors"
  chosen_at: string
}

export interface Elimination {
  id: string
  round_id: string
  eliminated_participant_id: string
  eliminator_participant_id?: string
  lives_lost: number
  eliminated_at: string
  reason: string
}

// 임시 데이터 (실제 데이터베이스 연결 전까지 사용)
export const mockUsers: User[] = [
  {
    id: "1",
    naver_id: "testuser",
    nickname: "테스터",
    initial_lives: 3,
    created_at: new Date().toISOString(),
    total_games: 15,
    total_wins: 3,
    total_eliminations: 45,
  },
  {
    id: "2",
    naver_id: "gamemaster123",
    nickname: "게임마스터",
    initial_lives: 10,
    created_at: new Date().toISOString(),
    total_games: 25,
    total_wins: 8,
    total_eliminations: 67,
  },
  {
    id: "3",
    naver_id: "survivalking",
    nickname: "서바이벌킹",
    initial_lives: 7,
    created_at: new Date().toISOString(),
    total_games: 30,
    total_wins: 12,
    total_eliminations: 89,
  },
  {
    id: "4",
    naver_id: "luckyplayer",
    nickname: "행운아",
    initial_lives: 1,
    created_at: new Date().toISOString(),
    total_games: 8,
    total_wins: 1,
    total_eliminations: 12,
  },
  {
    id: "5",
    naver_id: "veteran99",
    nickname: "베테랑",
    initial_lives: 15,
    created_at: new Date().toISOString(),
    total_games: 50,
    total_wins: 20,
    total_eliminations: 150,
  },
]

// 데이터베이스 쿼리 함수들 (Supabase 연결 후 실제 구현)
export class DatabaseService {
  static async getUserByNaverId(naverId: string): Promise<User | null> {
    // TODO: Supabase 쿼리로 교체
    return mockUsers.find((user) => user.naver_id.toLowerCase() === naverId.toLowerCase()) || null
  }

  static async createUser(userData: Partial<User>): Promise<User> {
    // TODO: Supabase 쿼리로 교체
    const newUser: User = {
      id: Date.now().toString(),
      naver_id: userData.naver_id!,
      nickname: userData.nickname!,
      initial_lives: userData.initial_lives || 5,
      created_at: new Date().toISOString(),
      total_games: 0,
      total_wins: 0,
      total_eliminations: 0,
    }
    mockUsers.push(newUser)
    return newUser
  }

  // 게임 세션 관련
  static async createGameSession(sessionData: Partial<GameSession>): Promise<GameSession> {
    // TODO: Supabase 쿼리로 교체
    return {
      id: Date.now().toString(),
      session_name: sessionData.session_name || "Survival Game",
      status: "waiting",
      max_players: sessionData.max_players || 100,
      min_players: sessionData.min_players || 10,
      initial_lives: sessionData.initial_lives || 5,
      current_round: 1,
      created_at: new Date().toISOString(),
    }
  }

  static async getActiveGameSession(): Promise<GameSession | null> {
    // TODO: Supabase 쿼리로 교체
    return null
  }

  // 게임 참가자 관련
  static async addParticipant(
    sessionId: string,
    userId: string,
    nickname: string,
    initialLives: number,
  ): Promise<GameParticipant> {
    // TODO: Supabase 쿼리로 교체
    return {
      id: Date.now().toString(),
      game_session_id: sessionId,
      user_id: userId,
      nickname,
      current_lives: initialLives,
      status: "waiting",
      joined_at: new Date().toISOString(),
    }
  }

  static async getParticipants(sessionId: string): Promise<GameParticipant[]> {
    // TODO: Supabase 쿼리로 교체
    return []
  }

  // 게임 라운드 관련
  static async createRound(sessionId: string, roundNumber: number): Promise<GameRound> {
    // TODO: Supabase 쿼리로 교체
    return {
      id: Date.now().toString(),
      game_session_id: sessionId,
      round_number: roundNumber,
      phase: "choosing",
      started_at: new Date().toISOString(),
      survivors_count: 0,
      eliminated_count: 0,
    }
  }

  // 플레이어 선택 관련
  static async savePlayerChoice(
    roundId: string,
    participantId: string,
    choice: "rock" | "paper" | "scissors",
  ): Promise<PlayerChoice> {
    // TODO: Supabase 쿼리로 교체
    return {
      id: Date.now().toString(),
      round_id: roundId,
      participant_id: participantId,
      choice,
      chosen_at: new Date().toISOString(),
    }
  }

  // 제거 기록 관련
  static async recordElimination(
    roundId: string,
    eliminatedParticipantId: string,
    eliminatorParticipantId?: string,
  ): Promise<Elimination> {
    // TODO: Supabase 쿼리로 교체
    return {
      id: Date.now().toString(),
      round_id: roundId,
      eliminated_participant_id: eliminatedParticipantId,
      eliminator_participant_id: eliminatorParticipantId,
      lives_lost: 1,
      eliminated_at: new Date().toISOString(),
      reason: "game_elimination",
    }
  }

  // 통계 관련
  static async getUserStatistics(userId: string): Promise<User | null> {
    // TODO: Supabase 쿼리로 교체
    return mockUsers.find((user) => user.id === userId) || null
  }

  static async getLeaderboard(limit = 10): Promise<User[]> {
    // TODO: Supabase 쿼리로 교체
    return mockUsers.sort((a, b) => b.total_wins - a.total_wins).slice(0, limit)
  }
}
