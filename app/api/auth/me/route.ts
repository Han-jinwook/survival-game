import { NextResponse } from "next/server"
import { cookies } from 'next/headers'
import { DatabaseService } from "@/lib/database"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const uid = cookieStore.get('uid')

    if (!uid?.value) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 })
    }

    // DB에서 사용자 정보 조회
    const user = await DatabaseService.getUserById(uid.value)
    
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 현재 활성 세션에서 참가자 정보 조회 (lives 정보 포함)
    let lives = 0
    try {
      const activeSession = await DatabaseService.getActiveGameSession()
      if (activeSession) {
        const participants = await DatabaseService.getParticipants(activeSession.id)
        const participant = participants.find(p => p.user_id === uid.value)
        if (participant) {
          lives = participant.current_lives
        }
      }
    } catch (err) {
      console.error('[Auth] 참가자 lives 조회 실패:', err)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        naverId: user.naver_id,
        nickname: user.nickname,
        lives: lives,
      }
    })
  } catch (error) {
    console.error('[Auth] 사용자 정보 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
