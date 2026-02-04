export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false
  try {
    const synthesis = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance("test")
    return !!synthesis && !!utterance
  } catch {
    return false
  }
}

export const initSpeechSynthesis = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!isSpeechSynthesisSupported()) {
      reject(new Error("Speech synthesis not supported"))
      return
    }
    const checkVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        const zhVoices = voices.filter(v => v.lang.startsWith('zh'))
        if (zhVoices.length > 0 || voices.length > 0) {
          resolve()
          return true
        }
      }
      return false
    }
    if (checkVoices()) return
    let loaded = false
    const handler = () => {
      if (checkVoices() && !loaded) {
        loaded = true
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        resolve()
      }
    }
    window.speechSynthesis.addEventListener('voiceschanged', handler)
    setTimeout(() => {
      if (!loaded) {
        window.speechSynthesis.removeEventListener('voiceschanged', handler)
        checkVoices() ? resolve() : reject(new Error("No voices available"))
      }
    }, 3000)
  })
}
