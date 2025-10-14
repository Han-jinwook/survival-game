import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/lib/database"

// GET /api/game/sessions - 모든 게임 세션 목록 조회
export async function GET(request: NextRequest) {
  try {
    const pool = getPool()
    const client = await pool.connect()
    
    try {
      // 모든 세션을 최신순으로 조회
      const sessionsResult = await client.query(`
        SELECT 
          id,
          session_name,
          cafe_name,
          prize,
          status,
          initial_lives,
          current_round,
          started_at,
          created_at,
          ended_at
        FROM game_sessions
        ORDER BY created_at DESC
      `)
      
      // 각 세션의 참가자 수 조회
      const sessionsWithParticipants = await Promise.all(
        sessionsResult.rows.map(async (session: any) => {
          const participantsResult = await client.query(
            `SELECT COUNT(*) as count FROM game_participants WHERE game_session_id = $1`,
            [session.id]
          )
          
          return {
            ...session,
            participantCount: parseInt(participantsResult.rows[0].count),
          }
        })
      )
      
      return NextResponse.json({
        sessions: sessionsWithParticipants,
        total: sessionsWithParticipants.length,
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("[API] 세션 목록 조회 실패:", error)
    return NextResponse.json(
      { error: "세션 목록을 불러올 수 없습니다" },
      { status: 500 }
    )
  }
}

// GET /api/game/sessions?id=xxx - 특정 세션 상세 조회
export async function GET_BY_ID(sessionId: string) {
  try {
    const pool = getPool()
    const client = await pool.connect()
    
    try {
      // 세션 정보 조회
      const sessionResult = await client.query(
        `SELECT * FROM game_sessions WHERE id = $1`,
        [sessionId]
      )
      
      if (sessionResult.rows.length === 0) {
        return null
      }
      
      // 참가자 정보 조회
      const participantsResult = await client.query(
        `
        SELECT 
          gp.*,
          u.naver_id
        FROM game_participants gp
        JOIN users u ON gp.user_id = u.id
        WHERE gp.game_session_id = $1
        ORDER BY gp.joined_at ASC
        `,
        [sessionId]
      )
      
      return {
        session: sessionResult.rows[0],
        participants: participantsResult.rows,
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("[API] 세션 상세 조회 실패:", error)
    return null
  }
}
