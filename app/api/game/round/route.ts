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
    const { action, sessionId, roundNumber, updates } = await request.json()

    if (action === "create") {
      if (!sessionId || !roundNumber) {
        return NextResponse.json(
          { error: "세션 ID와 라운드 번호가 필요합니다." },
          { status: 400 }
        )
      }

      const round = await DatabaseService.createRound(sessionId, roundNumber)
      return NextResponse.json({ success: true, round })
    }

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
