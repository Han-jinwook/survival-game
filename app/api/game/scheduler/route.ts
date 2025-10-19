import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    console.log("[Scheduler] 외부 Cron 스케줄러 실행 시작")
    
    // 🔐 보안: 외부 Cron 서비스에서만 호출 가능하도록 토큰 체크
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.SCHEDULER_SECRET_TOKEN
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      console.log("[Scheduler] ❌ 인증 실패 - 권한 없는 접근")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    console.log("[Scheduler] 현재 시간:", now.toISOString())

    // 1. 예약된 게임 세션 조회 (waiting 상태 + started_at이 현재 시간 이전)
    const sessions = await DatabaseService.getAllGameSessions()
    const scheduledSessions = sessions.filter(session => 
      session.status === 'waiting' && 
      session.started_at && 
      new Date(session.started_at) <= now
    )

    console.log("[Scheduler] 전체 세션 수:", sessions.length)
    console.log("[Scheduler] 시작 대상 세션 수:", scheduledSessions.length)

    if (scheduledSessions.length === 0) {
      console.log("[Scheduler] 시작할 게임 없음")
      return NextResponse.json({ 
        success: true, 
        message: "시작할 예약된 게임이 없습니다.",
        checkedAt: now.toISOString()
      })
    }

    const results = []

    // 2. 각 세션에 대해 게임 시작 처리
    for (const session of scheduledSessions) {
      console.log(`[Scheduler] 세션 ${session.id} 게임 시작 처리 중...`)
      
      try {
        // 2-1. 참가자 조회
        const users = await DatabaseService.getUsersBySession(session.id)
        const playerUsers = users.filter(u => u.status === 'player')
        
        console.log(`[Scheduler] 세션 ${session.id} - player 수: ${playerUsers.length}명`)

        // 2-2. 참가자 수에 따른 처리
        if (playerUsers.length === 0) {
          // 참가자 없음 - 게임 취소
          await DatabaseService.updateGameSession(session.id, {
            status: "completed",
            ended_at: now.toISOString(),
          })
          
          results.push({
            sessionId: session.id,
            sessionName: session.session_name,
            status: "cancelled",
            reason: "참가자 없음",
            playerCount: 0
          })
          
          console.log(`[Scheduler] 세션 ${session.id} - 참가자 없어서 취소`)
          
        } else if (playerUsers.length === 1) {
          // 참가자 1명 - 자동 우승
          const winner = playerUsers[0]
          
          await DatabaseService.updateUser(winner.id, {
            status: 'winner'
          })
          
          await DatabaseService.updateGameSession(session.id, {
            status: "completed",
            winner_id: winner.id,
            ended_at: now.toISOString(),
          })
          
          results.push({
            sessionId: session.id,
            sessionName: session.session_name,
            status: "auto_win",
            winner: {
              id: winner.id,
              nickname: winner.nickname
            },
            playerCount: 1
          })
          
          console.log(`[Scheduler] 세션 ${session.id} - ${winner.nickname} 자동 우승`)
          
        } else {
          // 참가자 2명 이상 - 정상 게임 시작
          
          // 2-3. 세션을 in_progress로 변경
          await DatabaseService.updateGameSession(session.id, {
            status: "in_progress",
            started_at: now.toISOString(),
          })
          
          // 2-4. 플레이어 데이터 초기화 (Promise.all로 동시 처리)
          await Promise.all(
            playerUsers.map(player =>
              DatabaseService.updateUser(player.id, {
                eliminated_at: null,
                current_lives: player.initial_lives
              })
            )
          )
          
          // 2-5. 첫 라운드 생성
          const roundPhase = playerUsers.length >= 5 ? 'selection' : 'final_selection'
          const round = await DatabaseService.createRound(session.id, 1, roundPhase)
          
          if (round) {
            results.push({
              sessionId: session.id,
              sessionName: session.session_name,
              status: "started",
              playerCount: playerUsers.length,
              roundId: round.id,
              phase: roundPhase
            })
            
            console.log(`[Scheduler] 세션 ${session.id} - 게임 시작 완료 (${playerUsers.length}명, ${roundPhase})`)
          } else {
            throw new Error("라운드 생성 실패")
          }
        }
        
      } catch (error) {
        console.error(`[Scheduler] 세션 ${session.id} 처리 실패:`, error)
        
        results.push({
          sessionId: session.id,
          sessionName: session.session_name,
          status: "error",
          error: error instanceof Error ? error.message : "알 수 없는 오류"
        })
      }
    }

    console.log("[Scheduler] 외부 Cron 스케줄러 실행 완료")
    
    return NextResponse.json({
      success: true,
      executedAt: now.toISOString(),
      processedSessions: results.length,
      results: results
    })

  } catch (error) {
    console.error("[Scheduler] 스케줄러 실행 오류:", error)
    return NextResponse.json({ 
      error: "스케줄러 실행 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    }, { status: 500 })
  }
}

// GET 요청으로 스케줄러 상태 확인 (디버깅용)
export async function GET() {
  try {
    const now = new Date()
    const sessions = await DatabaseService.getAllGameSessions()
    
    const waitingSessions = sessions.filter(s => s.status === 'waiting')
    const scheduledSessions = waitingSessions.filter(s => 
      s.started_at && new Date(s.started_at) <= now
    )
    
    return NextResponse.json({
      currentTime: now.toISOString(),
      totalSessions: sessions.length,
      waitingSessions: waitingSessions.length,
      readyToStart: scheduledSessions.length,
      scheduledSessions: scheduledSessions.map(s => ({
        id: s.id,
        name: s.session_name,
        startTime: s.started_at,
        status: s.status
      }))
    })
  } catch (error) {
    console.error("[Scheduler] 상태 조회 오류:", error)
    return NextResponse.json({ error: "상태 조회 실패" }, { status: 500 })
  }
}
