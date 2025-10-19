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

    // ✅ Choice API는 선택 저장만 담당
    // Phase 전환, 결과 계산은 게임 진행 로직에서 처리

    return NextResponse.json({
      success: true,
      choice: choice ? {
        id: choice.id,
        roundId: choice.round_id,
        userId: choice.user_id,
        selectedChoices: choice.selected_choices,
        finalChoice: choice.final_choice,
        chosenAt: choice.chosen_at,
      } : null,
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
