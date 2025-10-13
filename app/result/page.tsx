"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"

type GameChoice = "rock" | "paper" | "scissors"

interface GameEvent {
  type: "choice" | "elimination" | "timeup" | "roundStart" | "roundEnd"
  playerId: string
  playerNickname: string
  choice?: GameChoice
  livesLost?: number
  remainingLives?: number
  timestamp: number
}

interface ChoiceCount {
  rock: number
  paper: number
  scissors: number
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

export default function ResultPage() {
  const router = useRouter()
  const [gameLog, setGameLog] = useState<GameLog | null>(null)
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 0.5>(1)

  useEffect(() => {
    const savedLog = localStorage.getItem("gameLog")
    if (savedLog) {
      setGameLog(JSON.parse(savedLog))
    }
  }, [])

  useEffect(() => {
    if (isPlaying && gameLog && currentRoundIndex < gameLog.rounds.length - 1) {
      const timer = setTimeout(() => {
        setCurrentRoundIndex((prev) => prev + 1)
      }, 3000 / playbackSpeed)
      return () => clearTimeout(timer)
    } else if (isPlaying && currentRoundIndex >= (gameLog?.rounds.length || 0) - 1) {
      setIsPlaying(false)
    }
  }, [isPlaying, currentRoundIndex, gameLog, playbackSpeed])

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

  if (!gameLog) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-black text-white flex items-center justify-center">
        <Card className="bg-black/80 border-red-600/50 p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">게임 기록이 없습니다</h2>
          <Button onClick={() => router.push("/lobby")}>로비로 돌아가기</Button>
        </Card>
      </div>
    )
  }

  const currentRound = gameLog.rounds[currentRoundIndex]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-red-950 to-black text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-yellow-400">게임 다시보기</h1>
          <Button variant="outline" onClick={() => router.push("/lobby")}>
            로비로 돌아가기
          </Button>
        </div>

        {/* Game Summary */}
        <Card className="bg-black/60 border-yellow-600/50 p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-yellow-400">{gameLog.totalPlayers}명</div>
              <div className="text-gray-400 text-sm">총 참가자</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{gameLog.rounds.length}라운드</div>
              <div className="text-gray-400 text-sm">진행 라운드</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">{gameLog.finalists.length}명</div>
              <div className="text-gray-400 text-sm">결승 진출자</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {Math.floor(((gameLog.endTime || 0) - gameLog.startTime) / 60000)}분
              </div>
              <div className="text-gray-400 text-sm">게임 시간</div>
            </div>
          </div>
        </Card>

        {/* Playback Controls */}
        <Card className="bg-black/60 border-red-600/50 p-4 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsPlaying(!isPlaying)} className="bg-red-600 hover:bg-red-700">
                {isPlaying ? "일시정지" : "재생"}
              </Button>
              <Button
                onClick={() => setCurrentRoundIndex(Math.max(0, currentRoundIndex - 1))}
                disabled={currentRoundIndex === 0}
                variant="outline"
              >
                이전
              </Button>
              <Button
                onClick={() => setCurrentRoundIndex(Math.min(gameLog.rounds.length - 1, currentRoundIndex + 1))}
                disabled={currentRoundIndex === gameLog.rounds.length - 1}
                variant="outline"
              >
                다음
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">재생 속도:</span>
              <Button
                onClick={() => setPlaybackSpeed(0.5)}
                variant={playbackSpeed === 0.5 ? "default" : "outline"}
                size="sm"
              >
                0.5x
              </Button>
              <Button
                onClick={() => setPlaybackSpeed(1)}
                variant={playbackSpeed === 1 ? "default" : "outline"}
                size="sm"
              >
                1x
              </Button>
              <Button
                onClick={() => setPlaybackSpeed(2)}
                variant={playbackSpeed === 2 ? "default" : "outline"}
                size="sm"
              >
                2x
              </Button>
            </div>

            <div className="text-center">
              <Badge variant="outline" className="text-lg px-4 py-2">
                라운드 {currentRound.round} / {gameLog.rounds.length}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Round Details */}
        <Card className="bg-black/60 border-yellow-600/50 p-6 mb-6">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4">라운드 {currentRound.round}</h2>

          {/* Choice Distribution */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">선택 분포</h3>
            <div className="grid grid-cols-3 gap-4">
              <div
                className={`p-4 rounded-lg text-center ${currentRound.losingChoice === "rock" ? "bg-red-900/50 border-2 border-red-500" : "bg-gray-800/50"}`}
              >
                <div className="text-4xl mb-2">✊</div>
                <div className="text-xl font-bold">바위</div>
                <div className="text-2xl font-bold text-yellow-400">{currentRound.choiceCounts.rock}명</div>
                {currentRound.losingChoice === "rock" && (
                  <Badge variant="destructive" className="mt-2">
                    목숨 -1
                  </Badge>
                )}
              </div>
              <div
                className={`p-4 rounded-lg text-center ${currentRound.losingChoice === "paper" ? "bg-red-900/50 border-2 border-red-500" : "bg-gray-800/50"}`}
              >
                <div className="text-4xl mb-2">✋</div>
                <div className="text-xl font-bold">보</div>
                <div className="text-2xl font-bold text-yellow-400">{currentRound.choiceCounts.paper}명</div>
                {currentRound.losingChoice === "paper" && (
                  <Badge variant="destructive" className="mt-2">
                    목숨 -1
                  </Badge>
                )}
              </div>
              <div
                className={`p-4 rounded-lg text-center ${currentRound.losingChoice === "scissors" ? "bg-red-900/50 border-2 border-red-500" : "bg-gray-800/50"}`}
              >
                <div className="text-4xl mb-2">✌️</div>
                <div className="text-xl font-bold">가위</div>
                <div className="text-2xl font-bold text-yellow-400">{currentRound.choiceCounts.scissors}명</div>
                {currentRound.losingChoice === "scissors" && (
                  <Badge variant="destructive" className="mt-2">
                    목숨 -1
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Events */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">라운드 이벤트</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {currentRound.events.map((event, index) => (
                <div key={index} className="bg-gray-800/50 p-3 rounded-lg">
                  {event.type === "choice" && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{event.playerNickname}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">선택:</span>
                        <span className="text-2xl">{getChoiceIcon(event.choice!)}</span>
                        <span className="font-semibold">{getChoiceKorean(event.choice!)}</span>
                      </div>
                    </div>
                  )}
                  {event.type === "elimination" && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-400">{event.playerNickname}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">목숨 -1</Badge>
                        <span className="text-gray-400">남은 목숨: {event.remainingLives}</span>
                      </div>
                    </div>
                  )}
                  {event.type === "timeup" && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-orange-400">{event.playerNickname}</span>
                      <Badge variant="destructive">시간 초과 탈락</Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-950/30 border border-blue-600/50 rounded-lg text-center">
            <span className="text-blue-300 font-semibold">라운드 종료 후 생존자: {currentRound.survivorsAtEnd}명</span>
          </div>
        </Card>

        {/* Finalists */}
        {currentRoundIndex === gameLog.rounds.length - 1 && (
          <Card className="bg-black/60 border-yellow-600/50 p-6">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">🏆 결승 진출자</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gameLog.finalists.map((finalist) => (
                <div
                  key={finalist.id}
                  className="bg-yellow-950/30 border border-yellow-600/50 rounded-lg p-4 text-center"
                >
                  <div className="font-semibold text-lg mb-2">{finalist.nickname}</div>
                  <div className="flex justify-center gap-1">
                    {Array.from({ length: finalist.lives }).map((_, i) => (
                      <div key={i} className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                    ))}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">목숨 {finalist.lives}개</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
