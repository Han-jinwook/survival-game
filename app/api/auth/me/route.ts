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

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        naverId: user.naver_id,
        nickname: user.nickname,
        lives: user.current_lives || 5,
      }
    })
  } catch (error) {
    console.error('[Auth] 사용자 정보 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
