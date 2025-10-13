import { type NextRequest, NextResponse } from "next/server"
import { DatabaseService } from "@/lib/database"

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

    // 인증 성공
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        naverId: user.naver_id,
        nickname: user.nickname,
        lives: lives || 5, // 기본 목숨 5개
      },
    })
  } catch (error) {
    console.error("Auth error:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
