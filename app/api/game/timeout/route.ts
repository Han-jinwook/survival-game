import { NextResponse } from "next/server"
import DatabaseService from "@/lib/database"

export async function GET() {
  try {
    const timedOutPlayers = await DatabaseService.checkAndTimeoutInactivePlayers(3)
    
    if (timedOutPlayers.length > 0) {
      console.log(`[Timeout] ${timedOutPlayers.length}명 타임아웃 처리:`, 
        timedOutPlayers.map(p => p.nickname).join(', '))
    }

    return NextResponse.json({
      success: true,
      timedOutCount: timedOutPlayers.length,
      players: timedOutPlayers
    })
  } catch (error: any) {
    console.error('[Timeout] 에러:', error)
    return NextResponse.json(
      { error: "타임아웃 체크 실패", details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { participantId } = await request.json()

    if (!participantId) {
      return NextResponse.json(
        { error: "participantId 필수" },
        { status: 400 }
      )
    }

    await DatabaseService.updateParticipantActivity(participantId)

    return NextResponse.json({
      success: true,
      message: "활동 시간 업데이트됨"
    })
  } catch (error: any) {
    console.error('[Heartbeat] 에러:', error)
    return NextResponse.json(
      { error: "활동 업데이트 실패", details: error.message },
      { status: 500 }
    )
  }
}
