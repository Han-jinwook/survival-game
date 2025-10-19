import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"
import type { PlayerChoice } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const sessionIdParam = request.nextUrl.searchParams.get('sessionId')
    
    // 세션 ID가 없으면 현재 활성 세션을 자동으로 가져옴
    let session = null
    let sessionId: number | null = null
    
    if (!sessionIdParam) {
      const activeSession = await DatabaseService.getActiveGameSession()
      if (activeSession) {
        session = activeSession
        sessionId = activeSession.id
        console.log(`[API State] 활성 세션 자동 조회: ${sessionId}`)
      }
    } else {
      sessionId = parseInt(sessionIdParam, 10)
      if (!isNaN(sessionId)) {
        session = await DatabaseService.getGameSession(sessionId)
        console.log(`[API State] 세션 조회: ${sessionId}`)
      }
    }
    
    if (!session || !sessionId) {
      console.log('[API State] 활성 게임 세션 없음 - 빈 응답 반환')
      return NextResponse.json({ 
        session: null, 
        participants: [], 
        round: null, 
        choices: [] 
      })
    }

    const participants = await DatabaseService.getUsersBySession(sessionId)
    const currentRound = await DatabaseService.getCurrentRound(sessionId)
    
    console.log(`[API State] 현재 라운드 조회: ${currentRound ? currentRound.id : 'null'}`)

    let roundData = null
    let choices: PlayerChoice[] = []

    if (currentRound) {
      choices = await DatabaseService.getPlayerChoices(currentRound.id)
      roundData = {
        id: currentRound.id,
        roundNumber: currentRound.round_number,
        phase: currentRound.phase,
        survivorsCount: currentRound.survivors_count,
        rockCount: currentRound.rock_count,
        paperCount: currentRound.paper_count,
        scissorsCount: currentRound.scissors_count,
        losingChoice: currentRound.losing_choice,
        startedAt: currentRound.started_at,
        endedAt: currentRound.ended_at,
        // 🎯 서버 타이머 정보 추가
        time_left: currentRound.time_left || 0,
        phase_message: currentRound.phase_message || '',
        phase_started_at: currentRound.phase_started_at,
      }
    }

    return NextResponse.json({
      session: {
        id: session.id,
        sessionName: session.session_name,
        cafeName: session.cafe_name,
        prize: session.prize,
        status: session.status,
        initialLives: session.initial_lives,
        winnerId: session.winner_id,
        startedAt: session.started_at,
        endedAt: session.ended_at,
      },
      participants: participants.map(p => ({
        id: p.id,
        userId: p.id, // User 타입이므로 user_id 필드가 없음, id를 사용
        naverId: p.naver_id,
        nickname: p.nickname,
        initialLives: p.initial_lives,
        currentLives: p.current_lives,
        status: p.status,
        joinedAt: p.joined_at,
        eliminatedAt: p.eliminated_at,
      })),
      round: roundData,
      choices: choices.map(c => ({
        id: c.id,
        userId: c.user_id,
        selectedChoices: c.selected_choices,
        finalChoice: c.final_choice,
        chosenAt: c.chosen_at,
      })),
    })
  } catch (error) {
    console.error("Get game state error:", error)
    return NextResponse.json({ error: "게임 상태를 불러올 수 없습니다." }, { status: 500 })
  }
}
