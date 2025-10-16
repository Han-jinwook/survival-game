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
    const { action, sessionId, userId, participantId, nickname, initialLives, updates } = await request.json()

    if (action === "join") {
      const participant = await DatabaseService.addParticipant(
        sessionId, 
        userId, 
        nickname,
        initialLives || 5
      )
      return NextResponse.json({ success: true, participant })
    }

    if (action === "enter_lobby") {
      // 로비 입장: 참가자 상태를 "playing"으로 변경
      if (!participantId) {
        return NextResponse.json({ error: "참가자 ID가 필요합니다." }, { status: 400 })
      }
      
      const participant = await DatabaseService.updateParticipant(participantId, {
        status: "playing"
      })
      
      console.log(`[Lobby] 참가자 로비 입장: ${participant.nickname} (${participantId})`)
      return NextResponse.json({ success: true, participant })
    }

    if (action === "exit_lobby") {
      // 로비 퇴장: 참가자 상태를 "waiting"으로 변경
      if (!participantId) {
        return NextResponse.json({ error: "참가자 ID가 필요합니다." }, { status: 400 })
      }
      
      const participant = await DatabaseService.updateParticipant(participantId, {
        status: "waiting"
      })
      
      console.log(`[Lobby] 참가자 로비 퇴장: ${participant.nickname} (${participantId})`)
      return NextResponse.json({ success: true, participant })
    }

    if (action === "reset_session") {
      // 세션 리셋: status → 'waiting', current_round → 0
      if (!sessionId) {
        return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 })
      }
      
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "waiting",
        current_round: 0,
      })
      
      console.log(`[세션 리셋] 세션 ${sessionId}을 대기 상태로 변경`)
      return NextResponse.json({ success: true, session })
    }

    if (action === "start_countdown") {
      // 카운트다운 시작: status → 'starting'
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "starting",
        current_round: 0,
      })
      
      console.log(`[카운트다운 시작] 세션: ${session.id}, 10초 후 게임 시작`)
      
      // 10초 후 자동으로 in-progress로 변경 + 로비 미입장자 제거
      setTimeout(async () => {
        try {
          const participants = await DatabaseService.getParticipants(sessionId)
          
          // status !== 'playing'인 참가자를 eliminated로 변경
          for (const participant of participants) {
            if (participant.status !== 'playing') {
              await DatabaseService.updateParticipant(participant.id, {
                status: 'eliminated',
                eliminated_at: new Date().toISOString()
              })
              console.log(`[게임 시작] 로비 미입장자 제거: ${participant.nickname}`)
            }
          }
          
          // 게임 시작
          await DatabaseService.updateGameSession(sessionId, {
            status: "in_progress",
            started_at: new Date().toISOString(),
          })
          
          console.log(`[게임 시작] 세션 ${sessionId} 게임 진행 중`)
        } catch (error) {
          console.error('[게임 시작] 자동 시작 오류:', error)
        }
      }, 10000) // 10초 후
      
      return NextResponse.json({ success: true, session })
    }
    
    if (action === "start") {
      // 즉시 게임 시작 (기존 로직 유지)
      const participants = await DatabaseService.getParticipants(sessionId)
      
      for (const participant of participants) {
        if (participant.status !== 'playing') {
          await DatabaseService.updateParticipant(participant.id, {
            status: 'eliminated',
            eliminated_at: new Date().toISOString()
          })
          console.log(`[게임 시작] 로비 미입장자 제거: ${participant.nickname}`)
        }
      }
      
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "in_progress",
        started_at: new Date().toISOString(),
        current_round: 0,
      })
      
      console.log(`[게임 시작] 세션 업데이트 완료: ${session.id}`)
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
