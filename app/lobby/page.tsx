"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import AudioSystem from "@/components/audio-system"

interface Player {
  id: string
  naverId: string
  nickname: string
  lives: number
  status: "waiting" | "ready" | "disconnected"
  joinTime: Date
  isInLobby: boolean
}

export default function GameLobby() {
  const [currentUser, setCurrentUser] = useState<{ naverId: string; nickname: string; lives: number } | null>(null)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameStartCountdown, setGameStartCountdown] = useState<number | null>(null)
  const [gameDestination, setGameDestination] = useState<string>("/game")
  const [sortBy, setSortBy] = useState<"name" | "lives">("lives")
  const [gameStartTime, setGameStartTime] = useState<string>("")
  const [scheduledStartDate, setScheduledStartDate] = useState<Date | null>(null)
  const [lobbyOpenTime, setLobbyOpenTime] = useState<string>("")
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [currentRuleCard, setCurrentRuleCard] = useState(0)
  const [cafeName, setCafeName] = useState("썬드림 즐빛카페")
  const [eventName, setEventName] = useState("가위바위보 하나빼기 이벤트")
  const [startErrorMessage, setStartErrorMessage] = useState<string>("")
  const [autoStartTriggered, setAutoStartTriggered] = useState(false)

  const minPlayers = 3
  const readyPlayers = players.filter((p) => p.status === "ready").length
  const totalPlayers = players.length
  const lobbyPlayers = players.filter((p) => p.isInLobby).length

  // 로비 입장 처리
  const enterLobby = async (participantId: string) => {
    try {
      const response = await fetch("/api/game/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enter_lobby",
          participantId: participantId,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log("[Lobby] 로비 입장 완료:", data.participant)
        // 참가자 정보 저장 (exit_lobby용)
        localStorage.setItem("participantInfo", JSON.stringify(data.participant))
        return true
      } else {
        console.error("[Lobby] 로비 입장 실패:", response.status)
        return false
      }
    } catch (error) {
      console.error("[Lobby] 로비 입장 에러:", error)
      return false
    }
  }

  // 실시간 게임 데이터 가져오기
  const fetchGameData = async (autoEnter = false, cookieUserId?: string) => {
    try {
      const response = await fetch("/api/game/state")
      if (response.ok) {
        const data = await response.json()
        console.log("[Lobby] DB 데이터 로드 성공:", data)
        
        // 세션 정보 설정
        if (data.session) {
          setCafeName(data.session.cafeName || "썬드림 즐빛카페")
          setEventName(data.session.sessionName || "가위바위보 하나빼기 이벤트")
          
          // 게임 시작 감지: 세션 상태별 처리
          if (data.session.status === "starting") {
            // countdown 시작 신호
            const playingCount = data.participants?.filter((p: any) => p.status === "playing").length || 0
            console.log("[Lobby] 카운트다운 시작 감지! 참가자:", playingCount, "명")
            
            // 목적지 결정
            let destination = "/game"
            if (playingCount >= 5) {
              destination = "/game"
              console.log("[Lobby] 예선전 카운트다운")
            } else if (playingCount >= 2) {
              destination = "/finals"
              console.log("[Lobby] 본선 카운트다운")
            }
            
            // 카운트다운 시작
            sessionStorage.setItem('gameStarting', 'true')
            sessionStorage.setItem('currentSessionId', data.session.id)
            setGameDestination(destination)
            setGameStartCountdown(10)
            return
          }
          
          if (data.session.status === "in-progress") {
            // 이미 게임 진행 중 → sessionStorage 설정 후 이동
            const playingCount = data.participants?.filter((p: any) => p.status === "playing").length || 0
            console.log("[Lobby] 게임 진행 중 감지! 즉시 이동")
            
            // sessionStorage 설정 (게임 페이지 초기화에 필요)
            sessionStorage.setItem('gameStarting', 'true')
            sessionStorage.setItem('currentSessionId', data.session.id)
            
            if (playingCount >= 5) {
              window.location.href = "/game"
            } else if (playingCount >= 2) {
              window.location.href = "/finals"
            }
            return
          }
          
          // 게임 시작 시간 설정
          if (data.session.startedAt) {
            const gameDate = new Date(data.session.startedAt)
            const year = gameDate.getFullYear()
            const month = gameDate.getMonth() + 1
            const day = gameDate.getDate()
            const hours = gameDate.getHours()
            const minutes = gameDate.getMinutes()
            setGameStartTime(`${year}년 ${month}월 ${day}일 ${hours}시 ${minutes.toString().padStart(2, "0")}분`)
            setScheduledStartDate(gameDate) // 예약 시간 자동 시작용
            
            // 로비 오픈 시간 (게임 시작 3분 전)
            const lobbyDate = new Date(gameDate.getTime() - 3 * 60 * 1000)
            const lobbyHours = lobbyDate.getHours()
            const lobbyMinutes = lobbyDate.getMinutes()
            setLobbyOpenTime(`${lobbyHours}시 ${lobbyMinutes.toString().padStart(2, "0")}분`)
          }
        }
        
        // 참가자 데이터 설정
        if (data.participants && Array.isArray(data.participants)) {
          // 🍪 쿠키 인증 - 현재 사용자가 waiting 상태면 자동 입장
          if (autoEnter && cookieUserId) {
            const myParticipant = data.participants.find(
              (p: any) => p.userId === cookieUserId
            )
            
            if (myParticipant && myParticipant.status === "waiting") {
              console.log("[Lobby] 🍪 쿠키 인증 - 자동 로비 입장 시도:", myParticipant)
              const success = await enterLobby(myParticipant.id)
              if (success) {
                // 입장 후 데이터 재로드 (자동 입장은 한 번만)
                setTimeout(() => fetchGameData(false), 500)
                return
              }
            } else if (myParticipant && myParticipant.status === "playing") {
              // 이미 입장했으면 참가자 정보 저장 (exit_lobby용)
              console.log("[Lobby] 🍪 이미 로비에 입장한 상태, 참가자 정보 저장")
              localStorage.setItem("participantInfo", JSON.stringify(myParticipant))
            }
          }
          
          const dbPlayers: Player[] = data.participants.map((p: any) => ({
            id: p.id,
            naverId: p.naverId || p.userId,
            nickname: p.nickname,
            lives: p.currentLives,
            status: p.status === "eliminated" ? "disconnected" : (p.status === "playing" ? "ready" : "waiting"),
            joinTime: new Date(p.joinedAt),
            // playing 상태만 로비에 표시 (실제 입장자)
            isInLobby: p.status === "playing",
          }))
          setPlayers(dbPlayers)
          
          // 로비 입장자만 저장
          const lobbyPlayers = dbPlayers.filter((p) => p.isInLobby)
          console.log("[Lobby] 로비 입장자:", lobbyPlayers.length, "명")
          localStorage.setItem("lobbyPlayers", JSON.stringify(lobbyPlayers))
        }
      } else {
        console.error("[Lobby] 게임 데이터 로드 실패:", response.status)
      }
    } catch (error) {
      console.error("[Lobby] 게임 데이터 로드 에러:", error)
    }
  }

  useEffect(() => {
    console.log("[Lobby] 페이지 로드, 사용자 확인 중...")
    
    let eventSource: EventSource | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null
    let pollingInterval: NodeJS.Timeout | null = null
    let isActive = true
    let sseConnected = false
    
    // 로비 떠날 때 즉시 상태 변경
    const exitLobby = async () => {
      try {
        const participantData = localStorage.getItem("participantInfo")
        if (participantData) {
          const participant = JSON.parse(participantData)
          await fetch("/api/game/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "exit_lobby",
              participantId: participant.id,
            }),
            keepalive: true,
          })
          console.log("[Lobby] 🚪 로비 퇴장 처리")
        }
      } catch (error) {
        console.error("[Lobby] 로비 퇴장 처리 실패:", error)
      }
    }
    
    // SSE 실시간 연결 - 재연결 로직 포함
    const connectSSE = () => {
      if (!isActive) return
      
      console.log("[Lobby] SSE 연결 시도...")
      eventSource = new EventSource('/api/game/stream')
      
      eventSource.onopen = () => {
        console.log('[Lobby] SSE 연결 성공!')
        sseConnected = true
        
        if (pollingInterval) {
          clearInterval(pollingInterval)
          pollingInterval = null
          console.log('[Lobby] SSE 연결 성공 - 폴링 중지')
        }
      }
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[Lobby] SSE 메시지 수신:', data)
          
          if (data.type === 'game_update') {
            fetchGameData(false)
          }
        } catch (error) {
          console.error('[Lobby] SSE 메시지 파싱 오류:', error)
        }
      }
      
      eventSource.onerror = (error) => {
        console.error('[Lobby] SSE 연결 오류:', error)
        eventSource?.close()
        sseConnected = false
        
        if (isActive) {
          console.log('[Lobby] 3초 후 SSE 재연결 시도...')
          reconnectTimeout = setTimeout(() => {
            connectSSE()
          }, 3000)
        }
      }
    }
    
    // 쿠키 기반 인증으로 현재 사용자 확인
    const loadCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setCurrentUser(data.user)
            console.log("[Lobby] 🍪 쿠키 인증 성공:", data.user)
            
            // 🍪 초기 데이터 로드 (자동 입장 활성화 + 쿠키 userId 전달)
            fetchGameData(true, data.user.id)
            
            // SSE 연결 시작
            connectSSE()
            
            // 폴링 백업 (5초 후 SSE 상태 확인)
            setTimeout(() => {
              if (!sseConnected && isActive) {
                console.log('[Lobby] SSE 연결 실패 - 폴링 백업 시작 (2초 간격)')
                pollingInterval = setInterval(() => {
                  if (!sseConnected && isActive) {
                    console.log('[Lobby] 폴링으로 게임 상태 확인...')
                    fetchGameData(false)
                  }
                }, 2000)
              }
            }, 5000)
            
            return
          }
        }
      } catch (error) {
        console.error('[Lobby] 쿠키 인증 실패:', error)
      }
      
      // 쿠키 인증 실패 시 로그인 페이지로
      console.log("[Lobby] 인증되지 않은 사용자 - 로그인 필요")
      window.location.href = "/auth"
    }
    
    loadCurrentUser()
    
    // beforeunload: 브라우저 닫을 때
    const handleBeforeUnload = () => {
      const gameStartingFlag = sessionStorage.getItem('gameStarting')
      
      if (gameStartingFlag === 'completed') {
        console.log('[Lobby] 게임 시작 완료 - beforeunload 퇴장 건너뛰기')
        return
      }
      
      if (gameStartingFlag === 'true') {
        console.log('[Lobby] Countdown 취소 - beforeunload exitLobby 실행')
      }
      
      exitLobby()
    }
    
    window.addEventListener("beforeunload", handleBeforeUnload)
    
    return () => {
      console.log('[Lobby] SSE 연결 종료')
      isActive = false
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (pollingInterval) clearInterval(pollingInterval)
      eventSource?.close()
      window.removeEventListener("beforeunload", handleBeforeUnload)
      
      const gameStartingFlag = sessionStorage.getItem('gameStarting')
      
      if (gameStartingFlag === 'completed') {
        console.log('[Lobby] 게임 시작 완료 - cleanup 퇴장 건너뛰기')
        sessionStorage.removeItem('gameStarting')
        return
      }
      
      if (gameStartingFlag === 'true') {
        console.log('[Lobby] Countdown 취소 - cleanup exitLobby 실행')
        sessionStorage.removeItem('gameStarting')
      }
      
      exitLobby()
    }
  }, [])

  useEffect(() => {
    if (showWelcomeMessage) {
      const timer = setTimeout(() => {
        setShowWelcomeMessage(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showWelcomeMessage])

  useEffect(() => {
    if (gameStartCountdown !== null && gameStartCountdown > 0) {
      const timer = setTimeout(() => {
        setGameStartCountdown((prev) => (prev !== null ? prev - 1 : null))
      }, 1000)
      return () => clearTimeout(timer)
    } else if (gameStartCountdown === 0) {
      console.log("[Lobby] Countdown finished, redirecting to:", gameDestination)
      // 정상 완료 표시 (beforeunload에서 exitLobby 실행 방지)
      sessionStorage.setItem('gameStarting', 'completed')
      window.location.href = gameDestination
    }
  }, [gameStartCountdown, gameDestination])

  // 예약 시간 자동 게임 시작 체크
  useEffect(() => {
    if (!scheduledStartDate || autoStartTriggered || gameStartCountdown !== null) {
      return
    }

    const checkScheduledStart = () => {
      const now = new Date()
      
      // 예약 시간 도달 확인 (10초 이내 오차 허용)
      if (now >= scheduledStartDate) {
        console.log("[Lobby] 예약 시간 도달! 자동 게임 시작:", scheduledStartDate)
        setAutoStartTriggered(true)
        handleTestStart() // 자동으로 게임 시작
      }
    }

    // 1초마다 체크
    const interval = setInterval(checkScheduledStart, 1000)
    
    return () => clearInterval(interval)
  }, [scheduledStartDate, autoStartTriggered, gameStartCountdown])

  const currentUserStatus = players.find((p) => p.naverId === currentUser?.naverId)?.status || "waiting"
  const totalLives = players.reduce((sum, player) => sum + player.lives, 0)

  const sortedPlayers = [...players].sort((a, b) => {
    if (sortBy === "name") {
      return a.nickname.localeCompare(b.nickname, "ko")
    } else {
      return b.lives - a.lives
    }
  })

  const ruleCards = [
    {
      title: "게임 목표",
      content: (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold text-yellow-400 mb-2">최후의 1인이 되어라!</h3>
          </div>
          <div className="bg-red-950/30 border border-red-600/50 rounded-lg p-4 space-y-3">
            <p className="text-gray-300">
              한국 전통 <span className="text-yellow-400 font-bold">"하나빼기"</span> 게임으로 최후의 생존자를 가립니다.
            </p>
            <div className="bg-purple-950/30 border border-purple-600/50 rounded p-3 my-3">
              <p className="text-purple-300 font-semibold mb-2">🎮 기본 규칙</p>
              <p className="text-gray-300 text-sm">
                가위/바위/보 중 <span className="text-yellow-400 font-bold">2개를 선택</span>한 후,
                <br />그 중 <span className="text-red-400 font-bold">1개를 제외</span>하여 남은 무기로 승부!
              </p>
            </div>
            <div className="space-y-2 mt-4">
              <p className="text-gray-300 font-semibold">게임은 로비 입장 인원에 따라 진행됩니다:</p>
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-bold">• 5명 이상:</span>
                <span className="text-gray-300">다수결 예선전 → 결승전</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-400 font-bold">• 4명 이하:</span>
                <span className="text-gray-300">바로 결승전</span>
              </div>
            </div>
            <p className="text-gray-300 mt-4">
              목숨이 <span className="text-red-400 font-bold">0개</span>가 되면 탈락하며, 최후까지 살아남은 1명이
              우승합니다.
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <div className="text-center">
                <div className="text-4xl mb-2">✊</div>
                <div className="text-sm text-gray-400">주먹</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">✋</div>
                <div className="text-sm text-gray-400">보</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">✌️</div>
                <div className="text-sm text-gray-400">가위</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "다수결 예선전 (5명 이상)",
      content: (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-2xl font-bold text-purple-400 mb-2">다수결로 탈락자 결정!</h3>
          </div>
          <div className="bg-purple-950/30 border border-purple-600/50 rounded-lg p-4 space-y-4">
            <div>
              <h4 className="text-yellow-400 font-bold mb-2">📋 예선전 규칙</h4>
              <p className="text-gray-300 text-sm">
                로비에 입장한 참가자가 <span className="text-purple-400 font-bold">5명 이상</span>일 때 예선전이
                진행됩니다.
              </p>
            </div>

            <div className="border-t border-purple-600/30 pt-3">
              <h4 className="text-yellow-400 font-bold mb-2">1️⃣ 1단계: 2개 선택하기</h4>
              <p className="text-gray-300 text-sm mb-2">
                <span className="text-yellow-400 font-bold">10초</span> 안에 가위/바위/보 중{" "}
                <span className="text-yellow-400 font-bold">2개</span>를 선택하세요.
              </p>
              <div className="flex justify-center gap-3 my-3">
                <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center text-2xl ring-2 ring-blue-400">
                  ✊
                </div>
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl ring-2 ring-blue-400">
                  ✋
                </div>
              </div>
              <p className="text-red-400 text-xs">⚠️ 시간 내에 선택하지 않으면 즉시 탈락!</p>
            </div>

            <div className="border-t border-purple-600/30 pt-3">
              <h4 className="text-yellow-400 font-bold mb-2">2️⃣ 2단계: 하나빼기 (1개 제외)</h4>
              <p className="text-gray-300 text-sm mb-2">
                <span className="text-red-400 font-bold">5초</span> 안에 선택한 2개 중{" "}
                <span className="text-red-400 font-bold">1개를 제외</span>하세요.
              </p>
              <div className="flex justify-center items-center gap-3 my-3">
                <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center text-2xl opacity-30 relative">
                  ✊
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-red-500 text-4xl font-bold">✕</span>
                  </div>
                </div>
                <div className="text-xl text-green-400">→</div>
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl ring-4 ring-green-400">
                  ✋
                </div>
              </div>
              <p className="text-gray-300 text-xs text-center">남은 1개가 최종 무기가 됩니다.</p>
            </div>

            <div className="border-t border-purple-600/30 pt-3">
              <h4 className="text-yellow-400 font-bold mb-2">3️⃣ 결과: 다수결로 탈락자 결정</h4>
              <p className="text-gray-300 text-sm mb-2">
                전체 참가자 중 <span className="text-red-400 font-bold">가장 적게 선택된 무기</span>를 선택한 사람들이{" "}
                <span className="text-red-400 font-bold">목숨 1개</span>를 잃습니다.
              </p>
              <div className="bg-black/30 rounded p-2 my-2">
                <p className="text-yellow-400 text-xs font-semibold mb-1">💡 예시:</p>
                <p className="text-gray-300 text-xs">
                  가위 3명, 바위 2명, 보 1명
                  <br />→ <span className="text-red-400 font-bold">보를 선택한 1명</span>이 목숨 1개 감소
                </p>
              </div>
              <div className="bg-red-950/30 border border-red-600/50 rounded p-2 mt-2">
                <p className="text-red-400 text-xs font-semibold">
                  💀 목숨이 0개가 되면 즉시 탈락하며, 4명 이하가 되면 결승전으로 진행됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "가위바위보 진검승부 결승전 (4명 이하)",
      content: (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">⚔️</div>
            <h3 className="text-2xl font-bold text-red-400 mb-2">전통 가위바위보 대결!</h3>
          </div>
          <div className="bg-red-950/30 border border-red-600/50 rounded-lg p-4 space-y-4">
            <div>
              <h4 className="text-yellow-400 font-bold mb-2">🎯 결승전 규칙</h4>
              <p className="text-gray-300 text-sm">
                로비에 입장한 참가자가 <span className="text-red-400 font-bold">4명 이하</span>이거나, 예선전을 통과한{" "}
                <span className="text-red-400 font-bold">4명 이하</span>가 되면 결승전이 시작됩니다.
              </p>
            </div>

            <div className="border-t border-red-600/30 pt-3">
              <h4 className="text-yellow-400 font-bold mb-2">⚡ 전통 가위바위보 규칙</h4>
              <div className="bg-black/40 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl">✌️</span>
                  <span className="text-green-400 font-bold text-lg">&gt;</span>
                  <span className="text-3xl">✋</span>
                  <span className="text-green-400 font-bold text-lg">&gt;</span>
                  <span className="text-3xl">✊</span>
                  <span className="text-green-400 font-bold text-lg">&gt;</span>
                  <span className="text-3xl">✌️</span>
                </div>
                <p className="text-gray-400 text-xs text-center">가위 &gt; 보 &gt; 주먹 &gt; 가위</p>
              </div>
            </div>

            <div className="border-t border-red-600/30 pt-3">
              <h4 className="text-yellow-400 font-bold mb-2">1️⃣ 1단계: 2개 선택하기</h4>
              <p className="text-gray-300 text-sm mb-2">
                <span className="text-yellow-400 font-bold">10초</span> 안에 가위/바위/보 중{" "}
                <span className="text-yellow-400 font-bold">2개</span>를 선택하세요.
              </p>
              <div className="flex justify-center gap-3 my-3">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-2xl ring-2 ring-yellow-400">
                  ✌️
                </div>
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl ring-2 ring-yellow-400">
                  ✋
                </div>
              </div>
              <p className="text-purple-400 text-xs text-center">✨ 모든 참가자의 선택이 공개됩니다!</p>
            </div>

            <div className="border-t border-red-600/30 pt-3">
              <h4 className="text-yellow-400 font-bold mb-2">2️⃣ 2단계: 하나빼기 (전략적 선택)</h4>
              <p className="text-gray-300 text-sm mb-2">
                <span className="text-red-400 font-bold">5초</span> 안에 상대방의 패를 보고 유불리를 판단하여{" "}
                <span className="text-red-400 font-bold">1개를 제외</span>하세요!
              </p>
              <div className="bg-purple-950/30 border border-purple-600/50 rounded p-2 my-2">
                <p className="text-purple-300 text-xs font-semibold">🧠 지능 플레이!</p>
                <p className="text-gray-300 text-xs">
                  상대의 2개 선택을 보고 몇 초 안에 전략적으로 무기를 선택하는 심리전!
                </p>
              </div>
            </div>

            <div className="border-t border-red-600/30 pt-3">
              <h4 className="text-yellow-400 font-bold mb-2">3️⃣ 결과: 가위바위보 승부</h4>
              <p className="text-gray-300 text-sm mb-2">
                <span className="text-yellow-400 font-bold">2개 무기로 추려져야</span> 승부가 납니다!
              </p>
              <div className="bg-green-950/30 border border-green-600/50 rounded p-2 my-2">
                <p className="text-green-400 text-xs font-semibold mb-1">✅ 승부 조건 (2개 무기)</p>
                <p className="text-gray-300 text-xs mb-2">
                  전통 가위바위보 규칙에 따라 <span className="text-red-400 font-bold">약한 무기</span>를 낸 사람이 목숨
                  1개 감소
                </p>
                <div className="space-y-1 text-xs">
                  <p className="text-gray-300">• 가위 2명 : 보 2명 → 가위 2명 승리, 보 2명 목숨 -1</p>
                  <p className="text-gray-300">• 가위 1명 : 보 3명 → 가위 1명 승리, 보 3명 목숨 -1</p>
                  <p className="text-gray-300">• 바위 3명 : 가위 1명 → 바위 3명 승리, 가위 1명 목숨 -1</p>
                </div>
              </div>
              <div className="bg-yellow-950/30 border border-yellow-600/50 rounded p-2 my-2">
                <p className="text-yellow-400 text-xs font-semibold mb-1">🔄 무승부 조건</p>
                <p className="text-gray-300 text-xs mb-2">
                  다음 경우 무승부로 <span className="text-yellow-400 font-bold">다시 게임</span>을 진행합니다:
                </p>
                <div className="space-y-1 text-xs">
                  <p className="text-gray-300">• 3개 무기가 모두 나온 경우 (가위 1, 보 1, 주먹 1)</p>
                  <p className="text-gray-300">• 1개 무기만 나온 경우 (모두 가위 선택)</p>
                </div>
              </div>
              <div className="bg-red-950/30 border border-red-600/50 rounded p-2 mt-2">
                <p className="text-red-400 text-xs font-semibold">
                  🏆 최종 1명이 남을 때까지 계속되며, 마지막 생존자가 우승합니다!
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "승리 조건",
      content: (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎊</div>
            <h3 className="text-2xl font-bold text-yellow-400 mb-2">최후의 생존자가 우승!</h3>
          </div>
          <div className="bg-yellow-950/30 border border-yellow-600/50 rounded-lg p-4 space-y-4">
            <div>
              <h4 className="text-yellow-400 font-bold mb-2">🏆 우승 조건</h4>
              <p className="text-gray-300 text-sm">
                다른 모든 참가자가 탈락하고 <span className="text-yellow-400 font-bold">최후의 1명</span>으로 남으면
                우승합니다.
              </p>
            </div>

            <div className="border-t border-yellow-600/30 pt-3">
              <h4 className="text-red-400 font-bold mb-2">💀 탈락 조건</h4>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>
                  • 목숨이 <span className="text-red-400 font-bold">0개</span>가 되면 즉시 탈락
                </li>
                <li>• 선택 시간 내에 선택하지 않으면 즉시 탈락</li>
                <li>• 게임 중 연결이 끊기면 자동 탈락</li>
              </ul>
            </div>

            <div className="border-t border-yellow-600/30 pt-3">
              <h4 className="text-green-400 font-bold mb-2">🎁 우승 보상</h4>
              <p className="text-gray-300 text-sm">
                우승자에게는 특별한 보상이 주어지며, 축하 애니메이션과 함께 우승자가 발표됩니다!
              </p>
              <div className="text-center mt-4">
                <div className="text-4xl mb-2">🎉🏆🎉</div>
                <p className="text-yellow-400 font-bold">행운을 빕니다!</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ]

  // ========================================
  // 개발 테스트용 함수 (프로덕션에서 제거 예정)
  // 로컬 테스트: "나"만 로비 입장 → 테스트 시작 → AI가 나머지 플레이어 역할
  // ========================================
  const handleTestStart = async () => {
    // 로비 입장자 수 확인 (playing 상태만)
    const lobbyPlayerCount = players.filter((p) => p.isInLobby).length
    
    // 최소 인원 검증 (2명 이상)
    if (lobbyPlayerCount < 2) {
      setStartErrorMessage("❌ 최소 2명 이상이어야 게임을 시작할 수 있습니다 (현재: " + lobbyPlayerCount + "명)")
      setTimeout(() => setStartErrorMessage(""), 3000)
      return
    }
    
    // 세션 ID 가져오기
    let sessionId: string | null = null
    try {
      const stateResponse = await fetch("/api/game/state")
      if (stateResponse.ok) {
        const stateData = await stateResponse.json()
        sessionId = stateData.session?.id
      }
    } catch (error) {
      console.error("[Lobby] 세션 ID 가져오기 실패:", error)
    }
    
    if (!sessionId) {
      setStartErrorMessage("❌ 게임 세션을 찾을 수 없습니다")
      setTimeout(() => setStartErrorMessage(""), 3000)
      return
    }
    
    // 참가자 수에 따라 게임 페이지 결정
    let destination = "/game"
    if (lobbyPlayerCount >= 5) {
      destination = "/game" // 예선전
      console.log("[Lobby] 예선전 시작:", lobbyPlayerCount, "명")
    } else if (lobbyPlayerCount >= 2 && lobbyPlayerCount <= 4) {
      destination = "/finals" // 본선 직행
      console.log("[Lobby] 본선 직행:", lobbyPlayerCount, "명")
      setStartErrorMessage("✅ " + lobbyPlayerCount + "명 입장! 본선으로 바로 이동합니다...")
    }
    
    // 세션 상태를 'starting'으로 업데이트 (countdown 시작 신호)
    try {
      const response = await fetch("/api/game/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_countdown",
          sessionId: sessionId,
          destination: destination,
        }),
      })
      
      if (!response.ok) {
        console.error("[Lobby] 게임 시작 API 실패:", response.status)
        setStartErrorMessage("❌ 게임 시작 실패")
        setTimeout(() => setStartErrorMessage(""), 3000)
        return
      }
      
      console.log("[Lobby] 카운트다운 시작 신호 전송 완료")
    } catch (error) {
      console.error("[Lobby] 게임 시작 에러:", error)
      setStartErrorMessage("❌ 게임 시작 실패")
      setTimeout(() => setStartErrorMessage(""), 3000)
      return
    }
    
    // 로컬에서도 카운트다운 시작
    sessionStorage.setItem('gameStarting', 'true')
    sessionStorage.setItem('currentSessionId', sessionId)
    setGameDestination(destination)
    setGameStartCountdown(10)
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-black text-white">
      <div className="absolute inset-0 bg-[url('/abstract-geometric-pattern.png')] opacity-5"></div>

      {showWelcomeMessage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
          <Card className="bg-black/90 border-red-600/50 p-6 md:p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
              <span className="text-red-400 text-xl md:text-2xl">⚡</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-red-300 mb-3 md:mb-4">로비 입장 완료</h2>
            <div className="bg-red-950/50 border border-red-600/50 rounded-lg p-3 md:p-4">
              <p className="text-red-300 font-semibold text-sm md:text-base mb-2">"{currentUser.nickname}" 참가자님</p>
              <p className="text-gray-300 text-xs md:text-sm mb-2 md:mb-3">
                행운권 <span className="text-yellow-400 font-bold">{currentUser.lives}장</span>이
              </p>
              <p className="text-red-400 font-bold text-base md:text-lg">목숨 {currentUser.lives}개로 변환되었습니다.</p>
            </div>
          </Card>
        </div>
      )}

      <header className="relative z-10 p-4 md:p-6 border-b border-red-800/30">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-2">
          <Link href="/" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
            <img src="/game-logo.png" alt="가위바위보 로고" className="w-10 h-10 md:w-15 md:h-15 rounded-full" />
            <h1 className="text-base md:text-2xl font-bold">가위바위보 하나빼기</h1>
          </Link>
          <div className="flex items-center gap-1 md:gap-4">
            <Badge variant="destructive" className="bg-green-600/20 text-green-300 border-green-600/50 text-xs md:text-sm hidden sm:inline-flex">
              로비 대기중
            </Badge>
            <Badge variant="outline" className="border-yellow-600/50 text-yellow-300 text-xs md:text-sm">
              {currentUser.nickname}
            </Badge>
            <Link href="/">
              <Button variant="outline" size="sm" className="bg-blue-600/20 text-blue-300 border-blue-600/50 hover:bg-blue-600/30 text-xs md:text-sm px-2 md:px-3">
                홈
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-8">
        <Card className="bg-red-950/30 border-red-600/30 p-4 md:p-6 mb-4 md:mb-8">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h4 className="text-sm md:text-lg font-semibold text-red-300">게임 시작 전 확인사항</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRulesModal(true)}
              className="bg-purple-600/20 text-purple-300 border-purple-600/50 hover:bg-purple-600/30 text-xs md:text-sm px-2 md:px-3"
            >
              📖 규칙
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm text-gray-300">
            <ul className="space-y-1 md:space-y-2">
              <li>• 게임 시작 후 중도 퇴장 시 자동 패배</li>
              <li>• 목숨 0개 시 즉시 게임 종료</li>
              <li>• 네트워크 연결 상태를 확인하세요</li>
            </ul>
            <ul className="space-y-1 md:space-y-2">
              <li>• 최후의 1인까지 진행됩니다</li>
              <li>• 실시간 대전으로 지연 시간 주의</li>
              <li>• 카페 활동지수에 따른 개별 목숨 시스템</li>
            </ul>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-8">
          <Card className="bg-black/60 border-red-800/50 p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-red-300 mb-3 md:mb-4">참가자 현황</h3>
            <div className="space-y-2 md:space-y-3 text-gray-300">
              <div className="flex items-center gap-2 text-xs md:text-base">
                <span className="text-white font-semibold">참가예정자 총 {totalPlayers}명 중</span>
                <span className="text-green-400 font-semibold">로비 대기자 {lobbyPlayers}명</span>
              </div>
              <div className="flex items-center gap-2 text-xs md:text-base">
                <span className="text-white font-semibold">총 목숨:</span>
                <span className="text-yellow-400 font-semibold">{totalLives}개</span>
                <span className="text-gray-400 text-xs md:text-sm">
                  (평균 {totalPlayers > 0 ? (totalLives / totalPlayers).toFixed(1) : 0}개/인)
                </span>
              </div>
            </div>
          </Card>

          <Card className="bg-black/60 border-purple-800/50 p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-purple-300 mb-3 md:mb-4">게임장 입장 안내</h3>
            <div className="text-center">
              {gameStartTime && (
                <div className="text-sm text-purple-300 mb-3">
                  게임 시작 시간: <span className="font-bold text-purple-400">{gameStartTime}</span>
                </div>
              )}
              {gameStartCountdown === null ? (
                <div>
                  <div className="text-xl md:text-2xl font-bold text-purple-400 mb-3 md:mb-4">대기중</div>
                  {/* 개발 테스트용 버튼 (프로덕션에서 제거 예정) */}
                  <Button
                    onClick={handleTestStart}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 md:px-8 py-2.5 md:py-3 text-sm md:text-base"
                  >
                    테스트 시작
                  </Button>
                  {startErrorMessage && (
                    <div className={`mt-2 md:mt-3 p-2 md:p-3 rounded-lg text-xs md:text-sm text-center ${
                      startErrorMessage.includes("✅") 
                        ? "bg-green-900/50 border border-green-600/50 text-green-300" 
                        : "bg-red-900/50 border border-red-600/50 text-red-300"
                    }`}>
                      {startErrorMessage}
                    </div>
                  )}
                  {lobbyOpenTime && (
                    <div className="text-xs text-gray-500 mt-3 md:mt-4">
                      게임 시작 3분 전인 {lobbyOpenTime}에 게임장 오픈되오니, 시간 착오 없으시기 바랍니다.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-3xl md:text-4xl font-bold text-purple-400 mb-2">{gameStartCountdown}</div>
                  <div className="text-xs md:text-sm text-gray-300 mb-3">초 후 게임장 입장</div>
                  <Progress value={((10 - gameStartCountdown) / 10) * 100} className="h-2" />
                  {lobbyOpenTime && (
                    <div className="text-xs text-gray-500 mt-3">(실제 운영 시: {lobbyOpenTime}에 게임장 오픈)</div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="bg-black/60 border-red-800/50 p-6 mb-8">
          <div className="flex items-center gap-4">
            <span className="text-xl font-semibold text-white">{currentUser.nickname},</span>
            <span className="text-gray-300">나의 목숨은</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(currentUser.lives, 10) }).map((_, i) => (
                <span key={i} className="text-yellow-400 text-xl">
                  💛
                </span>
              ))}
              {currentUser.lives > 10 && (
                <span className="text-yellow-400 text-sm ml-1">+{currentUser.lives - 10}</span>
              )}
              <span className="text-yellow-400 font-bold ml-2 text-xl">{currentUser.lives}개</span>
            </div>
          </div>
        </Card>

        <Card className="bg-black/60 border-red-800/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-red-300">참가자 목록</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy("name")}
                className={`${
                  sortBy === "name"
                    ? "bg-red-600/20 text-red-300 border-red-600/50"
                    : "bg-transparent text-gray-400 border-gray-600/50"
                }`}
              >
                가나다순
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy("lives")}
                className={`${
                  sortBy === "lives"
                    ? "bg-red-600/20 text-red-300 border-red-600/50"
                    : "bg-transparent text-gray-400 border-gray-600/50"
                }`}
              >
                목숨 많은순
              </Button>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {sortedPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-4 rounded-lg bg-red-950/20 border border-red-800/30 hover:bg-red-950/30 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <span className="font-semibold text-white min-w-[100px]">{player.nickname}</span>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(player.lives, 10) }).map((_, i) => (
                      <span key={i} className="text-yellow-400 text-lg">
                        💛
                      </span>
                    ))}
                    {player.lives > 10 && <span className="text-yellow-400 text-sm ml-1">+{player.lives - 10}</span>}
                    <span className="text-yellow-400 font-bold ml-2">{player.lives}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {player.isInLobby ? (
                    <>
                      <img src="/person-sitting-on-chair-icon.jpg" alt="로비 대기 중" className="w-8 h-8" />
                      <span className="text-green-400 text-sm font-medium">로비 대기 중</span>
                    </>
                  ) : (
                    <>
                      <img src="/empty-chair-icon.jpg" alt="입장 전" className="w-8 h-8" />
                      <span className="text-gray-500 text-sm font-medium">입장 전</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>

      <footer className="relative z-10 p-4 border-t border-red-800/30">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500 text-sm">{cafeName} × {eventName}</p>
        </div>
      </footer>

      <Dialog open={showRulesModal} onOpenChange={setShowRulesModal}>
        <DialogContent className="bg-black/95 border-purple-600/50 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">{ruleCards[currentRuleCard].title}</DialogTitle>
          </DialogHeader>
          <div className="py-6">{ruleCards[currentRuleCard].content}</div>
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentRuleCard((prev) => Math.max(0, prev - 1))}
              disabled={currentRuleCard === 0}
              className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-600/20 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              이전
            </Button>
            <div className="flex gap-2">
              {ruleCards.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${index === currentRuleCard ? "bg-purple-400" : "bg-gray-600"}`}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentRuleCard((prev) => Math.min(ruleCards.length - 1, prev + 1))}
              disabled={currentRuleCard === ruleCards.length - 1}
              className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-600/20 disabled:opacity-30"
            >
              다음
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AudioSystem page="lobby" autoPlay={false} showControls={false} />
    </div>
  )
}
