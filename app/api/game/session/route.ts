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
    const body = await request.json()
    const { action, sessionId, userId, participantId, nickname, initialLives, updates } = body

    // 🔒 닫힌 세션에 대한 mutating 작업 차단
    const protectedActions = ["reset_session", "start_countdown", "start", "update", "complete"]
    if (protectedActions.includes(action) && sessionId) {
      const session = await DatabaseService.getGameSession(sessionId)
      if (session?.status === "closed") {
        return NextResponse.json({ 
          error: "닫힌 세션은 수정할 수 없습니다. 새 세션을 생성해주세요." 
        }, { status: 403 })
      }
    }

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
      // 로비 입장: 참가자 상태를 "in_lobby"로 변경
      if (!participantId) {
        return NextResponse.json({ error: "참가자 ID가 필요합니다." }, { status: 400 })
      }
      
      const participant = await DatabaseService.updateParticipant(participantId, {
        status: "in_lobby" // 'playing'이 아니라 'in_lobby'가 올바른 상태입니다.
      })

      if (!participant) {
        return NextResponse.json({ error: "참가자 상태를 업데이트할 수 없습니다." }, { status: 500 });
      }
      
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

      if (!participant) {
        console.error(`[Lobby] 참가자(${participantId}) 퇴장 처리 실패: 참가자를 찾을 수 없거나 업데이트에 실패했습니다.`);
        return NextResponse.json({ success: true, message: "Participant not found or update failed, but proceeding." });
      }
      
      console.log(`[Lobby] 참가자 로비 퇴장: ${participant.nickname} (${participantId})`)
      
      return NextResponse.json({ success: true, participant })
    }

    // ... (이하 다른 action들은 그대로 유지) ...

    if (action === "reset_session") {
      // 세션 리셋: status → 'waiting', current_round → 0, 모든 참가자 → 'waiting'
      if (!sessionId) {
        return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 })
      }
      
      const participants = await DatabaseService.getParticipants(sessionId)
      for (const participant of participants) {
        await DatabaseService.updateParticipant(participant.id, {
          status: "waiting"
        })
      }
      
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "waiting",
        current_round: 0,
      })
      
      console.log(`[세션 리셋] 세션 ${sessionId} 및 참가자 ${participants.length}명을 대기 상태로 변경`)
      return NextResponse.json({ success: true, session, participantsReset: participants.length })
    }

    if (action === "start_countdown") {
      // 카운트다운 시작: status → 'starting'
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "starting",
        current_round: 0,
      })
      
      console.log(`[카운트다운 시작] 세션: ${session.id}, 10초 후 게임 시작`)
      
      setTimeout(async () => {
        try {
          const currentSession = await DatabaseService.getGameSession(sessionId)
          if (!currentSession || currentSession.status !== "starting") {
            console.log(`[게임 시작] 세션 상태 변경됨 (${currentSession?.status}), 자동 시작 취소`)
            return
          }

          const participants = await DatabaseService.getParticipants(sessionId)
          
          for (const participant of participants) {
            if (participant.status !== 'in_lobby') {
              await DatabaseService.updateParticipant(participant.id, {
                status: 'eliminated',
                eliminated_at: new Date().toISOString()
              })
              console.log(`[게임 시작] 로비 미입장자 제거: ${participant.nickname}`)
            } else {
              await DatabaseService.updateParticipant(participant.id, {
                status: 'playing'
              })
            }
          }
          
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
      const participants = await DatabaseService.getParticipants(sessionId)
      
      for (const participant of participants) {
        if (participant.status !== 'in_lobby') {
          await DatabaseService.updateParticipant(participant.id, {
            status: 'eliminated',
            eliminated_at: new Date().toISOString()
          })
          console.log(`[게임 시작] 로비 미입장자 제거: ${participant.nickname}`)
        } else {
          await DatabaseService.updateParticipant(participant.id, {
            status: 'playing'
          })
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

    if (action === "close_session") {
      if (!sessionId) {
        return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 })
      }
      
      const session = await DatabaseService.updateGameSession(sessionId, {
        status: "closed",
      })
      
      console.log(`[세션 닫기] 세션 ${sessionId}가 닫혔습니다. 더 이상 수정할 수 없습니다.`)
      return NextResponse.json({ success: true, session })
    }

    if (action === "create_new_session") {
      const { sessionName, startedAt, cafeName, prize } = body
      
      const newSession = await DatabaseService.createGameSession(
        sessionName || "가위바위보 하나빼기 게임",
        initialLives || 5,
        startedAt,
        cafeName,
        prize
      )
      
      console.log(`[새 세션 생성] ID: ${newSession.id}, 이름: ${newSession.session_name}`)
      return NextResponse.json({ success: true, session: newSession })
    }

    return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 })
  } catch (error) {
    console.error("Game session action error:", error)
    return NextResponse.json({ error: "게임 액션을 처리할 수 없습니다." }, { status: 500 })
  }
}