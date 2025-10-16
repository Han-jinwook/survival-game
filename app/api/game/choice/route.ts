import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { 
      roundId, 
      participantId, 
      selectedChoices, 
      finalChoice,
      sessionId
    } = await request.json()

    if (!roundId || !participantId || !sessionId) {
      return NextResponse.json(
        { error: "라운드 ID, 참가자 ID, 세션 ID가 필요합니다." },
        { status: 400 }
      )
    }

    // 선택 저장
    const choice = await DatabaseService.savePlayerChoice(
      roundId,
      participantId,
      selectedChoices,
      finalChoice
    )

    // 🔥 실시간 동기화: 플레이어 선택 알림
    await DatabaseService.notifyGameUpdate({
      type: 'player_choice',
      roundId,
      participantId,
      selectedChoices: selectedChoices || null,
      finalChoice: finalChoice || null
    })

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
          const alivePlayers = await DatabaseService.getParticipants(round.game_session_id)
          const aliveCount = alivePlayers.filter(p => p.current_lives > 0 && p.status === 'playing').length
          
          // 게임 모드 결정 (2-4명 = final, 5+ = preliminary)
          const gameMode = aliveCount <= 4 ? 'final' : 'preliminary'
          
          // 🔒 트랜잭션: 결과 계산 + 목숨 차감 원자적 실행
          const txResult = await DatabaseService.calculateAndDeductLivesTransaction(roundId, gameMode)
          
          if (!txResult.success) {
            console.log('[Choice API] Transaction failed:', txResult.message)
            // 이미 계산된 경우 성공 응답
            return NextResponse.json({
              success: true,
              choice: {
                id: choice.id,
                roundId: choice.round_id,
                participantId: choice.participant_id,
                selectedChoices: choice.selected_choices,
                finalChoice: choice.final_choice,
                chosenAt: choice.chosen_at,
              },
            })
          }

          // NOTIFY 발행
          await DatabaseService.notifyGameUpdate({
            type: 'round_result',
            roundId,
            result: {
              ...txResult.result!,
              gameMode,
              losers: (txResult.losers || []).map(p => ({
                id: p.id,
                nickname: p.nickname,
                currentLives: p.current_lives,
                status: p.status
              }))
            }
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      choice: {
        id: choice.id,
        roundId: choice.round_id,
        participantId: choice.participant_id,
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
        participantId: c.participant_id,
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
