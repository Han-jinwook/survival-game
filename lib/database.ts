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
      
      // 🔥 pool.end() 제거 - 풀을 종료하지 않고 재사용
      if (pool && shouldRetry) {
        // 단순히 재시도만 함, 풀은 유지
        console.log('[DB] 연결 재시도, 풀 유지')
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
    updates: Partial<GameRound>,
    whereCondition?: string  // 추가 WHERE 조건 (예: "phase != 'revealing'")
  ): Promise<GameRound | null> {
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
    const whereClause = whereCondition 
      ? `WHERE id = $${paramCount} AND ${whereCondition}`
      : `WHERE id = $${paramCount}`
    
    const result = await db.query<GameRound>(
      `UPDATE game_rounds SET ${fields.join(', ')} ${whereClause} RETURNING *`,
      values
    )
    
    // whereCondition이 있고 업데이트된 행이 없으면 null 반환 (이미 처리됨)
    return result.rows[0] || null
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
    let isReleased = false // 🔥 중복 release 방지

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
      if (!isReleased) {
        try {
          client.release(true) // true = destroy connection
          isReleased = true
          console.log('[DB] 손상된 LISTEN 연결 파기 완료')
        } catch (e) {
          console.error('[DB] LISTEN 연결 파기 오류:', e)
        }
      }
    })

    // 연결 해제 함수 반환
    return () => {
      if (isReleased) {
        console.log('[DB] LISTEN 이미 해제됨, 스킵')
        return
      }
      
      console.log('[DB] LISTEN 해제 시작')
      client.query('UNLISTEN game_update')
        .catch((err) => console.error('[DB] UNLISTEN 오류:', err))
        .finally(() => {
          if (!isReleased) {
            client.release()
            isReleased = true
            console.log('[DB] LISTEN 클라이언트 해제 완료')
          }
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

  // 🎮 게임 로직: 모든 플레이어가 선택했는지 확인
  static async checkAllPlayersReady(roundId: string, phase: string): Promise<boolean> {
    const db = getPool()
    
    // 현재 라운드 정보 가져오기
    const roundResult = await db.query<GameRound>(
      'SELECT * FROM game_rounds WHERE id = $1',
      [roundId]
    )
    const round = roundResult.rows[0]
    if (!round) return false

    // 살아있는 플레이어 수 확인
    const participantsResult = await db.query<GameParticipant>(
      `SELECT COUNT(*) as count FROM game_participants 
       WHERE game_session_id = $1 AND status = 'playing' AND current_lives > 0`,
      [round.game_session_id]
    )
    const aliveCount = parseInt(participantsResult.rows[0].count as any)

    // 선택 완료된 플레이어 수 확인
    const choicesResult = await db.query<PlayerChoice>(
      `SELECT COUNT(*) as count FROM player_choices 
       WHERE round_id = $1 AND ${phase === 'selectTwo' ? 'selected_choices IS NOT NULL' : 'final_choice IS NOT NULL'}`,
      [roundId]
    )
    const choiceCount = parseInt(choicesResult.rows[0].count as any)

    console.log(`[Game Logic] Phase: ${phase}, Alive: ${aliveCount}, Choices: ${choiceCount}`)
    return aliveCount === choiceCount && aliveCount > 0
  }

  // 🎮 게임 로직: 결과 계산 (어떤 무기가 졌는지)
  static async calculateRoundResult(roundId: string, gameMode: 'preliminary' | 'final'): Promise<{
    rockCount: number
    paperCount: number
    scissorsCount: number
    losingChoice: string | null
  }> {
    const db = getPool()
    
    // 모든 선택 조회
    const choices = await db.query<PlayerChoice>(
      'SELECT final_choice FROM player_choices WHERE round_id = $1 AND final_choice IS NOT NULL',
      [roundId]
    )

    const counts = { rock: 0, paper: 0, scissors: 0 }
    choices.rows.forEach(choice => {
      if (choice.final_choice) {
        counts[choice.final_choice]++
      }
    })

    let losingChoice: string | null = null

    if (gameMode === 'final') {
      // 결승: 가위바위보 승부
      const nonZero = Object.entries(counts).filter(([_, count]) => count > 0)
      
      if (nonZero.length === 2) {
        // 2개만 있으면 승부 결정
        const [choice1, choice2] = nonZero.map(([choice]) => choice)
        if (counts.rock > 0 && counts.scissors > 0) losingChoice = 'scissors'
        else if (counts.rock > 0 && counts.paper > 0) losingChoice = 'rock'
        else if (counts.paper > 0 && counts.scissors > 0) losingChoice = 'paper'
      }
      // 3개 or 1개 = 무승부 (losingChoice = null)
    } else {
      // 예선: 가장 적은 수가 탈락
      const nonZero = Object.entries(counts).filter(([_, count]) => count > 0)
      if (nonZero.length > 0) {
        const minCount = Math.min(...nonZero.map(([_, count]) => count))
        const losers = nonZero.filter(([_, count]) => count === minCount)
        if (losers.length === 1) {
          losingChoice = losers[0][0]
        }
      }
    }

    return {
      rockCount: counts.rock,
      paperCount: counts.paper,
      scissorsCount: counts.scissors,
      losingChoice
    }
  }

  // 🎮 게임 로직: 목숨 차감
  static async deductLives(roundId: string, losingChoice: string): Promise<GameParticipant[]> {
    const db = getPool()
    
    // 진 플레이어들의 participant_id 조회
    const losersResult = await db.query<PlayerChoice>(
      'SELECT participant_id FROM player_choices WHERE round_id = $1 AND final_choice = $2',
      [roundId, losingChoice]
    )
    
    const loserIds = losersResult.rows.map(r => r.participant_id)
    if (loserIds.length === 0) return []

    // 목숨 차감
    const updatedResult = await db.query<GameParticipant>(
      `UPDATE game_participants 
       SET current_lives = GREATEST(0, current_lives - 1),
           status = CASE WHEN current_lives - 1 <= 0 THEN 'eliminated'::varchar ELSE status END
       WHERE id = ANY($1)
       RETURNING *`,
      [loserIds]
    )

    return updatedResult.rows
  }

  // 🔒 트랜잭션: 결과 계산 + 목숨 차감 원자적 실행
  static async calculateAndDeductLivesTransaction(
    roundId: string,
    gameMode: 'preliminary' | 'final'
  ): Promise<{
    success: boolean
    result?: {
      rockCount: number
      paperCount: number
      scissorsCount: number
      losingChoice: string | null
    }
    losers?: GameParticipant[]
    message?: string
  }> {
    const pool = getPool()
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // 🔒 SELECT FOR UPDATE: 라운드 잠금 (다른 트랜잭션 대기)
      const lockResult = await client.query<GameRound>(
        'SELECT * FROM game_rounds WHERE id = $1 FOR UPDATE',
        [roundId]
      )
      const round = lockResult.rows[0]
      
      if (!round) {
        await client.query('ROLLBACK')
        return { success: false, message: 'Round not found' }
      }
      
      // 이미 revealing이면 skip (중복 방지)
      if (round.phase === 'revealing') {
        await client.query('ROLLBACK')
        return {
          success: false,
          message: 'Already calculated',
          result: {
            rockCount: round.rock_count,
            paperCount: round.paper_count,
            scissorsCount: round.scissors_count,
            losingChoice: round.losing_choice || null
          }
        }
      }
      
      // 결과 계산
      const result = await this.calculateRoundResult(roundId, gameMode)
      
      // 라운드 업데이트
      await client.query(
        `UPDATE game_rounds 
         SET phase = 'revealing', 
             rock_count = $1, 
             paper_count = $2, 
             scissors_count = $3, 
             losing_choice = $4, 
             ended_at = NOW() 
         WHERE id = $5`,
        [result.rockCount, result.paperCount, result.scissorsCount, result.losingChoice, roundId]
      )
      
      // 목숨 차감
      let losers: GameParticipant[] = []
      if (result.losingChoice) {
        const losersResult = await client.query<PlayerChoice>(
          'SELECT participant_id FROM player_choices WHERE round_id = $1 AND final_choice = $2',
          [roundId, result.losingChoice]
        )
        
        const loserIds = losersResult.rows.map(r => r.participant_id)
        if (loserIds.length > 0) {
          const updatedResult = await client.query<GameParticipant>(
            `UPDATE game_participants 
             SET current_lives = GREATEST(0, current_lives - 1),
                 status = CASE WHEN current_lives - 1 <= 0 THEN 'eliminated'::varchar ELSE status END
             WHERE id = ANY($1)
             RETURNING *`,
            [loserIds]
          )
          losers = updatedResult.rows
        }
      }
      
      await client.query('COMMIT')
      
      return {
        success: true,
        result,
        losers
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

// 기본 export
export default DatabaseService
