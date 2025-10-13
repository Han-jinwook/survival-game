"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import AudioSystem, { playGameVoice } from "@/components/audio-system"

export default function AuthPage() {
  const router = useRouter()
  const [naverId, setNaverId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [userInfo, setUserInfo] = useState<{ nickname: string; lives: number } | null>(null)
  const [registeredMembers, setRegisteredMembers] = useState<any[]>([])

  useEffect(() => {
    const gameSettings = localStorage.getItem("gameSettings")
    if (gameSettings) {
      const settings = JSON.parse(gameSettings)
      if (settings.participants && Array.isArray(settings.participants)) {
        setRegisteredMembers(settings.participants)
      }
    }
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const trimmedNaverId = naverId.trim()

    console.log("[v0] Starting authentication for:", trimmedNaverId)

    if (!trimmedNaverId || trimmedNaverId.length < 3) {
      setError("올바른 네이버 ID를 입력해주세요. (3자 이상)")
      setIsLoading(false)
      return
    }

    setTimeout(() => {
      const member = registeredMembers.find((m) => m.naverId.toLowerCase() === trimmedNaverId.toLowerCase())

      if (member) {
        console.log("[v0] Authentication successful for:", member.nickname)
        setUserInfo({ nickname: member.nickname, lives: member.lives })
        setSuccess(true)

        try {
          playGameVoice("auth_success")
        } catch (error) {
          console.log("[v0] Audio play failed:", error)
        }

        localStorage.setItem(
          "userInfo",
          JSON.stringify({
            naverId: trimmedNaverId,
            nickname: member.nickname,
            lives: member.lives,
          }),
        )
      } else {
        console.log("[v0] Authentication failed for:", trimmedNaverId)
        setError("등록되지 않은 네이버 ID입니다. 썬드림 즐빛카페 운영자에게 문의해주세요.")
      }
      setIsLoading(false)
    }, 1500)
  }

  const handleEnterLobby = () => {
    console.log("[v0] User confirmed, redirecting to lobby")
    router.push("/lobby")
  }

  if (success && userInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-black text-white flex items-center justify-center">
        <Card className="bg-black/60 border-green-600/50 p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl">✓</span>
            </div>
            <h2 className="text-2xl font-bold text-green-400 mb-4">입장 허가!</h2>
            <div className="bg-red-950/30 border border-red-600/50 rounded-lg p-4 mb-6">
              <p className="text-red-300 font-semibold mb-2">"{userInfo.nickname}" 참가자님</p>
              <p className="text-gray-300 text-sm mb-3">
                행운권 <span className="text-yellow-400 font-bold">{userInfo.lives}장</span>을
              </p>
              <p className="text-red-400 font-bold text-lg">목숨 {userInfo.lives}개로 바꿔드립니다.</p>
            </div>
            <Button
              onClick={handleEnterLobby}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-semibold"
            >
              게임 로비 입장하기
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-black text-white">
      <div className="absolute inset-0 bg-[url('/abstract-geometric-pattern.png')] opacity-5"></div>

      <header className="relative z-10 p-6 border-b border-red-800/30">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/game-logo.png" alt="가위바위보 로고" className="w-15 h-15 rounded-full" />
            <h1 className="text-2xl font-bold">가위바위보 하나빼기</h1>
          </Link>
          <Badge variant="destructive" className="bg-red-600/20 text-red-300 border-red-600/50">
            회원 인증
          </Badge>
        </div>
      </header>

      <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-200px)] px-6">
        <Card className="bg-black/60 border-red-800/50 p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-2xl">🔐</span>
            </div>
            <h2 className="text-3xl font-bold mb-2 text-balance">썬드림 즐빛카페</h2>
            <h3 className="text-xl font-semibold mb-4 text-red-400">회원 인증</h3>
            <p className="text-gray-300 text-pretty">등록된 네이버 ID를 입력하여 게임에 참가하세요</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label htmlFor="naverId" className="block text-sm font-medium text-gray-300 mb-2">
                네이버 ID
              </label>
              <Input
                id="naverId"
                type="text"
                value={naverId}
                onChange={(e) => setNaverId(e.target.value)}
                placeholder="네이버 ID를 입력하세요"
                className="bg-black/40 border-red-800/50 text-white placeholder:text-gray-500 focus:border-red-600"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">@naver.com은 자동으로 처리됩니다</p>
            </div>

            {error && (
              <Alert className="bg-red-950/50 border-red-600/50">
                <AlertDescription className="text-red-300">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 text-lg font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  인증 중...
                </div>
              ) : (
                "게임 참가하기"
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-red-800/30">
            <h3 className="text-sm font-semibold text-red-300 mb-3">참가 안내</h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• 썬드림 즐빛카페에 등록된 회원만 참가 가능</li>
              <li>• 네이버 ID는 카페 가입 시 사용한 것과 동일해야 함</li>
              <li>• 카페 활동지수에 따라 행운권(목숨) 개수가 다름</li>
              <li>• 등록되지 않은 경우 카페 운영자에게 문의</li>
              <li>• 게임 시작 후에는 중도 퇴장 시 자동 패배</li>
            </ul>
          </div>
        </Card>
      </main>

      <footer className="relative z-10 p-4 border-t border-red-800/30">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500 text-sm">썬드림 즐빛카페 × 가위바위보 하나빼기 이벤트</p>
        </div>
      </footer>
      <AudioSystem page="auth" autoPlay={false} showControls={false} />
    </div>
  )
}
