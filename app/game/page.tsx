"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import AudioSystem from "@/components/audio-system"
import { useRouter } from "next/navigation"
import { speak, setVoiceEnabled } from "@/lib/voice"
import { Volume2, VolumeX } from "lucide-react"

type GameChoice = "rock" | "paper" | "scissors"
type GamePhase = "waiting" | "selectTwo" | "excludeOne" | "revealing" | "results" | "gameOver"
type GameMode = "preliminary" | "final"

interface Player {
  id: string
  nickname: string
  lives: number
  selectedChoices?: GameChoice[]
  finalChoice?: GameChoice
  eliminated?: boolean
  isCurrentUser?: boolean
  timedOut?: boolean
}

interface GameRound {
  round: number
  phase: GamePhase
  timeLeft: number
  survivors: number
}

interface ChoiceCount {
  rock: number
  paper: number
  scissors: number
}

interface GameEvent {
  type: "choice" | "elimination" | "timeup" | "roundStart" | "roundEnd"
  playerId: string
  playerNickname: string
  choice?: GameChoice
  livesLost?: number
  remainingLives?: number
  timestamp: number
}

interface RoundLog {
  round: number
  events: GameEvent[]
  choiceCounts: ChoiceCount
  losingChoice: GameChoice | null
  survivorsAtEnd: number
}

interface GameLog {
  startTime: number
  endTime?: number
  totalPlayers: number
  rounds: RoundLog[]
  finalists: { id: string; nickname: string; lives: number }[]
}

export default function GameInterface() {
  const router = useRouter()
  const hasLoadedDataRef = useRef(false)
  const hasEliminationSpokenRef = useRef(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameMode, setGameMode] = useState<GameMode>("preliminary")
  const [showModeTransition, setShowModeTransition] = useState(false)
  const [showFinalsConfirmation, setShowFinalsConfirmation] = useState(false)
  const [finalsCountdown, setFinalsCountdown] = useState(60)
  const [gameRound, setGameRound] = useState<GameRound>({
    round: 1,
    phase: "waiting",
    timeLeft: 0,
    survivors: 0,
  })
  const [selectedChoices, setSelectedChoices] = useState<GameChoice[]>([])
  const [choiceCounts, setChoiceCounts] = useState<ChoiceCount>({ rock: 0, paper: 0, scissors: 0 })
  const [gameMessage, setGameMessage] = useState("게임이 시작되었습니다!")
  const [losingChoice, setLosingChoice] = useState<GameChoice | null>(null)
  const [losingChoices, setLosingChoices] = useState<GameChoice[]>([])
  const [timeoutEliminatedCount, setTimeoutEliminatedCount] = useState(0)
  const [roundResultStatus, setRoundResultStatus] = useState<"survived" | "died" | null>(null)

  const [gameLog, setGameLog] = useState<GameLog>({
    startTime: Date.now(),
    totalPlayers: 0,
    rounds: [],
    finalists: [],
  })
  const [currentRoundLog, setCurrentRoundLog] = useState<RoundLog>({
    round: 1,
    events: [],
    choiceCounts: { rock: 0, paper: 0, scissors: 0 },
    losingChoice: null,
    survivorsAtEnd: 0,
  })

  // Generated unique ID for the current game session for sessionStorage
  const [gameRoundId, setGameRoundId] = useState<string>("")

  const currentUser = players.find((p) => p.isCurrentUser)
  const alivePlayers = players.filter((p) => p.lives > 0)

  const [voiceEnabled, setVoiceEnabledState] = useState(true)
  const [displayedCurrentUserLives, setDisplayedCurrentUserLives] = useState<number | null>(null)

  const getPositionedOpponents = () => {
    const opponents = alivePlayers
      .filter((p) => !p.isCurrentUser)
      .sort((a, b) => {
        // Sort by lives descending, then by nickname
        if (b.lives !== a.lives) return b.lives - a.lives
        return a.nickname.localeCompare(b.nickname, "ko")
      })

    return opponents
  }

  const opponentLifeBreakdown = useMemo(() => {
    const opponents = getPositionedOpponents()
    const lifeMap = new Map<number, number>()

    opponents.forEach((p) => {
      lifeMap.set(p.lives, (lifeMap.get(p.lives) || 0) + 1)
    })

    const breakdown = Array.from(lifeMap.entries())
      .map(([lives, count]) => ({ lives, count }))
      .sort((a, b) => b.lives - a.lives)

    console.log("[v0] Life breakdown:", breakdown)
    console.log(
      "[v0] Opponents:",
      opponents.map((p) => `${p.nickname}:${p.lives}`),
    )

    return breakdown
  }, [players, currentUser]) // Added currentUser dependency

  const getOpponentLifeBreakdown = () => {
    return opponentLifeBreakdown
  }

  const hasPlayerWithLivesLost = (lives: number): boolean => {
    if (gameRound.phase !== "revealing" || losingChoices.length === 0) return false

    const opponents = getPositionedOpponents()
    const result = opponents.some((p) => p.lives === lives && p.finalChoice && losingChoices.includes(p.finalChoice))

    console.log(`[v0] hasPlayerWithLivesLost(${lives}):`, result)
    console.log(`[v0] Losing choices:`, losingChoices)
    console.log(
      `[v0] Players with ${lives} lives:`,
      opponents.filter((p) => p.lives === lives).map((p) => `${p.nickname}:${p.finalChoice}`),
    )

    return result
  }

  const getOtherPlayersWeaponCounts = (): ChoiceCount => {
    const counts: ChoiceCount = { rock: 0, paper: 0, scissors: 0 }

    alivePlayers.forEach((player) => {
      if (!player.isCurrentUser && player.selectedChoices) {
        player.selectedChoices.forEach((choice) => {
          counts[choice]++
        })
      }
    })

    return counts
  }

  useEffect(() => {
    // Generate a unique ID for this game session
    setGameRoundId(Date.now().toString() + Math.random().toString(36).substring(2, 9))
  }, [])

  useEffect(() => {
    // 로비에서 게임 시작 플래그 제거
    sessionStorage.removeItem('gameStarting')
    
    const loadGameData = async () => {
      if (hasLoadedDataRef.current) {
        console.log("[v0] Already loaded game data, skipping")
        return
      }
      hasLoadedDataRef.current = true
      
      const searchParams = new URLSearchParams(window.location.search)
      const isTestMode = searchParams.get("test") === "finals"

      if (isTestMode) {
        const testPlayers: Player[] = [
          {
            id: "test-user",
            nickname: "나",
            lives: 2,
            isCurrentUser: true,
          },
          {
            id: "test-opponent",
            nickname: "상대방",
            lives: 2,
            isCurrentUser: false,
          },
        ]

        setPlayers(testPlayers)
        setGameMode("final")
        setGameRound({ round: 1, phase: "waiting", timeLeft: 0, survivors: 2 })
        setGameMessage("결승전 1라운드를 시작합니다")

        setTimeout(() => {
          speak("결승전 1라운드를 시작합니다", {
            onComplete: () => {
              setGameRound({
                round: 1,
                phase: "selectTwo",
                timeLeft: 10,
                survivors: testPlayers.length,
              })
            },
          })
        }, 2000)

        return
      }

      // Get current user participant ID from localStorage
      const participantData = localStorage.getItem("participantInfo")
      let currentParticipantId = ""
      if (participantData) {
        const participant = JSON.parse(participantData)
        currentParticipantId = participant.id
        console.log("[v0] Current participant ID:", currentParticipantId)
      }

      try {
        // DB에서 직접 플레이어 데이터 가져오기
        console.log("[v0] Loading game data from DB...")
        const response = await fetch("/api/game/state")
        if (!response.ok) {
          console.error("[v0] Failed to load game data:", response.status)
          return
        }

        const data = await response.json()
        console.log("[v0] DB game data:", data)

        // playing 상태인 참가자만 게임에 참여
        const lobbyPlayers = data.participants?.filter((p: any) => p.status === "playing") || []
        console.log("[v0] Playing participants:", lobbyPlayers)

        const gamePlayers: Player[] = lobbyPlayers.map((p: any) => {
          const player = {
            id: p.id,
            nickname: p.nickname,
            lives: p.currentLives || 0,
            isCurrentUser: p.id === currentParticipantId,
          }
          console.log("[v0] Created game player:", player)
          return player
        })

        console.log("[v0] All game players:", gamePlayers)
        setPlayers(gamePlayers)

        setGameMode(gamePlayers.length > 4 ? "preliminary" : "final")
        setGameRound((prev) => ({ ...prev, survivors: gamePlayers.length }))

        setGameLog((prev) => ({
          ...prev,
          totalPlayers: gamePlayers.length,
        }))

        const totalPlayers = gamePlayers.length
        const totalLives = gamePlayers.reduce((sum, p) => sum + p.lives, 0)
        const modeText = gamePlayers.length > 4 ? "예선" : "결승"

        const startMessage = `이제 총 ${totalPlayers}명, 목숨 ${totalLives}개로, ${modeText} 1라운드를 시작합니다`
        setGameMessage(startMessage)
        
        setTimeout(() => {
          speak(startMessage, {
            onComplete: () => {
              setGameRound({
                round: 1,
                phase: "selectTwo",
                timeLeft: 10,
                survivors: gamePlayers.length,
              })
            },
          })
        }, 500)
      } catch (error) {
        console.error("[v0] Error loading game data:", error)
      }
    }

    loadGameData()
  }, [])

  useEffect(() => {
    if (showFinalsConfirmation && finalsCountdown > 0) {
      const timer = setTimeout(() => {
        setFinalsCountdown((prev) => prev - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (showFinalsConfirmation && finalsCountdown === 0) {
      // Prepare finalist data for the finals page
      const finalists = players
        .filter((p) => p.lives > 0)
        .map((p) => ({
          id: p.id,
          nickname: p.nickname,
          lives: p.lives,
          isCurrentUser: p.isCurrentUser,
        }))

      // Store in sessionStorage for the finals page to access
      sessionStorage.setItem(
        "finalistsData",
        JSON.stringify({
          gameRoundId,
          finalists,
          timestamp: Date.now(),
        }),
      )

      // Redirect immediately
      window.location.href = "/finals"
    }
  }, [showFinalsConfirmation, finalsCountdown, players, gameRoundId])

  useEffect(() => {
    if (showModeTransition) {
      const timer = setTimeout(() => {
        setShowModeTransition(false)
        startNextRound()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [showModeTransition])

  useEffect(() => {
    const event: GameEvent = {
      type: "roundStart",
      playerId: "system",
      playerNickname: "System",
      timestamp: Date.now(),
    }
    setCurrentRoundLog((prev) => ({
      ...prev,
      events: [event],
    }))
  }, [])

  useEffect(() => {
    if (gameRound.timeLeft > 0 && (gameRound.phase === "selectTwo" || gameRound.phase === "excludeOne")) {
      const timer = setTimeout(() => {
        setGameRound((prev) => ({ ...prev, timeLeft: prev.timeLeft - 1 }))
      }, 1000)
      return () => clearTimeout(timer)
    } else if (gameRound.timeLeft === 0) {
      if (gameRound.phase === "selectTwo") {
        handleSelectTwoTimeUp()
      } else if (gameRound.phase === "excludeOne") {
        handleExcludeOneTimeUp()
      }
    }
  }, [gameRound.timeLeft, gameRound.phase])

  useEffect(() => {
    if (gameRound.phase === "selectTwo" && gameRound.timeLeft === 10) {
      // Only trigger on initial entry to selectTwo phase (when timeLeft is 10)
      setGameMessage("가위/바위/보 중 2개를 선택하세요!")
      setTimeout(() => {
        speak("가위 바위 보, 2개를 선택하세요")
      }, 500)
    }
  }, [gameRound.phase, gameRound.timeLeft])

  useEffect(() => {
    if (gameRound.phase === "excludeOne" && gameRound.timeLeft === 10) {
      // Only trigger on initial entry to excludeOne phase (when timeLeft is 10)
      setGameMessage("하나 빼기! 선택한 2개 중 하나를 빼세요!")
      setTimeout(() => {
        speak("하나 빼기, 1개를 제외하세요")
      }, 500)
    }
  }, [gameRound.phase, gameRound.timeLeft])

  useEffect(() => {
    if (gameRound.phase === "selectTwo" && gameRound.timeLeft <= 9 && gameRound.timeLeft > 0) {
      const timer = setTimeout(() => {
        setPlayers((prev) =>
          prev.map((p) => {
            if (!p.isCurrentUser && p.lives > 0 && (!p.selectedChoices || p.selectedChoices.length !== 2)) {
              const allChoices: GameChoice[] = ["rock", "paper", "scissors"]
              const randomTwo = allChoices.sort(() => Math.random() - 0.5).slice(0, 2)
              console.log(`[v0] AI ${p.nickname} auto-selected:`, randomTwo)
              return { ...p, selectedChoices: randomTwo }
            }
            return p
          }),
        )
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [gameRound.phase, gameRound.timeLeft])

  useEffect(() => {
    if (gameRound.phase === "excludeOne" && gameRound.timeLeft <= 9 && gameRound.timeLeft > 0) {
      const timer = setTimeout(() => {
        setPlayers((prev) =>
          prev.map((p) => {
            if (
              !p.isCurrentUser &&
              p.lives > 0 &&
              !p.finalChoice &&
              p.selectedChoices &&
              p.selectedChoices.length === 2
            ) {
              const finalChoice = p.selectedChoices[Math.floor(Math.random() * 2)]
              console.log(`[v0] AI ${p.nickname} auto-excluded, final choice:`, finalChoice)

              const event: GameEvent = {
                type: "choice",
                playerId: p.id,
                playerNickname: p.nickname,
                choice: finalChoice,
                timestamp: Date.now(),
              }
              setCurrentRoundLog((prevLog) => ({
                ...prevLog,
                events: [...prevLog.events, event],
              }))

              return { ...p, finalChoice }
            }
            return p
          }),
        )
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [gameRound.phase, gameRound.timeLeft])

  const handleSelectTwoTimeUp = () => {
    const playersWithoutChoice = alivePlayers.filter((p) => !p.selectedChoices || p.selectedChoices.length < 2)

    if (playersWithoutChoice.length > 0) {
      console.log(
        "[v0] Players without 2 choices (timeout):",
        playersWithoutChoice.map((p) => p.nickname),
      )

      setPlayers((prev) =>
        prev.map((p) => (playersWithoutChoice.some((pwc) => pwc.id === p.id) ? { ...p, timedOut: true } : p)),
      )
      // </CHANGE>

      setGameMessage(`${playersWithoutChoice.length}명이 시간 초과!`)
    }

    setPlayers((prev) =>
      prev.map((p) => {
        if (!p.isCurrentUser && !p.selectedChoices && p.lives > 0) {
          // Ensure it only applies to alive players without choices
          const allChoices: GameChoice[] = ["rock", "paper", "scissors"]
          const randomTwo = allChoices.sort(() => Math.random() - 0.5).slice(0, 2)
          console.log(`[v0] AI ${p.nickname} auto-selected at timeout:`, randomTwo)
          return { ...p, selectedChoices: randomTwo }
        }
        return p
      }),
    )

    setGameRound((prev) => ({ ...prev, phase: "excludeOne", timeLeft: 10 }))
  }

  const handleExcludeOneTimeUp = () => {
    const playersWithoutFinalChoice = alivePlayers.filter((p) => !p.finalChoice)

    if (playersWithoutFinalChoice.length > 0) {
      console.log(
        "[v0] Players without finalChoice (timeout):",
        playersWithoutFinalChoice.map((p) => p.nickname),
      )

      setPlayers((prev) =>
        prev.map((p) => (playersWithoutFinalChoice.some((pwc) => pwc.id === p.id) ? { ...p, timedOut: true } : p)),
      )
      // </CHANGE>

      setGameMessage(`${playersWithoutFinalChoice.length}명이 시간 초과!`)
    }

    setPlayers((prev) =>
      prev.map((p) => {
        if (!p.isCurrentUser && !p.finalChoice && p.selectedChoices && p.selectedChoices.length === 2) {
          const finalChoice = p.selectedChoices[Math.floor(Math.random() * 2)]
          console.log(`[v0] AI ${p.nickname} auto-excluded at timeout:`, finalChoice)

          const event: GameEvent = {
            type: "choice",
            playerId: p.id,
            playerNickname: p.nickname,
            choice: finalChoice,
            timestamp: Date.now(),
          }
          setCurrentRoundLog((prevLog) => ({
            ...prevLog,
            events: [...prevLog.events, event],
          }))

          return { ...p, finalChoice }
        }
        return p
      }),
    )

    calculateResults()
  }

  const replayRound = () => {
    console.log("[v0] ===== replayRound START (no round increment) =====")

    setPlayers((currentPlayers) => {
      const resetPlayers = currentPlayers.map((p) => ({
        ...p,
        selectedChoices: undefined,
        finalChoice: undefined,
        timedOut: undefined,
      }))

      console.log(
        "[v0] Players reset for replay:",
        resetPlayers.map((p) => ({ nickname: p.nickname, lives: p.lives })),
      )

      const event: GameEvent = {
        type: "roundStart",
        playerId: "system",
        playerNickname: "System",
        timestamp: Date.now(),
      }
      setCurrentRoundLog((prev) => ({
        ...prev,
        events: [event],
        choiceCounts: { rock: 0, paper: 0, scissors: 0 },
        losingChoice: null,
      }))

      setTimeout(() => {
        setGameRound((prev) => ({ ...prev, phase: "selectTwo", timeLeft: 10 }))
      }, 500)

      return resetPlayers
    })

    setSelectedChoices([])
    setChoiceCounts({ rock: 0, paper: 0, scissors: 0 })
    setLosingChoice(null)
    setLosingChoices([])
    setTimeoutEliminatedCount(0)
    setRoundResultStatus(null)

    console.log("[v0] ===== replayRound END =====")
  }

  const calculateResults = () => {
    console.log("[v0] ===== calculateResults START =====")

    let timeoutEliminatedPlayers: Player[] = []
    const playersWithoutChoice = alivePlayers.filter((p) => !p.finalChoice)

    if (playersWithoutChoice.length > 0) {
      console.log(
        "[v0] Players without finalChoice (timeout):",
        playersWithoutChoice.map((p) => p.nickname),
      )

      timeoutEliminatedPlayers = playersWithoutChoice

      setPlayers((prev) =>
        prev.map((p) =>
          playersWithoutChoice.some((pwc) => pwc.id === p.id)
            ? { ...p, timedOut: true }
            : p,
        ),
      )

      playersWithoutChoice.forEach((player) => {
        const event: GameEvent = {
          type: "timeup",
          playerId: player.id,
          playerNickname: player.nickname,
          livesLost: 1,
          remainingLives: Math.max(0, player.lives - 1),
          timestamp: Date.now(),
        }
        setCurrentRoundLog((prev) => ({
          ...prev,
          events: [...prev.events, event],
        }))
      })
    }

    const counts: ChoiceCount = { rock: 0, paper: 0, scissors: 0 }

    alivePlayers.forEach((player) => {
      console.log(`[v0] Player ${player.nickname}: finalChoice = ${player.finalChoice}`)
      if (player.finalChoice) {
        counts[player.finalChoice]++
      }
    })

    console.log("[v0] Choice counts:", counts)
    setChoiceCounts(counts)

    const nonZeroCounts = Object.entries(counts).filter(([_, count]) => count > 0)
    const numDifferentChoices = nonZeroCounts.length
    console.log("[v0] Number of different choices:", numDifferentChoices)

    if (gameMode === "final") {
      // Finals mode: Use rock-paper-scissors battle logic
      console.log("[v0] Finals mode: Using rock-paper-scissors battle logic")

      if (numDifferentChoices === 1) {
        // Everyone chose the same weapon → draw
        console.log("[v0] All players chose the same weapon → draw")
        setLosingChoice(null)
        setLosingChoices([])
        setCurrentRoundLog((prev) => ({
          ...prev,
          choiceCounts: counts,
          losingChoice: null,
        }))

        setGameRound((prev) => ({ ...prev, phase: "revealing", timeLeft: 5 }))

        if (timeoutEliminatedPlayers.length > 0) {
          const message = `${timeoutEliminatedPlayers.length}명이 시간 초과로 목숨 1개를 잃었습니다!`
          setGameMessage(message)
          speak(message)
          setTimeout(() => {
            console.log("[v0] Timeout elimination occurred, calling processElimination")
            processElimination([], counts)
            // </CHANGE>
          }, 3000)
        } else {
          setGameMessage("이번 게임은 무승부라 바로 이어서 시작합니다")
          speak("이번 게임은 무승부라 바로 이어서 시작합니다")
          setTimeout(() => {
            console.log("[v0] Draw with no eliminations, replaying round")
            replayRound()
          }, 3000)
        }
        return
      }

      if (numDifferentChoices === 3) {
        // All 3 weapons present → draw
        console.log("[v0] All 3 weapons present → draw")
        setLosingChoice(null)
        setLosingChoices([])
        setCurrentRoundLog((prev) => ({
          ...prev,
          choiceCounts: counts,
          losingChoice: null,
        }))

        setGameRound((prev) => ({ ...prev, phase: "revealing", timeLeft: 5 }))

        if (timeoutEliminatedPlayers.length > 0) {
          const message = `가위바위보를 내지 않아 ${timeoutEliminatedPlayers.length}명이 목숨 1개를 잃었습니다! (배틀은 무승부)`
          setGameMessage(message)
          speak(message)
          setTimeout(() => {
            console.log("[v0] Timeout elimination occurred, calling processElimination")
            processElimination([], counts)
            // </CHANGE>
          }, 3000)
        } else {
          setGameMessage("이번 게임은 무승부라 바로 이어서 시작합니다 (3종류 무기 출현)")
          speak("이번 게임은 무승부라 바로 이어서 시작합니다")
          setTimeout(() => {
            console.log("[v0] Draw with no eliminations (3 choices), replaying round")
            replayRound()
          }, 3000)
        }
        return
      }

      // 2 different weapons: Determine winner by rock-paper-scissors rules
      const presentWeapons = nonZeroCounts.map(([choice, _]) => choice as GameChoice)
      console.log("[v0] Present weapons:", presentWeapons)

      let losingWeapon: GameChoice | null = null

      // Rock-paper-scissors rules:
      // Rock beats Scissors
      // Scissors beats Paper
      // Paper beats Rock
      if (presentWeapons.includes("rock") && presentWeapons.includes("scissors")) {
        losingWeapon = "scissors" // Rock beats Scissors
      } else if (presentWeapons.includes("scissors") && presentWeapons.includes("paper")) {
        losingWeapon = "paper" // Scissors beats Paper
      } else if (presentWeapons.includes("paper") && presentWeapons.includes("rock")) {
        losingWeapon = "rock" // Paper beats Rock
      }

      console.log("[v0] Losing weapon:", losingWeapon)

      if (!losingWeapon) {
        console.error("[v0] ERROR: Could not determine losing weapon!")
        return
      }

      setLosingChoice(losingWeapon)
      setLosingChoices([losingWeapon])
      setTimeoutEliminatedCount(timeoutEliminatedPlayers.length)

      setCurrentRoundLog((prev) => ({
        ...prev,
        choiceCounts: counts,
        losingChoice: losingWeapon,
      }))

      setGameRound((prev) => ({ ...prev, phase: "revealing", timeLeft: 5 }))
      setGameMessage("결과를 공개합니다...")
      speak("결과를 공개합니다")

      setTimeout(() => {
        console.log("[v0] Calling processElimination with:", [losingWeapon])
        if (losingWeapon) {
          processElimination([losingWeapon], counts)
        }
      }, 3000)
      return
    }

    if (numDifferentChoices === 1) {
      console.log("[v0] Only one choice selected, no battle elimination")
      setLosingChoice(null)
      setLosingChoices([])
      setCurrentRoundLog((prev) => ({
        ...prev,
        choiceCounts: counts,
        losingChoice: null,
      }))

      setGameRound((prev) => ({ ...prev, phase: "revealing", timeLeft: 5 }))

      if (timeoutEliminatedPlayers.length > 0) {
        const message = `가위바위보를 내지 않아 ${timeoutEliminatedPlayers.length}명이 목숨 1개를 잃었습니다!`
        setGameMessage(message)
        speak(message)
        setTimeout(() => {
          console.log("[v0] Timeout elimination occurred, calling processElimination")
          processElimination([], counts)
          // </CHANGE>
        }, 3000)
      } else {
        setGameMessage("이번 게임은 무승부라 바로 이어서 시작합니다")
        speak("이번 게임은 무승부라 바로 이어서 시작합니다")
        setTimeout(() => {
          console.log("[v0] No battle elimination (only one choice), replaying round")
          replayRound()
        }, 3000)
      }
      return
    }

    const minCount = Math.min(...nonZeroCounts.map(([_, count]) => count))
    console.log("[v0] Min count:", minCount)

    const losingChoicesArray = nonZeroCounts
      .filter(([_, count]) => count === minCount)
      .map(([choice, _]) => choice as GameChoice)

    console.log("[v0] Losing choices:", losingChoicesArray)

    if (losingChoicesArray.length === numDifferentChoices) {
      console.log("[v0] All choices have same count, no battle elimination")
      setLosingChoice(null)
      setLosingChoices([])
      setCurrentRoundLog((prev) => ({
        ...prev,
        choiceCounts: counts,
        losingChoice: null,
      }))

      setGameRound((prev) => ({ ...prev, phase: "revealing", timeLeft: 5 }))

      if (timeoutEliminatedPlayers.length > 0) {
        const message = `가위바위보를 내지 않아 ${timeoutEliminatedPlayers.length}명이 목숨 1개를 잃었습니다! (배틀은 무승부)`
        setGameMessage(message)
        speak(message)
        setTimeout(() => {
          console.log("[v0] Timeout elimination occurred, calling processElimination")
          processElimination([], counts)
          // </CHANGE>
        }, 3000)
      } else {
        setGameMessage("이번 게임은 무승부라 바로 이어서 시작합니다")
        speak("이번 게임은 무승부라 바로 이어서 시작합니다")
        setTimeout(() => {
          console.log("[v0] No battle elimination (tie), replaying round")
          replayRound()
        }, 3000)
      }
      return
    }

    console.log("[v0] All losing choices:", losingChoicesArray)
    setLosingChoice(losingChoicesArray[0])
    setLosingChoices(losingChoicesArray)

    setTimeoutEliminatedCount(timeoutEliminatedPlayers.length)

    setCurrentRoundLog((prev) => ({
      ...prev,
      choiceCounts: counts,
      losingChoice: losingChoicesArray[0],
    }))

    setGameRound((prev) => ({ ...prev, phase: "revealing", timeLeft: 5 }))
    setGameMessage("결과를 공개합니다...")
    speak("결과를 공개합니다")

    setTimeout(() => {
      console.log("[v0] Calling processElimination with:", losingChoicesArray)
      processElimination(losingChoicesArray, counts)
    }, 3000)
  }

  const processElimination = (losingChoicesArray: GameChoice[], counts: ChoiceCount) => {
    console.log("[v0] ===== processElimination START =====")
    console.log("[v0] Processing elimination for choices:", losingChoicesArray)
    console.log("[v0] Counts:", counts)

    // Reset elimination spoken flag at start of each elimination
    hasEliminationSpokenRef.current = false

    const currentUserBeforeElimination = players.find((p) => p.isCurrentUser)
    let currentUserLostLife = false

    setPlayers((currentPlayers) => {
      console.log("[v0] Current players count:", currentPlayers.length)
      console.log(
        "[v0] Current players before elimination:",
        currentPlayers.map((p) => ({
          nickname: p.nickname,
          lives: p.lives,
          finalChoice: p.finalChoice,
          timedOut: p.timedOut,
          isAlive: p.lives > 0,
        })),
      )

      let totalLivesLost = 0
      let playersEliminated = 0
      let timeoutCount = 0

      const updatedPlayers = currentPlayers.map((p) => {
        const lostByTimeout = p.lives > 0 && p.timedOut
        const lostByBattle = p.lives > 0 && p.finalChoice && losingChoicesArray.includes(p.finalChoice)

        if (lostByBattle) {
          const newLives = Math.max(0, p.lives - 1)
          console.log(
            `[v0] ⚠️ ${p.nickname} loses 1 life: ${p.lives} -> ${newLives} (timeout: ${lostByTimeout}, battle: ${lostByBattle})`,
          )

          totalLivesLost++
          if (newLives === 0) {
            playersEliminated++
          }

          if (p.isCurrentUser) {
            currentUserLostLife = true
          }

          const event: GameEvent = {
            type: "elimination",
            playerId: p.id,
            playerNickname: p.nickname,
            choice: p.finalChoice,
            livesLost: 1,
            remainingLives: newLives,
            timestamp: Date.now(),
          }
          setCurrentRoundLog((prevLog) => ({
            ...prevLog,
            events: [...prevLog.events, event],
          }))

          // Clear timedOut flag for next round
          return { ...p, lives: newLives, timedOut: false }
        } else if (lostByTimeout) {
          // Timeout: lose 1 life
          const newLives = Math.max(0, p.lives - 1)
          console.log(
            `[v0] ⏱️ ${p.nickname} timed out, loses 1 life: ${p.lives} -> ${newLives}`,
          )
          
          timeoutCount++
          totalLivesLost++
          if (newLives === 0) {
            playersEliminated++
          }

          if (p.isCurrentUser) {
            currentUserLostLife = true
          }

          const event: GameEvent = {
            type: "timeup",
            playerId: p.id,
            playerNickname: p.nickname,
            livesLost: 1,
            remainingLives: newLives,
            timestamp: Date.now(),
          }
          setCurrentRoundLog((prevLog) => ({
            ...prevLog,
            events: [...prevLog.events, event],
          }))
          // Clear timedOut flag for next round
          return { ...p, lives: newLives, timedOut: false }
        }

        // Clear timedOut flag even if didn't lose life
        return { ...p, timedOut: false }
        // </CHANGE>
      })

      console.log(
        "[v0] Updated players after elimination:",
        updatedPlayers.map((p) => ({ nickname: p.nickname, lives: p.lives })),
      )

      const newAlivePlayers = updatedPlayers.filter((p) => p.lives > 0)
      const newSurvivors = newAlivePlayers.length

      console.log("[v0] Survivors after elimination:", newSurvivors)
      console.log(
        "[v0] Alive players:",
        newAlivePlayers.map((p) => ({ nickname: p.nickname, lives: p.lives })),
      )

      if (currentUserBeforeElimination && currentUserBeforeElimination.lives > 0) {
        if (currentUserLostLife) {
          setRoundResultStatus("died")
        } else {
          setRoundResultStatus("survived")
        }
      }

      let eliminationMessage = ""
      const battleLivesLost = totalLivesLost - timeoutCount // Exclude timeout from battle count

      if (timeoutCount > 0 && battleLivesLost > 0) {
        // Both timeout and battle losses
        const choice = losingChoicesArray[0]
        const choiceText =
          losingChoicesArray.length === 1
            ? `${getChoiceKorean(choice)}`
            : losingChoicesArray.map((c) => getChoiceKorean(c)).join(", ")

        eliminationMessage = `가위바위보를 내지 않아 ${timeoutCount}명, ${choiceText}를 낸 ${battleLivesLost}개의 목숨을 잃었습니다`
      } else if (timeoutCount > 0) {
        // Only timeout losses
        eliminationMessage = `가위바위보를 내지 않아 ${timeoutCount}명이 시간 초과했습니다.`
      } else if (battleLivesLost > 0) {
        // Only battle losses
        const choice = losingChoicesArray[0]
        const choiceText =
          losingChoicesArray.length === 1
            ? `${getChoiceKorean(choice)}`
            : losingChoicesArray.map((c) => getChoiceKorean(c)).join(", ")

        eliminationMessage = `${choiceText}를 낸 ${battleLivesLost}개의 목숨을 잃었습니다`
      }

      if (playersEliminated > 0) {
        eliminationMessage += ` (${playersEliminated}명 탈락)`
      }
      // </CHANGE>

      console.log("[v0] Elimination message:", eliminationMessage)

      // Prevent duplicate speak calls using ref (React Strict Mode protection)
      if (!hasEliminationSpokenRef.current) {
        hasEliminationSpokenRef.current = true
        setGameMessage(eliminationMessage)

        speak(eliminationMessage, {
          onComplete: () => {
            // Update displayed lives after TTS completes (syncs timing with message)
            const newCurrentUser = updatedPlayers.find((p) => p.isCurrentUser)
            if (newCurrentUser) {
              setDisplayedCurrentUserLives(newCurrentUser.lives)
            }

            // After TTS completes, proceed with game flow
            if (newSurvivors === 1) {
              console.log("[v0] Winner found!")
              setTimeout(() => {
                const winner = newAlivePlayers[0]
                const finalRoundLog = { ...currentRoundLog, survivorsAtEnd: 1 }
                const completeGameLog: GameLog = {
                  ...gameLog,
                  endTime: Date.now(),
                  rounds: [...gameLog.rounds, finalRoundLog],
                  finalists: [{ id: winner.id, nickname: winner.nickname, lives: winner.lives }],
                }

                localStorage.setItem("gameLog", JSON.stringify(completeGameLog))

                setGameRound((prev) => ({ ...prev, phase: "gameOver", timeLeft: 0 }))
                setGameMessage(`🎉 ${winner.nickname}님이 우승했습니다! 🎉`)
                speak(`우승자는 ${winner.nickname}입니다. 축하합니다!`)
              }, 2000)
            } else if (newSurvivors <= 4 && gameMode === "preliminary") {
              console.log("[v0] Showing finals confirmation modal after delay")
              setTimeout(() => {
                setFinalsCountdown(60)
                setShowFinalsConfirmation(true)
                speak("결승전 진출자가 확정되었습니다")
              }, 2000)
            } else {
              console.log("[v0] Starting next round after TTS complete")
              setTimeout(() => {
                startNextRound()
              }, 2000)
            }
          },
        })
      }

      setTimeoutEliminatedCount(0)

      setCurrentRoundLog((prev) => ({
        ...prev,
        survivorsAtEnd: newSurvivors,
      }))

      setGameRound((prev) => ({ ...prev, survivors: newSurvivors }))

      console.log(
        "[v0] Returning updated players to state:",
        updatedPlayers.map((p) => ({ nickname: p.nickname, lives: p.lives })),
      )
      return updatedPlayers
    })
  }

  const handleProceedToFinals = () => {
    setShowFinalsConfirmation(false)
    setShowModeTransition(true)
    speak("결승전이 시작됩니다")
    // The setShowModeTransition logic is now handled in its own useEffect
  }

  const startNextRound = () => {
    console.log("[v0] ===== startNextRound START =====")

    // Reset elimination spoken flag for next round
    hasEliminationSpokenRef.current = false
    
    // Reset displayed lives (will use actual lives from currentUser)
    setDisplayedCurrentUserLives(null)

    setGameLog((prev) => ({
      ...prev,
      rounds: [...prev.rounds, currentRoundLog],
    }))

    let roundMessage = ""
    
    setPlayers((currentPlayers) => {
      const resetPlayers = currentPlayers.map((p) => ({
        ...p,
        selectedChoices: undefined,
        finalChoice: undefined,
        timedOut: undefined,
      }))

      console.log(
        "[v0] Players reset for next round:",
        resetPlayers.map((p) => ({ nickname: p.nickname, lives: p.lives })),
      )

      const currentAlivePlayers = resetPlayers.filter((p) => p.lives > 0)
      const totalPlayers = currentAlivePlayers.length

      console.log("[v0] Current alive players for next round:", totalPlayers)

      // If only 1 player remains, declare winner and end game
      if (totalPlayers === 1) {
        console.log("[v0] Only 1 player remaining - ending game")
        const winner = currentAlivePlayers[0]
        const finalRoundLog = { ...currentRoundLog, survivorsAtEnd: 1 }
        const completeGameLog: GameLog = {
          ...gameLog,
          endTime: Date.now(),
          rounds: [...gameLog.rounds, finalRoundLog],
          finalists: [{ id: winner.id, nickname: winner.nickname, lives: winner.lives }],
        }

        localStorage.setItem("gameLog", JSON.stringify(completeGameLog))

        setGameRound((prev) => ({ ...prev, phase: "gameOver", timeLeft: 0 }))
        setGameMessage(`🎉 ${winner.nickname}님이 우승했습니다! 🎉`)
        speak(`우승자는 ${winner.nickname}입니다. 축하합니다!`)

        return resetPlayers
      }

      const totalLives = currentAlivePlayers.reduce((sum, p) => sum + p.lives, 0)

      console.log("[v0] Total lives for next round:", totalLives)

      const nextRound = gameRound.round + 1
      const modeText = gameMode === "preliminary" ? "예선" : "결승"

      setGameRound((prev) => ({
        ...prev,
        round: nextRound,
        phase: "waiting",
        timeLeft: 0,
        survivors: currentAlivePlayers.length,
      }))

      const event: GameEvent = {
        type: "roundStart",
        playerId: "system",
        playerNickname: "System",
        timestamp: Date.now(),
      }
      setCurrentRoundLog({
        round: nextRound,
        events: [event],
        choiceCounts: { rock: 0, paper: 0, scissors: 0 },
        losingChoice: null,
        survivorsAtEnd: currentAlivePlayers.length,
      })

      roundMessage = `총 ${totalPlayers}명, 목숨 ${totalLives}개로, ${modeText} ${nextRound}라운드를 시작합니다`
      setGameMessage(roundMessage)

      return resetPlayers
    })

    setTimeout(() => {
      if (roundMessage) {
        speak(roundMessage, {
          onComplete: () => {
            setTimeout(() => {
              setGameRound((prev) => ({ ...prev, phase: "selectTwo", timeLeft: 10 }))
            }, 1000)
          },
        })
      }
    }, 1000)

    setSelectedChoices([])
    setChoiceCounts({ rock: 0, paper: 0, scissors: 0 })
    setLosingChoice(null)
    setLosingChoices([])
    setTimeoutEliminatedCount(0)
    setRoundResultStatus(null)

    console.log("[v0] ===== startNextRound END =====")
  }

  const handleSelectChoice = (choice: GameChoice) => {
    if (gameRound.phase !== "selectTwo") return

    setSelectedChoices((prev) => {
      if (prev.includes(choice)) {
        return prev.filter((c) => c !== choice)
      } else if (prev.length < 2) {
        const newChoices = [...prev, choice]
        if (newChoices.length === 2) {
          setPlayers((players) => players.map((p) => (p.isCurrentUser ? { ...p, selectedChoices: newChoices } : p)))
        }
        return newChoices
      }
      return prev
    })
  }

  const handleExcludeChoice = (choice: GameChoice) => {
    if (gameRound.phase !== "excludeOne" || !selectedChoices.includes(choice)) return

    const finalChoice = selectedChoices.find((c) => c !== choice)
    if (finalChoice) {
      setPlayers((prev) => prev.map((p) => (p.isCurrentUser ? { ...p, finalChoice } : p)))

      if (currentUser) {
        const event: GameEvent = {
          type: "choice",
          playerId: currentUser.id,
          playerNickname: currentUser.nickname,
          choice: finalChoice,
          timestamp: Date.now(),
        }
        setCurrentRoundLog((prev) => ({
          ...prev,
          events: [...prev.events, event],
        }))
      }
    }
  }

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

  const getChoiceKorean = (choice: GameChoice) => {
    switch (choice) {
      case "rock":
        return "바위"
      case "paper":
        return "보"
      case "scissors":
        return "가위"
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

  const toggleVoice = () => {
    const newState = !voiceEnabled
    setVoiceEnabledState(newState)
    setVoiceEnabled(newState)
  }

  if (gameRound.phase === "gameOver") {
    const winner = alivePlayers.find((p) => p.lives > 0)
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-yellow-950 to-black text-white flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          {/* Confetti animation */}
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

  if (showModeTransition) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-black text-white flex items-center justify-center">
        <Card className="bg-black/80 border-purple-600/50 p-12 max-w-2xl w-full mx-4 text-center">
          <div className="mb-8">
            <div className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <span className="text-white font-bold text-sm">하</span>
            </div>
            <h1 className="text-4xl font-bold text-purple-400 mb-4 animate-pulse">결승전 진출!</h1>
            <h2 className="text-2xl font-semibold text-white mb-6">
              {alivePlayers.length}명의 결승 진출자가 결정되었습니다
            </h2>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-purple-400 mb-4">결승 진출자</h3>
            <div className="grid grid-cols-2 gap-4">
              {players
                .sort((a, b) => b.lives - a.lives)
                .map((player) => (
                  <div
                    key={player.id}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg border min-w-[120px] ${
                      player.lives === 0
                        ? "bg-gray-950/50 border-gray-600/30 opacity-50"
                        : player.isCurrentUser
                          ? "bg-yellow-950/30 border-yellow-600/50"
                          : "bg-red-950/30 border-red-600/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-semibold text-xs truncate ${player.lives === 0 ? "text-gray-500" : "text-white"}`}
                      >
                        {player.nickname}
                      </span>
                      {player.isCurrentUser && (
                        <Badge className="text-[10px] bg-yellow-600/20 text-yellow-200 px-1 py-0.5">나</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: player.lives }).map((_, i) => (
                        <div key={i} className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                      ))}
                      <span className="text-[10px] text-gray-400 ml-1">{player.lives}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="text-gray-400 text-sm">잠시 후 결승전이 시작됩니다...</div>
        </Card>
      </div>
    )
  }

  if (showFinalsConfirmation) {
    const finalists = players
      .filter((p) => p.lives > 0)
      .sort((a, b) => {
        if (b.lives !== a.lives) {
          return b.lives - a.lives
        }
        return a.nickname.localeCompare(b.nickname, "ko")
      })

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-black text-white flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

        <Card className="bg-black/90 border-purple-600/50 p-8 max-w-2xl w-full mx-4 relative z-10">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">🏆</span>
            </div>
            <h1 className="text-3xl font-bold text-purple-400 mb-2">결승전 확정 명단</h1>
            <p className="text-xl text-gray-300">{finalists.length}명</p>
          </div>

          <div className="bg-purple-950/30 border border-purple-600/50 rounded-lg p-6 mb-6">
            <div className="space-y-3">
              {finalists.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                    player.isCurrentUser
                      ? "bg-yellow-950/30 border-2 border-yellow-400 shadow-lg shadow-yellow-600/20"
                      : "bg-gray-900/50 border border-gray-700/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-purple-400 w-8">#{index + 1}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xl font-bold ${player.isCurrentUser ? "text-yellow-300" : "text-white"}`}
                        >
                          {player.nickname}
                        </span>
                        {player.isCurrentUser && (
                          <Badge className="text-xs bg-yellow-600 text-black px-2 py-1 font-bold">나</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: player.lives }).map((_, i) => (
                        <div key={i} className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                      ))}
                    </div>
                    <span className="text-xl font-bold text-yellow-400">목숨 {player.lives}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-950/30 border border-red-600/50 rounded-lg p-6 mb-4 text-center">
            <p className="text-lg text-red-300 mb-3">
              결승전은 진짜 가위바위보 게임이니
              <br />
              마음의 준비를 하시고...
            </p>
            <div className="text-5xl font-bold text-yellow-400 mb-2 animate-pulse">{finalsCountdown}</div>
            <p className="text-sm text-gray-400">초 후 자동으로 시작됩니다</p>
            <Progress value={((60 - finalsCountdown) / 60) * 100} className="w-full h-2 mt-3" />
          </div>

          <p className="text-center text-gray-400 text-sm">잠시 휴식을 취하세요...</p>
        </Card>
      </div>
    )
  }

  const isFinals = gameMode === "final" && alivePlayers.length <= 4

  if (
    isFinals &&
    (gameRound.phase === "selectTwo" || gameRound.phase === "excludeOne" || gameRound.phase === "revealing")
  ) {
    const opponents = getPositionedOpponents()
    const numOpponents = opponents.length

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-black text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('/abstract-geometric-pattern.png')] opacity-5"></div>

        <header className="relative z-10 p-3 border-b border-purple-800/30 sticky top-0 bg-slate-900/95 backdrop-blur">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <img src="/game-logo.png" alt="가위바위보 로고" className="w-15 h-15 rounded-full" />
                <h1 className="text-xl font-bold">가위바위보 하나빼기</h1>
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
            <div className="flex items-center justify-center gap-4">
              <Badge
                variant="destructive"
                className="text-2xl px-4 py-2 bg-purple-600/20 text-purple-300 border-purple-600/50"
              >
                결승 R{gameRound.round}
              </Badge>
              <Badge variant="outline" className="border-green-600/50 text-green-300 text-2xl px-4 py-2">
                생존 {alivePlayers.length}
              </Badge>
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

          {/* Removed duplicate opponent status card showing individual player names */}
          <></>

          {/* Finals Arena - Positioned Players */}
          <div
            className={`relative flex items-center justify-center ${numOpponents === 1 ? "min-h-[400px]" : "min-h-[600px]"}`}
          >
            {/* Opponent(s) - Top position for 1 opponent */}
            {numOpponents === 1 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2">
                <OpponentCard player={opponents[0]} phase={gameRound.phase} losingChoices={losingChoices} />
              </div>
            )}

            {/* Current User - Bottom position */}
            {currentUser && currentUser.lives > 0 && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-black text-white pb-24">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('/abstract-geometric-pattern.png')] opacity-5"></div>

      <header className="relative z-10 p-3 border-b border-red-800/30 sticky top-0 bg-slate-900/95 backdrop-blur">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <img src="/game-logo.png" alt="가위바위보 로고" className="w-15 h-15 rounded-full" />
              <h1 className="text-xl font-bold">가위바위보 하나빼기</h1>
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
          <div className="flex items-center justify-center gap-4">
            <Badge
              variant="destructive"
              className={`text-2xl px-4 py-2 ${gameMode === "final" ? "bg-purple-600/20 text-purple-300 border-purple-600/50" : "bg-red-600/20 text-red-300 border-red-600/50"}`}
            >
              {gameMode === "final" ? "결승" : "예선"} R{gameRound.round}
            </Badge>
            <Badge variant="outline" className="border-green-600/50 text-green-300 text-2xl px-4 py-2">
              생존 {alivePlayers.length}
            </Badge>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-3 py-3">
        <Card className="bg-black/60 border-red-800/50 p-4 mb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-red-300">{gameMessage}</h2>
            </div>
            {(gameRound.phase === "selectTwo" ||
              gameRound.phase === "excludeOne" ||
              gameRound.phase === "revealing") && (
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

        {!isFinals && (
          <Card className="bg-red-950/30 border-red-600/50 p-3 mb-3">
            <div className="flex items-center gap-4">
              {/* Title on the left with border */}
              <h3 className="text-base font-semibold text-red-300 border-l-4 border-red-600 pl-3 whitespace-nowrap">
                상대 현황 ({getPositionedOpponents().length}명,{" "}
                {getPositionedOpponents().reduce((sum, p) => sum + p.lives, 0)}개목숨)
              </h3>

              {/* Lives display on the right, wraps if needed */}
              <div className="flex flex-wrap items-center gap-4 flex-1 justify-center">
                {opponentLifeBreakdown.map(({ lives, count }) => {
                  return (
                    <div key={lives} className="flex items-center gap-2">
                      {/* Visual life icons */}
                      <div className="flex gap-1">
                        {Array.from({ length: lives }).map((_, i) => (
                          <div key={i} className="w-3 h-3 bg-red-600 rounded-full"></div>
                        ))}
                      </div>
                      <span className="text-white font-semibold text-base">- {count}명</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )}

        {alivePlayers.length > 4 && (gameRound.phase === "excludeOne" || gameRound.phase === "waiting") && (
          <Card className="bg-black/60 border-purple-800/50 p-4 mb-3">
            <div className="relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 pl-3 border-l-4 border-purple-500">
                <h3 className="text-xl font-bold text-purple-300 whitespace-nowrap">상대 무기현황</h3>
              </div>
              <div className="flex justify-center gap-4 py-2">
                {(["scissors", "rock", "paper"] as GameChoice[]).map((choice) => {
                  const count = getOtherPlayersWeaponCounts()[choice]
                  return (
                    <div key={choice} className="flex flex-col items-center">
                      <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center text-4xl mb-2">
                        {getChoiceIcon(choice)}
                      </div>
                      <div className="text-3xl font-bold text-yellow-400">{count}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )}

        {gameRound.phase === "selectTwo" && (
          <>
            {currentUser && currentUser.lives > 0 ? (
              <Card className="bg-black/60 border-yellow-800/50 p-4 mb-3">
                <h3 className="text-base font-semibold text-yellow-300 mb-3 text-center">
                  2개 선택 ({selectedChoices.length}/2)
                </h3>
                <div className="flex justify-center gap-4">
                  {(["rock", "paper", "scissors"] as GameChoice[]).map((choice) => {
                    const isSelected = selectedChoices.includes(choice)
                    return (
                      <Button
                        key={choice}
                        onClick={() => handleSelectChoice(choice)}
                        className={`w-20 h-20 text-4xl rounded-full transition-all ${getChoiceColor(choice, isSelected)}`}
                      >
                        {getChoiceIcon(choice)}
                      </Button>
                    )
                  })}
                </div>
                {selectedChoices.length === 2 && (
                  <div className="text-center mt-3 p-2 bg-green-950/30 border border-green-600/50 rounded-lg">
                    <p className="text-green-300 text-sm font-semibold">
                      <span className="text-5xl">{selectedChoices.map((c) => getChoiceIcon(c)).join(" ")}</span>
                    </p>
                    <p className="text-green-300 text-sm font-semibold mt-2">선택 완료</p>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="bg-black/60 border-gray-800/50 p-6 mb-3">
                <div className="text-center">
                  <div className="text-6xl mb-4">👻</div>
                  <h3 className="text-2xl font-bold text-gray-400 mb-2">탈락했습니다</h3>
                  <p className="text-gray-500">관전 중입니다...</p>
                </div>
              </Card>
            )}
          </>
        )}

        {gameRound.phase === "excludeOne" && (
          <>
            {currentUser && currentUser.lives > 0 ? (
              <Card className="bg-black/60 border-red-800/50 p-4 mb-3">
                <h3 className="text-base font-semibold text-red-300 mb-3 text-center">
                  하나 빼기! {currentUser?.finalChoice ? "✓" : ""}
                </h3>
                <div className="flex justify-center gap-4">
                  {selectedChoices.map((choice) => {
                    const isFinalChoice = currentUser?.finalChoice === choice
                    const isExcluded = currentUser?.finalChoice && currentUser.finalChoice !== choice
                    return (
                      <Button
                        key={choice}
                        onClick={() => handleExcludeChoice(choice)}
                        disabled={!!currentUser?.finalChoice}
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
              </Card>
            ) : (
              <Card className="bg-black/60 border-gray-800/50 p-6 mb-3">
                <div className="text-center">
                  <div className="text-6xl mb-4">👻</div>
                  <h3 className="text-2xl font-bold text-gray-400 mb-2">탈락했습니다</h3>
                  <p className="text-gray-500">관전 중입니다...</p>
                </div>
              </Card>
            )}
          </>
        )}

        {gameRound.phase === "revealing" && (
          <Card className="bg-black/60 border-yellow-800/50 p-6 mb-3">
            <h3 className="text-xl font-semibold text-yellow-300 mb-4 text-center">라운드 결과</h3>
            <div className="flex justify-center items-center">
              <div className="relative w-72 h-72">
                {/* 가위 (상단) */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-center">
                  <div className="relative inline-block">
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-2 ${
                        losingChoices.includes("scissors") ? "bg-red-600 animate-pulse" : "bg-red-800/50"
                      } ${
                        currentUser?.finalChoice === "scissors"
                          ? "ring-4 ring-yellow-400 shadow-lg shadow-yellow-400/50"
                          : ""
                      }`}
                    >
                      ✌️
                    </div>
                    {currentUser?.finalChoice === "scissors" && (
                      <Badge className="absolute -top-2 -right-2 bg-yellow-600 text-black text-xs px-2 py-0.5 font-bold shadow-lg">
                        나
                      </Badge>
                    )}
                  </div>
                  <div
                    className={`text-xl font-bold ${losingChoices.includes("scissors") ? "text-red-400" : "text-white"}`}
                  >
                    {choiceCounts.scissors}명
                  </div>
                  {losingChoices.includes("scissors") && (
                    <div className="relative inline-flex items-center justify-center mt-1 animate-pulse">
                      <span className="text-4xl">💀</span>
                      <span
                        className="absolute text-red-500 font-black text-3xl"
                        style={{ textShadow: "0 0 4px black" }}
                      >
                        ✕
                      </span>
                    </div>
                  )}
                </div>

                {/* 바위 (좌하단) */}
                <div className="absolute bottom-0 left-0 text-center">
                  <div className="relative inline-block">
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-2 ${
                        losingChoices.includes("rock") ? "bg-red-600 animate-pulse" : "bg-gray-800/50"
                      } ${
                        currentUser?.finalChoice === "rock"
                          ? "ring-4 ring-yellow-400 shadow-lg shadow-yellow-400/50"
                          : ""
                      }`}
                    >
                      ✊
                    </div>
                    {currentUser?.finalChoice === "rock" && (
                      <Badge className="absolute -top-2 -right-2 bg-yellow-600 text-black text-xs px-2 py-0.5 font-bold shadow-lg">
                        나
                      </Badge>
                    )}
                  </div>
                  <div
                    className={`text-xl font-bold ${losingChoices.includes("rock") ? "text-red-400" : "text-white"}`}
                  >
                    {choiceCounts.rock}명
                  </div>
                  {losingChoices.includes("rock") && (
                    <div className="relative inline-flex items-center justify-center mt-1 animate-pulse">
                      <span className="text-4xl">💀</span>
                      <span
                        className="absolute text-red-500 font-black text-3xl"
                        style={{ textShadow: "0 0 4px black" }}
                      >
                        ✕
                      </span>
                    </div>
                  )}
                </div>

                {/* 보 (우하단) */}
                <div className="absolute bottom-0 right-0 text-center">
                  <div className="relative inline-block">
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-2 ${
                        losingChoices.includes("paper") ? "bg-red-600 animate-pulse" : "bg-blue-800/50"
                      } ${
                        currentUser?.finalChoice === "paper"
                          ? "ring-4 ring-yellow-400 shadow-lg shadow-yellow-400/50"
                          : ""
                      }`}
                    >
                      ✋
                    </div>
                    {currentUser?.finalChoice === "paper" && (
                      <Badge className="absolute -top-2 -right-2 bg-yellow-600 text-black text-xs px-2 py-0.5 font-bold shadow-lg">
                        나
                      </Badge>
                    )}
                  </div>
                  <div
                    className={`text-xl font-bold ${losingChoices.includes("paper") ? "text-red-400" : "text-white"}`}
                  >
                    {choiceCounts.paper}명
                  </div>
                  {losingChoices.includes("paper") && (
                    <div className="relative inline-flex items-center justify-center mt-1 animate-pulse">
                      <span className="text-4xl">💀</span>
                      <span
                        className="absolute text-red-500 font-black text-3xl"
                        style={{ textShadow: "0 0 4px black" }}
                      >
                        ✕
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/98 backdrop-blur border-t border-red-800/30 z-20">
        <div className="max-w-6xl mx-auto px-3 py-3">
          {currentUser && (
            <div className="bg-yellow-950/40 border border-yellow-600/50 rounded-lg px-4 py-3">
              <div className="flex items-center justify-center gap-8">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-yellow-300">{currentUser.nickname}</span>
                  <Badge className="bg-yellow-600 text-black text-xs px-2 py-0.5 font-bold">나</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {Array.from({ length: displayedCurrentUserLives ?? currentUser.lives }).map((_, i) => (
                      <div key={i} className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                        <span className="text-base text-black font-bold">♠</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-2xl font-bold text-yellow-300">목숨 {displayedCurrentUserLives ?? currentUser.lives}개</span>
                </div>
              </div>
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

  return (
    <Card
      className={`bg-black/80 p-4 min-w-[320px] ${isLoser ? "border-red-600 border-2 animate-pulse" : "border-red-600/50"}`}
    >
      <div className="text-center mb-3">
        <h3 className="text-xl font-bold text-white">{player.nickname}</h3>
      </div>

      <div className="flex items-center gap-4">
        {/* Lives section on the left */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-col gap-1">
            {Array.from({ length: player.lives }).map((_, i) => (
              <div key={i} className="w-4 h-4 bg-red-600 rounded-full"></div>
            ))}
          </div>
          <span className="text-sm text-red-300 whitespace-nowrap">목숨 {player.lives}</span>
        </div>

        {/* Weapons section on the right */}
        <div className="flex-1">
          {phase === "selectTwo" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 text-center">2개 선택 중...</p>
              <div className="flex justify-center gap-2">
                <div className="w-14 h-14 bg-gray-800/50 rounded-full flex items-center justify-center">
                  <span className="text-xl text-gray-600">?</span>
                </div>
                <div className="w-14 h-14 bg-gray-800/50 rounded-full flex items-center justify-center">
                  <span className="text-xl text-gray-600">?</span>
                </div>
              </div>
            </div>
          )}

          {phase === "excludeOne" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 text-center">하나 빼기 중...</p>
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
            </div>
          )}

          {phase === "revealing" && (
            <div className="space-y-2">
              <div className="flex justify-center">
                {player.finalChoice ? (
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
              {isLoser && <p className="text-center text-red-400 font-bold text-sm animate-pulse">목숨 -1</p>}
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
        {/* Lives section on the left */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-col gap-1">
            {Array.from({ length: player.lives }).map((_, i) => (
              <div key={i} className="w-5 h-5 bg-yellow-600 rounded-full"></div>
            ))}
          </div>
          <span className="text-sm text-yellow-300 whitespace-nowrap">목숨 {player.lives}</span>
        </div>

        {/* Weapons section on the right */}
        <div className="flex-1">
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
                      {isExcluded ? <span className="text-6xl text-red-500 font-bold">✕</span> : getChoiceIcon(choice)}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {phase === "revealing" && (
            <div className="space-y-2">
              <div className="flex justify-center">
                {player.finalChoice ? (
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
              {isLoser && <p className="text-center text-red-400 font-bold text-sm animate-pulse">목숨 -1</p>}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
