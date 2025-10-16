// PostgreSQL 데이터베이스 연결 및 쿼리 유틸리티
import { Pool, QueryResult } from 'pg'

// PostgreSQL 연결 풀 (싱글톤)
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다.')
    }
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      allowExitOnIdle: false,
    })

    pool.on('error', (err) => {
      console.error('[DB] 풀 에러:', err.message)
    })

    pool.on('connect', () => {
      console.log('[DB] 새로운 연결 생성됨')
    })
  }
  return pool
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 500
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation()
    } catch (err: any) {
      const isLastAttempt = attempt === retries
      const shouldRetry = 
        err.message?.includes('Connection terminated') ||
        err.message?.includes('timeout') ||
        err.code === '57P01'

      if (isLastAttempt || !shouldRetry) {
        throw err
      }

      console.log(`[DB] 재시도 ${attempt}/${retries} (${delay}ms 대기)`)
      
      if (pool && shouldRetry) {
        try {
          await pool.end()
        } catch {}
        pool = null
      }

      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }
  
  throw new Error('Max retries reached')
}

// 타입 정의
export interface User {
  id: string
  naver_id: string
  nickname: string
  created_at: string
  is_active: boolean
}

export interface GameSession {
  id: string
  session_name: string
  cafe_name?: string
  prize?: string
  status: "waiting" | "starting" | "in_progress" | "completed" | "closed"
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
  initial_lives: number
  current_lives: number
  status: "waiting" | "playing" | "eliminated" | "winner"
  joined_at: string
  eliminated_at?: string
  last_active_at?: string
}

export interface GameRound {
  id: string
  game_session_id: string
  round_number: number
  phase: "waiting" | "selectTwo" | "excludeOne" | "revealing"
  survivors_count?: number
  rock_count: number
  paper_count: number
  scissors_count: number
  losing_choice?: "rock" | "paper" | "scissors"
  started_at: string
  ended_at?: string
}

export interface PlayerChoice {
  id: string
  round_id: string
  participant_id: string
  selected_choices?: string[] // 2개 선택 단계
  final_choice?: "rock" | "paper" | "scissors" // 최종 선택
  chosen_at: string
}

// 실시간 업데이트 리스너 타입
export type GameUpdateCallback = (update: {
  table: string
  operation: string
  data: any
}) => void

// 데이터베이스 서비스
export class DatabaseService {
  // 사용자 관련
  static async getUserById(userId: string): Promise<User | null> {
    const db = getPool()
    const result = await db.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    )
    return result.rows[0] || null
  }

  static async getUserByNaverId(naverId: string): Promise<User | null> {
    const db = getPool()
    const result = await db.query<User>(
      'SELECT * FROM users WHERE naver_id = $1',
      [naverId]
    )
    return result.rows[0] || null
  }

  static async createUser(naverId: string, nickname: string): Promise<User> {
    const db = getPool()
    const result = await db.query<User>(
      'INSERT INTO users (naver_id, nickname) VALUES ($1, $2) RETURNING *',
      [naverId, nickname]
    )
    return result.rows[0]
  }

  // 게임 세션 관련
  static async createGameSession(
    sessionName: string,
    initialLives: number,
    startedAt?: string,
    cafeName?: string,
    prize?: string
  ): Promise<GameSession> {
    const db = getPool()
    
    const result = await db.query<GameSession>(
      'INSERT INTO game_sessions (session_name, initial_lives, started_at, cafe_name, prize) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [sessionName, initialLives, startedAt || null, cafeName || null, prize || null]
    )
    return result.rows[0]
  }

  static async getActiveGameSession(): Promise<GameSession | null> {
    return executeWithRetry(async () => {
      const db = getPool()
      const result = await db.query<GameSession>(
        "SELECT * FROM game_sessions WHERE status IN ('waiting', 'starting', 'in_progress') ORDER BY created_at DESC LIMIT 1"
      )
      return result.rows[0] || null
    })
  }

  static async getGameSession(sessionId: string): Promise<GameSession | null> {
    const db = getPool()
    const result = await db.query<GameSession>(
      'SELECT * FROM game_sessions WHERE id = $1',
      [sessionId]
    )
    return result.rows[0] || null
  }

  static async updateGameSession(
    sessionId: string,
    updates: Partial<GameSession>
  ): Promise<GameSession> {
    const db = getPool()
    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`)
        values.push(value)
        paramCount++
      }
    })

    // 빈 업데이트 방지
    if (fields.length === 0) {
      const result = await db.query<GameSession>(
        'SELECT * FROM game_sessions WHERE id = $1',
        [sessionId]
      )
      if (!result.rows[0]) {
        throw new Error(`GameSession with id ${sessionId} not found`)
      }
      return result.rows[0]
    }

    values.push(sessionId)
    const result = await db.query<GameSession>(
      `UPDATE game_sessions SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    )
    return result.rows[0]
  }

  // 게임 참가자 관련
  static async addParticipant(
    sessionId: string,
    userId: string,
    nickname: string,
    initialLives: number
  ): Promise<GameParticipant> {
    const db = getPool()
    const result = await db.query<GameParticipant>(
      `INSERT INTO game_participants (game_session_id, user_id, nickname, initial_lives, current_lives)
       VALUES ($1, $2, $3, $4, $4) RETURNING *`,
      [sessionId, userId, nickname, initialLives]
    )
    return result.rows[0]
  }

  static async getParticipants(sessionId: string): Promise<GameParticipant[]> {
    return executeWithRetry(async () => {
      const db = getPool()
      const result = await db.query<GameParticipant & {naver_id: string}>(
        `SELECT gp.*, u.naver_id 
         FROM game_participants gp 
         JOIN users u ON gp.user_id = u.id 
         WHERE gp.game_session_id = $1 
         ORDER BY gp.joined_at`,
        [sessionId]
      )
      return result.rows
    })
  }

  static async updateParticipant(
    participantId: string,
    updates: Partial<GameParticipant>
  ): Promise<GameParticipant> {
    const db = getPool()
    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`)
        values.push(value)
        paramCount++
      }
    })

    // 빈 업데이트 방지
    if (fields.length === 0) {
      const result = await db.query<GameParticipant>(
        'SELECT * FROM game_participants WHERE id = $1',
        [participantId]
      )
      if (!result.rows[0]) {
        throw new Error(`GameParticipant with id ${participantId} not found`)
      }
      return result.rows[0]
    }

    values.push(participantId)
    const result = await db.query<GameParticipant>(
      `UPDATE game_participants SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    )
    return result.rows[0]
  }

  // 게임 라운드 관련
  static async createRound(
    sessionId: string,
    roundNumber: number
  ): Promise<GameRound> {
    const db = getPool()
    const result = await db.query<GameRound>(
      'INSERT INTO game_rounds (game_session_id, round_number) VALUES ($1, $2) RETURNING *',
      [sessionId, roundNumber]
    )
    return result.rows[0]
  }

  static async getCurrentRound(sessionId: string): Promise<GameRound | null> {
    return executeWithRetry(async () => {
      const db = getPool()
      const result = await db.query<GameRound>(
        'SELECT * FROM game_rounds WHERE game_session_id = $1 ORDER BY round_number DESC LIMIT 1',
        [sessionId]
      )
      return result.rows[0] || null
    })
  }

  static async updateRound(
    roundId: string,
    updates: Partial<GameRound>
  ): Promise<GameRound> {
    const db = getPool()
    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`)
        values.push(value)
        paramCount++
      }
    })

    // 빈 업데이트 방지
    if (fields.length === 0) {
      const result = await db.query<GameRound>(
        'SELECT * FROM game_rounds WHERE id = $1',
        [roundId]
      )
      if (!result.rows[0]) {
        throw new Error(`GameRound with id ${roundId} not found`)
      }
      return result.rows[0]
    }

    values.push(roundId)
    const result = await db.query<GameRound>(
      `UPDATE game_rounds SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    )
    return result.rows[0]
  }

  // 플레이어 선택 관련
  static async savePlayerChoice(
    roundId: string,
    participantId: string,
    selectedChoices?: string[],
    finalChoice?: "rock" | "paper" | "scissors"
  ): Promise<PlayerChoice> {
    const db = getPool()
    const result = await db.query<PlayerChoice>(
      `INSERT INTO player_choices (round_id, participant_id, selected_choices, final_choice)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (round_id, participant_id)
       DO UPDATE SET selected_choices = $3, final_choice = $4, chosen_at = NOW()
       RETURNING *`,
      [roundId, participantId, selectedChoices || null, finalChoice || null]
    )
    return result.rows[0]
  }

  static async getPlayerChoices(roundId: string): Promise<PlayerChoice[]> {
    const db = getPool()
    const result = await db.query<PlayerChoice>(
      'SELECT * FROM player_choices WHERE round_id = $1',
      [roundId]
    )
    return result.rows
  }

  // 실시간 동기화 (LISTEN/NOTIFY)
  static async listenToGameUpdates(
    callback: GameUpdateCallback
  ): Promise<() => void> {
    const db = getPool()
    const client = await db.connect()

    console.log('[DB] LISTEN 클라이언트 연결 시작')

    await client.query('LISTEN game_update')
    console.log('[DB] LISTEN game_update 등록 완료')

    client.on('notification', (msg) => {
      if (msg.channel === 'game_update' && msg.payload) {
        try {
          const update = JSON.parse(msg.payload)
          callback(update)
        } catch (err) {
          console.error('[DB] NOTIFY 파싱 오류:', err)
        }
      }
    })

    // DB 에러 핸들링
    client.on('error', (err) => {
      console.error('[DB] LISTEN 클라이언트 에러:', err)
      // 에러 발생 시 연결 파기 (풀에 반환하지 않음)
      try {
        client.release(true) // true = destroy connection
        console.log('[DB] 손상된 LISTEN 연결 파기 완료')
      } catch (e) {
        console.error('[DB] LISTEN 연결 파기 오류:', e)
      }
    })

    // 연결 해제 함수 반환
    return () => {
      console.log('[DB] LISTEN 해제 시작')
      client.query('UNLISTEN game_update')
        .catch((err) => console.error('[DB] UNLISTEN 오류:', err))
        .finally(() => {
          client.release()
          console.log('[DB] LISTEN 클라이언트 해제 완료')
        })
    }
  }

  // 🔥 게임 상태 변경 알림 (NOTIFY 발행)
  static async notifyGameUpdate(update: any): Promise<void> {
    try {
      const db = getPool()
      const payload = JSON.stringify(update)
      await db.query("SELECT pg_notify('game_update', $1)", [payload])
      console.log('[DB] NOTIFY 발행:', update.type || 'update')
    } catch (error) {
      console.error('[DB] NOTIFY 발행 실패:', error)
    }
  }

  // 참가자 활동 시간 업데이트 (heartbeat)
  static async updateParticipantActivity(participantId: string): Promise<void> {
    return executeWithRetry(async () => {
      const db = getPool()
      await db.query(
        `UPDATE game_participants 
         SET last_active_at = NOW() 
         WHERE id = $1`,
        [participantId]
      )
    })
  }

  // 비활성 참가자 타임아웃 처리 (10초)
  static async checkAndTimeoutInactivePlayers(timeoutSeconds: number = 10): Promise<GameParticipant[]> {
    return executeWithRetry(async () => {
      const db = getPool()
      const result = await db.query<GameParticipant>(
        `UPDATE game_participants
         SET status = 'waiting'
         WHERE status = 'playing' 
         AND last_active_at < NOW() - INTERVAL '${timeoutSeconds} seconds'
         RETURNING *`
      )
      return result.rows
    })
  }

  // 연결 종료
  static async closePool(): Promise<void> {
    if (pool) {
      await pool.end()
      pool = null
    }
  }
}

// 기본 export
export default DatabaseService
