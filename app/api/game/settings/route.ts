import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { 
      sessionName, 
      initialLives, 
      participants 
    } = await request.json()

    if (!sessionName || !initialLives) {
      return NextResponse.json(
        { error: "세션 이름과 초기 목숨을 입력해주세요." }, 
        { status: 400 }
      )
    }

    // 기존 활성 세션 확인
    const activeSession = await DatabaseService.getActiveGameSession()
    
    if (activeSession) {
      return NextResponse.json(
        { error: "이미 진행 중인 게임이 있습니다." }, 
        { status: 409 }
      )
    }

    // 새 게임 세션 생성
    const session = await DatabaseService.createGameSession(
      sessionName,
      initialLives
    )

    // 참가자 등록
    if (participants && Array.isArray(participants)) {
      for (const p of participants) {
        // 사용자 확인 또는 생성
        let user = await DatabaseService.getUserByNaverId(p.naverId)
        
        if (!user) {
          user = await DatabaseService.createUser(p.naverId, p.nickname)
        }

        // 게임 참가자로 등록
        await DatabaseService.addParticipant(
          session.id,
          user.id,
          p.nickname,
          p.lives || initialLives
        )
      }
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        sessionName: session.session_name,
        initialLives: session.initial_lives,
        status: session.status,
      },
    })
  } catch (error) {
    console.error("Game settings error:", error)
    return NextResponse.json(
      { error: "게임 설정을 저장할 수 없습니다." }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await DatabaseService.getActiveGameSession()
    
    if (!session) {
      return NextResponse.json({ session: null })
    }

    const participants = await DatabaseService.getParticipants(session.id)

    return NextResponse.json({
      session: {
        id: session.id,
        sessionName: session.session_name,
        initialLives: session.initial_lives,
        status: session.status,
        currentRound: session.current_round,
        createdAt: session.created_at,
      },
      participants: participants.map(p => ({
        id: p.id,
        userId: p.user_id,
        nickname: p.nickname,
        initialLives: p.initial_lives,
        currentLives: p.current_lives,
        status: p.status,
        joinedAt: p.joined_at,
      })),
    })
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json(
      { error: "게임 설정을 불러올 수 없습니다." }, 
      { status: 500 }
    )
  }
}
