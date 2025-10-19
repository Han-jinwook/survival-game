import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    console.log("[Timer Tick] 타이머 틱 스케줄러 실행 시작")
    
    // 🔐 보안: 외부 Cron 서비스에서만 호출 가능하도록 토큰 체크
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.SCHEDULER_SECRET_TOKEN
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      console.log("[Timer Tick] ❌ 인증 실패 - 권한 없는 접근")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. 진행 중인 모든 게임 세션 조회
    const sessions = await DatabaseService.getAllGameSessions()
    const activeSessions = sessions.filter(session => session.status === 'in_progress')
    
    console.log("[Timer Tick] 활성 세션 수:", activeSessions.length)

    if (activeSessions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "진행 중인 게임이 없습니다.",
        processedRounds: 0
      })
    }

    const results = []

    // 2. 각 세션의 현재 라운드에 대해 타이머 처리
    for (const session of activeSessions) {
      try {
        const currentRound = await DatabaseService.getCurrentRound(session.id)
        
        if (!currentRound) {
          console.log(`[Timer Tick] 세션 ${session.id} - 현재 라운드 없음`)
          continue
        }

        // 타이머가 0 이하이거나 완료된 라운드는 건너뛰기
        if (currentRound.time_left <= 0 || currentRound.phase === 'completed') {
          continue
        }

        console.log(`[Timer Tick] 라운드 ${currentRound.id} - ${currentRound.phase} ${currentRound.time_left}초`)

        // 타이머 1초 감소
        const newTimeLeft = Math.max(0, currentRound.time_left - 1)
        
        // 시간이 0이 되면 다음 단계로 전환
        let newPhase = currentRound.phase
        let newMessage = currentRound.phase_message
        let resetTimer = newTimeLeft

        if (newTimeLeft === 0) {
          switch (currentRound.phase) {
            case 'waiting':
              // 준비 단계 완료 → 무기 선택 시작
              newPhase = 'selectTwo'
              newMessage = '무기 2개를 선택하세요!'
              resetTimer = 10
              console.log(`[Timer Tick] 단계 전환: waiting → selectTwo`)
              break
            case 'selectTwo':
              newPhase = 'excludeOne'
              newMessage = '하나 빼기! 선택한 2개 중 하나를 빼세요!'
              resetTimer = 10
              console.log(`[Timer Tick] 단계 전환: selectTwo → excludeOne`)
              break
            case 'excludeOne':
              newPhase = 'revealing'
              newMessage = '결과를 확인하세요!'
              resetTimer = 5
              console.log(`[Timer Tick] 단계 전환: excludeOne → revealing`)
              break
            case 'revealing':
              // 라운드 종료 - 결과 계산 및 다음 라운드 준비
              newPhase = 'completed'
              newMessage = '라운드 완료!'
              resetTimer = 0
              console.log(`[Timer Tick] 라운드 완료: revealing → completed`)
              
              // TODO: 결과 계산 및 다음 라운드 생성 로직 추가
              break
          }
        }

        // DB 업데이트
        await DatabaseService.updateRound(currentRound.id, {
          time_left: resetTimer,
          phase: newPhase,
          phase_message: newMessage,
          phase_started_at: newTimeLeft === 0 ? new Date().toISOString() : currentRound.phase_started_at
        })

        results.push({
          sessionId: session.id,
          roundId: currentRound.id,
          phase: newPhase,
          timeLeft: resetTimer,
          phaseChanged: newTimeLeft === 0
        })

      } catch (error) {
        console.error(`[Timer Tick] 세션 ${session.id} 처리 실패:`, error)
      }
    }

    console.log("[Timer Tick] 타이머 틱 스케줄러 실행 완료")
    
    return NextResponse.json({
      success: true,
      processedRounds: results.length,
      results: results
    })

  } catch (error) {
    console.error("[Timer Tick] 스케줄러 실행 오류:", error)
    return NextResponse.json({ 
      error: "타이머 틱 스케줄러 실행 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    }, { status: 500 })
  }
}
