import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "올바른 이메일 주소를 입력해주세요." }, { status: 400 })
    }

    // 등록된 사용자 확인
    const user = await DatabaseService.getUserByEmail(email)

    if (!user) {
      return NextResponse.json(
        { error: "등록되지 않은 회원입니다. 네이버 카페 운영자에게 문의해주세요." },
        { status: 404 },
      )
    }

    // 인증 성공 - 실제로는 JWT 토큰 생성
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        total_games: user.total_games,
        total_wins: user.total_wins,
      },
    })
  } catch (error) {
    console.error("Auth error:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
