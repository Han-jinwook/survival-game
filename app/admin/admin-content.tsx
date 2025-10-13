"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import Link from "next/link"

interface Participant {
  id: string
  naverId: string
  nickname: string
  lives: number
  status: "waiting" | "ready" | "playing"
}

export default function AdminContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [cafeName, setCafeName] = useState("")
  const [eventName, setEventName] = useState("")
  const [prize, setPrize] = useState("")
  const [gameStartTime, setGameStartTime] = useState("")
  const [gameScheduled, setGameScheduled] = useState(false)
  const [gameStatus, setGameStatus] = useState<"waiting" | "starting" | "in-progress" | "completed">("waiting")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newParticipant, setNewParticipant] = useState({ naverId: "", nickname: "", lives: 5 })
  const [bulkData, setBulkData] = useState("")
  const [timeRemaining, setTimeRemaining] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [isSaved, setIsSaved] = useState(true)
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [gameMessage, setGameMessage] = useState("")
  const isInitialMount = useRef(true)

  const calculateTimeRemaining = () => {
    if (!gameStartTime) return ""

    const now = new Date()
    const startTime = new Date(gameStartTime)
    const diff = startTime.getTime() - now.getTime()

    if (diff <= 0) return "게임 시작 시간이 지났습니다"

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) {
      return `D-${days}일 ${hours}시간 ${minutes}분`
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분 남음`
    } else {
      return `${minutes}분 남음`
    }
  }

  useEffect(() => {
    console.log("[Admin] 초기 로드 시작 - DB에서 데이터를 불러옵니다")
    
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/game/settings")
        if (response.ok) {
          const data = await response.json()
          console.log("[Admin] DB 데이터 로드 성공:", data)
          
          if (data.session) {
            setCafeName(data.session.cafeName || "")
            setEventName(data.session.sessionName || "")
            setPrize(data.session.prize || "")
            setGameStartTime(data.session.startedAt?.slice(0, 16) || "")
            setGameScheduled(data.session.status === "waiting")
          }
          
          if (data.participants && data.participants.length > 0) {
            const loadedParticipants = data.participants.map((p: any) => ({
              id: p.id,
              naverId: p.naverId || "",
              nickname: p.nickname,
              lives: p.currentLives,
              status: p.status,
            }))
            setParticipants(loadedParticipants)
            console.log("[Admin] 참가자 로드 완료:", loadedParticipants.length, "명")
          } else {
            console.log("[Admin] 저장된 게임 설정이 없습니다. 빈 상태로 시작합니다.")
            setParticipants([])
          }
        } else {
          console.log("[Admin] DB에 저장된 설정 없음 - 빈 상태로 시작")
          setParticipants([])
        }
      } catch (error) {
        console.error("[Admin] 데이터 로드 실패:", error)
        setParticipants([])
      }
    }
    
    loadSettings()
  }, [])

  useEffect(() => {
    if (!gameScheduled || !gameStartTime) return

    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining()
      setTimeRemaining(remaining)

      const now = new Date()
      const startTime = new Date(gameStartTime)
      const diff = startTime.getTime() - now.getTime()

      if (diff <= 0 && gameStatus === "waiting") {
        setGameStatus("starting")
        setCountdown(10)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [gameScheduled, gameStartTime, gameStatus])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && gameStatus === "starting") {
      setGameStatus("in-progress")
      window.location.href = "/game"
    }
  }, [countdown, gameStatus])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (isEditing) {
      setIsSaved(false)
    }
  }, [cafeName, eventName, prize, gameStartTime, participants, isEditing])

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (adminPassword === "1") {
      setIsAuthenticated(true)
    } else {
      alert("잘못된 관리자 비밀번호입니다.")
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    setSaveMessage("")
    
    try {
      const response = await fetch("/api/game/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionName: eventName || cafeName || "가위바위보 하나빼기 게임",
          cafeName: cafeName || undefined,
          prize: prize || undefined,
          initialLives: 5,
          gameStartTime: gameStartTime || undefined,
          participants: participants.map(p => ({
            naverId: p.naverId,
            nickname: p.nickname,
            lives: p.lives,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "설정 저장 실패")
      }

      setIsSaved(true)
      setLastSavedTime(new Date())
      setIsEditing(false)
      console.log("[Admin] 설정 DB 저장 완료, 참가자 수:", participants.length)
      setSaveMessage("설정이 DB에 저장되었습니다!")
    } catch (error: any) {
      console.error("[Admin] 설정 저장 실패:", error)
      setSaveMessage(`❌ ${error.message || "설정 저장에 실패했습니다."}`)
    } finally {
      setIsSaving(false)
    }
  }

  const saveParticipants = async () => {
    setIsSaving(true)
    setSaveMessage("")
    
    try {
      const response = await fetch("/api/game/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionName: eventName || cafeName || "가위바위보 하나빼기 게임",
          cafeName: cafeName || undefined,
          prize: prize || undefined,
          initialLives: 5,
          gameStartTime: gameStartTime || undefined,
          participants: participants.map(p => ({
            naverId: p.naverId,
            nickname: p.nickname,
            lives: p.lives,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "참가자 목록 저장 실패")
      }

      setIsSaved(true)
      setLastSavedTime(new Date())
      console.log("[Admin] 참가자 목록 DB 저장 완료, 참가자 수:", participants.length)
      setSaveMessage("참가자 목록이 DB에 저장되었습니다!")
    } catch (error: any) {
      console.error("[Admin] 참가자 저장 실패:", error)
      setSaveMessage(`❌ ${error.message || "참가자 저장에 실패했습니다."}`)
    } finally {
      setIsSaving(false)
    }
  }

  const addParticipant = () => {
    if (newParticipant.naverId && newParticipant.nickname) {
      const updatedParticipants = [
        ...participants,
        { ...newParticipant, id: Date.now().toString() + Math.random().toString(36), status: "waiting" as const },
      ]
      setParticipants(updatedParticipants)
      setNewParticipant({ naverId: "", nickname: "", lives: 5 })
      setIsSaved(false)
      console.log("[v0] 참가자 추가됨:", newParticipant.naverId, "총 참가자:", updatedParticipants.length)
    }
  }

  const removeParticipant = (id: string) => {
    const updatedParticipants = participants.filter((p) => p.id !== id)
    setParticipants(updatedParticipants)
    setIsSaved(false)
    console.log("[v0] 참가자 제거됨:", id, "남은 참가자:", updatedParticipants.length)
  }

  const updateParticipantLives = (id: string, lives: number) => {
    console.log("[v0] 목숨 업데이트 시도:", id, "새 목숨:", lives)
    setParticipants((prevParticipants) => {
      const updated = prevParticipants.map((p) => {
        if (p.id === id) {
          console.log("[v0] 참가자 업데이트:", p.nickname, "목숨:", p.lives, "→", lives)
          return { ...p, lives }
        }
        return p
      })
      console.log("[v0] 업데이트 후 참가자 목록:", updated.map((p) => `${p.nickname}:${p.lives}`).join(", "))
      return updated
    })
    setIsSaved(false)
  }

  const processBulkData = () => {
    const lines = bulkData.trim().split("\n")
    const newParticipants: Participant[] = []

    lines.forEach((line) => {
      const parts = line.split(",").map((s) => s.trim())
      if (parts.length >= 3) {
        const [naverId, nickname, livesStr] = parts
        const lives = Number.parseInt(livesStr) || 5
        newParticipants.push({
          id: Date.now().toString() + Math.random().toString(36) + newParticipants.length,
          naverId,
          nickname,
          lives,
          status: "waiting",
        })
      }
    })

    if (newParticipants.length > 0) {
      const updatedParticipants = [...participants, ...newParticipants]
      setParticipants(updatedParticipants)
      setBulkData("")
      setIsSaved(false)
      console.log("[v0] 일괄 추가 완료:", newParticipants.length, "명, 총 참가자:", updatedParticipants.length)
    }
  }

  const completeGameSetup = async () => {
    if (participants.length < 2) {
      setSaveMessage("❌ 최소 2명 이상의 참가자가 필요합니다.")
      setTimeout(() => setSaveMessage(""), 5000)
      return
    }
    if (!gameStartTime) {
      setSaveMessage("❌ 게임 시작 일시를 설정해주세요.")
      setTimeout(() => setSaveMessage(""), 5000)
      return
    }

    const now = new Date()
    const startTime = new Date(gameStartTime)
    const diff = startTime.getTime() - now.getTime()

    if (diff <= 0) {
      setSaveMessage("❌ 게임 시작 시간이 이미 지났습니다. 새로운 시간을 설정해주세요.")
      setTimeout(() => setSaveMessage(""), 5000)
      return
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    let timeMessage = ""
    if (days > 0) {
      timeMessage = `${days}일 ${hours}시간 ${minutes}분`
    } else if (hours > 0) {
      timeMessage = `${hours}시간 ${minutes}분`
    } else {
      timeMessage = `${minutes}분`
    }

    setIsSaving(true)
    setSaveMessage("")

    try {
      const response = await fetch("/api/game/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionName: eventName || cafeName || "가위바위보 하나빼기 게임",
          cafeName: cafeName || undefined,
          prize: prize || undefined,
          initialLives: 5,
          gameStartTime: gameStartTime,
          participants: participants.map(p => ({
            naverId: p.naverId,
            nickname: p.nickname,
            lives: p.lives,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "게임 예약 실패")
      }

      setGameScheduled(true)
      setIsSaved(true)
      setLastSavedTime(new Date())
      console.log("[Admin] 게임 예약 DB 저장 완료, 참가자 수:", participants.length)

      setGameMessage(`🎉 게임 예약이 완료되었습니다! 시작까지 ${timeMessage} 남았습니다.`)
    } catch (error: any) {
      console.error("[Admin] 게임 예약 실패:", error)
      setGameMessage(`❌ ${error.message || "게임 예약에 실패했습니다."}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelReservation = () => {
    if (confirm("게임 예약을 취소하시겠습니까?")) {
      console.log("[Admin] 게임 예약 취소")
      setGameScheduled(false)
      setGameMessage("게임 예약이 취소되었습니다.")
      setTimeout(() => {
        setGameMessage("")
      }, 3000)
    }
  }

  const handleGameSetupClick = () => {
    if (gameScheduled) {
      setGameMessage("⚠️ 이미 게임이 예약되었습니다.")
      return
    }
    if (gameStatus !== "waiting") {
      setGameMessage("⚠️ 게임이 이미 시작되었거나 진행 중입니다.")
      return
    }
    if (participants.length < 2) {
      setGameMessage("❌ 최소 2명 이상의 참가자를 추가해주세요.")
      return
    }

    completeGameSetup()
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-black text-white flex items-center justify-center">
        <Card className="bg-black/60 border-red-800/50 p-8 max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-2xl">🔒</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">운영자 로그인</h2>
            <p className="text-gray-300">관리자 권한이 필요합니다</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                관리자 비밀번호
              </label>
              <Input
                id="password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="bg-black/40 border-red-800/50 text-white placeholder:text-gray-500 focus:border-red-600"
              />
            </div>

            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white py-3 text-lg font-semibold">
              로그인
            </Button>
          </form>

          <div className="mt-6 p-4 bg-yellow-950/20 border border-yellow-600/30 rounded-lg">
            <p className="text-xs text-yellow-300">테스트용 비밀번호: 1</p>
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
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-sm">관</span>
            </div>
            <h1 className="text-2xl font-bold">운영자 관리 패널</h1>
          </div>
          <div className="flex items-center gap-4">
            {!isSaved && (
              <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                저장 안됨
              </Badge>
            )}
            {isSaved && lastSavedTime && (
              <Badge variant="outline" className="border-green-600 text-green-400">
                저장됨 ({lastSavedTime.toLocaleTimeString("ko-KR")})
              </Badge>
            )}
            <Badge
              variant={
                gameStatus === "waiting" ? "secondary" : gameStatus === "in-progress" ? "destructive" : "default"
              }
              className="px-3 py-1"
            >
              {gameStatus === "waiting" && "대기 중"}
              {gameStatus === "starting" && "시작 중"}
              {gameStatus === "in-progress" && "진행 중"}
              {gameStatus === "completed" && "완료"}
            </Badge>
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              메인으로
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-black/60 border-red-800/50 p-6">
            <h3 className="text-xl font-bold mb-4 text-red-300">이벤트 설정</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">카페명</label>
                <Input
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  className="bg-black/40 border-red-800/50 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="카페 이름을 입력하세요"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">이벤트 이름</label>
                <Input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="bg-black/40 border-red-800/50 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="이벤트 이름을 입력하세요"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">상품</label>
                <Input
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  className="bg-black/40 border-red-800/50 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="상품을 입력하세요 (예: 아이폰 16 Pro Max)"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">게임 시작 일시</label>
                <Input
                  type="datetime-local"
                  value={gameStartTime || ""}
                  onChange={(e) => setGameStartTime(e.target.value)}
                  disabled={!isEditing}
                  className="w-full bg-black/40 border-red-800/50 text-white disabled:opacity-60 text-base p-3 h-12"
                  style={{ colorScheme: 'dark' }}
                />
                {gameStartTime && (
                  <p className="text-sm text-gray-400 mt-2">
                    ⏰ {format(new Date(gameStartTime), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })} 시작
                  </p>
                )}
              </div>
              {saveMessage && (
                <div className="p-3 bg-green-900/50 border border-green-600/50 rounded-lg mt-4">
                  <p className="text-sm text-green-300 text-center">✅ {saveMessage}</p>
                </div>
              )}
              
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 font-semibold mt-4"
                >
                  📝 정보 수정
                </Button>
              ) : (
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={saveSettings}
                    disabled={isSaving}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSaving ? "⏳ 저장 중..." : "💾 저장"}
                  </Button>
                  <Button
                    onClick={async () => {
                      setIsEditing(false)
                      setIsSaved(true)
                      setSaveMessage("")
                      console.log("[Admin] 수정 취소 - 변경사항 되돌림")
                      try {
                        const response = await fetch("/api/game/settings")
                        if (response.ok) {
                          const data = await response.json()
                          if (data.session) {
                            setCafeName(data.session.cafeName || "")
                            setEventName(data.session.sessionName || "")
                            setPrize(data.session.prize || "")
                            setGameStartTime(data.session.startedAt?.slice(0, 16) || "")
                          }
                        }
                      } catch (error) {
                        console.error("[Admin] 데이터 복원 실패:", error)
                      }
                    }}
                    variant="outline"
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    ❌ 취소
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-black/60 border-red-800/50 p-6">
            <h3 className="text-xl font-bold mb-4 text-red-300">게임 제어</h3>
            <div className="space-y-4">
              {gameScheduled && gameStatus === "waiting" && (
                <div className="p-4 bg-blue-950/30 border border-blue-600/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-blue-300 mb-2">게임 시작까지</p>
                    <p className="text-2xl font-bold text-blue-400">{timeRemaining}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-300">참가자 수</span>
                <Badge variant="outline" className="border-green-600 text-green-400">
                  {participants.length}명
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">총 행운권</span>
                <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                  {participants.reduce((sum, p) => sum + p.lives, 0)}개
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">평균 행운권</span>
                <Badge variant="outline" className="border-blue-600 text-blue-400">
                  {participants.length > 0
                    ? (participants.reduce((sum, p) => sum + p.lives, 0) / participants.length).toFixed(1)
                    : 0}
                  개
                </Badge>
              </div>

              {gameMessage && (
                <div className="p-3 bg-blue-900/50 border border-blue-600/50 rounded-lg">
                  <p className="text-sm text-blue-300 text-center">{gameMessage}</p>
                </div>
              )}

              {!gameScheduled && gameStatus === "waiting" && participants.length < 2 && (
                <p className="text-xs text-yellow-400 text-center">⚠️ 최소 2명 이상의 참가자를 추가해주세요</p>
              )}

              {gameScheduled && gameStatus === "waiting" ? (
                <div className="flex gap-2">
                  <Button
                    disabled
                    className="flex-1 bg-green-700 text-white py-3 text-lg font-semibold cursor-not-allowed"
                  >
                    ✓ 게임 예약됨
                  </Button>
                  <Button
                    onClick={handleCancelReservation}
                    variant="destructive"
                    className="flex-1 py-3 text-lg font-semibold"
                  >
                    예약 취소
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleGameSetupClick}
                  disabled={isSaving || gameStatus !== "waiting" || participants.length < 2}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSaving && "⏳ 저장 중..."}
                  {!isSaving && gameStatus === "waiting" && "🎮 게임 예약하기"}
                  {!isSaving && gameStatus === "starting" && "⏱️ 시작 중..."}
                  {!isSaving && gameStatus === "in-progress" && "🎯 게임 진행 중"}
                  {!isSaving && gameStatus === "completed" && "✅ 게임 완료"}
                </Button>
              )}
            </div>
          </Card>
        </div>

        <Card className="bg-black/60 border-red-800/50 p-6">
          <h3 className="text-xl font-bold mb-4 text-red-300">참가자 관리</h3>

          <div className="mb-6 p-4 bg-red-950/20 border border-red-600/30 rounded-lg">
            <h4 className="font-semibold mb-3 text-red-300">개별 추가</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="네이버 ID"
                value={newParticipant.naverId}
                onChange={(e) => setNewParticipant({ ...newParticipant, naverId: e.target.value })}
                className="bg-black/40 border-red-800/50 text-white"
              />
              <Input
                placeholder="닉네임"
                value={newParticipant.nickname}
                onChange={(e) => setNewParticipant({ ...newParticipant, nickname: e.target.value })}
                className="bg-black/40 border-red-800/50 text-white"
              />
              <Input
                type="number"
                placeholder="행운권 (1-10)"
                value={newParticipant.lives}
                onChange={(e) => setNewParticipant({ ...newParticipant, lives: Number.parseInt(e.target.value) || 5 })}
                className="bg-black/40 border-red-800/50 text-white"
                min="1"
                max="10"
              />
              <Button onClick={addParticipant} className="bg-green-600 hover:bg-green-700">
                추가
              </Button>
            </div>
          </div>

          <div className="mb-6 p-4 bg-blue-950/20 border border-blue-600/30 rounded-lg">
            <h4 className="font-semibold mb-3 text-blue-300">일괄 업로드 (CSV 형식)</h4>
            <div className="space-y-3">
              <textarea
                placeholder="네이버ID, 닉네임, 행운권 (한 줄에 하나씩, 쉼표로 구분)&#10;예시:&#10;gamemaster123, 게임마스터, 10&#10;survivalking, 서바이벌킹, 7&#10;testuser, 테스터, 3"
                value={bulkData}
                onChange={(e) => setBulkData(e.target.value)}
                className="w-full h-32 bg-black/40 border-blue-800/50 text-white placeholder:text-gray-500 rounded-md p-3 resize-none font-mono text-sm"
              />
              <div className="flex gap-3">
                <Button onClick={processBulkData} className="bg-blue-600 hover:bg-blue-700">
                  일괄 추가
                </Button>
                <Button
                  onClick={() => setBulkData("")}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  초기화
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-300">참가자 목록</h4>
              <div className="flex gap-2">
                <Button
                  onClick={saveParticipants}
                  disabled={isSaving || isSaved}
                  size="sm"
                  className="h-8 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSaving ? "⏳ 저장 중..." : "저장"}
                </Button>
                {participants.length > 0 && (
                  <Button onClick={() => setParticipants([])} variant="destructive" size="sm" className="h-8">
                    전체 삭제
                  </Button>
                )}
              </div>
            </div>
            {participants.length === 0 ? (
              <p className="text-gray-500 text-center py-8">등록된 참가자가 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {participants.map((participant, index) => (
                  <div
                    key={participant.id} // naverId 대신 id 사용
                    className="flex items-center justify-between p-2.5 bg-black/40 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm w-8">#{index + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{participant.nickname}</span>
                        <span className="text-gray-500">·</span>
                        <span className="text-sm text-gray-400">{participant.naverId}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">행운권:</span>
                        <Input
                          type="number"
                          value={participant.lives}
                          onChange={(e) => updateParticipantLives(participant.id, Number.parseInt(e.target.value) || 1)} // naverId 대신 id 사용
                          className="w-16 h-8 bg-black/40 border-gray-600 text-white text-center"
                          min="1"
                          max="10"
                        />
                      </div>
                      <Badge
                        variant={participant.status === "ready" ? "default" : "secondary"}
                        className="min-w-16 text-center"
                      >
                        {participant.status === "waiting" && "대기"}
                        {participant.status === "ready" && "준비"}
                        {participant.status === "playing" && "플레이"}
                      </Badge>
                      <Button
                        onClick={() => removeParticipant(participant.id)} // naverId 대신 id 사용
                        variant="destructive"
                        size="sm"
                        className="h-8 px-3"
                      >
                        제거
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </main>

      <footer className="relative z-10 p-4 border-t border-red-800/30">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            {cafeName} × {eventName} • 상품: {prize} • 시작:{" "}
            {gameStartTime ? new Date(gameStartTime).toLocaleString("ko-KR") : "미설정"}
          </p>
        </div>
      </footer>
    </div>
  )
}
