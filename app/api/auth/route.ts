import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"
// pg Pool은 더 이상 사용하지 않으므로 제거합니다.

export async function POST(request: NextRequest) {
  try {
    const { naverId, nickname, lives } = await request.json()

    if (!naverId || naverId.trim().length === 0) {
      return NextResponse.json({ error: "네이버 ID를 입력해주세요." }, { status: 400 })
    }

    const trimmedNaverId = naverId.trim()

    // 등록된 사용자 확인
    let user = await DatabaseService.getUserByNaverId(trimmedNaverId)

    if (!user) {
      // 사용자가 없으면 새로 생성 (관리자가 등록한 참가자)
      if (!nickname) {
        return NextResponse.json(
          { error: "등록되지 않은 회원입니다. 네이버 카페 운영자에게 문의해주세요." },
          { status: 404 },
        )
      }
      
      user = await DatabaseService.createUser(trimmedNaverId, nickname)
    }

    // DatabaseService를 사용하여 참가자 정보 조회
    const participant = await DatabaseService.getParticipantByUserId(user.id);
    const userLives = participant ? participant.current_lives : 5; // 참가자 정보가 없으면 기본값 5

    // 인증 성공 - 쿠키 발급
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        naverId: user.naver_id,
        nickname: user.nickname,
        lives: userLives,
      },
    })

    // 쿠키 설정 (24시간 유효)
    response.cookies.set('uid', user.id, {
      httpOnly: true,     // JS 접근 차단 (보안)
      secure: process.env.NODE_ENV === 'production', // HTTPS만 허용 (프로덕션)
      maxAge: 86400,      // 24시간
      path: '/',          // 모든 경로에서 사용
      sameSite: 'lax'     // CSRF 방지
    })

    console.log('[Auth] 쿠키 발급 완료:', user.id)

    return response
  } catch (error) {
    console.error("Auth error:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
