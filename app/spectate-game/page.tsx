"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import AudioSystem from "@/components/audio-system"
import { useRouter } from "next/navigation"
import { Volume2, VolumeX } from "lucide-react"

type GameChoice = "rock" | "paper" | "scissors"
type GamePhase = "waiting" | "selectTwo" | "excludeOne" | "revealing" | "results" | "gameOver"

interface Player {
  id: string
  nickname: string
  lives: number
  selectedChoices?: GameChoice[]
  finalChoice?: GameChoice
  eliminated?: boolean
  timedOut?: boolean
  status?: 'waiting' | 'player' | 'eliminated' | 'disconnected';
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

export default function SpectateGamePage() {
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [gameRound, setGameRound] = useState<GameRound>({
    round: 0,
    phase: "waiting",
    timeLeft: 0,
    survivors: 0,
  })
  const [choiceCounts, setChoiceCounts] = useState<ChoiceCount>({ rock: 0, paper: 0, scissors: 0 })
  const [gameMessage, setGameMessage] = useState("게임 데이터를 불러오는 중입니다...")
  const [losingChoices, setLosingChoices] = useState<GameChoice[]>([])
  const [voiceEnabled, setVoiceEnabledState] = useState(true)
  const [showFinalsRoster, setShowFinalsRoster] = useState(false)
  const [finalsCountdown, setFinalsCountdown] = useState(60)

  const alivePlayers = players.filter((p: Player) => p.lives > 0)

  const fetchGameState = async () => {
    try {
      const response = await fetch('/api/game/state');
      if (!response.ok) {
        throw new Error('게임 상태를 불러오는데 실패했습니다.');
      }
      const data = await response.json();
      console.log("[Spectate] Game state loaded:", data);

      if (data.participants) {
        setPlayers(data.participants.map((p: Player) => ({
          id: p.id,
          nickname: p.nickname,
          lives: p.lives,
          finalChoice: p.finalChoice,
          eliminated: p.eliminated,
        })));
      }

      if (data.round) {
        setGameRound({
          round: data.round.round_number,
          phase: data.round.phase,
          timeLeft: 10, // 타이머는 클라이언트에서 관리
          survivors: data.participants?.filter((p: Player) => p.status !== 'eliminated').length || 0,
        });
      }

      // TODO: choiceCounts, gameMessage, losingChoices 등 추가 데이터 처리

    } catch (error) {
      console.error("[Spectate] Error fetching game state:", error);
      setGameMessage("게임 상태를 불러올 수 없습니다.");
    }
  };

  useEffect(() => {
    // 초기 데이터 로드
    fetchGameState();

    // Supabase Realtime 구독
    const channel = supabase.channel('spectate-game-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, 
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('[Spectate] Realtime change received:', payload);
          fetchGameState();
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT', err?: Error) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Spectate] Realtime 구독 성공');
        } else {
          console.error('[Spectate] Realtime 구독 실패:', err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  const toggleVoice = () => {
    setVoiceEnabledState(!voiceEnabled)
  }

  const totalLifeBreakdown = useMemo(() => {
    const lifeMap = new Map<number, number>()

    alivePlayers.forEach((p: Player) => {
      lifeMap.set(p.lives, (lifeMap.get(p.lives) || 0) + 1)
    })

    return Array.from(lifeMap.entries())
      .map(([lives, count]: [number, number]) => ({ lives, count }))
      .sort((a, b) => b.lives - a.lives)
  }, [players])

  if (showFinalsRoster || alivePlayers.length <= 4) {
    const finalists = alivePlayers
      .sort((a, b) => b.lives - a.lives)
      .map((p: Player) => ({
        ...p,
        isCurrentUser: false, // 관전자는 참가자가 아님
      }))

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
                  className="flex items-center justify-between p-4 rounded-lg transition-all bg-gray-900/50 border border-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-purple-400 w-8">#{index + 1}</div>
                    <div>
                      <span className="text-xl font-bold text-white">{player.nickname}</span>
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

          <div className="flex gap-3">
            <Button
              onClick={() => router.push("/finals?spectator=true")}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
            >
              결승전 관전하기
            </Button>
          </div>

          <p className="text-center text-gray-400 text-sm mt-4">잠시 휴식을 취하세요...</p>
        </Card>

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
              <div>
                <h1 className="text-xl font-bold">가위바위보 하나빼기</h1>
                <Badge variant="outline" className="text-xs bg-purple-600/20 text-purple-300 border-purple-600/50 mt-1">
                  예선 관전 모드
                </Badge>
              </div>
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
            <Badge variant="destructive" className="text-2xl px-4 py-2 bg-red-600/20 text-red-300 border-red-600/50">
              예선 R{gameRound.round}
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

        <Card className="bg-red-950/30 border-red-600/50 p-3 mb-3">
          <div className="flex items-center gap-4">
            <h3 className="text-base font-semibold text-red-300 border-l-4 border-red-600 pl-3 whitespace-nowrap">
              전체 현황 ({alivePlayers.length}명, {alivePlayers.reduce((sum, p) => sum + p.lives, 0)}개목숨)
            </h3>

            <div className="flex flex-wrap items-center gap-4 flex-1 justify-center">
              {totalLifeBreakdown.map(({ lives, count }) => (
                <div key={lives} className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: lives }).map((_, i) => (
                      <div key={i} className="w-3 h-3 bg-red-600 rounded-full"></div>
                    ))}
                  </div>
                  <span className="text-white font-semibold text-base">- {count}명</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {alivePlayers.length > 4 && (gameRound.phase === "excludeOne" || gameRound.phase === "waiting") && (
          <Card className="bg-black/60 border-purple-800/50 p-4 mb-3">
            <div className="relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 pl-3 border-l-4 border-purple-500">
                <h3 className="text-xl font-bold text-purple-300 whitespace-nowrap">전체 무기현황</h3>
              </div>
              <div className="flex justify-center gap-4 py-2">
                {(["scissors", "rock", "paper"] as GameChoice[]).map((choice) => {
                  const count = choiceCounts[choice]
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
                      }`}
                    >
                      ✌️
                    </div>
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
                      }`}
                    >
                      ✊
                    </div>
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
                      }`}
                    >
                      ✋
                    </div>
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

      <AudioSystem page="game" autoPlay={false} showControls={false} />
    </div>
  )
}
