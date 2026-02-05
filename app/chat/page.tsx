"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Menu, Mic, Send, StopCircle, Volume2, VolumeX } from "lucide-react"
import { whisperSpeechService, type SpeechStatus } from "../conversation/whisper-speech-service"
import { TTS_PROVIDER } from "@/config"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface SceneMeta {
  aiRole: string
  userRole: string
  context: string
  scenario: string
}

// 同步读取初始状态（仅在客户端）
function getInitialState() {
  if (typeof window === 'undefined') {
    return { sceneMeta: null, messages: [], scenario: "", isSpeechEnabled: true }
  }
  try {
    const saved = localStorage.getItem('converse-sages-state')
    if (saved) {
      const state = JSON.parse(saved)
      return {
        sceneMeta: state.sceneMeta || null,
        messages: state.messages || [],
        scenario: state.scenario || "",
        isSpeechEnabled: state.isSpeechEnabled !== undefined ? state.isSpeechEnabled : true
      }
    }
  } catch (e) {
    console.error('Failed to restore state:', e)
  }
  return { sceneMeta: null, messages: [], scenario: "", isSpeechEnabled: true }
}

export default function ChatPage() {
  const router = useRouter()
  const initialState = getInitialState()
  
  const [sceneMeta, setSceneMeta] = useState<SceneMeta | null>(initialState.sceneMeta)
  const [messages, setMessages] = useState<Message[]>(initialState.messages)
  const [inputText, setInputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(initialState.isSpeechEnabled)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const transcriptCallback = useRef<((text: string) => void) | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isSpeechEnabledRef = useRef(isSpeechEnabled)
  const isInitialMountRef = useRef(true)
  const prevMessagesLengthRef = useRef(initialState.messages.length)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  isSpeechEnabledRef.current = isSpeechEnabled

  // 如果没有 sceneMeta，重定向到首页
  useEffect(() => {
    if (!sceneMeta && typeof window !== 'undefined') {
      router.push('/')
    }
  }, [sceneMeta, router])

  // 页面加载时强制滚动到顶部，防止自动滚动到底部
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 立即滚动到顶部
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      
      // 延迟再次确保（防止其他脚本触发滚动）
      const timer = setTimeout(() => {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    whisperSpeechService.updateConfig({
      ttsProvider: TTS_PROVIDER,
      onStatusChange: (s) => {
        console.log(`[ChatPage] Speech status changed to: ${s}`)
        setSpeechStatus(s)
      },
      onError: (err) => {
        setErrorMessage(err)
        setSpeechStatus("idle")
      },
      onTranscript: (text) => {
        if (transcriptCallback.current) transcriptCallback.current(text)
      },
    })
    return () => whisperSpeechService.resetConfig?.()
  }, [])

  // 只在有新消息时滚动到底部，初次加载和第一条消息时不滚动
  useEffect(() => {
    const currentLength = messages.length
    
    // 跳过初次加载时的滚动（包括从 localStorage 恢复的消息）
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      prevMessagesLengthRef.current = currentLength
      return
    }
    
    const prevLength = prevMessagesLengthRef.current
    
    // 只在消息数量增加且大于1时滚动（第一条消息不滚动，后续消息才滚动）
    if (currentLength === 0 || currentLength <= prevLength || currentLength <= 1) {
      prevMessagesLengthRef.current = currentLength
      return
    }
    
    // 更新上一次的消息数量
    prevMessagesLengthRef.current = currentLength
    
    // 延迟滚动，确保 DOM 已更新
    const timer = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [messages])

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputText])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sceneMeta || messages.length > 0) {
      localStorage.setItem('converse-sages-state', JSON.stringify({
        sceneMeta,
        messages,
        scenario: initialState.scenario,
        isSpeechEnabled,
      }))
    } else {
      localStorage.removeItem('converse-sages-state')
    }
  }, [sceneMeta, messages, isSpeechEnabled, initialState.scenario])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !sceneMeta) return
    setIsLoading(true)
    setErrorMessage(null)
    const newUserMsg: Message = { role: "user", content: text }
    setMessages((prev) => [...prev, newUserMsg])
    setInputText("")

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, newUserMsg],
          sceneMeta,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || "API error")
      const aiMsg: Message = { role: "assistant", content: data.content || "(No response)" }
      setMessages((prev) => [...prev, aiMsg])
      setIsLoading(false)

      // 仅 PC 端自动播放回复语音，手机/平板跳过（按 UA 判断，不按触摸屏，避免触摸屏 PC 被误判）
      const isMobileUA = typeof navigator !== "undefined" &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const speakMatch = data.content?.match(/\[SPEAK\]([\s\S]*?)\[\/SPEAK\]/)
      if (!isMobileUA && isSpeechEnabledRef.current && speakMatch?.[1]) {
        try {
          await whisperSpeechService.speak(speakMatch[1].trim())
        } catch (speakErr: any) {
          console.warn('Speech playback failed:', speakErr)
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Request failed")
    } finally {
      setIsLoading(false)
      setSpeechStatus("idle")
    }
  }, [messages, sceneMeta, isSpeechEnabled])

  const handleVoiceToggle = async () => {
    if (speechStatus === "recording") {
      await whisperSpeechService.stopListening()
      return
    }
    transcriptCallback.current = (text) => {
      if (text?.trim()) {
        setInputText(text)
        sendMessage(text)
      }
    }
    await whisperSpeechService.startListening()
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputText.trim()) return
    sendMessage(inputText)
  }

  const handleConfirmScene = () => {
    if (!sceneMeta) return
    setIsLoading(true)
    setErrorMessage(null)
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [], sceneMeta }),
    })
      .then((r) => r.json())
      .then((data) => {
        const aiMsg: Message = { role: "assistant", content: data.content || "(No response)" }
        setMessages([aiMsg])
        // 仅 PC 端自动播放，手机/平板跳过（按 UA 判断）
        const isMobileUA = typeof navigator !== "undefined" &&
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        const speakMatch = data.content?.match(/\[SPEAK\]([\s\S]*?)\[\/SPEAK\]/)
        if (!isMobileUA && isSpeechEnabledRef.current && speakMatch?.[1]) {
          whisperSpeechService.speak(speakMatch[1].trim())
        }
      })
      .catch((err) => setErrorMessage(err.message))
      .finally(() => setIsLoading(false))
  }

  const handleBack = () => {
    whisperSpeechService.stopSpeaking()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('converse-sages-state')
    }
    router.push('/')
  }

  const extractSpeakContent = (content: string) => {
    if (!content) return content
    
    // 检查内容是否完全被 [SPEAK]...[/SPEAK] 包裹
    const fullMatch = content.match(/^\s*\[\s*SPEAK\s*\]([\s\S]*?)\[\s*\/\s*SPEAK\s*\]\s*$/i)
    if (fullMatch && fullMatch[1]) {
      // 如果完全被包裹，只返回标签内的内容
      return fullMatch[1].trim()
    }
    
    // 否则，移除所有 [SPEAK]...[/SPEAK] 标签对（包括带空格的变体）
    let cleaned = content.replace(/\[\s*SPEAK\s*\][\s\S]*?\[\s*\/\s*SPEAK\s*\]/gi, '')
    
    // 移除残留的单独标签
    cleaned = cleaned
      .replace(/\[\s*\/\s*SPEAK\s*\]/gi, '')
      .replace(/\[\s*SPEAK\s*\]/gi, '')
      .trim()
    
    return cleaned || content
  }

  if (!sceneMeta) {
    return null // 重定向中
  }

  return (
    <div className="min-h-screen flex flex-col" suppressHydrationWarning>
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm flex justify-between items-center">
          {errorMessage}
          <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)}>关闭</Button>
        </div>
      )}

      {!messages.length ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
          <div className="bg-card border rounded-lg p-4 sm:p-6 max-w-lg w-full mb-6 mx-3">
            <h2 className="text-xl font-bold mb-4">场景设定</h2>
            <p className="mb-2"><strong>圣人：</strong>{sceneMeta.aiRole}</p>
            <p className="mb-2"><strong>你的身份：</strong>学生</p>
            <p className="text-sm text-muted-foreground leading-relaxed"><strong>对话场景：</strong>{sceneMeta.context}</p>
          </div>
          {isLoading && (
            <div className="mb-4 text-sm text-muted-foreground flex items-center justify-center gap-1">
              <span className="inline-flex">
                <span className="animate-dot-flash-1">.</span>
                <span className="animate-dot-flash-2">.</span>
                <span className="animate-dot-flash-3">.</span>
              </span>
              <span>正在生成对话，请稍候</span>
              <span className="inline-flex">
                <span className="animate-dot-flash-1">.</span>
                <span className="animate-dot-flash-2">.</span>
                <span className="animate-dot-flash-3">.</span>
              </span>
            </div>
          )}
          <div className="flex gap-4">
            <Button onClick={handleConfirmScene} disabled={isLoading}>
              {isLoading ? (
                <span className="animate-status-pulse">等待圣人回复</span>
              ) : (
                '确认开始'
              )}
            </Button>
            <Button variant="outline" onClick={handleBack} disabled={isLoading}>返回</Button>
          </div>
        </div>
      ) : (
        <div className="flex h-screen bg-stone-50/60">
          {/* 移动端侧栏遮罩 */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
          )}
          <aside
            className={`fixed md:relative inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] flex flex-col shrink-0 bg-[#171717] text-gray-200 transform transition-transform duration-200 ease-out ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            }`}
          >
            <div className="p-3">
              <Button
                onClick={() => { handleBack(); setSidebarOpen(false) }}
                className="w-full justify-center gap-2 rounded-lg bg-transparent hover:bg-white/10 text-gray-300 border border-white/20 min-h-[44px] touch-manipulation"
              >
                <span className="text-sm">+ 新对话</span>
              </Button>
            </div>
            <div className="flex-1 min-h-0 px-3 py-2 overflow-y-auto">
              <div className="rounded-xl bg-gradient-to-br from-amber-900/30 to-orange-900/20 border border-amber-700/30 p-4 shadow-lg">
                {(() => {
                  const parts = sceneMeta.scenario.split(/[，,]/);
                  const name = parts[0]?.trim() || sceneMeta.scenario;
                  const intro = parts.slice(1).join('，').trim();
                  return (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center text-lg font-medium text-amber-900 shadow-inner shrink-0">
                          {name.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-white mb-0.5 truncate">{name}</h3>
                          {intro && (
                            <p className="text-xs text-amber-200/80 line-clamp-2 leading-relaxed">{intro}</p>
                          )}
                        </div>
                      </div>
                      {(sceneMeta.context || intro) && (
                        <div className="pt-3 border-t border-amber-700/30">
                          <p className="text-xs text-amber-300/90 leading-relaxed">
                            {sceneMeta.context || intro}
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="mt-3 space-y-1">
                <button
                  type="button"
                  onClick={() => { handleBack(); setSidebarOpen(false) }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-white/10 hover:text-gray-200 min-h-[44px] touch-manipulation"
                >
                  <ArrowLeft className="h-4 w-4" />
                  选古人
                </button>
                <button
                  type="button"
                  onClick={() => setIsSpeechEnabled(!isSpeechEnabled)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-white/10 hover:text-gray-200 min-h-[44px] touch-manipulation"
                  title={isSpeechEnabled ? "关闭语音" : "开启语音"}
                >
                  {isSpeechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  {isSpeechEnabled ? "语音开" : "语音关"}
                </button>
              </div>
            </div>
          </aside>

          <main className="flex-1 flex flex-col min-w-0 bg-white min-h-0">
            {/* 移动端顶部栏 */}
            <div className="sticky top-0 font-bold  z-10 flex md:hidden items-center gap-2 shrink-0 px-3 py-2 border-b border-stone-200 bg-white/95 min-h-[44px] shadow-sm backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 touch-manipulation"
                aria-label="打开菜单"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 text-sm touch-manipulation"
              >
                <ArrowLeft className="h-4 w-4" />
                选古人
              </button>
              <span className="flex-1 truncate text-base font-bold text-gray-700 ml-1" title={sceneMeta.scenario}>
                {sceneMeta.scenario}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-[max(6rem,calc(6rem+env(safe-area-inset-bottom)))]">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`group relative flex gap-4 py-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        msg.role === "assistant"
                          ? "bg-[#19c37d] text-white"
                          : "bg-[#ab68ff] text-white"
                      }`}
                    >
                      {msg.role === "assistant" ? "师" : "我"}
                    </div>
                    <div
                      className={`flex-1 min-w-0 text-[15px] leading-[1.75] whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "text-gray-900 text-right"
                          : "text-gray-800"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <div className="inline-block max-w-[85%] rounded-2xl bg-violet-50 border border-violet-100 px-4 py-3 text-gray-900 text-left">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="prose prose-gray max-w-none text-[15px] leading-[1.75] prose-p:my-2 prose-p:leading-relaxed">
                            {extractSpeakContent(msg.content)}
                          </div>
                          {i === messages.length - 1 && (
                            <div className="min-h-[28px] flex items-center pt-1">
                              {speechStatus === "speaking" ? (
                                <div className="flex items-center gap-2 text-[13px] text-emerald-600">
                                  <span className="flex items-end gap-0.5 h-4 [&>span]:inline-block">
                                    <span className="w-1 bg-emerald-500 rounded-full origin-bottom animate-sound-wave animate-sound-wave-1 h-3" />
                                    <span className="w-1 bg-emerald-500 rounded-full origin-bottom animate-sound-wave animate-sound-wave-2 h-4" />
                                    <span className="w-1 bg-emerald-500 rounded-full origin-bottom animate-sound-wave animate-sound-wave-3 h-3" />
                                    <span className="w-1 bg-emerald-500 rounded-full origin-bottom animate-sound-wave animate-sound-wave-4 h-4" />
                                  </span>
                                  <Volume2 className="h-3.5 w-3.5 shrink-0 animate-status-pulse" />
                                  正在播放
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="group relative flex gap-4 py-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-[#19c37d] flex items-center justify-center text-xs font-medium text-white animate-status-pulse">
                      师
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="inline-block rounded-2xl bg-emerald-50/90 border border-emerald-100 px-4 py-3 text-[15px] text-emerald-700/80 italic">
                        等待圣人回复
                        <span className="inline-flex">
                          <span className="animate-dot-flash-1">.</span>
                          <span className="animate-dot-flash-2">.</span>
                          <span className="animate-dot-flash-3">.</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="sticky bottom-0 w-full border-t border-stone-200 bg-white/95 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.05)] backdrop-blur-sm">
              <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
                <div className="flex flex-col rounded-2xl bg-white border border-stone-200 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.04)] focus-within:border-emerald-300 focus-within:shadow-[0_0_0_1px_rgba(5,150,105,0.15),0_2px_6px_rgba(0,0,0,0.06)] transition-all">
                  <Textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      // Shift+Enter：换行
                      if (e.shiftKey) return
                      // 移动端：Enter 仅换行，不发送
                      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                        ('ontouchstart' in window) ||
                        (navigator.maxTouchPoints > 0)
                      if (isMobile) return
                      // PC：打字过程里 Enter 为 IME 确认键，不发送；输入完成后 Enter 发送
                      if ((e.nativeEvent as KeyboardEvent).isComposing) return
                      e.preventDefault()
                      if (inputText.trim() && !isLoading && speechStatus !== 'recording' && speechStatus !== 'processing') {
                        handleSubmit(e)
                      }
                    }}
                    placeholder="输入或语音...（Shift+Enter 换行）"
                    disabled={isLoading || speechStatus === "recording" || speechStatus === "processing"}
                    className="w-full border-0 min-h-[44px] sm:min-h-[52px] max-h-[120px] py-3 px-4 text-base sm:text-[15px] focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-500 resize-none overflow-hidden bg-transparent"
                    rows={1}
                  />
                  <div className="flex items-center justify-end gap-1.5 p-2 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={handleVoiceToggle}
                      disabled={isLoading || speechStatus === "processing"}
                      className="shrink-0 h-10 w-10 sm:h-9 sm:w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 touch-manipulation"
                    >
                      {speechStatus === "recording" ? <StopCircle className="h-5 w-5 text-red-500" /> : <Mic className="h-5 w-5" />}
                    </Button>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!inputText.trim() || isLoading}
                      className="shrink-0 h-10 w-10 sm:h-9 sm:w-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 touch-manipulation"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </main>
        </div>
      )}
    </div>
  )
}
