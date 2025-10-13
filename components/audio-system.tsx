"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface AudioSystemProps {
  autoPlay?: boolean
  showControls?: boolean
  page?: "landing" | "auth" | "lobby" | "game"
}

class GlobalAudioManager {
  private static instance: GlobalAudioManager
  private audioElement: HTMLAudioElement | null = null
  private voiceElement: HTMLAudioElement | null = null
  private currentTrack: string | null = null
  private isInitialized = false
  private volume = 0.3
  private isMuted = false
  private isPlaying = false
  private listeners: Set<() => void> = new Set()

  static getInstance(): GlobalAudioManager {
    if (!GlobalAudioManager.instance) {
      GlobalAudioManager.instance = new GlobalAudioManager()
    }
    return GlobalAudioManager.instance
  }

  private constructor() {
    if (typeof window !== "undefined") {
      this.init()
    }
  }

  private init() {
    if (this.isInitialized) return

    console.log("[v0] GlobalAudioManager initializing")

    this.audioElement = new Audio()
    this.voiceElement = new Audio()

    if (this.audioElement) {
      this.audioElement.loop = true
      this.audioElement.volume = this.volume

      this.audioElement.addEventListener("canplaythrough", () => {
        console.log("[v0] Global background music loaded successfully")
        this.notifyListeners()
      })

      this.audioElement.addEventListener("error", (e) => {
        console.log("[v0] Global background music load failed:", e)
        this.notifyListeners()
      })

      this.audioElement.addEventListener("play", () => {
        this.isPlaying = true
        this.notifyListeners()
      })

      this.audioElement.addEventListener("pause", () => {
        this.isPlaying = false
        this.notifyListeners()
      })
    }

    this.isInitialized = true
  }

  addListener(callback: () => void) {
    this.listeners.add(callback)
  }

  removeListener(callback: () => void) {
    this.listeners.delete(callback)
  }

  private notifyListeners() {
    this.listeners.forEach((callback) => callback())
  }

  async setTrack(trackUrl: string) {
    if (!this.audioElement || this.currentTrack === trackUrl) return

    console.log("[v0] Setting global track:", trackUrl)

    // 현재 재생 중인 트랙과 같으면 변경하지 않음
    if (this.currentTrack === trackUrl && !this.audioElement.paused) {
      console.log("[v0] Same track already playing, skipping")
      return
    }

    const wasPlaying = this.isPlaying
    this.currentTrack = trackUrl
    this.audioElement.src = trackUrl
    this.audioElement.load()

    // 이전에 재생 중이었다면 자동으로 재생 시작
    if (wasPlaying) {
      try {
        await this.audioElement.play()
        console.log("[v0] Global track continued playing")
      } catch (error) {
        console.log("[v0] Global track autoplay failed:", error)
      }
    }
  }

  async play() {
    if (!this.audioElement || !this.currentTrack) return

    try {
      console.log("[v0] Playing global background music")
      await this.audioElement.play()
      this.isPlaying = true
      console.log("[v0] Global background music playing successfully")
    } catch (error) {
      console.log("[v0] Global audio play failed:", error)
      this.isPlaying = false
    }
  }

  pause() {
    if (!this.audioElement) return

    console.log("[v0] Pausing global background music")
    this.audioElement.pause()
    this.isPlaying = false
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol))
    if (this.audioElement) {
      this.audioElement.volume = this.isMuted ? 0 : this.volume
    }
    if (this.voiceElement) {
      this.voiceElement.volume = this.isMuted ? 0 : Math.min(this.volume + 0.2, 1)
    }
    this.notifyListeners()
  }

  setMuted(muted: boolean) {
    this.isMuted = muted
    if (this.audioElement) {
      this.audioElement.volume = muted ? 0 : this.volume
    }
    if (this.voiceElement) {
      this.voiceElement.volume = muted ? 0 : Math.min(this.volume + 0.2, 1)
    }
    this.notifyListeners()
  }

  async playVoice(messageKey: string) {
    console.log("[v0] Playing global voice message:", messageKey)

    const voiceMessages: Record<string, string> = {
      welcome: "/audio/voice/welcome.mp3",
      auth_success: "/audio/voice/auth-success.mp3",
      lobby_enter: "/audio/voice/lobby-enter.mp3",
      game_start: "/audio/voice/game-start.mp3",
      round_start: "/audio/voice/round-start.mp3",
      elimination: "/audio/voice/elimination.mp3",
      final_winner: "/audio/voice/final-winner.mp3",
    }

    if (this.voiceElement && voiceMessages[messageKey]) {
      try {
        this.voiceElement.src = voiceMessages[messageKey]
        this.voiceElement.volume = this.isMuted ? 0 : Math.min(this.volume + 0.2, 1)
        await this.voiceElement.play()
        console.log("[v0] Global voice message played successfully")
      } catch (error) {
        console.log("[v0] Global voice message play failed:", error)
        this.showTextMessage(messageKey)
      }
    } else {
      console.log("[v0] Voice file not found, showing text message")
      this.showTextMessage(messageKey)
    }
  }

  private showTextMessage(messageKey: string) {
    const messages: Record<string, string> = {
      welcome: "하나빼기 서바이벌에 오신 것을 환영합니다",
      auth_success: "인증이 완료되었습니다",
      lobby_enter: "행운권을 목숨으로 바꿔드립니다",
      game_start: "게임을 시작합니다",
      round_start: "라운드를 시작합니다",
      elimination: "탈락자가 발생했습니다",
      final_winner: "최종 승자가 결정되었습니다",
      audio_blocked: "오디오 재생을 위해 플레이 버튼을 클릭하세요",
    }

    if (typeof window !== "undefined") {
      const messageDiv = document.createElement("div")
      messageDiv.textContent = messages[messageKey] || messageKey
      messageDiv.className =
        "fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg z-50 font-semibold shadow-lg animate-pulse"

      document.body.appendChild(messageDiv)

      setTimeout(() => {
        if (document.body.contains(messageDiv)) {
          messageDiv.style.opacity = "0"
          messageDiv.style.transition = "opacity 0.3s ease-out"
          setTimeout(() => {
            if (document.body.contains(messageDiv)) {
              messageDiv.remove()
            }
          }, 300)
        }
      }, 3000)
    }
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      volume: this.volume,
      isMuted: this.isMuted,
      currentTrack: this.currentTrack,
      isReady: this.audioElement?.readyState === 4,
    }
  }
}

export default function AudioSystem({ autoPlay = false, showControls = false, page = "landing" }: AudioSystemProps) {
  const [audioState, setAudioState] = useState(() => GlobalAudioManager.getInstance().getState())
  const audioManager = useRef(GlobalAudioManager.getInstance())

  const backgroundMusic = {
    landing: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Way%20Back%20then-1-%EC%A0%95%EC%9E%AC%EC%9D%BC-LXdaGoh2hrZXY2teQe6OxSuQPZj4tT.mp3",
    auth: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Way%20Back%20then-1-%EC%A0%95%EC%9E%AC%EC%9D%BC-LXdaGoh2hrZXY2teQe6OxSuQPZj4tT.mp3",
    lobby: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Way%20Back%20then-1-%EC%A0%95%EC%9E%AC%EC%9D%BC-LXdaGoh2hrZXY2teQe6OxSuQPZj4tT.mp3",
    game: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Way%20Back%20then-1-%EC%A0%95%EC%9E%AC%EC%9D%BC-LXdaGoh2hrZXY2teQe6OxSuQPZj4tT.mp3",
  }

  useEffect(() => {
    const updateState = () => {
      setAudioState(audioManager.current.getState())
    }

    audioManager.current.addListener(updateState)
    return () => {
      audioManager.current.removeListener(updateState)
    }
  }, [])

  useEffect(() => {
    console.log("[v0] AudioSystem connecting to page:", page)

    if (backgroundMusic[page]) {
      audioManager.current.setTrack(backgroundMusic[page])
    }
  }, [page])

  useEffect(() => {
    if (autoPlay && audioState.isReady && !audioState.isPlaying) {
      const timer = setTimeout(() => {
        audioManager.current.play()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [autoPlay, audioState.isReady, audioState.isPlaying])

  useEffect(() => {
    if (typeof window !== "undefined") {
      ;(window as any).gameAudio = {
        playVoice: (messageKey: string) => audioManager.current.playVoice(messageKey),
        setVolume: (vol: number) => audioManager.current.setVolume(vol),
        mute: () => audioManager.current.setMuted(true),
        unmute: () => audioManager.current.setMuted(false),
        play: () => audioManager.current.play(),
        pause: () => audioManager.current.pause(),
      }
      console.log("[v0] Global audio controls registered")
    }
  }, [])

  if (!showControls) {
    return null
  }

  const togglePlayPause = () => {
    if (audioState.isPlaying) {
      audioManager.current.pause()
    } else {
      audioManager.current.play()
    }
  }

  return (
    <Card className="fixed bottom-4 right-4 bg-black/80 border-red-800/50 p-4 z-40">
      <div className="flex items-center gap-3">
        <Button
          onClick={togglePlayPause}
          size="sm"
          className={`w-10 h-10 p-0 ${
            audioState.isReady
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
          disabled={!audioState.isReady}
        >
          {audioState.isPlaying ? "⏸" : "▶"}
        </Button>

        <Button
          onClick={() => audioManager.current.setMuted(!audioState.isMuted)}
          size="sm"
          variant="outline"
          className="border-red-600/50 text-red-300 hover:bg-red-600/20 w-10 h-10 p-0"
        >
          {audioState.isMuted ? "🔇" : "🔊"}
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">음량</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={audioState.volume}
            onChange={(e) => audioManager.current.setVolume(Number.parseFloat(e.target.value))}
            className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${audioState.volume * 100}%, #374151 ${audioState.volume * 100}%, #374151 100%)`,
            }}
          />
        </div>

        <div className="border-l border-red-800/50 pl-3 ml-2">
          <Button
            onClick={() => audioManager.current.playVoice("welcome")}
            size="sm"
            variant="ghost"
            className="text-xs text-gray-400 hover:text-white h-6 px-2"
          >
            테스트
          </Button>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">
        {page === "landing" && "메인 테마"}
        {page === "auth" && "인증 음악"}
        {page === "lobby" && "대기실 음악"}
        {page === "game" && "게임 음악"}
        {!audioState.isReady && " (로딩중...)"}
      </div>
    </Card>
  )
}

export const playGameVoice = (messageKey: string) => {
  console.log("[v0] Global playGameVoice called:", messageKey)
  GlobalAudioManager.getInstance().playVoice(messageKey)
}

export const setGameVolume = (volume: number) => {
  GlobalAudioManager.getInstance().setVolume(volume)
}
