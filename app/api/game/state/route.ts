import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService, type PlayerChoice } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    let sessionId: string | null = request.nextUrl.searchParams.get('sessionId')
    
    // 세션 ID가 없으면 현재 활성 세션을 자동으로 가져옴
    let session = null
    if (!sessionId) {
      const activeSession = await DatabaseService.getActiveGameSession()
      if (activeSession) {
        session = activeSession
        sessionId = activeSession.id
      }
    } else {
      session = await DatabaseService.getGameSession(sessionId)
    }
    
    if (!session || !sessionId) {
      return NextResponse.json({ error: "게임 세션을 찾을 수 없습니다." }, { status: 404 })
    }

    const participants = await DatabaseService.getParticipants(sessionId)
    const currentRound = await DatabaseService.getCurrentRound(sessionId)

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
      }
    }

    return NextResponse.json({
      session: {
        id: session.id,
        sessionName: session.session_name,
        status: session.status,
        initialLives: session.initial_lives,
        currentRound: session.current_round,
        winnerId: session.winner_id,
        startedAt: session.started_at,
        endedAt: session.ended_at,
      },
      participants: participants.map(p => ({
        id: p.id,
        userId: p.user_id,
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
        participantId: c.participant_id,
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
