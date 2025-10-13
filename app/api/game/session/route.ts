import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function GET() {
  try {
    const activeSession = await DatabaseService.getActiveGameSession()

    if (!activeSession) {
      return NextResponse.json({ session: null })
    }

    const participants = await DatabaseService.getParticipants(activeSession.id)

    return NextResponse.json({
      session: {
        id: activeSession.id,
        sessionName: activeSession.session_name,
        status: activeSession.status,
        initialLives: activeSession.initial_lives,
        currentRound: activeSession.current_round,
        startedAt: activeSession.started_at,
        createdAt: activeSession.created_at,
      },
      participants: participants.map(p => ({
        id: p.id,
        userId: p.user_id,
        nickname: p.nickname,
        currentLives: p.current_lives,
        status: p.status,
        joinedAt: p.joined_at,
      })),
    })
  } catch (error) {
    console.error("Game session error:", error)
    return NextResponse.json({ error: "게임 세션을 불러올 수 없습니다." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, sessionId, userId, nickname, initialLives, updates } = await request.json()

    if (action === "join") {
      const participant = await DatabaseService.addParticipant(
        sessionId, 
        userId, 
        nickname,
        initialLives || 5
      )
      return NextResponse.json({ success: true, participant })
    }

    if (action === "start") {
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      return NextResponse.json({ success: true, session })
    }

    if (action === "update") {
      const session = await DatabaseService.updateGameSession(sessionId, updates)
      return NextResponse.json({ success: true, session })
    }

    if (action === "complete") {
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "completed",
        ended_at: new Date().toISOString(),
        ...updates,
      })
      return NextResponse.json({ success: true, session })
    }

    return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 })
  } catch (error) {
    console.error("Game session action error:", error)
    return NextResponse.json({ error: "게임 액션을 처리할 수 없습니다." }, { status: 500 })
  }
}
