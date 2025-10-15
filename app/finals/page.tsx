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
  const [playersLostLife, setPlayersLostLife] = useState<string[]>([])
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [choiceCounts, setChoiceCounts] = useState<Record<GameChoice, number>>({ rock: 0, paper: 0, scissors: 0 })
  const [initialized, setInitialized] = useState(false)
  const [displayedCurrentUserLives, setDisplayedCurrentUserLives] = useState<number | null>(null)

  const opponents = players.filter((p) => !p.isCurrentUser)
  const currentUser = players.find((p) => p.isCurrentUser)

  useEffect(() => {
    if (initialized) {
      console.log("[Finals] Already initialized, skipping re-initialization")
      return
    }

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
        }, 2000)
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
        .then((data) => {
          if (!data.session || !data.participants) {
            console.error("[Finals] Failed to load session data")
            router.push("/")
            return
          }

          const userInfo = localStorage.getItem("userInfo")
          if (!userInfo) {
            console.error("[Finals] No userInfo found in localStorage")
            router.push("/")
            return
          }

          const currentUser = JSON.parse(userInfo)
          console.log("[Finals] Current user from localStorage:", currentUser)
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
          }, 2000)
        })
        .catch((error) => {
          console.error("[Finals] Error loading session data:", error)
          router.push("/")
        })
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
      } else if (gameRound.timeLeft === 0) {
        // Time's up - handle phase transition
        if (gameRound.phase === "selectTwo") {
          // Mark players who didn't select 2 choices as timed out
          setPlayers((prev) =>
            prev.map((p) => {
              if (p.isCurrentUser) {
                // User: check if they selected 2 choices
                if (selectedChoices.length < 2) {
                  return { ...p, timedOut: true }
                }
                return p
              } else {
                // AI opponents: check if they have selectedChoices
                if (!p.selectedChoices || p.selectedChoices.length < 2) {
                  return { ...p, timedOut: true }
                }
                return p
              }
            }),
          )

          // Move to excludeOne phase
          setGameRound((prev) => ({ ...prev, phase: "excludeOne", timeLeft: 10 }))
        } else if (gameRound.phase === "excludeOne") {
          // Mark players who didn't exclude as timed out
          setPlayers((prev) =>
            prev.map((p) => {
              if (p.timedOut) {
                // Already timed out in selectTwo phase
                return p
              }
              if (!p.finalChoice) {
                return { ...p, timedOut: true }
              }
              return p
            }),
          )

          // Move to revealing phase
          setGameRound((prev) => ({ ...prev, phase: "revealing", timeLeft: 0 }))
          setGameMessage("결과를 확인하세요!")
          speak("결과를 확인합니다")

          // Calculate results after delay
          setTimeout(() => {
            calculateResults()
          }, 2000)
        }
      }
    }
  }, [gameRound.phase, gameRound.timeLeft, selectedChoices, players])

  useEffect(() => {
    if (gameRound.phase === "selectTwo") {
      // AI opponents auto-select after 2 seconds
      setTimeout(() => {
        setPlayers((prev) =>
          prev.map((p) => {
            if (!p.isCurrentUser && !p.selectedChoices && p.lives > 0) {
              const allChoices: GameChoice[] = ["rock", "paper", "scissors"]
              const shuffled = allChoices.sort(() => Math.random() - 0.5)
              return { ...p, selectedChoices: [shuffled[0], shuffled[1]] }
            }
            return p
          }),
        )
      }, 2000)
    } else if (gameRound.phase === "excludeOne") {
      // AI opponents auto-exclude after 2 seconds
      setTimeout(() => {
        setPlayers((prev) =>
          prev.map((p) => {
            if (!p.isCurrentUser && p.selectedChoices && !p.finalChoice && p.lives > 0) {
              const randomChoice = p.selectedChoices[Math.floor(Math.random() * 2)]
              return { ...p, finalChoice: randomChoice }
            }
            return p
          }),
        )
      }, 2000)
    }
  }, [gameRound.phase])

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

  const handleSelectChoice = (choice: GameChoice) => {
    if (gameRound.phase !== "selectTwo") return
    if (selectedChoices.includes(choice)) {
      setSelectedChoices(selectedChoices.filter((c) => c !== choice))
    } else if (selectedChoices.length < 2) {
      setSelectedChoices([...selectedChoices, choice])
    }
  }

  const handleExcludeChoice = (choice: GameChoice) => {
    if (gameRound.phase !== "excludeOne") return

    const keptChoice = selectedChoices.find((c) => c !== choice)
    if (!keptChoice) return

    setPlayers((prev) => prev.map((p) => (p.isCurrentUser ? { ...p, finalChoice: keptChoice } : p)))
  }

  const calculateResults = () => {
    console.log("[v0] ===== calculateResults START =====")

    // Store current user's lives before elimination for delayed display update
    const currentUserBeforeElimination = players.find((p) => p.isCurrentUser)
    if (currentUserBeforeElimination) {
      setDisplayedCurrentUserLives(currentUserBeforeElimination.lives)
    }

    const choices: Record<GameChoice, number> = { rock: 0, paper: 0, scissors: 0 }
    players.forEach((p) => {
      if (p.finalChoice && p.lives > 0 && !p.timedOut) {
        choices[p.finalChoice]++
        console.log(`[v0] Player ${p.nickname}: finalChoice = ${p.finalChoice}`)
      }
    })

    console.log("[v0] Choice counts:", choices)
    setChoiceCounts(choices)

    // Process timed out players first
    const timedOutPlayers = players.filter((p) => p.lives > 0 && p.timedOut)

    const weaponTypes = [choices.rock > 0, choices.paper > 0, choices.scissors > 0].filter(Boolean).length

    // Case 1: Only 1 weapon type → draw
    if (weaponTypes === 1) {
      console.log("[v0] Only 1 weapon type → draw")
      setLosingChoices([])
      setPlayersLostLife([])
      setGameMessage("이번 게임은 무승부라 바로 이어서 시작합니다")
      speak("이번 게임은 무승부라 바로 이어서 시작합니다", {
        onComplete: () => {
          setTimeout(() => replayRound(), 2000)
        },
      })
      return
    }

    // Case 2: All 3 weapons present → draw
    if (weaponTypes === 3) {
      console.log("[v0] All 3 weapons present → draw")
      setLosingChoices([])
      setPlayersLostLife([])
      setGameMessage("이번 게임은 무승부라 바로 이어서 시작합니다 (3종류 무기 출현)")
      speak("이번 게임은 무승부라 바로 이어서 시작합니다", {
        onComplete: () => {
          setTimeout(() => replayRound(), 2000)
        },
      })
      return
    }

    // Case 3: 2 different weapons → Determine winner by rock-paper-scissors rules
    let losingWeapon: GameChoice | null = null

    // Rock-paper-scissors rules:
    // Rock beats Scissors
    // Scissors beats Paper
    // Paper beats Rock
    if (choices.rock > 0 && choices.scissors > 0) {
      losingWeapon = "scissors" // Rock beats Scissors
    } else if (choices.scissors > 0 && choices.paper > 0) {
      losingWeapon = "paper" // Scissors beats Paper
    } else if (choices.paper > 0 && choices.rock > 0) {
      losingWeapon = "rock" // Paper beats Rock
    }

    console.log("[v0] Losing weapon:", losingWeapon)

    if (!losingWeapon) {
      console.error("[v0] ERROR: Could not determine losing weapon!")
      return
    }

    setLosingChoices([losingWeapon])

    // Select losers from non-timed out players
    const losersIds = [
      ...players.filter((p) => !p.timedOut && p.finalChoice === losingWeapon && p.lives > 0).map((p) => p.id),
      ...timedOutPlayers.map((p) => p.id),
    ]

    setPlayersLostLife(losersIds)
    console.log("[v0] Players who lost life:", losersIds)

    const updatedPlayers = players.map((p) => {
      if (losersIds.includes(p.id)) {
        console.log(`[v0] Will update ${p.nickname} lives: ${p.lives} -> ${p.lives - 1}`)
        return { ...p, lives: p.lives - 1 }
      }
      return p
    })

    const actualSurvivors = updatedPlayers.filter((p) => p.lives > 0).length

    console.log("[v0] Survivors after elimination:", actualSurvivors)

    const losingText = losingWeapon === "rock" ? "바위" : losingWeapon === "paper" ? "보" : "가위"
    const eliminatedCount = losersIds.length - timedOutPlayers.length
    const timedOutCount = timedOutPlayers.length
    let message = ""
    if (timedOutCount > 0 && eliminatedCount > 0) {
      message = `가위바위보를 내지 않아 ${timedOutCount}개, ${losingText}를 낸 ${eliminatedCount}개가 목숨을 잃었습니다`
    } else if (timedOutCount > 0) {
      message = `가위바위보를 내지 않아 ${timedOutCount}개가 목숨을 잃었습니다`
    } else {
      message = `${losingText}를 낸 ${eliminatedCount}개가 목숨을 잃었습니다`
    }

    setGameMessage(message)
    speak(message, {
      onComplete: () => {
        // Update displayed lives for current user (synchronized with subtitle timing)
        const currentUserAfterElimination = updatedPlayers.find((p) => p.isCurrentUser)
        if (currentUserAfterElimination) {
          setDisplayedCurrentUserLives(currentUserAfterElimination.lives)
        }

        setPlayers(updatedPlayers)

        if (actualSurvivors === 1) {
          const winner = updatedPlayers.find((p) => p.lives > 0)
          if (winner) {
            setGameRound((prev) => ({ ...prev, phase: "gameOver" }))
            setGameMessage(`🎉 ${winner.nickname}님이 우승했습니다! 🎉`)
            speak(`우승자는 ${winner.nickname}입니다. 축하합니다!`)
          }
        } else {
          setTimeout(() => startNextRound(updatedPlayers), 3000)
        }
      },
    })

    console.log("[v0] ===== calculateResults END =====")
  }

  const startNextRound = (updatedPlayersParam?: Player[]) => {
    console.log("[v0] ===== startNextRound START =====")

    const currentPlayers = updatedPlayersParam || players

    console.log("[v0] Current players state BEFORE update:")
    currentPlayers.forEach((p) => console.log(`[v0]   ${p.nickname}: ${p.lives} lives`))
    console.log("[v0] Players who lost life this round:", playersLostLife)

    const updatedPlayers = currentPlayers.map((p) => {
      if (playersLostLife.includes(p.id)) {
        const newLives = p.lives - 1
        console.log(`[v0] Updating ${p.nickname}: ${p.lives} lives -> ${newLives} lives`)
        return { ...p, lives: newLives, selectedChoices: undefined, finalChoice: undefined, timedOut: false }
      }
      return { ...p, selectedChoices: undefined, finalChoice: undefined, timedOut: false }
    })

    console.log("[v0] Updated players array AFTER calculation:")
    updatedPlayers.forEach((p) => console.log(`[v0]   ${p.nickname}: ${p.lives} lives`))

    const alivePlayers = updatedPlayers.filter((p) => p.lives > 0)
    const survivors = alivePlayers.length
    const totalLives = alivePlayers.reduce((sum, p) => sum + p.lives, 0)
    const nextRound = gameRound.round + 1

    console.log(
      "[v0] Alive players:",
      alivePlayers.map((p) => `${p.nickname}(${p.lives})`),
    )
    console.log("[v0] Survivors:", survivors, "Total lives:", totalLives)
    console.log("[v0] Calling setPlayers with updatedPlayers...")

    setPlayers(updatedPlayers)
    setSelectedChoices([])
    setLosingChoices([])
    setPlayersLostLife([])
    setDisplayedCurrentUserLives(null) // Reset for next round

    setGameRound({
      round: nextRound,
      phase: "waiting",
      timeLeft: 0,
      survivors,
    })

    const message = `이제 총 ${survivors}명, 목숨 ${totalLives}개로, 결승 ${nextRound}라운드를 시작합니다`
    setGameMessage(message)

    setTimeout(() => {
      speak(message, {
        onComplete: () => {
          setTimeout(() => {
            console.log("[v0] About to start next round selection phase")
            console.log("[v0] Current players state at this point:")
            // Note: This will log the OLD state because we're in a closure
            setGameRound((prev) => ({ ...prev, phase: "selectTwo", timeLeft: 10 }))
          }, 1000)
        },
      })
    }, 1000)

    console.log("[v0] ===== startNextRound END =====")
  }

  const replayRound = () => {
    console.log("[v0] ===== replayRound START (no round increment) =====")

    // Reset choices
    setSelectedChoices([])
    setLosingChoices([])
    setPlayersLostLife([])
    setDisplayedCurrentUserLives(null) // Reset for replay round
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        selectedChoices: undefined,
        finalChoice: undefined,
        timedOut: false,
      })),
    )

    const survivors = players.filter((p) => p.lives > 0).length

    setGameRound({
      round: gameRound.round,
      phase: "selectTwo",
      timeLeft: 10,
      survivors,
    })

    console.log("[v0] ===== replayRound END =====")
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
                lostLife={playersLostLife.includes(pos.player.id)}
              />
            </div>
          ))}

          {/* Current User - Only shown in participant mode (참가자 모드에서만 표시) */}
          {!isSpectator && currentUser && currentUser.lives > 0 && (
            <div className={`absolute ${playerPositions.userStyle}`}>
              <CurrentUserCard
                player={{
                  ...currentUser,
                  lives: displayedCurrentUserLives ?? currentUser.lives,
                }}
                phase={gameRound.phase}
                selectedChoices={selectedChoices}
                onSelectChoice={handleSelectChoice}
                onExcludeChoice={handleExcludeChoice}
                losingChoices={losingChoices}
                lostLife={playersLostLife.includes(currentUser.id)}
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
  lostLife = false,
}: { player: Player; phase: GamePhase; losingChoices?: GameChoice[]; lostLife?: boolean }) {
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
  lostLife = false,
}: {
  player: Player
  phase: GamePhase
  selectedChoices: GameChoice[]
  onSelectChoice: (choice: GameChoice) => void
  onExcludeChoice: (choice: GameChoice) => void
  losingChoices?: GameChoice[]
  lostLife?: boolean
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
