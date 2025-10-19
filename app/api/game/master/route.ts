import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

// 🎮 게임 마스터 API - 서버에서 모든 게임 로직 통제
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, sessionId } = body

    if (action === "start_game") {
      // 1. 게임 시작 - 서버에서 첫 라운드 생성
      const session = await DatabaseService.getGameSession(sessionId)
      if (!session) {
        return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 })
      }

      // 2. 첫 라운드 생성
      const round = await DatabaseService.createRound(sessionId, 1, 'selection')
      
      // 3. 게임 상태를 in_progress로 변경
      await DatabaseService.updateGameSession(sessionId, {
        status: 'in_progress',
        started_at: new Date().toISOString()
      })

      // 4. 30초 후 자동으로 다음 단계 진행
      setTimeout(() => {
        processRoundPhase(sessionId, round.id, 'elimination')
      }, 30000)

      console.log(`[게임 마스터] 게임 시작: 세션 ${sessionId}, 라운드 ${round.id}`)
      
      return NextResponse.json({ 
        success: true, 
        gameState: {
          status: 'in_progress',
          roundNumber: 1,
          phase: 'selection',
          timeLeft: 30,
          roundId: round.id
        }
      })
    }

    if (action === "get_game_state") {
      // 현재 게임 상태 조회
      const session = await DatabaseService.getGameSession(sessionId)
      const currentRound = await DatabaseService.getCurrentRound(sessionId)
      const participants = await DatabaseService.getUsersBySession(sessionId)
      
      let choices = []
      if (currentRound) {
        choices = await DatabaseService.getPlayerChoices(currentRound.id)
      }

      return NextResponse.json({
        gameState: {
          status: session?.status || 'waiting',
          roundNumber: currentRound?.round_number || 0,
          phase: currentRound?.phase || 'waiting',
          roundId: currentRound?.id || null,
          participants: participants.map(p => ({
            id: p.id,
            nickname: p.nickname,
            currentLives: p.current_lives,
            status: p.status
          })),
          choices: choices.map(c => ({
            userId: c.user_id,
            selectedChoices: c.selected_choices,
            finalChoice: c.final_choice
          }))
        }
      })
    }

    return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 })
  } catch (error) {
    console.error("게임 마스터 에러:", error)
    return NextResponse.json({ error: "게임 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}

// 🕐 라운드 단계 자동 진행 함수
async function processRoundPhase(sessionId: number, roundId: string, nextPhase: string) {
  try {
    console.log(`[게임 마스터] 라운드 단계 진행: ${roundId} -> ${nextPhase}`)
    
    if (nextPhase === 'elimination') {
      // 1. 결과 계산 및 탈락자 처리
      await DatabaseService.processRoundResults(roundId, 'preliminary')
      
      // 2. 라운드 상태 업데이트
      await DatabaseService.updateRound(roundId, {
        phase: 'elimination',
        ended_at: new Date().toISOString()
      })
      
      // 3. 5초 후 다음 라운드 또는 게임 종료
      setTimeout(() => {
        checkGameEnd(sessionId)
      }, 5000)
    }
  } catch (error) {
    console.error(`[게임 마스터] 라운드 처리 오류:`, error)
  }
}

// 🏁 게임 종료 조건 확인
async function checkGameEnd(sessionId: number) {
  try {
    const participants = await DatabaseService.getUsersBySession(sessionId)
    const alivePlayers = participants.filter(p => p.current_lives > 0 && p.status !== 'eliminated')
    
    if (alivePlayers.length <= 1) {
      // 게임 종료
      const winner = alivePlayers[0] || null
      await DatabaseService.updateGameSession(sessionId, {
        status: 'completed',
        winner_id: winner?.id || null,
        ended_at: new Date().toISOString()
      })
      
      console.log(`[게임 마스터] 게임 종료: 승자 ${winner?.nickname || '없음'}`)
    } else if (alivePlayers.length <= 4) {
      // 결승전 시작
      startFinalRound(sessionId, alivePlayers.length)
    } else {
      // 다음 예선 라운드
      startNextRound(sessionId)
    }
  } catch (error) {
    console.error(`[게임 마스터] 게임 종료 확인 오류:`, error)
  }
}

// 🆕 다음 라운드 시작
async function startNextRound(sessionId: number) {
  try {
    const currentRound = await DatabaseService.getCurrentRound(sessionId)
    const nextRoundNumber = (currentRound?.round_number || 0) + 1
    
    // 새 라운드 생성
    const round = await DatabaseService.createRound(sessionId, nextRoundNumber, 'selection')
    
    console.log(`[게임 마스터] 다음 라운드 시작: ${nextRoundNumber}`)
    
    // 30초 후 자동 진행
    setTimeout(() => {
      processRoundPhase(sessionId, round.id, 'elimination')
    }, 30000)
  } catch (error) {
    console.error(`[게임 마스터] 다음 라운드 시작 오류:`, error)
  }
}

// 🏆 결승전 시작
async function startFinalRound(sessionId: number, playerCount: number) {
  try {
    const currentRound = await DatabaseService.getCurrentRound(sessionId)
    const nextRoundNumber = (currentRound?.round_number || 0) + 1
    
    // 결승 라운드 생성
    const round = await DatabaseService.createRound(sessionId, nextRoundNumber, 'final_selection')
    
    // 세션을 결승 상태로 업데이트
    await DatabaseService.updateGameSession(sessionId, {
      status: 'finals'
    })
    
    console.log(`[게임 마스터] 결승전 시작: ${playerCount}명`)
    
    // 결승전은 2단계 (선택 + 하나빼기)
    setTimeout(() => {
      processRoundPhase(sessionId, round.id, 'final_elimination')
    }, 20000) // 20초 (10초 선택 + 10초 하나빼기)
  } catch (error) {
    console.error(`[게임 마스터] 결승전 시작 오류:`, error)
  }
}

export async function GET(request: NextRequest) {
  // 게임 상태 조회용
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 })
  }
  
  return POST(request)
}
