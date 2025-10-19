"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Volume2, VolumeX } from "lucide-react"
import AudioSystem from "@/components/audio-system"
import { speak } from "@/lib/voice"
import { supabase } from "@/lib/supabaseClient"
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

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

// OpponentCard Component
function OpponentCard({
  player,
  phase,
  losingChoices = [],
}: { player: Player; phase: GamePhase; losingChoices?: GameChoice[] }) {
  const getChoiceIcon = (choice: GameChoice) => {
    switch (choice) {
      case "rock": return "✊";
      case "paper": return "✋";
      case "scissors": return "✌️";
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
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
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
                  2개 선택 중...
                </p>
              )}
            </div>
          )}
          {phase === "excludeOne" && player.selectedChoices && (
            <div className="flex justify-center gap-3">
              {player.selectedChoices.map((choice) => (
                <div key={choice} className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center text-3xl">
                  {getChoiceIcon(choice)}
                </div>
              ))}
            </div>
          )}
          {(phase === "revealing" || phase === "gameOver") && player.finalChoice && (
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto ${isLoser ? "bg-red-900" : "bg-gray-700"}`}>
              {getChoiceIcon(player.finalChoice)}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// CurrentUserCard Component
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
            case "rock": return "✊";
            case "paper": return "✋";
            case "scissors": return "✌️";
        }
    }
    const isLoser = player.finalChoice && losingChoices.includes(player.finalChoice);

    return (
        <Card className={`bg-black/80 p-4 min-w-[320px] ${isLoser ? "border-red-500 border-2 animate-pulse" : "border-purple-500/80"}`}>
            <div className="text-center mb-3">
                <h3 className="text-xl font-bold text-white">{player.nickname} (나)</h3>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                            {Array.from({ length: player.lives }).map((_, i) => (
                                <div key={i} className="relative w-4 h-4">
                                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <span className="text-sm text-green-300 whitespace-nowrap">목숨 {player.lives}</span>
                </div>
                <div className="flex-1">
                    {(phase === "revealing" || phase === "gameOver") && player.finalChoice && (
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto ${isLoser ? "bg-red-900" : "bg-gray-700"}`}>
                            {getChoiceIcon(player.finalChoice)}
                        </div>
                    )}
                    {phase === "selectTwo" && (
                        <div className="flex justify-center gap-2">
                            {(["rock", "paper", "scissors"] as GameChoice[]).map((choice) => (
                                <button
                                    key={choice}
                                    onClick={() => onSelectChoice(choice)}
                                    className={`w-16 h-16 rounded-full text-3xl transition-all ${selectedChoices.includes(choice) ? "bg-yellow-500 ring-4 ring-yellow-300" : "bg-gray-700 hover:bg-gray-600"}`}
                                >
                                    {getChoiceIcon(choice)}
                                </button>
                            ))}
                        </div>
                    )}
                    {phase === "excludeOne" && (
                        <div className="flex justify-center gap-2">
                            {selectedChoices.map((choice) => (
                                <button
                                    key={choice}
                                    onClick={() => onExcludeChoice(choice)}
                                    className="w-16 h-16 rounded-full text-3xl bg-gray-700 hover:bg-red-700 transition-all"
                                >
                                    {getChoiceIcon(choice)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    )
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
  const hasInitialized = useRef(false);
  const [roundId, setRoundId] = useState<number | null>(null)

  const opponents = players.filter((p: Player) => !p.isCurrentUser)
  const currentUser = players.find((p: Player) => p.isCurrentUser)

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const exitLobby = () => {
      const participantInfo = localStorage.getItem("participantInfo");
      if (!participantInfo) return;
      try {
        const participant = JSON.parse(participantInfo);
        fetch("/api/game/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "exit_lobby", participantId: participant.id }),
          keepalive: true,
        });
        localStorage.removeItem("participantInfo");
      } catch (error) {
        console.error("[Finals] 로비 퇴장 실패:", error);
      }
    };

    const handleBeforeUnload = () => exitLobby();
    window.addEventListener("beforeunload", handleBeforeUnload);

    const initializeGame = async () => {
      const storedData = sessionStorage.getItem("finalistsData");
      let initialPlayers: Player[] = [];

      if (storedData) {
        try {
          const { finalists } = JSON.parse(storedData);
          initialPlayers = finalists.map((f: any) => ({
            id: f.id, nickname: f.nickname, lives: f.lives, isCurrentUser: f.isCurrentUser, maxLives: f.lives,
          }));
        } catch (error) {
          router.push("/game");
          return;
        }
      } else {
        const currentSessionId = sessionStorage.getItem("currentSessionId");
        if (!currentSessionId) { router.push("/"); return; }
        try {
          const res = await fetch(`/api/game/state?sessionId=${currentSessionId}`);
          const data = await res.json();
          const userRes = await fetch('/api/auth/me');
          const userData = await userRes.json();
          if (!userData.user) { router.push("/auth"); return; }
          
          initialPlayers = data.participants
            .filter((p: any) => p.status === 'player')
            .map((p: any) => ({
              id: p.id, nickname: p.nickname, lives: p.currentLives, isCurrentUser: p.userId === userData.user.id, maxLives: p.initialLives,
            }));
        } catch (error) {
          router.push("/");
          return;
        }
      }
      
      setPlayers(initialPlayers);
      setGameRound({ round: 1, phase: "waiting", timeLeft: 0, survivors: initialPlayers.length });
      const totalLives = initialPlayers.reduce((sum: number, p: Player) => sum + p.lives, 0);
      setGameMessage(`이제 총 ${initialPlayers.length}명, 목숨 ${totalLives}개로, 결승 1라운드를 시작합니다`);
            
      // 🎯 초기 라운드 ID 가져오기
      const currentSessionId = sessionStorage.getItem("currentSessionId");
      if (currentSessionId) {
        const res = await fetch(`/api/game/state?sessionId=${currentSessionId}`);
        const data = await res.json();
        if (data.round) {
          setRoundId(data.round.id);
          console.log("[Finals] 초기 라운드 ID 설정:", data.round.id);
        }
      }

      setTimeout(() => {
        speak(gameMessage, {
            onComplete: () => setGameRound(prev => ({ ...prev, phase: "selectTwo", timeLeft: 10 })),
        });
      }, 500);
    };

    initializeGame();

    const updateGameState = async () => {
        const res = await fetch(`/api/game/state`);
        const gameState = await res.json();
        
        const activePlayers = gameState.participants?.filter((p: any) => p.status === "player") || [];
        const participantInfo = localStorage.getItem("participantInfo");
        const currentParticipantId = participantInfo ? JSON.parse(participantInfo).id : null;
        
        const updatedPlayers: Player[] = activePlayers.map((p: any) => ({
            id: p.id, nickname: p.nickname, lives: p.currentLives || 0, isCurrentUser: p.id === currentParticipantId, maxLives: p.initialLives || 5, selectedChoices: p.selectedChoices, finalChoice: p.finalChoice
        }));
        setPlayers(updatedPlayers);

        if (gameState.round) {
            setRoundId(gameState.round.id); // 🎯 라운드 ID 설정
            setGameRound(prev => ({ ...prev, round: gameState.round.roundNumber, phase: gameState.round.phase }));
        }
    };

    const channel = supabase.channel('finals-game-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, 
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('[Finals Realtime] Change received:', payload);
          updateGameState();
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT', err?: Error) => {
        if (status !== 'SUBSCRIBED') {
          console.error('[Finals Realtime] 구독 실패:', err);
        }
      });

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      exitLobby();
      supabase.removeChannel(channel);
    };
  }, [router, gameMessage]);

  useEffect(() => {
    if (gameRound.phase === "selectTwo" && gameRound.timeLeft === 10) {
      setGameMessage("가위/바위/보 중 2개를 선택하세요!");
      setTimeout(() => speak("가위 바위 보, 2개를 선택하세요"), 500);
    }
  }, [gameRound.phase, gameRound.timeLeft]);

  useEffect(() => {
    if (gameRound.phase === "excludeOne" && gameRound.timeLeft === 10) {
      setGameMessage("하나 빼기! 선택한 2개 중 빼세요!");
      setTimeout(() => speak("하나 빼기, 1개를 제외하세요"), 500);
    }
  }, [gameRound.phase, gameRound.timeLeft]);

  useEffect(() => {
    if ((gameRound.phase === "selectTwo" || gameRound.phase === "excludeOne") && gameRound.timeLeft > 0) {
      const timer = setTimeout(() => {
        setGameRound((prev: GameRound) => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameRound.phase, gameRound.timeLeft]);

  // 타이머 0초 도달 시 UI 상태 전환
  useEffect(() => {
    if (gameRound.timeLeft > 0) return;

    if (gameRound.phase === 'selectTwo') {
      setGameRound(prev => ({ ...prev, phase: 'excludeOne', timeLeft: 10 }));
    } else if (gameRound.phase === 'excludeOne') {
      setGameRound(prev => ({ ...prev, phase: 'revealing', timeLeft: 5 }));
    }
  }, [gameRound.timeLeft, gameRound.phase]);

  const toggleVoice = () => {
    setVoiceEnabled(prev => !prev);
    if (voiceEnabled) window.speechSynthesis.cancel();
  };

  const handleSelectChoice = async (choice: GameChoice) => {
    if (gameRound.phase !== "selectTwo" || !roundId) return;
    const newChoices = selectedChoices.includes(choice) ? selectedChoices.filter(c => c !== choice) : (selectedChoices.length < 2 ? [...selectedChoices, choice] : selectedChoices);
    setSelectedChoices(newChoices);

    if (newChoices.length === 2) {
        const participantId = JSON.parse(localStorage.getItem("participantInfo") || '{}').id;
        const sessionId = sessionStorage.getItem("currentSessionId");
        if (!participantId || !sessionId) return;
        await fetch("/api/game/choice", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "select_two", roundId, participantId, sessionId: parseInt(sessionId), selectedChoices: newChoices }),
        });
    }
  };

  const handleExcludeChoice = async (choice: GameChoice) => {
    if (gameRound.phase !== "excludeOne" || !roundId) return;
    const keptChoice = selectedChoices.find(c => c !== choice);
    if (!keptChoice) return;
    setPlayers((prev: Player[]) => prev.map((p: Player) => (p.isCurrentUser ? { ...p, finalChoice: keptChoice } : p)));
    
    const participantId = JSON.parse(localStorage.getItem("participantInfo") || '{}').id;
    const sessionId = sessionStorage.getItem("currentSessionId");
    if (!participantId || !sessionId) return;
    await fetch("/api/game/choice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "exclude_one", roundId, participantId, sessionId: parseInt(sessionId), finalChoice: keptChoice }),
    });
  };

  const getPlayerPositions = () => {
    const alivePlayers = players.filter((p: Player) => p.lives > 0);
    if (isSpectator) {
        if (alivePlayers.length === 2) return { positions: [{ player: alivePlayers[0], style: "top-0 left-1/2 -translate-x-1/2" }, { player: alivePlayers[1], style: "bottom-0 left-1/2 -translate-x-1/2" }], userStyle: null };
        if (alivePlayers.length === 3) return { positions: [{ player: alivePlayers[0], style: "top-0 left-1/2 -translate-x-1/2" }, { player: alivePlayers[1], style: "bottom-0 left-1/4 -translate-x-1/2" }, { player: alivePlayers[2], style: "bottom-0 right-1/4 translate-x-1/2" }], userStyle: null };
        if (alivePlayers.length === 4) return { positions: [{ player: alivePlayers[0], style: "top-0 left-1/2 -translate-x-1/2" }, { player: alivePlayers[1], style: "top-1/2 right-0 -translate-y-1/2" }, { player: alivePlayers[2], style: "bottom-0 left-1/2 -translate-x-1/2" }, { player: alivePlayers[3], style: "top-1/2 left-0 -translate-y-1/2" }], userStyle: null };
        return { positions: [], userStyle: null };
    }
    const opponentCount = opponents.length;
    if (opponentCount === 1) return { positions: [{ player: opponents[0], style: "top-0 left-1/2 -translate-x-1/2" }], userStyle: "bottom-0 left-1/2 -translate-x-1/2" };
    if (opponentCount === 2) return { positions: [{ player: opponents[0], style: "top-0 left-1/2 -translate-x-1/2" }, { player: opponents[1], style: "top-1/2 left-0 -translate-y-1/2" }], userStyle: "bottom-0 left-1/2 -translate-x-1/2" };
    if (opponentCount === 3) return { positions: [{ player: opponents[0], style: "top-0 left-1/2 -translate-x-1/2" }, { player: opponents[1], style: "top-1/2 right-0 -translate-y-1/2" }, { player: opponents[2], style: "top-1/2 left-0 -translate-y-1/2" }], userStyle: "bottom-0 left-1/2 -translate-x-1/2" };
    return { positions: [], userStyle: "bottom-0 left-1/2 -translate-x-1/2" };
  };

  const playerPositions = getPlayerPositions();

  if (gameRound.phase === "gameOver") {
    const winner = players.find((p: Player) => p.lives > 0);
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-yellow-950 to-black text-white flex items-center justify-center">
        {/* ... (Winner display code remains the same) ... */}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-black text-white">
      {/* ... (Main game UI remains the same) ... */}
    </div>
  );
}