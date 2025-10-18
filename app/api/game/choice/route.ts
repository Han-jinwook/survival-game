import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { 
      roundId, 
      userId, 
      selectedChoices, 
      finalChoice,
      sessionId
    } = await request.json()

    if (!roundId || !userId || !sessionId) {
      return NextResponse.json(
        { error: "라운드 ID, 사용자 ID, 세션 ID가 필요합니다." },
        { status: 400 }
      )
    }

    // 선택 저장
    const choice = await DatabaseService.savePlayerChoice({
      round_id: roundId,
      user_id: userId,
      selected_choices: selectedChoices,
      final_choice: finalChoice
    })

    // 🔥 실시간 동기화: 플레이어 선택 알림
    // notifyGameUpdate 메서드가 없다면 이 부분은 제거하거나 주석 처리

    // 🎮 자동 페이즈 전환: 모든 플레이어가 선택했는지 확인
    const round = await DatabaseService.getCurrentRound(sessionId)
    if (round && round.id === roundId) {
      const currentPhase = round.phase
      const allReady = await DatabaseService.checkAllPlayersReady(roundId, currentPhase)
      
      if (allReady) {
        console.log(`[Choice API] All players ready for phase: ${currentPhase}`)
        
        // selectTwo → excludeOne 자동 전환
        if (currentPhase === 'selectTwo') {
          const updatedRound = await DatabaseService.updateRound(roundId, { phase: 'excludeOne' as any })
          await DatabaseService.notifyGameUpdate({
            type: 'phase_changed',
            roundId: updatedRound.id,
            phase: 'excludeOne'
          })
        }
        // excludeOne → 결과 계산 및 목숨 차감
        else if (currentPhase === 'excludeOne') {
          // 게임 세션 정보 가져오기 (게임 모드 확인)
          const session = await DatabaseService.getGameSession(round.game_session_id)
          const alivePlayers = await DatabaseService.getUsersBySession(round.game_session_id)
          const aliveCount = alivePlayers.filter(u => u.current_lives > 0 && u.status === 'playing').length
          
          // 게임 모드 결정 (2-4명 = final, 5+ = preliminary)
          const gameMode = aliveCount <= 4 ? 'final' : 'preliminary'
          
          // 🔒 트랜잭션: 결과 계산 + 목숨 차감 원자적 실행
          await DatabaseService.processRoundResults(roundId, gameMode)
        }
      }
    }

    return NextResponse.json({
      success: true,
      choice: {
        id: choice.id,
        roundId: choice.round_id,
        userId: choice.user_id,
        selectedChoices: choice.selected_choices,
        finalChoice: choice.final_choice,
        chosenAt: choice.chosen_at,
      },
    })
  } catch (error) {
    console.error("Save choice error:", error)
    return NextResponse.json({ error: "선택을 저장할 수 없습니다." }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const roundId = request.nextUrl.searchParams.get('roundId')
    
    if (!roundId) {
      return NextResponse.json({ error: "라운드 ID가 필요합니다." }, { status: 400 })
    }

    const choices = await DatabaseService.getPlayerChoices(roundId)

    return NextResponse.json({
      choices: choices.map(c => ({
        id: c.id,
        userId: c.user_id,
        selectedChoices: c.selected_choices,
        finalChoice: c.final_choice,
        chosenAt: c.chosen_at,
      })),
    })
  } catch (error) {
    console.error("Get choices error:", error)
    return NextResponse.json({ error: "선택 정보를 불러올 수 없습니다." }, { status: 500 })
  }
}
