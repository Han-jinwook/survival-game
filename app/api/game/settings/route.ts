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
    if (participants && Array.isArray(participants)) {
      console.log("[Settings API] 참가자 동기화 시작:", participants.length, "명")
      
      // 1. 현재 DB의 모든 사용자 조회
      const dbUsers = await DatabaseService.getUsersBySession(session.id)
      const requestedNaverIds = new Set(participants.map(p => p.naverId))
      
      // 2. DB에 있지만 요청에 없는 사용자 삭제
      for (const dbUser of dbUsers) {
        if (!requestedNaverIds.has(dbUser.naver_id)) {
          await DatabaseService.deleteUser(dbUser.id)
          console.log("[Settings API] 사용자 삭제:", dbUser.nickname, "(", dbUser.naver_id, ")")
        }
      }
      
      // 3. 요청된 사용자 추가/업데이트
      for (const p of participants) {
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
          // 이미 등록된 사용자의 목숨값 업데이트 (초기값 + 현재값 둘 다)
          await DatabaseService.updateUser(existingUser.id, {
            initial_lives: p.lives,
            current_lives: p.lives,
            nickname: p.nickname,
          })
          console.log("[Settings API] 사용자 목숨값 업데이트:", p.nickname, "→", p.lives, "(초기/현재 둘 다)")
        }
      }
      console.log("[Settings API] 참가자 동기화 완료")
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
    // 1. 먼저 활성 세션 찾기
    let session = await DatabaseService.getActiveGameSession()
    
    // 2. 활성 세션이 없으면 가장 최근 세션 가져오기
    if (!session) {
      console.log('[Settings API] 활성 세션 없음, 최근 세션 조회 중...')
      const allSessions = await DatabaseService.getAllGameSessions()
      session = allSessions[0] || null
      if (session) {
        console.log('[Settings API] 최근 세션 로드:', session.id, 'status:', session.status)
      }
    }
    
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
