"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Volume2, VolumeX } from "lucide-react"
import AudioSystem from "@/components/audio-system"
import { speak } from "@/lib/voice"

type GameChoice = "rock" | "paper" | "scissors"
type GamePhase = "waiting" | "selectTwo" | "excludeOne" | "revealing" | "gameOver"

interface Player {
  id: string
  nickname: string
  lives: number
  isCurrentUser: boolean
  selectedChoices?: GameChoice[]
  finalChoice?: GameChoice
  maxLives?: number
  timedOut?: boolean
}

interface GameRound {
  round: number
  phase: GamePhase
  timeLeft: number
  survivors: number
}

export default function FinalsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isSpectator = searchParams.get('spectator') === 'true'
  
  const [players, setPlayers] = useState<Player[]>([])
  const [gameRound, setGameRound] = useState<GameRound>({
    round: 1,
    phase: "waiting",
    timeLeft: 0,
    survivors: 0,
  })
  const [gameMessage, setGameMessage] = useState("결승전을 준비하는 중...")
  const [selectedChoices, setSelectedChoices] = useState<GameChoice[]>([])
  const [losingChoices, setLosingChoices] = useState<GameChoice[]>([])
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [choiceCounts, setChoiceCounts] = useState<Record<GameChoice, number>>({ rock: 0, paper: 0, scissors: 0 })
  const [initialized, setInitialized] = useState(false)
  const [roundId, setRoundId] = useState<number | null>(null) // 서버 라운드 ID

  const opponents = players.filter((p) => !p.isCurrentUser)
  const currentUser = players.find((p) => p.isCurrentUser)

  useEffect(() => {
    if (initialized) {
      console.log("[Finals] Already initialized, skipping re-initialization")
      return
    }

    // 🔒 결승전 페이지 퇴장 시 로비 퇴장 처리
    const exitLobby = () => {
      const participantInfo = localStorage.getItem("participantInfo")
      if (!participantInfo) return

      try {
        const participant = JSON.parse(participantInfo)
        console.log("[Finals] 로비 퇴장 처리 중:", participant.nickname)

        fetch("/api/game/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "exit_lobby",
            participantId: participant.id,
          }),
          keepalive: true,
        })

        localStorage.removeItem("participantInfo")
        console.log("[Finals] 로비 퇴장 완료 및 참가자 정보 삭제")
      } catch (error) {
        console.error("[Finals] 로비 퇴장 실패:", error)
      }
    }

    const handleBeforeUnload = () => {
      exitLobby()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    // 먼저 finalistsData 확인
    const storedData = sessionStorage.getItem("finalistsData")

    if (storedData) {
      // 예선전에서 온 경우
      try {
        const { gameRoundId, finalists, timestamp } = JSON.parse(storedData)

        console.log("[Finals] Loaded finalists from session:", finalists)
        console.log("[Finals] Game round ID:", gameRoundId)

        const finalsPlayers: Player[] = finalists.map((f: any) => ({
          id: f.id,
          nickname: f.nickname,
          lives: f.lives,
          isCurrentUser: f.isCurrentUser,
          maxLives: f.lives,
        }))

        setPlayers(finalsPlayers)
        setGameRound({
          round: 1,
          phase: "waiting",
          timeLeft: 0,
          survivors: finalsPlayers.length,
        })

        const totalLives = finalsPlayers.reduce((sum, p) => sum + p.lives, 0)
        const message = `이제 총 ${finalsPlayers.length}명, 목숨 ${totalLives}개로, 결승 1라운드를 시작합니다`
        setGameMessage(message)

        setInitialized(true)

        // 🔒 서버 모드: 예선전에서 넘어온 경우, 결승전용 라운드 생성
        const sessionIdStr = sessionStorage.getItem("currentSessionId")
        if (sessionIdStr) {
          const sessionId = parseInt(sessionIdStr, 10)
          if (!isNaN(sessionId)) {
            console.log("[Finals] 결승전 라운드 생성 API 호출...")
            ;(async () => {
              try {
                const roundResponse = await fetch("/api/game/round", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "start_round",
                    sessionId,
                    roundNumber: 1,
                  }),
                })
                
                if (roundResponse.ok) {
                  const roundData = await roundResponse.json()
                  setRoundId(roundData.round.id)
                  console.log("[Finals] 결승전 라운드 생성 성공:", roundData.round.id)
                } else {
                  console.error("[Finals] 결승전 라운드 생성 실패:", roundResponse.status)
                }
              } catch (error) {
                console.error("[Finals] 결승전 라운드 생성 에러:", error)
              }
            })()
          }
        }

        setTimeout(() => {
          speak(message, {
            onComplete: () => {
              setGameRound({
                round: 1,
                phase: "selectTwo",
                timeLeft: 10,
                survivors: finalsPlayers.length,
              })
            },
          })
        }, 500)
      } catch (error) {
        console.error("[Finals] Error parsing finalist data:", error)
        router.push("/game")
      }
    } else {
      // 로비에서 직행한 경우: DB에서 로드
      const currentSessionId = sessionStorage.getItem("currentSessionId")
      
      if (!currentSessionId) {
        console.log("[Finals] No session data found, redirecting to home")
        router.push("/")
        return
      }

      console.log("[Finals] Loading from DB, session:", currentSessionId)

      fetch("/api/game/session?sessionId=" + currentSessionId)
        .then((res) => res.json())
        .then(async (data) => {
          if (!data.session || !data.participants) {
            console.error("[Finals] Failed to load session data")
            router.push("/")
            return
          }

          // 쿠키로 현재 사용자 ID 확인
          const userResponse = await fetch('/api/auth/me')
          if (!userResponse.ok) {
            console.error("[Finals] 쿠키 인증 실패")
            router.push("/auth")
            return
          }

          const userData = await userResponse.json()
          const currentUser = userData.user
          console.log("[Finals] Current user from cookie:", currentUser)
          console.log("[Finals] Participants from DB:", data.participants)

          const activePlayers = data.participants.filter((p: any) => p.status === "playing")
          
          const finalsPlayers: Player[] = activePlayers.map((p: any) => {
            // userId로만 비교
            const isMe = p.userId === currentUser.id
            console.log(`[Finals] Player ${p.nickname}: userId=${p.userId}, currentUserId=${currentUser.id}, isCurrentUser=${isMe}`)
            return {
              id: p.id,
              nickname: p.nickname,
              lives: p.currentLives,
              isCurrentUser: isMe,
              maxLives: p.initialLives,
            }
          })

          console.log("[Finals] Loaded players from DB:", finalsPlayers)

          setPlayers(finalsPlayers)
          setGameRound({
            round: 1,
            phase: "waiting",
            timeLeft: 0,
            survivors: finalsPlayers.length,
          })

          const totalLives = finalsPlayers.reduce((sum, p) => sum + p.lives, 0)
          const message = `이제 총 ${finalsPlayers.length}명, 목숨 ${totalLives}개로, 결승 1라운드를 시작합니다`
          setGameMessage(message)

          setInitialized(true)

          // 🔒 서버 모드: 라운드가 없으면 자동으로 라운드 생성
          if (!data.round) {
            const sessionIdStr = sessionStorage.getItem("currentSessionId")
            if (sessionIdStr) {
              const sessionId = parseInt(sessionIdStr, 10)
              if (!isNaN(sessionId)) {
                console.log("[Finals] 라운드 생성 API 호출...")
                try {
                  const roundResponse = await fetch("/api/game/round", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "start_round",
                      sessionId,
                      roundNumber: 1,
                    }),
                  })
                  
                  if (roundResponse.ok) {
                    const roundData = await roundResponse.json()
                    setRoundId(roundData.round.id)
                    console.log("[Finals] 라운드 생성 성공:", roundData.round.id)
                  } else {
                    console.error("[Finals] 라운드 생성 실패:", roundResponse.status)
                  }
                } catch (error) {
                  console.error("[Finals] 라운드 생성 에러:", error)
                }
              }
            }
          }

          setTimeout(() => {
            speak(message, {
              onComplete: () => {
                setGameRound({
                  round: 1,
                  phase: "selectTwo",
                  timeLeft: 10,
                  survivors: finalsPlayers.length,
                })
              },
            })
          }, 500)
        })
        .catch((error) => {
          console.error("[Finals] Error loading session data:", error)
          router.push("/")
        })
    }
    
    // Helper function to update players from game state
    const updatePlayersFromState = (gameState: any) => {
      const activePlayers = gameState.participants?.filter((p: any) => p.status === "playing") || []
      const participantInfo = localStorage.getItem("participantInfo")
      const currentParticipantId = participantInfo ? JSON.parse(participantInfo).id : null
      
      const updatedPlayers = activePlayers.map((p: any) => ({
        id: p.id,
        nickname: p.nickname,
        lives: p.currentLives || 0,
        isCurrentUser: p.id === currentParticipantId,
        maxLives: p.initialLives || 5,
        selectedChoices: p.selectedChoices,
        finalChoice: p.finalChoice
      }))
      
      setPlayers(updatedPlayers)
      console.log("[Finals SSE] 플레이어 상태 업데이트:", updatedPlayers.length, "명")
    }

    // 🔥 SSE: 실시간 게임 상태 동기화
    const sessionIdStr = sessionStorage.getItem("currentSessionId")
    if (!sessionIdStr) {
      console.error("[Finals] 세션 ID 없음, SSE 연결 불가")
      return
    }
    const sessionId = parseInt(sessionIdStr, 10)
    
    const eventSource = new EventSource('/api/game/stream')
    console.log("[Finals SSE] 연결 시작")
    
    eventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data)
      console.log("[Finals SSE] 수신:", data.type, data)
      
      if (data.type === 'connected') return
      
      // 이벤트 타입별 처리
      if (data.type === 'player_choice') {
        // 플레이어 선택만 업데이트
        const response = await fetch(`/api/game/state?sessionId=${sessionId}`)
        const gameState = await response.json()
        updatePlayersFromState(gameState)
      }
      else if (data.type === 'phase_changed') {
        // 페이즈 변경
        console.log("[Finals SSE] 페이즈 변경:", data.phase)
        setGameRound(prev => ({ ...prev, phase: data.phase as GamePhase }))
        
        // 페이즈별 타이머 설정
        if (data.phase === 'selectTwo') {
          setGameRound(prev => ({ ...prev, timeLeft: 10 }))
        } else if (data.phase === 'excludeOne') {
          setGameRound(prev => ({ ...prev, timeLeft: 10 }))
        } else if (data.phase === 'revealing') {
          setGameRound(prev => ({ ...prev, timeLeft: 5 }))
        }
      }
      else if (data.type === 'round_result') {
        // 라운드 결과 - 서버가 이미 계산 완료
        console.log("[Finals SSE] 라운드 결과:", data.result)
        const { rockCount, paperCount, scissorsCount, losingChoice, losers } = data.result
        
        setChoiceCounts({ rock: rockCount, paper: paperCount, scissors: scissorsCount })
        if (losingChoice) {
          setLosingChoices([losingChoice])
        }
        
        // 페이즈를 revealing으로 변경
        setGameRound(prev => ({ ...prev, phase: 'revealing', timeLeft: 5 }))
        
        // 전체 게임 상태 리프레시 (목숨 업데이트 포함)
        const response = await fetch(`/api/game/state?sessionId=${sessionId}`)
        const gameState = await response.json()
        updatePlayersFromState(gameState)
        
        // 결과 메시지 출력
        if (losers && losers.length > 0) {
          const loserNames = losers.map((l: any) => l.nickname).join(', ')
          const message = `${loserNames}님이 목숨을 잃었습니다!`
          setGameMessage(message)
          speak(message)
        }
        
        // 승자 확인
        const alivePlayers = gameState.participants.filter((p: any) => p.currentLives > 0 && p.status === 'playing')
        if (alivePlayers.length === 1) {
          // 게임 종료
          setTimeout(() => {
            const winner = alivePlayers[0]
            setGameMessage(`${winner.nickname}님이 우승했습니다! 축하합니다!`)
            speak(`${winner.nickname}님이 우승했습니다! 축하합니다!`)
            setGameRound(prev => ({ ...prev, phase: 'gameOver' }))
          }, 5000)
        } else {
          // 다음 라운드
          setTimeout(() => {
            startNextRound()
          }, 5000)
        }
      }
      else if (data.type === 'round_created') {
        // 새 라운드 시작
        console.log("[Finals SSE] 새 라운드:", data.roundNumber)
        setRoundId(data.roundId)
        setGameRound(prev => ({ 
          ...prev, 
          round: data.roundNumber,
          phase: 'selectTwo',
          timeLeft: 10 
        }))
        setSelectedChoices([])
        setChoiceCounts({ rock: 0, paper: 0, scissors: 0 })
        setLosingChoices([])
      }
      else {
        // 기타 업데이트 - 전체 상태 리프레시
        const response = await fetch(`/api/game/state?sessionId=${sessionId}`)
        const gameState = await response.json()
        updatePlayersFromState(gameState)
      }
    }
    
    eventSource.onerror = (error) => {
      console.error("[Finals SSE] 연결 오류, 재시도...")
      eventSource.close()
    }
    
    // cleanup
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      exitLobby()
      eventSource.close()
      console.log("[Finals SSE] 연결 종료")
    }
  }, [router, initialized]) // Add initialized to dependencies

  useEffect(() => {
    if (gameRound.phase === "selectTwo" && gameRound.timeLeft === 10) {
      setGameMessage("가위/바위/보 중 2개를 선택하세요!")
      setTimeout(() => {
        speak("가위 바위 보, 2개를 선택하세요")
      }, 500)
    }
  }, [gameRound.phase, gameRound.timeLeft])

  useEffect(() => {
    if (gameRound.phase === "excludeOne" && gameRound.timeLeft === 10) {
      setGameMessage("하나 빼기! 선택한 2개 중 빼세요!")
      setTimeout(() => {
        speak("하나 빼기, 1개를 제외하세요")
      }, 500)
    }
  }, [gameRound.phase, gameRound.timeLeft])

  useEffect(() => {
    if (gameRound.phase === "selectTwo" || gameRound.phase === "excludeOne") {
      if (gameRound.timeLeft > 0) {
        const timer = setTimeout(() => {
          setGameRound((prev) => ({ ...prev, timeLeft: prev.timeLeft - 1 }))
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [gameRound.phase, gameRound.timeLeft])

  useEffect(() => {
    if (players.length > 0) {
      console.log("[v0] ===== PLAYERS STATE CHANGED =====")
      players.forEach((p) => {
        console.log(`[v0] ${p.nickname}: ${p.lives} lives, finalChoice: ${p.finalChoice || "none"}`)
      })
      console.log("[v0] =====================================")
    }
  }, [players])

  const toggleVoice = () => {
    setVoiceEnabled((prev) => !prev)
    if (voiceEnabled) {
      window.speechSynthesis.cancel()
    }
  }

  const handleSelectChoice = async (choice: GameChoice) => {
    if (gameRound.phase !== "selectTwo") return
    
    let newChoices: GameChoice[]
    if (selectedChoices.includes(choice)) {
      newChoices = selectedChoices.filter((c) => c !== choice)
    } else if (selectedChoices.length < 2) {
      newChoices = [...selectedChoices, choice]
    } else {
      return
    }
    
    setSelectedChoices(newChoices)
    
    // 🔒 서버 모드: 2개 선택 완료 시 서버로 저장
    if (roundId && newChoices.length === 2) {
      console.log("[Finals API] 2개 선택 완료, 서버 저장:", newChoices)
      
      const participantInfo = localStorage.getItem("participantInfo")
      const sessionIdStr = sessionStorage.getItem("currentSessionId")
      
      if (!participantInfo || !sessionIdStr) {
        console.error("[Finals API] 참가자 정보 또는 세션 ID 없음")
        return
      }
      
      const participant = JSON.parse(participantInfo)
      const sessionId = parseInt(sessionIdStr, 10)
      
      if (isNaN(sessionId)) {
        console.error("[Finals API] 세션 ID 파싱 실패:", sessionIdStr)
        return
      }
      
      try {
        const response = await fetch("/api/game/choice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "select_two",
            roundId,
            participantId: participant.id,
            sessionId,
            selectedChoices: newChoices,
          }),
        })
        
        if (!response.ok) {
          const error = await response.json()
          console.error("[Finals API] 2개 선택 저장 실패:", error)
        } else {
          console.log("[Finals API] 2개 선택 저장 성공")
        }
      } catch (error) {
        console.error("[Finals API] 2개 선택 저장 에러:", error)
      }
    }
  }

  const handleExcludeChoice = async (choice: GameChoice) => {
    if (gameRound.phase !== "excludeOne") return

    const keptChoice = selectedChoices.find((c) => c !== choice)
    if (!keptChoice) return

    setPlayers((prev) => prev.map((p) => (p.isCurrentUser ? { ...p, finalChoice: keptChoice } : p)))
    
    // 🔒 서버 모드: 하나빼기 즉시 서버로 저장
    if (roundId) {
      console.log("[Finals API] 하나빼기 저장:", { excluded: choice, kept: keptChoice })
      
      const participantInfo = localStorage.getItem("participantInfo")
      const sessionIdStr = sessionStorage.getItem("currentSessionId")
      
      if (!participantInfo || !sessionIdStr) {
        console.error("[Finals API] 참가자 정보 또는 세션 ID 없음")
        return
      }
      
      const participant = JSON.parse(participantInfo)
      const sessionId = parseInt(sessionIdStr, 10)
      
      if (isNaN(sessionId)) {
        console.error("[Finals API] 세션 ID 파싱 실패:", sessionIdStr)
        return
      }
      
      try {
        const response = await fetch("/api/game/choice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "exclude_one",
            roundId,
            participantId: participant.id,
            sessionId,
            finalChoice: keptChoice,
          }),
        })
        
        if (!response.ok) {
          const error = await response.json()
          console.error("[Finals API] 하나빼기 저장 실패:", error)
        } else {
          console.log("[Finals API] 하나빼기 저장 성공")
        }
      } catch (error) {
        console.error("[Finals API] 하나빼기 저장 에러:", error)
      }
    }
  }


  const startNextRound = async () => {
    console.log("[Finals] startNextRound - 서버에 다음 라운드 생성 요청")
    
    const sessionIdStr = sessionStorage.getItem("currentSessionId")
    if (!sessionIdStr) {
      console.error("[Finals] 세션 ID 없음")
      return
    }
    
    const sessionId = parseInt(sessionIdStr, 10)
    if (isNaN(sessionId)) {
      console.error("[Finals] 세션 ID 파싱 실패:", sessionIdStr)
      return
    }
    
    try {
      const response = await fetch("/api/game/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          sessionId,
          roundNumber: gameRound.round + 1,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log("[Finals] 다음 라운드 생성 성공:", data.round.id)
      } else {
        console.error("[Finals] 다음 라운드 생성 실패:", response.status)
      }
    } catch (error) {
      console.error("[Finals] 다음 라운드 생성 에러:", error)
    }
  }

  const getPlayerPositions = () => {
    // 관전 모드: 결승 참가자 2~4명 전체를 화면에 배치 (본인 위치 없음)
    if (isSpectator) {
      const alivePlayers = players.filter((p) => p.lives > 0)
      
      if (alivePlayers.length === 2) {
        // 2명: 상단 vs 하단
        return {
          positions: [
            { player: alivePlayers[0], style: "top-0 left-1/2 -translate-x-1/2" },
            { player: alivePlayers[1], style: "bottom-0 left-1/2 -translate-x-1/2" },
          ],
          userStyle: null,
        }
      } else if (alivePlayers.length === 3) {
        // 3명: 삼각형 (상단 중앙, 하단 좌우)
        return {
          positions: [
            { player: alivePlayers[0], style: "top-0 left-1/2 -translate-x-1/2" },
            { player: alivePlayers[1], style: "bottom-0 left-1/4 -translate-x-1/2" },
            { player: alivePlayers[2], style: "bottom-0 right-1/4 translate-x-1/2" },
          ],
          userStyle: null,
        }
      } else if (alivePlayers.length === 4) {
        // 4명: 사각형 (동서남북)
        return {
          positions: [
            { player: alivePlayers[0], style: "top-0 left-1/2 -translate-x-1/2" }, // North
            { player: alivePlayers[1], style: "top-1/2 right-0 -translate-y-1/2" }, // East
            { player: alivePlayers[2], style: "bottom-0 left-1/2 -translate-x-1/2" }, // South
            { player: alivePlayers[3], style: "top-1/2 left-0 -translate-y-1/2" }, // West
          ],
          userStyle: null,
        }
      }
      
      return { positions: [], userStyle: null }
    }
    
    // 참가자 모드: 기존 로직 (opponents + currentUser)
    const opponentCount = opponents.length

    if (opponentCount === 1) {
      // 2 players total: top vs bottom
      return {
        positions: [{ player: opponents[0], style: "top-0 left-1/2 -translate-x-1/2" }],
        userStyle: "bottom-0 left-1/2 -translate-x-1/2",
      }
    } else if (opponentCount === 2) {
      // 3 players total: triangle (top center, bottom left/right, user at bottom center)
      return {
        positions: [
          { player: opponents[0], style: "top-0 left-1/2 -translate-x-1/2" },
          { player: opponents[1], style: "top-1/2 left-0 -translate-y-1/2" },
        ],
        userStyle: "bottom-0 left-1/2 -translate-x-1/2",
      }
    } else if (opponentCount === 3) {
      // 4 players total: N/E/W/S (user always at south/bottom)
      return {
        positions: [
          { player: opponents[0], style: "top-0 left-1/2 -translate-x-1/2" }, // North
          { player: opponents[1], style: "top-1/2 right-0 -translate-y-1/2" }, // East
          { player: opponents[2], style: "top-1/2 left-0 -translate-y-1/2" }, // West
        ],
        userStyle: "bottom-0 left-1/2 -translate-x-1/2", // South
      }
    }

    return { positions: [], userStyle: "bottom-0 left-1/2 -translate-x-1/2" }
  }

  const playerPositions = getPlayerPositions()

  if (gameRound.phase === "gameOver") {
    const winner = players.find((p) => p.lives > 0)
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-yellow-950 to-black text-white flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              {["🎉", "🎊", "⭐", "✨", "🏆"][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>

        <Card className="bg-black/80 border-yellow-600/50 p-12 max-w-2xl w-full mx-4 text-center relative z-10">
          <div className="mb-8">
            <div className="w-32 h-32 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <span className="text-6xl">🏆</span>
            </div>
            <h1 className="text-5xl font-bold text-yellow-400 mb-4 animate-pulse">우승!</h1>
            {winner && <h2 className="text-3xl font-semibold text-white mb-6">{winner.nickname}님 축하합니다!</h2>}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400 mb-2">{gameRound.round}</div>
              <div className="text-gray-400">총 라운드</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">{players.length}</div>
              <div className="text-gray-400">총 참가자</div>
            </div>
          </div>

          {winner && (
            <div className="mb-6 bg-yellow-950/30 border border-yellow-600/50 rounded-lg p-6">
              <h3 className="text-2xl font-semibold text-yellow-400 mb-4">최종 우승자</h3>
              <div className="text-3xl font-bold text-white mb-2">{winner.nickname}</div>
              <div className="flex justify-center gap-1 mt-3">
                {Array.from({ length: winner.lives }).map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-yellow-600 rounded-full flex items-center justify-center">
                    <span className="text-xs text-black font-bold">♠</span>
                  </div>
                ))}
              </div>
              <div className="text-yellow-400 mt-2">남은 목숨: {winner.lives}개</div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
              onClick={() => router.push("/result")}
            >
              게임 다시보기
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3"
              onClick={() => (window.location.href = "/lobby")}
            >
              새 게임 시작
            </Button>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-600/10 px-8 py-3 bg-transparent"
              onClick={() => (window.location.href = "/")}
            >
              메인으로
            </Button>
          </div>
        </Card>
        <AudioSystem page="game" autoPlay={false} showControls={false} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-black text-white">
      <div className="absolute inset-0 bg-[url('/abstract-geometric-pattern.png')] opacity-5"></div>

      {/* Header with logo, badges, and voice toggle */}
      <header className="relative z-30 p-3 border-b border-purple-800/30 sticky top-0 bg-slate-900/95 backdrop-blur">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/game-logo.png" alt="가위바위보 로고" className="w-15 h-15 rounded-full" />
              <div>
                <h1 className="text-xl font-bold">가위바위보 하나빼기</h1>
                {isSpectator && (
                  <Badge variant="outline" className="text-xs bg-purple-600/20 text-purple-300 border-purple-600/50 mt-1">
                    결승 관전 모드 👁️
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <Badge
                variant="destructive"
                className="text-lg px-3 py-1 bg-purple-600/20 text-purple-300 border-purple-600/50"
              >
                결승 R{gameRound.round}
              </Badge>
              <Badge variant="outline" className="border-green-600/50 text-green-300 text-lg px-3 py-1">
                생존 {players.filter((p) => p.lives > 0).length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleVoice}
              className="text-gray-300 hover:text-white h-8 w-8"
              title={voiceEnabled ? "음성 끄기" : "음성 켜기"}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-3 py-3">
        <Card className="bg-black/60 border-purple-800/50 p-4 mb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-purple-300">{gameMessage}</h2>
            </div>
            {(gameRound.phase === "selectTwo" || gameRound.phase === "excludeOne") && (
              <div className="flex items-center gap-3">
                <div
                  className={`text-5xl font-bold ${gameRound.timeLeft <= 2 ? "text-red-400 animate-pulse" : "text-yellow-400"}`}
                >
                  {gameRound.timeLeft}
                </div>
                <div className="relative w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="absolute right-0 top-0 h-full bg-gradient-to-l from-yellow-400 to-yellow-600 transition-all duration-1000 ease-linear"
                    style={{ width: `${(gameRound.timeLeft / 10) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="relative flex items-center justify-center min-h-[600px]">
          {/* All Players - Dynamic positions (관전 모드에서는 모든 플레이어를 OpponentCard로 표시) */}
          {playerPositions.positions.map((pos, idx) => (
            <div key={pos.player.id} className={`absolute ${pos.style}`}>
              <OpponentCard
                player={pos.player}
                phase={gameRound.phase}
                losingChoices={losingChoices}
              />
            </div>
          ))}

          {/* Current User - Only shown in participant mode (참가자 모드에서만 표시) */}
          {!isSpectator && currentUser && currentUser.lives > 0 && (
            <div className={`absolute ${playerPositions.userStyle}`}>
              <CurrentUserCard
                player={currentUser}
                phase={gameRound.phase}
                selectedChoices={selectedChoices}
                onSelectChoice={handleSelectChoice}
                onExcludeChoice={handleExcludeChoice}
                losingChoices={losingChoices}
              />
            </div>
          )}
        </div>
      </div>

      <AudioSystem page="game" autoPlay={false} showControls={false} />
    </div>
  )
}

function OpponentCard({
  player,
  phase,
  losingChoices = [],
}: { player: Player; phase: GamePhase; losingChoices?: GameChoice[] }) {
  const getChoiceIcon = (choice: GameChoice) => {
    switch (choice) {
      case "rock":
        return "✊"
      case "paper":
        return "✋"
      case "scissors":
        return "✌️"
    }
  }

  const isLoser = player.finalChoice && losingChoices.includes(player.finalChoice)
  const lostLives = (player.maxLives || player.lives) - player.lives

  return (
    <Card
      className={`bg-black/80 p-4 min-w-[320px] ${isLoser ? "border-red-600 border-2 animate-pulse" : "border-red-600/50"}`}
    >
      <div className="text-center mb-3">
        <h3 className="text-xl font-bold text-white">{player.nickname}</h3>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            {/* Remaining lives */}
            <div className="flex flex-col gap-1">
              {Array.from({ length: player.lives }).map((_, i) => (
                <div key={i} className="relative w-4 h-4">
                  <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
          <span className="text-sm text-red-300 whitespace-nowrap">목숨 {player.lives}</span>
        </div>

        <div className="flex-1">
          {phase === "selectTwo" && (
            <div className="space-y-2">
              {player.lives === 0 ? (
                <p className="text-4xl text-center">💀</p>
              ) : (
                <p className="text-xs text-gray-400 text-center">
                  2개 선택 중
                  <span className="inline-flex ml-1">
                    <span
                      className="text-2xl animate-pulse"
                      style={{ animationDelay: "0s", animationDuration: "1.4s" }}
                    >
                      .
                    </span>
                    <span
                      className="text-2xl animate-pulse"
                      style={{ animationDelay: "0.2s", animationDuration: "1.4s" }}
                    >
                      .
                    </span>
                    <span
                      className="text-2xl animate-pulse"
                      style={{ animationDelay: "0.4s", animationDuration: "1.4s" }}
                    >
                      .
                    </span>
                  </span>
                </p>
              )}
              {player.lives > 0 && (
                <div className="flex justify-center gap-2">
                  <div className="w-14 h-14 bg-gray-800/50 rounded-full flex items-center justify-center">
                    <span className="text-xl text-gray-600">?</span>
                  </div>
                  <div className="w-14 h-14 bg-gray-800/50 rounded-full flex items-center justify-center">
                    <span className="text-xl text-gray-600">?</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === "excludeOne" && (
            <div className="space-y-2">
              {player.lives === 0 ? (
                <p className="text-4xl text-center">💀</p>
              ) : (
                <p className="text-xs text-gray-400 text-center">
                  하나 빼기 중
                  <span className="inline-flex ml-1">
                    <span
                      className="text-2xl animate-pulse"
                      style={{ animationDelay: "0s", animationDuration: "1.4s" }}
                    >
                      .
                    </span>
                    <span
                      className="text-2xl animate-pulse"
                      style={{ animationDelay: "0.2s", animationDuration: "1.4s" }}
                    >
                      .
                    </span>
                    <span
                      className="text-2xl animate-pulse"
                      style={{ animationDelay: "0.4s", animationDuration: "1.4s" }}
                    >
                      .
                    </span>
                  </span>
                </p>
              )}
              {player.lives > 0 && (
                <div className="flex justify-center gap-2">
                  {player.selectedChoices && player.selectedChoices.length === 2 ? (
                    player.selectedChoices.map((choice, idx) => (
                      <div
                        key={idx}
                        className="w-14 h-14 bg-gray-700/50 rounded-full flex items-center justify-center text-2xl"
                      >
                        {getChoiceIcon(choice)}
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-gray-800/50 rounded-full flex items-center justify-center">
                        <span className="text-xl text-gray-600">?</span>
                      </div>
                      <div className="w-14 h-14 bg-gray-800/50 rounded-full flex items-center justify-center">
                        <span className="text-xl text-gray-600">?</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {phase === "revealing" && (
            <div className="space-y-2">
              <div className="flex justify-center">
                {player.lives === 0 ? (
                  <span className="text-6xl opacity-50">💀</span>
                ) : player.finalChoice ? (
                  <div className="relative">
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${
                        isLoser ? "bg-red-600" : "bg-green-600"
                      }`}
                    >
                      {getChoiceIcon(player.finalChoice)}
                    </div>
                    {isLoser && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-6xl text-white font-black" style={{ textShadow: "0 0 8px black" }}>
                          ✕
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center">
                    <span className="text-2xl text-gray-600">?</span>
                  </div>
                )}
              </div>
              {isLoser && player.lives > 0 && <p className="text-center text-4xl animate-pulse">💀</p>}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function CurrentUserCard({
  player,
  phase,
  selectedChoices,
  onSelectChoice,
  onExcludeChoice,
  losingChoices = [],
}: {
  player: Player
  phase: GamePhase
  selectedChoices: GameChoice[]
  onSelectChoice: (choice: GameChoice) => void
  onExcludeChoice: (choice: GameChoice) => void
  losingChoices?: GameChoice[]
}) {
  const getChoiceIcon = (choice: GameChoice) => {
    switch (choice) {
      case "rock":
        return "✊"
      case "paper":
        return "✋"
      case "scissors":
        return "✌️"
    }
  }

  const getChoiceColor = (choice: GameChoice, isSelected = false) => {
    const baseColors = {
      rock: "bg-gray-600 hover:bg-gray-700",
      paper: "bg-blue-600 hover:bg-blue-700",
      scissors: "bg-red-600 hover:bg-red-700",
    }

    if (isSelected) {
      return `${baseColors[choice]} ring-4 ring-yellow-400`
    }

    return baseColors[choice]
  }

  const isLoser = player.finalChoice && losingChoices.includes(player.finalChoice)
  const lostLives = (player.maxLives || player.lives) - player.lives

  return (
    <Card
      className={`bg-black/80 p-4 min-w-[360px] ${isLoser ? "border-red-600 border-2 animate-pulse" : "border-yellow-600/50"}`}
    >
      <div className="text-center mb-3">
        <div className="flex items-center justify-center gap-2">
          <h3 className="text-xl font-bold text-yellow-300">{player.nickname}</h3>
          <Badge className="bg-yellow-600 text-black text-xs px-2 py-0.5 font-bold">나</Badge>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            {/* Remaining lives */}
            <div className="flex flex-col gap-1">
              {Array.from({ length: player.lives }).map((_, i) => (
                <div key={i} className="relative w-5 h-5">
                  <div className="w-5 h-5 bg-yellow-600 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
          <span className="text-sm text-yellow-300 whitespace-nowrap">목숨 {player.lives}</span>
        </div>

        <div className="flex-1">
          {player.lives === 0 ? (
            <div className="flex justify-center items-center py-8">
              <span className="text-6xl opacity-50">💀</span>
            </div>
          ) : (
            <>
              {phase === "selectTwo" && (
                <div className="space-y-2">
                  <p className="text-center text-xs text-gray-300">2개 선택 ({selectedChoices.length}/2)</p>
                  <div className="flex justify-center gap-3">
                    {(["rock", "paper", "scissors"] as GameChoice[]).map((choice) => {
                      const isSelected = selectedChoices.includes(choice)
                      return (
                        <Button
                          key={choice}
                          onClick={() => onSelectChoice(choice)}
                          className={`w-16 h-16 text-3xl rounded-full transition-all ${getChoiceColor(choice, isSelected)}`}
                        >
                          {getChoiceIcon(choice)}
                        </Button>
                      )
                    })}
                  </div>
                  {selectedChoices.length === 2 && (
                    <div className="text-center p-1 bg-green-950/30 border border-green-600/50 rounded-lg">
                      <p className="text-green-300 text-xs font-semibold">선택 완료!</p>
                    </div>
                  )}
                </div>
              )}

              {phase === "excludeOne" && (
                <div className="space-y-2">
                  <p className="text-center text-xs text-gray-300">하나 빼기! {player.finalChoice ? "✓" : ""}</p>
                  <div className="flex justify-center gap-3">
                    {selectedChoices.map((choice) => {
                      const isFinalChoice = player.finalChoice === choice
                      const isExcluded = player.finalChoice && player.finalChoice !== choice
                      return (
                        <Button
                          key={choice}
                          onClick={() => onExcludeChoice(choice)}
                          disabled={!!player.finalChoice}
                          className={`w-16 h-16 text-3xl rounded-full relative ${
                            isExcluded
                              ? "bg-gray-800 opacity-50"
                              : isFinalChoice
                                ? "bg-green-600 hover:bg-green-700 ring-4 ring-green-400"
                                : getChoiceColor(choice)
                          }`}
                        >
                          {isExcluded ? (
                            <span className="text-6xl text-red-500 font-bold">✕</span>
                          ) : (
                            getChoiceIcon(choice)
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}

              {phase === "revealing" && (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    {player.lives === 0 ? (
                      <span className="text-6xl opacity-50">💀</span>
                    ) : player.finalChoice ? (
                      <div className="relative">
                        <div
                          className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${
                            isLoser ? "bg-red-600" : "bg-green-600"
                          }`}
                        >
                          {getChoiceIcon(player.finalChoice)}
                        </div>
                        {isLoser && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-6xl text-white font-black" style={{ textShadow: "0 0 8px black" }}>
                              ✕
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center">
                        <span className="text-2xl text-gray-600">?</span>
                      </div>
                    )}
                  </div>
                  {isLoser && player.lives > 0 && <p className="text-center text-4xl animate-pulse">💀</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
