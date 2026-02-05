"use client"

import React, { useState, useEffect, useLayoutEffect, useRef } from "react"
import Image from "next/image"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, List, Mic, MessageSquare, Send, StopCircle, Volume2, VolumeX, X } from "lucide-react"
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

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [totalChapters, setTotalChapters] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentChapterNum, setCurrentChapterNum] = useState(() => parseInt(chapterParam || "1", 10))
  
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
  // 默认打开；若有已保存的偏好则从 localStorage 恢复
  const [isChatOpen, setIsChatOpen] = useState(true)

  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem("read-chat-open")
      if (saved !== null) setIsChatOpen(saved === "true")
    } catch {
      // 保持默认打开
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("read-chat-open", isChatOpen.toString())
  }, [isChatOpen])

  const [contentTransitioning, setContentTransitioning] = useState(false)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const [pageEntered, setPageEntered] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setPageEntered(true))
    return () => cancelAnimationFrame(t)
  }, [])

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
      setCurrentChapterNum(0)
      setChapter(null)
      setTotalChapters(total)
      setLoading(false)
      contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" })
      if (book?.versionNote) {
        setSceneMeta({
          aiRole: "解读助手",
          userRole: "读者",
          context: `正在阅读《${bookId}》的版本说明`,
          scenario: "读者对书籍的版本和背景感兴趣"
        })
      }
    } else {
      const ch = getChapter(bookId, num)
      if (ch) {
        setChapter(ch)
        setCurrentChapterNum(num)
        setTotalChapters(total)
        setLoading(false)
        contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" })
        setSceneMeta({
          aiRole: "解读助手",
          userRole: "读者",
          context: `正在阅读《${bookId}》第${ch.chapter}章：${ch.title}`,
          scenario: "读者对当前章节内容有疑问或想深入了解"
        })
      }
    }
  }, [bookId, chapterParam, router])

  // 消息滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 处理语音输入回调
  useEffect(() => {
    transcriptCallback.current = (text: string) => {
      setInputText(prev => prev + text)
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }, [])

  const handleGoHome = () => router.push("/")
  
  const handleGoToChapter = (num: number) => {
    if (num === currentChapterNum) {
      setShowToc(false)
      return
    }
    setContentTransitioning(true)
    setTimeout(() => {
      setShowToc(false)
      router.push(`/read/${bookId}/${num}`)
      setContentTransitioning(false)
    }, 200)
  }

  const handlePrevChapter = () => {
    const prev = getPrevChapter(bookId, currentChapterNum)
    if (prev !== null) {
      handleGoToChapter(prev)
    }
  }

  const handleNextChapter = () => {
    const next = getNextChapter(bookId, currentChapterNum)
    if (next !== null) {
      handleGoToChapter(next)
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoadingChat || !sceneMeta) return

    const userMsg: Message = { role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setInputText("")
    setIsLoadingChat(true)
    setSpeechError(null)
    userStoppedPlaybackRef.current = false

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          sceneMeta: {
            ...sceneMeta,
            context: `${sceneMeta.context}\n当前章节内容：\n${chapter?.content || ""}`
          }
        })
      })

      if (!response.ok) throw new Error("对话请求失败")
      
      const data = await response.json()
      const assistantMsg: Message = { role: "assistant", content: data.content }
      setMessages(prev => [...prev, assistantMsg])

      // 如果开启了语音，自动朗读
      if (isSpeechEnabledRef.current) {
        const speakText = extractSpeakContent(data.content)
        if (speakText) {
          try {
            await whisperSpeechService.speak(speakText)
          } catch (err) {
            console.error("TTS Error:", err)
            setSpeechError("语音播放失败")
          }
        }
      }
    } catch (error) {
      console.error("Chat Error:", error)
      setSpeechError("对话请求失败，请稍后再试")
    } finally {
      setIsLoadingChat(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputText)
  }

  const handleVoiceToggle = async () => {
    if (speechStatus === "recording") {
      whisperSpeechService.stopListening()
      setSpeechStatus("idle")
      return
    }

    setSpeechError(null)
    setSpeechStatus("recording")
    try {
      whisperSpeechService.updateConfig({
        onTranscript: (text: string) => {
          transcriptCallback.current?.(text)
        },
        onError: (err: string) => {
          console.error("Recording Error:", err)
          setSpeechError(err || "语音识别失败")
          setSpeechStatus("idle")
        },
        onStatusChange: (s: SpeechStatus) => {
          setSpeechStatus(s)
        }
      })
      await whisperSpeechService.startListening()
    } catch (err) {
      setSpeechStatus("idle")
      setSpeechError("无法启动录音")
    }
  }

  // 拖拽调整宽度
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = chatWidth
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const deltaX = resizeStartX.current - e.clientX
      const newWidth = Math.max(MIN_CHAT_WIDTH, Math.min(resizeStartWidth.current + deltaX, window.innerWidth * (MAX_CHAT_WIDTH_PERCENT / 100)))
      setChatWidth(newWidth)
      lastChatWidthRef.current = newWidth
    }

    const handleMouseUp = () => {
      if (!isResizing) return
      setIsResizing(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      localStorage.setItem("read-chat-width", lastChatWidthRef.current.toString())
    }

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  // 提取 [SPEAK] 标签内容
  const extractSpeakContent = (content: string) => {
    if (!content) return ''
    
    // 检查是否整个内容都被 [SPEAK] 标签包裹
    const fullMatch = content.match(/^\[\s*SPEAK\s*\]([\s\S]*?)\[\s*\/\s*SPEAK\s*\]$/i)
    if (fullMatch) {
      return fullMatch[1].trim()
    }

    // 如果不是整体包裹，则移除所有 [SPEAK] 标签及其内容
    let cleaned = content.replace(/\[\s*SPEAK\s*\][\s\S]*?\[\s*\/\s*SPEAK\s*\]/gi, '')
    
    // 移除残留的单独标签
    cleaned = cleaned
      .replace(/\[\s*\/\s*SPEAK\s*\]/gi, '')
      .replace(/\[\s*SPEAK\s*\]/gi, '')
      .trim()
    
    return cleaned || content
  }

  // 配色参考首页 pastel 卡片（快捷按钮 + 上一章/下一章/语音开关共用）
  const presetColors = [
    { bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-700", hover: "hover:bg-slate-200/50" },
    { bg: "bg-violet-100", border: "border-violet-200", text: "text-violet-700", hover: "hover:bg-violet-200/50" },
    { bg: "bg-pink-100", border: "border-pink-200", text: "text-pink-700", hover: "hover:bg-pink-200/50" },
    { bg: "bg-amber-100", border: "border-amber-200", text: "text-amber-800", hover: "hover:bg-amber-200/50" },
    { bg: "bg-emerald-100", border: "border-emerald-200", text: "text-emerald-700", hover: "hover:bg-emerald-200/50" },
  ]
  
  // 章节卡片颜色方案（参考 sages.relaxgao.com - 柔和 pastel 色）
  const chapterCardColors = [
    { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600", avatarBg: "bg-slate-100", avatarText: "text-slate-700", hover: "hover:bg-slate-100", ring: "focus:ring-slate-200" },
    { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-600", avatarBg: "bg-violet-100", avatarText: "text-violet-700", hover: "hover:bg-violet-100", ring: "focus:ring-violet-200" },
    { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-600", avatarBg: "bg-pink-100", avatarText: "text-pink-700", hover: "hover:bg-pink-100", ring: "focus:ring-pink-200" },
    { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", avatarBg: "bg-amber-100", avatarText: "text-amber-800", hover: "hover:bg-amber-100", ring: "focus:ring-amber-200" },
    { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", avatarBg: "bg-emerald-100", avatarText: "text-emerald-700", hover: "hover:bg-emerald-100", ring: "focus:ring-emerald-200" },
    { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-600", avatarBg: "bg-sky-100", avatarText: "text-sky-700", hover: "hover:bg-sky-100", ring: "focus:ring-sky-200" },
    { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-600", avatarBg: "bg-teal-100", avatarText: "text-teal-700", hover: "hover:bg-teal-100", ring: "focus:ring-teal-200" },
    { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-600", avatarBg: "bg-orange-100", avatarText: "text-orange-700", hover: "hover:bg-orange-100", ring: "focus:ring-orange-200" },
    { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-600", avatarBg: "bg-cyan-100", avatarText: "text-cyan-700", hover: "hover:bg-cyan-100", ring: "focus:ring-cyan-200" },
    { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-600", avatarBg: "bg-rose-100", avatarText: "text-rose-700", hover: "hover:bg-rose-100", ring: "focus:ring-rose-200" },
    { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-600", avatarBg: "bg-indigo-100", avatarText: "text-indigo-700", hover: "hover:bg-indigo-100", ring: "focus:ring-indigo-200" },
    { bg: "bg-lime-50", border: "border-lime-200", text: "text-lime-600", avatarBg: "bg-lime-100", avatarText: "text-lime-700", hover: "hover:bg-lime-100", ring: "focus:ring-lime-200" },
  ]
  
  // 根据章节索引获取颜色（确保同一章节总是相同颜色）
  const getChapterColor = (chapterIndex: number) => {
    return chapterCardColors[chapterIndex % chapterCardColors.length]
  }
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

  const isVersionPage = currentChapterNum === 0 && hasVersionPage(bookId)
  const pageTitle = isVersionPage ? "版本说明" : (chapter?.title ?? "")
  const showContent = !loading && (chapter || isVersionPage)

  return (
    <div
      className={`h-screen flex flex-col bg-stone-50/60 transition-opacity duration-300 ease-out ${pageEntered ? "opacity-100" : "opacity-0"}`}
      aria-busy={!pageEntered}
    >
      {/* 主要内容区域 - 左右分栏，右侧宽度可拖拽 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：章节内容（宽度与聊天窗口同步过渡，拖拽时无动画） */}
        <div
          className="shrink-0 min-w-0 flex flex-col overflow-hidden border-r border-gray-200 bg-white relative"
          style={{
            width: isChatOpen ? `calc(100% - ${chatWidth}px - 6px)` : "100%",
            transition: isResizing ? "none" : "width 0.55s cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        >
          {/* 页面内导航：返回首页、标题、目录（章节信息在页脚） */}
          <div className="sticky top-0 z-10 max-w-[44rem] mx-auto w-full px-6 md:px-12 py-2 bg-white/95 backdrop-blur-sm border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={handleGoHome}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 -ml-2 shrink-0"
              >
                ← 返回首页
              </Button>
              {showContent && (
                <h1 
                  className="text-lg md:text-xl font-semibold text-gray-900 tracking-tight text-center leading-tight flex-1"
                  style={{ fontFamily: '"LXGW WenKai", "Noto Serif SC", serif' }}
                >
                  {isVersionPage ? "版本说明" : chapter?.title ?? ""}
                </h1>
              )}
              <Button
                variant="ghost"
                onClick={() => setShowToc(true)}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 shrink-0"
                title="目录"
                aria-label="目录"
              >
                <List className="h-4 w-4 mr-1" />
                目录
              </Button>
            </div>
          </div>
          <div ref={contentScrollRef} className="flex-1 overflow-y-auto min-h-0">
            {/* 内容区：正文或版本详情（全宽），切换时淡入淡出 */}
            <div className={`min-h-full flex items-center justify-center transition-opacity duration-200 ease-out ${contentTransitioning ? "opacity-0" : "opacity-100"}`}>
              {!showContent ? (
                <div className="flex items-center justify-center">
                  <span className="text-gray-500 text-sm">加载中...</span>
                </div>
              ) : (() => {
                // 获取当前章节的颜色
                const chapterColor = isVersionPage 
                  ? getChapterColor(0) 
                  : chapter 
                    ? getChapterColor(chapter.chapter) 
                    : chapterCardColors[0]
                
                return (
                  /* 正文内容：在页面中上下左右居中 */
                  <article className="read-content max-w-[42rem] w-full mx-auto px-5 md:px-10 py-6">
                      {isVersionPage ? (
                        /* 版本详情页 */
                        <div 
                          className="read-body select-text text-base md:text-lg leading-[1.5] md:leading-[1.55] text-gray-800 text-left w-full font-bold"
                          style={{ fontFamily: '"LXGW WenKai", "Noto Serif SC", serif', userSelect: 'text', WebkitUserSelect: 'text' }}
                        >
                          <div className="whitespace-pre-wrap space-y-1 md:space-y-1.5">{getBook(bookId)?.versionNote ?? ""}</div>
                        </div>
                      ) : chapter ? (
                        /* 章节正文 */
                        <div 
                          className="read-body select-text w-full text-gray-800"
                          style={{ fontFamily: '"LXGW WenKai", "Noto Serif SC", serif', userSelect: 'text', WebkitUserSelect: 'text' }}
                        >
                          <div className="space-y-1 md:space-y-1.5">
                            {chapter.content
                              .split('\n')
                              .filter(Boolean)
                              .map((line, i) => (
                                <p 
                                  key={i} 
                                  className="text-base md:text-lg leading-[1.5] md:leading-[1.55] text-gray-800 text-left tracking-normal font-bold"
                                >
                                  {line}
                                </p>
                              ))}
                          </div>
                        </div>
                      ) : null}
                  </article>
                )
              })()}
            </div>
          </div>
          {/* 页脚：始终在底部 */}
          <footer className="shrink-0 py-4 px-6 border-t border-gray-200 bg-white">
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
                        currentChapterNum === 0 ? "bg-amber-100 text-amber-900 font-medium" : "text-gray-700 hover:bg-amber-50"
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
                        currentChapterNum === ch.chapter ? "bg-amber-100 text-amber-900 font-medium" : "text-gray-700 hover:bg-amber-50"
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
                disabled={getPrevChapter(bookId, currentChapterNum) === null}
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
                disabled={getNextChapter(bookId, currentChapterNum) === null}
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

        {/* 拖拽条（带顺滑过渡） */}
        <div
          role="separator"
          aria-label="调整 AI 窗口宽度"
          onMouseDown={handleResizeStart}
          className={`shrink-0 flex flex-col items-center justify-center bg-gray-200 hover:bg-emerald-400 active:bg-emerald-500 cursor-col-resize select-none overflow-hidden ${
            isResizing ? "bg-emerald-500" : ""
          } ${isChatOpen ? "w-1.5" : "w-0 pointer-events-none"}`}
          style={{ transition: isResizing ? "none" : "width 0.55s cubic-bezier(0.25, 0.1, 0.25, 1)" }}
        >
          <div className="w-0.5 h-8 rounded-full bg-gray-400 group-hover:bg-white pointer-events-none shrink-0" />
        </div>

        {/* 右侧：AI 聊天窗口（translateX 滑入，更顺滑） */}
        <div
          className={`flex flex-col shrink-0 overflow-hidden ${!isChatOpen ? "pointer-events-none" : ""}`}
          style={{
            width: isChatOpen ? chatWidth : 0,
            minWidth: isChatOpen ? MIN_CHAT_WIDTH : 0,
            transition: isResizing ? "none" : "width 0.55s cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        >
          <div
            className="flex flex-col flex-1 min-w-0 h-full bg-white border-l border-gray-200"
            style={{
              width: chatWidth,
              minWidth: MIN_CHAT_WIDTH,
              transform: isChatOpen ? "translateX(0)" : "translateX(100%)",
              transition: isResizing ? "none" : "transform 0.55s cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
          >
            {/* 聊天标题 */}
            <div className="shrink-0 px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-700">AI 解读助手</h3>
                <p className="text-xs text-gray-500 mt-0.5">基于当前章节内容提问</p>
              </div>
              <div className="flex items-center gap-2">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsChatOpen(false)}
                  className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                  title="关闭聊天"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
                            ) : speechStatus === "processing" ? (
                              <div className="flex items-center gap-2 text-xs text-amber-600">
                                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                正在处理语音...
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
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col rounded-lg border border-gray-300 bg-white shadow-sm focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400/20 transition-all">
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
                    className="block w-full min-h-[44px] max-h-[120px] text-sm resize-none pt-2.5 px-3 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-gray-400"
                    rows={1}
                  />
                  <div className="flex items-center justify-end gap-1.5 p-1.5 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={handleVoiceToggle}
                      disabled={isLoadingChat || !sceneMeta || speechStatus === "processing"}
                      className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50 transition-colors"
                      title={speechStatus === "recording" ? "停止录音" : "语音输入"}
                    >
                      {speechStatus === "recording" ? (
                        <StopCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!inputText.trim() || isLoadingChat || !sceneMeta}
                      className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* 聊天窗口开关按钮（仅在关闭时显示，固定贴视口右边缘） */}
        {!isChatOpen && (
          <div className="fixed right-0 top-1/3 -translate-y-1/2 z-[100] flex justify-end pointer-events-none">
            <Button
              onClick={() => setIsChatOpen(true)}
              className="pointer-events-auto h-20 pl-5 pr-4 rounded-l-2xl rounded-r-none bg-gray-200/95 hover:bg-gray-300/95 text-gray-700 shadow-md border border-l border-gray-300/50 flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-[0.98]"
              title="打开 AI 助手"
            >
              <span className="shrink-0 w-20 h-20 flex items-center justify-center bg-transparent rounded overflow-hidden">
                <Image src="/icon_jingyu.png?v=whale" alt="" width={80} height={80} className="w-full h-full object-contain bg-transparent" aria-hidden unoptimized />
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
