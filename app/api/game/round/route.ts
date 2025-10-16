import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 })
    }

    const round = await DatabaseService.getCurrentRound(sessionId)
    
    if (!round) {
      return NextResponse.json({ round: null })
    }

    const choices = await DatabaseService.getPlayerChoices(round.id)

    return NextResponse.json({
      round: {
        id: round.id,
        roundNumber: round.round_number,
        phase: round.phase,
        survivorsCount: round.survivors_count,
        rockCount: round.rock_count,
        paperCount: round.paper_count,
        scissorsCount: round.scissors_count,
        losingChoice: round.losing_choice,
        startedAt: round.started_at,
        endedAt: round.ended_at,
      },
      choices: choices.map(c => ({
        id: c.id,
        participantId: c.participant_id,
        selectedChoices: c.selected_choices,
        finalChoice: c.final_choice,
        chosenAt: c.chosen_at,
      })),
    })
  } catch (error) {
    console.error("Get round error:", error)
    return NextResponse.json({ error: "라운드 정보를 불러올 수 없습니다." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, sessionId, roundNumber, roundId, updates, gameMode } = await request.json()

    // 라운드 생성
    if (action === "create") {
      if (!sessionId || roundNumber === undefined) {
        return NextResponse.json(
          { error: "세션 ID와 라운드 번호가 필요합니다." },
          { status: 400 }
        )
      }

      const round = await DatabaseService.createRound(sessionId, roundNumber)
      
      // NOTIFY 발행
      await DatabaseService.notifyGameUpdate({
        type: 'round_created',
        roundId: round.id,
        roundNumber: round.round_number
      })

      return NextResponse.json({ success: true, round })
    }

    // 페이즈 전환
    if (action === "advance_phase") {
      if (!roundId) {
        return NextResponse.json({ error: "라운드 ID가 필요합니다." }, { status: 400 })
      }

      const round = await DatabaseService.getCurrentRound(sessionId!)
      if (!round || round.id !== roundId) {
        return NextResponse.json({ error: "유효하지 않은 라운드입니다." }, { status: 400 })
      }

      let newPhase: string = round.phase
      if (round.phase === "selectTwo") newPhase = "excludeOne"
      else if (round.phase === "excludeOne") newPhase = "revealing"

      const updatedRound = await DatabaseService.updateRound(roundId, { phase: newPhase as any })
      
      if (!updatedRound) {
        return NextResponse.json({ error: "라운드 업데이트 실패" }, { status: 500 })
      }
      
      // NOTIFY 발행
      await DatabaseService.notifyGameUpdate({
        type: 'phase_changed',
        roundId: updatedRound.id,
        phase: newPhase
      })

      return NextResponse.json({ success: true, round: updatedRound })
    }

    // 결과 계산
    if (action === "calculate_result") {
      if (!roundId || !gameMode || !sessionId) {
        return NextResponse.json(
          { error: "라운드 ID, 게임 모드, 세션 ID가 필요합니다." },
          { status: 400 }
        )
      }

      // 라운드 검증
      const currentRound = await DatabaseService.getCurrentRound(sessionId)
      if (!currentRound || currentRound.id !== roundId) {
        return NextResponse.json({ error: "유효하지 않은 라운드입니다." }, { status: 400 })
      }

      // 🔒 트랜잭션: 결과 계산 + 목숨 차감 원자적 실행
      const txResult = await DatabaseService.calculateAndDeductLivesTransaction(roundId, gameMode)
      
      if (!txResult.success) {
        console.log('[Round API] Transaction failed:', txResult.message)
        return NextResponse.json({
          success: true,
          message: txResult.message,
          result: txResult.result
        })
      }

      // NOTIFY 발행
      await DatabaseService.notifyGameUpdate({
        type: 'round_result',
        roundId,
        result: {
          ...txResult.result!,
          losers: (txResult.losers || []).map(p => ({
            id: p.id,
            nickname: p.nickname,
            currentLives: p.current_lives,
            status: p.status
          }))
        }
      })

      return NextResponse.json({
        success: true,
        result: {
          ...txResult.result,
          losers: txResult.losers
        }
      })
    }

    // 기존 update 액션
    if (action === "update") {
      const { roundId, ...updateData } = updates
      
      if (!roundId) {
        return NextResponse.json({ error: "라운드 ID가 필요합니다." }, { status: 400 })
      }

      const round = await DatabaseService.updateRound(roundId, updateData)
      return NextResponse.json({ success: true, round })
    }

    return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 })
  } catch (error) {
    console.error("Round action error:", error)
    return NextResponse.json({ error: "라운드 처리를 할 수 없습니다." }, { status: 500 })
  }
}
