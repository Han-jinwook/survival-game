import { type NextRequest, NextResponse } from "next/server"
export const dynamic = 'force-dynamic' // 캐시 비활성화
import { DatabaseService } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { 
      sessionName, 
      initialLives, 
      participants,
      gameStartTime,
      cafeName,
      prize
    } = await request.json()

    if (!sessionName || !initialLives) {
      return NextResponse.json(
        { error: "세션 이름과 초기 목숨을 입력해주세요." }, 
        { status: 400 }
      )
    }

    // 기존 활성 세션 확인
    const activeSession = await DatabaseService.getActiveGameSession()
    
    let session
    if (activeSession) {
      // ⚠️ 기존 세션 업데이트 (새 세션 생성 안 함!)
      session = await DatabaseService.updateGameSession(activeSession.id, {
        session_name: sessionName,
        started_at: gameStartTime,
        cafe_name: cafeName,
        prize: prize,
      })
      console.log("[Settings API] 기존 세션 업데이트:", session.id)
    } else {
      // 새 게임 세션 생성
      session = await DatabaseService.createGameSession(
        sessionName,
        initialLives,
        gameStartTime,
        cafeName,
        prize
      )
      console.log("[Settings API] 새 세션 생성:", session.id)
    }

    // 참가자 등록
    if (participants && Array.isArray(participants) && participants.length > 0) {
      console.log("[Settings API] 참가자 등록 시작:", participants.length, "명")
      
      for (const p of participants) {
        // 사용자 확인 또는 생성
        let user = await DatabaseService.getUserByNaverId(p.naverId)
        
        if (!user) {
          user = await DatabaseService.createUser(p.naverId, p.nickname)
          console.log("[Settings API] 새 사용자 생성:", p.naverId, p.nickname)
        }
        
        if (!user) {
          console.error("[Settings API] 사용자 생성 실패:", p.naverId)
          continue
        }

        // 이미 참가자로 등록되어 있는지 확인
        const existingParticipants = await DatabaseService.getParticipants(session.id)
        const alreadyJoined = existingParticipants.find(ep => ep.user_id === user.id)
        
        if (!alreadyJoined) {
          // 게임 참가자로 등록
          await DatabaseService.addParticipant(
            session.id,
            user.id,
            p.nickname,
            p.lives || initialLives
          )
          console.log("[Settings API] 참가자 추가:", p.nickname)
        } else {
          console.log("[Settings API] 이미 등록된 참가자 건너뜀:", p.nickname)
        }
      }
      console.log("[Settings API] 참가자 등록 완료")
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
        cafeName: session.cafe_name,
        prize: session.prize,
        initialLives: session.initial_lives,
        status: session.status,
        currentRound: session.current_round,
        startedAt: session.started_at,
        createdAt: session.created_at,
      },
      participants: participants.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        naverId: p.naver_id,
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
