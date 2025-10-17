"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ChevronDown } from "lucide-react"
import Link from "next/link"
import AudioSystem from "@/components/audio-system"

export default function GameLanding() {
  const [playerCount, setPlayerCount] = useState(0)
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [visitorId] = useState(() => `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [eventInfo, setEventInfo] = useState({
    cafeName: "",
    name: "",
    prize: "",
    startTime: "",
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadEventInfo = async () => {
      try {
        const response = await fetch("/api/game/settings")
        if (response.ok) {
          const data = await response.json()
          console.log("[Home] DB 데이터 로드 성공:", data)
          
          if (data.session) {
            setEventInfo({
              cafeName: data.session.cafeName || "",
              name: data.session.sessionName || "",
              prize: data.session.prize || "",
              startTime: data.session.startedAt || data.session.createdAt || "",
            })
            
            // 게임 시작 감지 → 인증된 사용자는 로비로 자동 이동
            if (data.session.status === "in-progress") {
              const userInfo = localStorage.getItem("userInfo")
              if (userInfo) {
                console.log("[Home] 게임 시작 감지! 로비로 이동")
                window.location.href = "/lobby"
                return
              }
            }
            
            if (data.participants) {
              // 로비 대기중 = 'in_lobby' 또는 'playing' 상태인 참가자
              const lobbyPlayerCount = data.participants.filter((p: any) => p.status === 'in_lobby' || p.status === 'playing').length;
              setPlayerCount(lobbyPlayerCount);
            }
          }
        } else {
          console.log("[Home] DB에 저장된 설정 없음")
        }
      } catch (error) {
        console.error("[Home] 데이터 로드 실패:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadEventInfo()
    
    // Supabase Realtime 실시간 동기화
    const setupRealtimeSubscription = async () => {
      const { supabase } = await import('@/lib/supabaseClient')
      
      // 게임 세션 변경 감지
      const sessionChannel = supabase
        .channel('game_sessions_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'game_sessions' },
          (payload) => {
            console.log('[Home] 게임 세션 변경 감지:', payload)
            loadEventInfo()
          }
        )
        .subscribe()

      // 게임 참가자 변경 감지  
      const participantsChannel = supabase
        .channel('game_participants_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'game_participants' },
          (payload) => {
            console.log('[Home] 참가자 변경 감지:', payload)
            loadEventInfo()
          }
        )
        .subscribe()
      
      return () => {
        sessionChannel.unsubscribe()
        participantsChannel.unsubscribe()
      }
    }
    
    let cleanup: (() => void) | undefined
    setupRealtimeSubscription().then(cleanupFn => {
      cleanup = cleanupFn
    })
    
    return () => {
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const response = await fetch("/api/visitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId }),
        })
        
        if (response.ok) {
          const data = await response.json()
          setSpectatorCount(data.count)
          console.log("[Home] 실시간 접속자:", data.count)
        }
      } catch (error) {
        console.error("[Home] Heartbeat 전송 실패:", error)
      }
    }

    const fetchVisitorCount = async () => {
      try {
        const response = await fetch("/api/visitors")
        if (response.ok) {
          const data = await response.json()
          setSpectatorCount(data.count)
        }
      } catch (error) {
        console.error("[Home] 접속자 수 조회 실패:", error)
      }
    }

    sendHeartbeat()
    fetchVisitorCount()

    const heartbeatInterval = setInterval(sendHeartbeat, 5000)
    const countInterval = setInterval(fetchVisitorCount, 5000)

    const handleBeforeUnload = async () => {
      try {
        await fetch("/api/visitors", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId }),
          keepalive: true,
        })
      } catch (error) {
        console.error("[Home] 접속 종료 알림 실패:", error)
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      clearInterval(heartbeatInterval)
      clearInterval(countInterval)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      handleBeforeUnload()
    }
  }, [visitorId])

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = new Date(dateTimeStr)
      return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateTimeStr
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-black text-white">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('/abstract-geometric-pattern.png')] opacity-5"></div>

      {/* Header */}
      <header className="relative z-10 p-6 border-b border-red-800/30">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/game-logo.png" alt="가위바위보 로고" className="w-15 h-15 rounded-full" />
            <h1 className="text-2xl font-bold text-balance">가위바위보 하나빼기</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="destructive" className="bg-red-600/20 text-red-300 border-red-600/50">
                로비 대기중 {playerCount}명
              </Badge>
              <Badge variant="outline" className="bg-blue-600/20 text-blue-300 border-blue-600/50">
                관람자 {spectatorCount}명
              </Badge>
            </div>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-white transition-colors">
              운영자 입장
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          {isLoading ? (
            <div className="bg-gradient-to-r from-red-950/80 to-orange-950/80 border border-red-600/50 rounded-lg p-8 mb-12">
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full"></div>
                <p className="text-gray-300">이벤트 정보 로딩 중...</p>
              </div>
            </div>
          ) : eventInfo.name ? (
            <Card className="bg-gradient-to-r from-red-950/80 to-orange-950/80 border-red-600/50 p-8 mb-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 text-left">
                  {eventInfo.cafeName && (
                    <p className="text-sm text-gray-400 mb-1">카페명: {eventInfo.cafeName}</p>
                  )}
                  <h3 className="text-2xl font-bold text-white mb-2">{eventInfo.name}</h3>
                  <p className="text-xl text-yellow-300 font-semibold mb-1">🎁 상품: {eventInfo.prize}</p>
                  <p className="text-lg text-red-200">📅 게임 시작: {formatDateTime(eventInfo.startTime)}</p>
                </div>
                <div className="bg-red-600/30 border-2 border-red-500 rounded-lg p-6 min-w-[280px]">
                  <p className="text-sm text-red-200 mb-2 font-semibold">⚠️ 중요 안내</p>
                  <p className="text-white font-bold text-lg">
                    게임 시작 1분 전까지
                    <br />
                    모든 참가자는 입장 완료 필수!
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="bg-gradient-to-r from-orange-950/80 to-yellow-950/80 border-yellow-600/50 p-8 mb-12">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-300 mb-3">📢 이벤트 준비 중입니다</p>
                <p className="text-gray-300 mb-4">
                  관리자가 아직 이벤트를 설정하지 않았습니다.
                </p>
                <p className="text-sm text-gray-400">
                  관리자는 <Link href="/admin" className="text-yellow-400 hover:underline">운영자 입장</Link>에서 이벤트를 생성할 수 있습니다.
                </p>
              </div>
            </Card>
          )}

          <p className="text-3xl font-semibold text-gray-200 mb-12 max-w-4xl mx-auto text-balance leading-relaxed">
            전통 가위바위보 하나빼기 게임이 생존 게임으로 돌아왔습니다. 행운권이 곧 당신의 목숨입니다.
          </p>

          {/* Game Rules - Accordion */}
          <Card className="bg-black/60 border-red-800/50 mb-12">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="rules" className="border-none">
                <AccordionTrigger className="px-8 py-6 hover:no-underline hover:bg-red-900/20 transition-colors group">
                  <div className="flex items-center justify-between w-full">
                    <h3 className="text-2xl font-bold text-red-300 group-hover:text-red-200 transition-colors">게임 규칙</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 group-hover:text-gray-300">클릭하여 펼치기</span>
                      <ChevronDown className="h-5 w-5 text-red-400 group-hover:text-red-300 transition-transform duration-200" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-8 pb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    <div>
                      <h4 className="font-semibold text-white mb-3">기본 규칙</h4>
                      <ul className="space-y-2 text-gray-300">
                        <li>• 모든 참가자는 1~10개의 행운권(목숨)으로 시작</li>
                        <li>• 가위/바위/보 중 2개를 선택 후 하나빼기</li>
                        <li>• 패배 시 행운권 1개 차감</li>
                        <li>• 행운권이 0개가 되면 게임 종료</li>
                        <li className="text-yellow-300 font-semibold">• 시간 내 선택하지 않으면 즉시 탈락</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-3">승패 결정</h4>
                      <ul className="space-y-2 text-gray-300">
                        <li>• 가장 적은 인원이 선택한 무기가 패배</li>
                        <li className="text-red-300 font-semibold">
                          • 동점 최소인 경우 모두 패배 (예: 3-1-1 → 1명씩 선택한 2개 무기 모두 패배)
                        </li>
                        <li>• 모든 무기가 동일 인원이면 무승부</li>
                        <li>• 최후의 1인이 될 때까지 생존</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-3">게임 모드</h4>
                      <ul className="space-y-2 text-gray-300">
                        <li>
                          • <span className="text-yellow-400 font-semibold">예선전</span>: 로비 입장자 5명 이상일 때
                        </li>
                        <li>• 예선전에서 4명 이하로 줄어들면 결승전 진입</li>
                        <li>
                          • <span className="text-red-400 font-semibold">결승전</span>: 로비 입장자 4명 이하일 때
                        </li>
                        <li>• 결승전은 최종 1명이 남을 때까지 진행</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-3">중요 안내</h4>
                      <ul className="space-y-2 text-gray-300">
                        <li>• 참가예정자가 100명이어도 로비 입장자가 4명이면 바로 결승전</li>
                        <li>• 게임 시작 시간 내에 로비 입장 필수</li>
                        <li>• 입장하지 않은 참가예정자는 게임 불참 처리</li>
                        <li>• 게임 중 퇴장 시 자동 패배 처리</li>
                      </ul>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 text-lg font-semibold min-w-48"
              asChild
            >
              <Link href="/auth">게임 참가하기</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-blue-600/50 text-blue-300 hover:bg-blue-600/10 px-8 py-4 text-lg min-w-48 bg-transparent"
              asChild
            >
              <Link href="/viewer">실시간 관전하기</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-red-800/30 p-6 text-center text-gray-400">
        <p>© 2025 가위바위보 하나빼기 • 네이버 카페 전용 게임</p>
      </footer>

      {/* Audio System */}
      <AudioSystem page="landing" autoPlay={false} showControls={false} />
    </div>
  )
}
