import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { action, roundId, phase, timeLeft, message } = await request.json()

    if (action === "start_phase") {
      // 새로운 단계 시작 (게임 시작 시 호출)
      console.log(`[Timer API] 단계 시작: ${phase}, 시간: ${timeLeft}초`)
      
      await DatabaseService.updateRound(roundId, {
        phase,
        time_left: timeLeft,
        phase_message: message,
        phase_started_at: new Date().toISOString()
      })

      return NextResponse.json({ success: true })
    }

    if (action === "tick") {
      // 타이머 1초 감소 (Cron에서 호출)
      const round = await DatabaseService.getRound(roundId)
      if (!round) {
        return NextResponse.json({ error: "라운드를 찾을 수 없습니다." }, { status: 404 })
      }

      const newTimeLeft = Math.max(0, round.time_left - 1)
      console.log(`[Timer API] 타이머 틱: ${round.phase} ${newTimeLeft}초`)
      
      // 시간이 0이 되면 다음 단계로 전환
      let newPhase = round.phase
      let newMessage = round.phase_message
      let resetTimer = newTimeLeft

      if (newTimeLeft === 0) {
        switch (round.phase) {
          case 'selectTwo':
            newPhase = 'excludeOne'
            newMessage = '하나 빼기! 선택한 2개 중 하나를 빼세요!'
            resetTimer = 10
            console.log(`[Timer API] 단계 전환: selectTwo → excludeOne`)
            break
          case 'excludeOne':
            newPhase = 'revealing'
            newMessage = '결과를 확인하세요!'
            resetTimer = 5
            console.log(`[Timer API] 단계 전환: excludeOne → revealing`)
            break
          case 'revealing':
            // 라운드 종료 - 결과 계산 및 다음 라운드 준비
            newPhase = 'completed'
            newMessage = '라운드 완료!'
            resetTimer = 0
            console.log(`[Timer API] 라운드 완료: revealing → completed`)
            
            // TODO: 결과 계산 및 다음 라운드 생성 로직 추가
            break
        }
      }

      // DB 업데이트
      await DatabaseService.updateRound(roundId, {
        time_left: resetTimer,
        phase: newPhase,
        phase_message: newMessage,
        phase_started_at: newTimeLeft === 0 ? new Date().toISOString() : round.phase_started_at
      })

      return NextResponse.json({ 
        success: true, 
        timeLeft: resetTimer,
        phase: newPhase,
        message: newMessage,
        phaseChanged: newTimeLeft === 0
      })
    }

    return NextResponse.json({ error: "지원하지 않는 액션입니다." }, { status: 400 })
  } catch (error) {
    console.error("Timer API error:", error)
    return NextResponse.json({ error: "타이머 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const roundId = request.nextUrl.searchParams.get('roundId')
    if (!roundId) {
      return NextResponse.json({ error: "라운드 ID가 필요합니다." }, { status: 400 })
    }

    const round = await DatabaseService.getRound(roundId)
    if (!round) {
      return NextResponse.json({ error: "라운드를 찾을 수 없습니다." }, { status: 404 })
    }

    return NextResponse.json({
      timeLeft: round.time_left,
      phase: round.phase,
      message: round.phase_message,
      phaseStartedAt: round.phase_started_at
    })
  } catch (error) {
    console.error("Get timer error:", error)
    return NextResponse.json({ error: "타이머 정보를 불러올 수 없습니다." }, { status: 500 })
  }
}
