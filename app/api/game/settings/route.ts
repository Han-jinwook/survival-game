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
        // 이미 세션에 등록되어 있는지 확인
        const existingUser = await DatabaseService.getUserByNaverIdAndSession(p.naverId, session.id)
        
        if (!existingUser) {
          // 세션에 사용자 추가
          await DatabaseService.addUserToSession(
            session.id,
            p.naverId,
            p.nickname,
            p.lives || initialLives
          )
          console.log("[Settings API] 사용자 추가:", p.nickname, "(", p.naverId, ")")
        } else {
          // 이미 등록된 사용자의 목숨값 업데이트
          await DatabaseService.updateUser(existingUser.id, {
            current_lives: p.lives,
            nickname: p.nickname,
          })
          console.log("[Settings API] 사용자 목숨값 업데이트:", p.nickname, "→", p.lives)
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

    const users = await DatabaseService.getUsersBySession(session.id)

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
      users: users.map((u: any) => ({
        id: u.id,
        userId: u.id,
        naver_id: u.naver_id,
        nickname: u.nickname,
        initialLives: u.initial_lives,
        current_lives: u.current_lives,
        status: u.status,
        joined_at: u.joined_at,
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
