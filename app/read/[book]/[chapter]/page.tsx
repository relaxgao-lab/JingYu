"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, List, Mic, Send, StopCircle, Volume2, VolumeX } from "lucide-react"
import { getChapter, getChapters, getTotalChapters, getNextChapter, getPrevChapter, hasChapter, hasVersionPage, getBook } from "@/lib/classics"
import { whisperSpeechService, type SpeechStatus } from "@/app/conversation/whisper-speech-service"
import { TTS_PROVIDER } from "@/config"
import { Chapter } from "@/app/read/types"

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


export default function ReadPage() {
  const router = useRouter()
  const params = useParams()
  const bookId = params.book as string
  const chapterParam = params.chapter as string
  const chapterNumber = parseInt(chapterParam, 10)

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [totalChapters, setTotalChapters] = useState(0)
  const [loading, setLoading] = useState(true)
  
  // AI 聊天相关状态
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [isLoadingChat, setIsLoadingChat] = useState(false)
  const [sceneMeta, setSceneMeta] = useState<SceneMeta | null>(null)
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle")
  const [speechError, setSpeechError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const transcriptCallback = useRef<((text: string) => void) | null>(null)
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false)
  const isSpeechEnabledRef = useRef(false)
  isSpeechEnabledRef.current = isSpeechEnabled
  const userStoppedPlaybackRef = useRef(false)

  // AI 窗口宽度（可拖拽调整），默认 420px，范围 280 ~ 70vw
  const MIN_CHAT_WIDTH = 280
  const MAX_CHAT_WIDTH_PERCENT = 70
  const DEFAULT_CHAT_WIDTH = 420
  const [chatWidth, setChatWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_CHAT_WIDTH
    try {
      const saved = localStorage.getItem("read-chat-width")
      if (saved) {
        const n = parseInt(saved, 10)
        if (!isNaN(n) && n >= MIN_CHAT_WIDTH) return Math.min(n, window.innerWidth * (MAX_CHAT_WIDTH_PERCENT / 100))
      }
    } catch {}
    return DEFAULT_CHAT_WIDTH
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const lastChatWidthRef = useRef(chatWidth)
  const [showToc, setShowToc] = useState(false)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!bookId || chapterParam === undefined || chapterParam === '') {
      router.push('/')
      return
    }
    const num = parseInt(chapterParam, 10)
    if (isNaN(num) || num < 0) {
      router.push('/')
      return
    }
    const isVersionPage = num === 0 && hasVersionPage(bookId)
    if (!isVersionPage && !hasChapter(bookId, num)) {
      router.push('/')
      return
    }

    const total = getTotalChapters(bookId)
    const book = getBook(bookId)

    if (isVersionPage) {
      setChapter(null)
      setTotalChapters(total)
      setLoading(false)
      contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" })
      if (book?.versionNote) {
        setSceneMeta({
          aiRole: book.author || "经典解读助手",
          userRole: "学生",
          context: `你正在阅读《${book.book}》的版本说明。内容如下：\n\n${book.versionNote}\n\n请基于以上版本说明，用现代人容易听懂的白话文帮助学生理解该版本的选取理由和相关背景。`,
          scenario: `${book.book} - 版本说明`
        })
      } else {
        setSceneMeta(null)
      }
      setMessages([])
      return
    }

    const chapterData = getChapter(bookId, num)
    if (!chapterData) {
      router.push('/')
      return
    }

    setChapter(chapterData)
    setTotalChapters(total)
    setLoading(false)
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" })
    if (book && chapterData) {
      setSceneMeta({
        aiRole: book.author || "经典解读助手",
        userRole: "学生",
        context: `你正在阅读《${book.book}》的${chapterData.title}。本章内容如下：\n\n${chapterData.content}\n\n请基于本章内容，用现代人容易听懂的白话文帮助学生理解经典的含义和智慧。回复时请用「你」直接对读者讲解，用第二人称。若原文有对比或递进（如无欲/有欲、妙/徼），请明确区分二者含义与层次，避免把两种状态说成并列、等同；例如「常无欲以观其妙，常有欲以观其徼」中，无欲才能观其妙，有欲时只能观其徼（边界），二者不是并列的两种观察方式。`,
        scenario: `${book.book} - ${chapterData.title}`
      })
      setMessages([])
    }
  }, [bookId, chapterParam, router])

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputText])

  // 消息滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // 语音服务配置
  useEffect(() => {
    whisperSpeechService.updateConfig({
      ttsProvider: TTS_PROVIDER,
      onStatusChange: (s) => setSpeechStatus(s),
      onError: (err) => {
        if (userStoppedPlaybackRef.current) {
          userStoppedPlaybackRef.current = false
          setSpeechError(null)
          setSpeechStatus("idle")
          return
        }
        setSpeechError(err)
        setSpeechStatus("idle")
      },
      onTranscript: (text) => {
        if (transcriptCallback.current) transcriptCallback.current(text)
      },
    })
    return () => whisperSpeechService.resetConfig?.()
  }, [])

  // 拖拽调整 AI 窗口宽度
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = chatWidth
  }, [chatWidth])

  useEffect(() => {
    if (!isResizing) return
    const maxW = typeof window !== "undefined" ? window.innerWidth * (MAX_CHAT_WIDTH_PERCENT / 100) : 800
    const onMove = (e: MouseEvent) => {
      const delta = resizeStartX.current - e.clientX // 往左拖 = 正 = 变宽
      let next = resizeStartWidth.current + delta
      next = Math.max(MIN_CHAT_WIDTH, Math.min(maxW, next))
      lastChatWidthRef.current = next
      setChatWidth(next)
    }
    const onUp = () => {
      setIsResizing(false)
      try {
        localStorage.setItem("read-chat-width", String(lastChatWidthRef.current))
      } catch {}
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing, chatWidth])


  const handleGoToChapter = (ch: number) => {
    setShowToc(false)
    router.push(`/read/${bookId}/${ch}`)
  }

  const handlePrevChapter = () => {
    const prev = getPrevChapter(bookId, chapterNumber)
    if (prev != null) {
      contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" })
      router.push(`/read/${bookId}/${prev}`, { scroll: false })
    }
  }

  const handleNextChapter = () => {
    const next = getNextChapter(bookId, chapterNumber)
    if (next != null) {
      contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" })
      router.push(`/read/${bookId}/${next}`, { scroll: false })
    }
  }

  const handleGoHome = () => {
    router.push('/')
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !sceneMeta) return
    setIsLoadingChat(true)
    setSpeechError(null)
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
      setIsLoadingChat(false)

      // PC 端自动播放 AI 回复语音（不 await，播放在后台进行，避免播放期间仍显示「正在思考」）
      const isMobileUA = typeof navigator !== "undefined" &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const speakMatch = data.content?.match(/\[SPEAK\]([\s\S]*?)\[\/SPEAK\]/)
      if (!isMobileUA && isSpeechEnabledRef.current && speakMatch?.[1]) {
        whisperSpeechService.speak(speakMatch[1].trim()).catch((speakErr: unknown) => {
          console.warn("Speech playback failed:", speakErr)
        })
      }
    } catch (err: unknown) {
      console.error("Chat error:", err)
    } finally {
      setIsLoadingChat(false)
      if (speechStatus !== "speaking") setSpeechStatus("idle")
    }
  }, [messages, sceneMeta])

  const handleVoiceToggle = async () => {
    if (speechStatus === "recording") {
      await whisperSpeechService.stopListening()
      return
    }
    setSpeechError(null)
    transcriptCallback.current = (text: string) => {
      if (text?.trim()) {
        setInputText(text)
        sendMessage(text)
      }
    }
    await whisperSpeechService.startListening()
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputText.trim() || isLoadingChat) return
    sendMessage(inputText)
  }

  const extractSpeakContent = (content: string) => {
    if (!content) return content
    return content
      .replace(/\[\/SPEAK\]/gi, '')
      .replace(/\[SPEAK\]/gi, '')
      .trim() || content
  }

  // 配色参考首页 pastel 卡片（快捷按钮 + 上一章/下一章/语音开关共用）
  const presetColors = [
    { bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-700", hover: "hover:bg-slate-200/50" },
    { bg: "bg-violet-100", border: "border-violet-200", text: "text-violet-700", hover: "hover:bg-violet-200/50" },
    { bg: "bg-pink-100", border: "border-pink-200", text: "text-pink-700", hover: "hover:bg-pink-200/50" },
    { bg: "bg-amber-100", border: "border-amber-200", text: "text-amber-800", hover: "hover:bg-amber-200/50" },
    { bg: "bg-emerald-100", border: "border-emerald-200", text: "text-emerald-700", hover: "hover:bg-emerald-200/50" },
  ]
  const navPrevColor = presetColors[0]
  const navNextColor = presetColors[1]
  const voiceToggleColor = presetColors[4]
  const presetPrompts = [
    { label: "讲解", text: "请用现代人容易听懂的白话文讲解这一章的意思。" },
    { label: "大意", text: "请用白话文概括本章大意。" },
    { label: "重点", text: "请用白话文说明本章有哪些重点。" },
    { label: "联系现实", text: "请用白话文说说本章对现代人有什么启发。" },
  ]
  const handlePreset = (text: string) => {
    if (!sceneMeta || isLoadingChat || speechStatus === "recording" || speechStatus === "processing") return
    sendMessage(text)
  }

  const isVersionPage = chapterNumber === 0 && hasVersionPage(bookId)
  const pageTitle = isVersionPage ? "版本说明" : (chapter?.title ?? "")
  const showContent = !loading && (chapter || isVersionPage)

  if (!showContent) {
    return (
      <div className="h-screen flex items-center justify-center bg-amber-50">
        <div className="text-gray-600">加载中...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-amber-50 to-amber-100">
      {/* 主要内容区域 - 左右分栏，右侧宽度可拖拽 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：章节内容 */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-amber-200/80 bg-[#faf9f6] relative">
          <div ref={contentScrollRef} className="flex-1 overflow-y-auto">
            {/* 页面内导航：返回首页、目录（章节信息在页脚） */}
            <div className="sticky top-0 z-10 max-w-[44rem] mx-auto px-6 md:px-12 py-4 flex items-center justify-between gap-3 bg-[#faf9f6]/95 backdrop-blur-sm border-b border-amber-200/60 -mb-px">
              <Button
                variant="ghost"
                onClick={handleGoHome}
                className="text-gray-600 hover:text-gray-900 hover:bg-amber-100/60 -ml-2"
              >
                ← 返回首页
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowToc(true)}
                className="text-gray-600 hover:text-gray-900 hover:bg-amber-100/60"
                title="目录"
                aria-label="目录"
              >
                <List className="h-4 w-4 mr-1" />
                目录
              </Button>
            </div>
            {/* 内容区：正文或版本详情（全宽，箭头悬浮不占空间） */}
            <div className="min-h-[50vh]">
              <article className="read-content max-w-[44rem] mx-auto py-10 md:py-16 px-4 md:px-12">
                {isVersionPage ? (
                  /* 版本详情页 */
                  <>
                    <header className="text-center mb-10 md:mb-14">
                      <h1 
                        className="text-2xl md:text-4xl font-semibold text-gray-900 tracking-tight mb-4"
                        style={{ fontFamily: '"LXGW WenKai", "Noto Serif SC", serif' }}
                      >
                        版本说明
                      </h1>
                      <div className="w-20 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent mx-auto opacity-80" aria-hidden />
                    </header>
                    <div 
                      className="read-body select-text text-base md:text-lg leading-relaxed text-gray-800"
                      style={{ fontFamily: '"LXGW WenKai", "Noto Serif SC", serif', userSelect: 'text', WebkitUserSelect: 'text' }}
                    >
                      <p className="whitespace-pre-wrap">{getBook(bookId)?.versionNote ?? ""}</p>
                    </div>
                  </>
                ) : chapter ? (
                  /* 章节正文 */
                  <>
                    <header className="text-center mb-10 md:mb-14">
                      <h1 
                        className="text-2xl md:text-4xl font-semibold text-gray-900 tracking-tight mb-4"
                        style={{ fontFamily: '"LXGW WenKai", "Noto Serif SC", serif' }}
                      >
                        {chapter.title}
                      </h1>
                      <div className="w-20 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent mx-auto opacity-80" aria-hidden />
                    </header>

                    <div 
                      className="read-body select-text"
                      style={{ fontFamily: '"LXGW WenKai", "Noto Serif SC", serif', userSelect: 'text', WebkitUserSelect: 'text' }}
                    >
                      {chapter.content
                        .split('\n')
                        .filter(Boolean)
                        .map((line, i) => (
                          <p key={i} className="text-lg md:text-xl leading-[2] text-gray-800 text-center mb-5 last:mb-0 tracking-wide">
                            {line}
                          </p>
                        ))}
                    </div>
                  </>
                ) : null}
              </article>
            </div>
          </div>
          {/* 页脚：始终在底部 */}
          <footer className="shrink-0 py-4 px-6 border-t border-amber-200/60 bg-[#faf9f6]">
            <div className="max-w-[44rem] mx-auto text-center">
              <span className="text-xs md:text-sm text-gray-500 tracking-widest">
                {pageTitle} / 共{totalChapters}章
              </span>
            </div>
          </footer>
          {/* 目录弹窗 */}
          {showToc && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => setShowToc(false)}
              aria-modal="true"
              role="dialog"
            >
              <div
                className="bg-white rounded-xl shadow-2xl max-h-[80vh] w-full max-w-md mx-4 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">目录</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowToc(false)}>关闭</Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {hasVersionPage(bookId) && (
                    <button
                      type="button"
                      onClick={() => handleGoToChapter(0)}
                      className={`w-full text-left py-2.5 px-3 rounded-lg text-sm transition-colors ${
                        chapterNumber === 0 ? "bg-amber-100 text-amber-900 font-medium" : "text-gray-700 hover:bg-amber-50"
                      }`}
                    >
                      版本说明
                    </button>
                  )}
                  {getChapters(bookId).map((ch) => (
                    <button
                      key={ch.chapter}
                      type="button"
                      onClick={() => handleGoToChapter(ch.chapter)}
                      className={`w-full text-left py-2.5 px-3 rounded-lg text-sm transition-colors ${
                        chapterNumber === ch.chapter ? "bg-amber-100 text-amber-900 font-medium" : "text-gray-700 hover:bg-amber-50"
                      }`}
                    >
                      {ch.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* 悬浮箭头：不占用内容空间，距离边缘较远 */}
          <div className="absolute left-6 md:left-10 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="pointer-events-auto">
              <Button
                onClick={handlePrevChapter}
                disabled={getPrevChapter(bookId, chapterNumber) === null}
                variant="outline"
                size="icon"
                className={`rounded-full border shadow-md ${navPrevColor.bg} ${navPrevColor.border} ${navPrevColor.text} ${navPrevColor.hover} disabled:opacity-50 h-10 w-10 md:h-12 md:w-12`}
                title="上一章"
                aria-label="上一章"
              >
                <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </div>
          </div>
          <div className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="pointer-events-auto">
              <Button
                onClick={handleNextChapter}
                disabled={getNextChapter(bookId, chapterNumber) === null}
                variant="outline"
                size="icon"
                className={`rounded-full border shadow-md ${navNextColor.bg} ${navNextColor.border} ${navNextColor.text} ${navNextColor.hover} disabled:opacity-50 h-10 w-10 md:h-12 md:w-12`}
                title="下一章"
                aria-label="下一章"
              >
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* 拖拽条 */}
        <div
          role="separator"
          aria-label="调整 AI 窗口宽度"
          onMouseDown={handleResizeStart}
          className={`shrink-0 w-1.5 flex flex-col items-center justify-center bg-gray-200 hover:bg-emerald-400 active:bg-emerald-500 cursor-col-resize select-none transition-colors ${
            isResizing ? "bg-emerald-500" : ""
          }`}
        >
          <div className="w-0.5 h-8 rounded-full bg-gray-400 group-hover:bg-white pointer-events-none" />
        </div>

        {/* 右侧：AI 聊天窗口（宽度可拖拽） */}
        <div
          className="flex flex-col bg-white border-l border-gray-200 shrink-0"
          style={{ width: chatWidth, minWidth: MIN_CHAT_WIDTH }}
        >
          {/* 聊天标题 */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-700">AI 解读助手</h3>
              <p className="text-xs text-gray-500 mt-1">基于当前章节内容提问</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next = !isSpeechEnabled
                if (!next) {
                  userStoppedPlaybackRef.current = true
                  whisperSpeechService.stopSpeaking()
                  setSpeechError(null)
                }
                setIsSpeechEnabled(next)
              }}
              className={`shrink-0 h-8 px-2 border ${voiceToggleColor.bg} ${voiceToggleColor.border} ${voiceToggleColor.text} ${voiceToggleColor.hover}`}
              title={isSpeechEnabled ? "关闭语音朗读" : "开启语音朗读"}
            >
              {isSpeechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="ml-1 text-xs">{isSpeechEnabled ? "语音开" : "语音关"}</span>
            </Button>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-sm text-gray-500 mt-8">
                <p>有什么问题想了解吗？</p>
                <p className="mt-2 text-xs">可以询问本章的含义、背景或相关智慧</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    msg.role === "assistant"
                      ? "bg-emerald-500 text-white"
                      : "bg-violet-500 text-white"
                  }`}
                >
                  {msg.role === "assistant" ? "AI" : "我"}
                </div>
                <div
                  className={`flex-1 min-w-0 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-right"
                      : "text-gray-800"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div className="inline-block max-w-[85%] rounded-2xl bg-violet-50 border border-violet-100 px-4 py-2 text-gray-900 text-left">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-2 whitespace-pre-wrap">
                        {extractSpeakContent(msg.content)}
                      </div>
                      {i === messages.length - 1 && (
                        <div className="min-h-[24px] flex items-center pt-1">
                          {speechStatus === "speaking" ? (
                            <div className="flex items-center gap-2 text-xs text-emerald-600">
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
            {isLoadingChat && (
              <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-medium text-white">
                  AI
                </div>
                <div className="flex-1 min-w-0">
                  <div className="inline-block rounded-2xl bg-gray-50 border border-gray-100 px-4 py-2 text-sm text-gray-600">
                    正在思考...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 默认快捷按钮 */}
          <div className="shrink-0 px-4 py-2 border-t border-gray-100 bg-gray-50/80">
            <div className="flex flex-wrap gap-2">
              {presetPrompts.map((p, i) => {
                const c = presetColors[i % presetColors.length]
                return (
                  <Button
                    key={p.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!sceneMeta || isLoadingChat || speechStatus === "recording" || speechStatus === "processing"}
                    onClick={() => handlePreset(p.text)}
                    className={`text-xs h-8 px-3 rounded-full border ${c.bg} ${c.border} ${c.text} ${c.hover} disabled:opacity-50`}
                  >
                    {p.label}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* 输入框 */}
          <div className="shrink-0 border-t border-gray-200 p-4 bg-gray-50">
            {speechError && (
              <div className="mb-2 text-xs text-red-600 flex items-center justify-between gap-2">
                <span>{speechError}</span>
                <Button variant="ghost" size="sm" className="h-6 px-1 text-red-600" onClick={() => setSpeechError(null)}>
                  关闭
                </Button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-end gap-1">
              <Textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (inputText.trim() && !isLoadingChat && speechStatus !== "recording" && speechStatus !== "processing") {
                      handleSubmit(e)
                    }
                  }
                }}
                placeholder="输入或语音...（Shift+Enter 换行）"
                disabled={isLoadingChat || !sceneMeta || speechStatus === "processing"}
                className="flex-1 min-h-[44px] max-h-[120px] text-sm resize-none"
                rows={1}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleVoiceToggle}
                disabled={isLoadingChat || !sceneMeta || speechStatus === "processing"}
                className="shrink-0 h-11 w-11 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                title={speechStatus === "recording" ? "停止录音" : "语音输入"}
              >
                {speechStatus === "recording" ? (
                  <StopCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={!inputText.trim() || isLoadingChat || !sceneMeta}
                className="shrink-0 h-11 w-11 bg-emerald-600 hover:bg-emerald-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
