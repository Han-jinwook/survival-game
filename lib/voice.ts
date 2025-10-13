// Voice announcement system using Web Speech API
// Can be replaced with audio files later for better quality

let isSpeaking = false
let voiceEnabled = true

export function setVoiceEnabled(enabled: boolean) {
  voiceEnabled = enabled
  if (!enabled && isSpeaking) {
    window.speechSynthesis.cancel()
    isSpeaking = false
  }
}

export function getVoiceEnabled() {
  return voiceEnabled
}

export function speak(
  text: string,
  options?: { rate?: number; pitch?: number; volume?: number; onComplete?: () => void },
) {
  if (!voiceEnabled) {
    options?.onComplete?.()
    return
  }

  // Cancel any ongoing speech
  if (isSpeaking) {
    window.speechSynthesis.cancel()
  }

  const utterance = new SpeechSynthesisUtterance(text)

  // Set Korean voice if available
  const voices = window.speechSynthesis.getVoices()
  const koreanVoice = voices.find((voice) => voice.lang.startsWith("ko"))
  if (koreanVoice) {
    utterance.voice = koreanVoice
  }

  // Set voice properties
  utterance.rate = options?.rate || 1.0
  utterance.pitch = options?.pitch || 1.0
  utterance.volume = options?.volume || 1.0
  utterance.lang = "ko-KR"

  utterance.onstart = () => {
    isSpeaking = true
  }

  utterance.onend = () => {
    isSpeaking = false
    options?.onComplete?.()
  }

  utterance.onerror = () => {
    isSpeaking = false
  }

  window.speechSynthesis.speak(utterance)
}

// Preload voices (some browsers need this)
if (typeof window !== "undefined") {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}
