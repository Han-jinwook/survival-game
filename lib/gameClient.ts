// 🎮 게임 클라이언트 - 서버 중심 아키텍처
export class GameClient {
  private sessionId: number | null = null
  private gameState: any = null
  private pollingInterval: NodeJS.Timeout | null = null
  private onStateChange: ((state: any) => void) | null = null

  constructor(sessionId: number, onStateChange: (state: any) => void) {
    this.sessionId = sessionId
    this.onStateChange = onStateChange
    this.startPolling()
  }

  // 🔄 서버에서 게임 상태 폴링
  private startPolling() {
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/game/master?sessionId=${this.sessionId}&action=get_game_state`)
        if (response.ok) {
          const data = await response.json()
          
          // 상태가 변경되었을 때만 업데이트
          if (JSON.stringify(this.gameState) !== JSON.stringify(data.gameState)) {
            this.gameState = data.gameState
            this.onStateChange?.(this.gameState)
            console.log('[게임 클라이언트] 상태 업데이트:', this.gameState)
          }
        }
      } catch (error) {
        console.error('[게임 클라이언트] 상태 조회 실패:', error)
      }
    }, 1000) // 1초마다 폴링
  }

  // 🎯 플레이어 선택 전송
  async submitChoice(participantId: string, selectedChoices: string[], finalChoice?: string) {
    try {
      const response = await fetch('/api/game/choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          roundId: this.gameState?.roundId,
          selectedChoices,
          finalChoice
        })
      })
      
      if (response.ok) {
        console.log('[게임 클라이언트] 선택 전송 완료')
        return true
      } else {
        console.error('[게임 클라이언트] 선택 전송 실패')
        return false
      }
    } catch (error) {
      console.error('[게임 클라이언트] 선택 전송 오류:', error)
      return false
    }
  }

  // 🎮 게임 시작 요청 (관리자용)
  async startGame() {
    try {
      const response = await fetch('/api/game/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_game',
          sessionId: this.sessionId
        })
      })
      
      if (response.ok) {
        console.log('[게임 클라이언트] 게임 시작 요청 완료')
        return true
      } else {
        console.error('[게임 클라이언트] 게임 시작 실패')
        return false
      }
    } catch (error) {
      console.error('[게임 클라이언트] 게임 시작 오류:', error)
      return false
    }
  }

  // 📊 현재 게임 상태 반환
  getGameState() {
    return this.gameState
  }

  // 🛑 폴링 중지
  destroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
    console.log('[게임 클라이언트] 정리 완료')
  }
}

// 🎯 게임 상태 타입 정의
export interface GameState {
  status: 'waiting' | 'in_progress' | 'finals' | 'completed'
  currentRound: number
  phase: 'selection' | 'elimination' | 'final_selection' | 'final_elimination' | 'waiting'
  timeLeft?: number
  roundId: string | null
  participants: Array<{
    id: string
    nickname: string
    currentLives: number
    status: string
  }>
  choices: Array<{
    participantId: string
    selectedChoices: string[]
    finalChoice: string | null
  }>
}
