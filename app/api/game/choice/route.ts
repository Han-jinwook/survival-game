import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { 
      roundId, 
      participantId, 
      selectedChoices, 
      finalChoice 
    } = await request.json()

    if (!roundId || !participantId) {
      return NextResponse.json(
        { error: "라운드 ID와 참가자 ID가 필요합니다." },
        { status: 400 }
      )
    }

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
