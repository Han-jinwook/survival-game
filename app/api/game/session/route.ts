import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function GET() {
  try {
    // 현재 활성 게임 세션 조회
    const activeSession = await DatabaseService.getActiveGameSession()

    if (!activeSession) {
      // 새 게임 세션 생성
      const newSession = await DatabaseService.createGameSession({
        session_name: `서바이벌 게임 #${Date.now()}`,
        max_players: 100,
        min_players: 10,
        initial_lives: 5,
      })

      return NextResponse.json({ session: newSession })
    }

    return NextResponse.json({ session: activeSession })
  } catch (error) {
    console.error("Game session error:", error)
    return NextResponse.json({ error: "게임 세션을 불러올 수 없습니다." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, sessionId, userId, nickname } = await request.json()

    if (action === "join") {
      // 게임 참가
      const participant = await DatabaseService.addParticipant(sessionId, userId, nickname)
      return NextResponse.json({ participant })
    }

    return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 })
  } catch (error) {
    console.error("Game session action error:", error)
    return NextResponse.json({ error: "게임 액션을 처리할 수 없습니다." }, { status: 500 })
  }
}
