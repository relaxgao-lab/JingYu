"use client"

import React, { useState, useEffect, useLayoutEffect, useRef } from "react"

const MOBILE_CHAT_KEY = "read-mobile-chat-open"
const READ_GUIDE_KEY = "read-guide-seen"
const CLEARED_FLAG = "__readPageClearedThisLoad"
/** 每次刷新只清一次；多实例时若 key 已是 "1"（用户刚点打开）则不再清 */
function clearMobileChatKeyOnce() {
  try {
    if (typeof window === "undefined") return
    const already = (window as unknown as Record<string, boolean>)[CLEARED_FLAG]
    if (already) {
      if (sessionStorage.getItem(MOBILE_CHAT_KEY) === "1") return
      sessionStorage.removeItem(MOBILE_CHAT_KEY)
      return
    }
    ;(window as unknown as Record<string, boolean>)[CLEARED_FLAG] = true
    sessionStorage.removeItem(MOBILE_CHAT_KEY)
  } catch {}
}

import Image from "next/image"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, HelpCircle, List, Mic, MessageSquare, Play, Send, StopCircle, Volume2, VolumeX, X, Type, Sparkles } from "lucide-react"
import { getChapter, getChapters, getTotalChapters, getNextChapter, getPrevChapter, hasChapter, hasVersionPage, getBook } from "@/lib/classics"
import { whisperSpeechService, type SpeechStatus } from "@/app/conversation/whisper-speech-service"
import { TTS_PROVIDER } from "@/config"
import { Chapter } from "@/app/read/types"
import { rareCharPronunciations, presetPrompts, presetColors, chapterCardColors, GUIDE_VIDEO_URL } from "../../constants"

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

  // 初始化时，如果章节数据已经可用，直接设置为 false，避免显示"加载中..."
  const initialChapterNum = parseInt(chapterParam || "1", 10)
  const initialIsVersionPage = bookId && initialChapterNum === 0 && hasVersionPage(bookId)
  const initialChapter = bookId && !initialIsVersionPage ? getChapter(bookId, initialChapterNum) : null
  // 如果章节数据已经准备好，或者章节号无效，不显示加载状态
  const initialLoading = bookId ? (initialChapter === null && !initialIsVersionPage) : true
  
  const [chapter, setChapter] = useState<Chapter | null>(initialChapter)
  const [totalChapters, setTotalChapters] = useState(() => bookId ? getTotalChapters(bookId) : 0)
  const [loading, setLoading] = useState(initialLoading)
  const [currentChapterNum, setCurrentChapterNum] = useState(initialChapterNum)
  
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

  // 选中的句子（用于点击高亮和深度解析）
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null)

  // 字体大小相关状态
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === "undefined") return 22
    try {
      const saved = localStorage.getItem("read-font-size")
      if (saved) {
        const n = parseInt(saved, 10)
        if (!isNaN(n) && n >= 12 && n <= 40) return n
      }
    } catch {}
    return 22
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("read-font-size", fontSize.toString())
    }
  }, [fontSize])

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
  const [isChapterChanging, setIsChapterChanging] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const lastChatWidthRef = useRef(chatWidth)
  const [showToc, setShowToc] = useState(false)
  // 首次进入阅读页引导浮层（仅未看过时显示）
  const [showReadGuide, setShowReadGuide] = useState(false)
  const [showVideoInGuide, setShowVideoInGuide] = useState(false)
  const readGuideCheckedRef = useRef(false)
  // 首帧与服务端一致，避免水合报错；挂载后再用 matchMedia 更新
  const [isMobile, setIsMobile] = useState(false)
  const [allowChatTransition, setAllowChatTransition] = useState(false)
  // 首帧统一为 false，避免服务端/客户端不一致；PC 在挂载后从 localStorage 恢复
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const prevRouteRef = useRef({ bookId: bookId ?? "", chapterParam: chapterParam ?? "" })
  const routeEffectRunRef = useRef(false)
  /** 刚从 localStorage 恢复为打开，本帧及下两帧不播过渡，避免切章后重播展开动画 */
  const justRestoredOpenRef = useRef(false)
  // 手机端：state 或（挂载后读 sessionStorage）任一为开则显示；PC 只认 isChatOpen；挂载前不读 session 防水合
  const effectiveChatOpen =
    isMobile
      ? (isChatOpen || (mounted && typeof window !== "undefined" && sessionStorage.getItem(MOBILE_CHAT_KEY) === "1"))
      : isChatOpen

  useLayoutEffect(() => {
    clearMobileChatKeyOnce()
  }, [])
  // PC：挂载后从 localStorage 恢复聊天开关；手机保持默认关。恢复时先关过渡+打标再setState；未恢复时再开过渡
  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    const isM = window.matchMedia("(max-width: 767px)").matches
    setIsMobile(isM)
    if (!isM) {
      try {
        const saved = localStorage.getItem("read-chat-open")
        if (saved !== "false") {
          setAllowChatTransition(false)
          justRestoredOpenRef.current = true
          setIsChatOpen(true)
          return
        }
      } catch {}
    }
    // 如果不恢复打开，则在两帧后开启过渡，确保后续手动点击有动画
    let raf1: number, raf2: number
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setAllowChatTransition(true)
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2 != null) cancelAnimationFrame(raf2)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  // 首次进入阅读页：内容加载完成后，若用户未看过引导，则显示浮层
  useEffect(() => {
    if (typeof window === "undefined" || !mounted || readGuideCheckedRef.current) return
    const contentReady = !loading && (chapter !== null || (currentChapterNum === 0 && bookId && hasVersionPage(bookId)))
    if (!contentReady) return
    readGuideCheckedRef.current = true
    try {
      if (localStorage.getItem(READ_GUIDE_KEY) !== "1") {
        setShowReadGuide(true)
      }
    } catch {}
  }, [mounted, loading, chapter, currentChapterNum, bookId])
  // 仅在「已渲染为打开」之后才在两帧后清 ref 并开过渡，避免 rAF 早于 React 提交导致“打开”帧带过渡
  useEffect(() => {
    if (!effectiveChatOpen || !justRestoredOpenRef.current) return
    let raf1: number, raf2: number
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        justRestoredOpenRef.current = false
        setAllowChatTransition(true)
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2 != null) cancelAnimationFrame(raf2)
    }
  }, [effectiveChatOpen])
  useLayoutEffect(() => {
    prevRouteRef.current = { bookId: bookId ?? "", chapterParam: chapterParam ?? "" }
  })

  // 切章时手机端关聊天；首屏/刷新时 effect 首 run 不关，避免“点打开后被打回”
  useEffect(() => {
    const isMobileWidth = typeof window !== "undefined" && window.innerWidth < 768
    const routeChanged =
      prevRouteRef.current.bookId !== (bookId ?? "") || prevRouteRef.current.chapterParam !== (chapterParam ?? "")
    const isRealNav = routeEffectRunRef.current
    routeEffectRunRef.current = true
    if (routeChanged && isMobileWidth && isRealNav) {
      try {
        sessionStorage.removeItem(MOBILE_CHAT_KEY)
      } catch {}
      setIsChatOpen(false)
    }
    if (routeChanged) {
      prevRouteRef.current = { bookId: bookId ?? "", chapterParam: chapterParam ?? "" }
    }
  }, [bookId, chapterParam])

  // 仅挂载后再写入，避免切章重挂载时先用初始 false 覆盖 localStorage 导致 PC 恢复不到“打开”
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return
    localStorage.setItem("read-chat-open", isChatOpen.toString())
  }, [mounted, isChatOpen])

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)")
    const update = () => {
      setIsMobile(mql.matches)
    }
    update()
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])

  const contentScrollRef = useRef<HTMLDivElement>(null)
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const [contentAreaWidth, setContentAreaWidth] = useState<number>(0)
  
  // 使用 sessionStorage 保存上一个章节参数，避免组件重新挂载时丢失
  const getPrevChapterParam = () => {
    if (typeof window === 'undefined') return undefined
    try {
      return sessionStorage.getItem('read-prev-chapter-param') || undefined
    } catch {
      return undefined
    }
  }
  
  const setPrevChapterParam = (param: string) => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem('read-prev-chapter-param', param)
    } catch {}
  }
  
  // 检查是否是章节切换（组件重新挂载时）
  const prevChapterParam = getPrevChapterParam()
  const isInitialChapterChange = prevChapterParam !== undefined && prevChapterParam !== chapterParam
  // 如果是章节切换，立即设置 pageEntered 为 true，避免闪屏
  const [pageEntered, setPageEntered] = useState(isInitialChapterChange || prevChapterParam === undefined)
  
  useEffect(() => {
    // 如果是章节切换或刷新页面，pageEntered 已经是 true，不需要动画
    if (isInitialChapterChange || prevChapterParam === undefined) {
      return
    }
    // 否则，正常初始化动画（仅用于首次加载）
    const t = requestAnimationFrame(() => {
      setPageEntered(true)
    })
    return () => cancelAnimationFrame(t)
  }, [])
  
  // 在章节切换时，立即设置 pageEntered 为 true，避免触发过渡动画
  useEffect(() => {
    if (isChapterChanging) {
      setPageEntered(true)
    }
  }, [isChapterChanging, chapterParam])

  // 使用 useLayoutEffect 同步更新，在浏览器绘制前完成，避免闪烁
  useLayoutEffect(() => {
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

    // 如果章节号相同且已有数据，跳过更新（避免不必要的重新渲染）
    // 但需要确保数据确实存在，如果 chapter 为 null 且不是版本页，需要重新加载
    if (num === currentChapterNum && chapter !== null) {
      // 确保 sceneMeta 已设置（刷新页面时可能未设置）
      if (!sceneMeta && chapter) {
        setSceneMeta({
          aiRole: "解读助手",
          userRole: "读者",
          context: `正在阅读《${bookId}》第${chapter.chapter}章：${chapter.title}`,
          scenario: "读者对当前章节内容有疑问或想深入了解"
        })
      }
      // 章节切换完成，恢复动画
      if (isChapterChanging) {
        setIsChapterChanging(false)
      }
      return
    }
    
    // 如果是版本页且章节号相同，也需要检查是否有版本说明
    // 但需要确保数据确实存在，如果版本说明不存在，需要重新加载
    if (num === currentChapterNum && isVersionPage) {
      const book = getBook(bookId)
      if (book?.versionNote) {
        // 如果已经有版本说明且不在加载状态，跳过更新
        if (!loading) {
          // 确保 sceneMeta 已设置（刷新页面时可能未设置）
          if (!sceneMeta) {
            setSceneMeta({
              aiRole: "解读助手",
              userRole: "读者",
              context: `正在阅读《${bookId}》的版本说明`,
              scenario: "读者对书籍的版本和背景感兴趣"
            })
          }
          // 章节切换完成，恢复动画
          if (isChapterChanging) {
            setIsChapterChanging(false)
          }
          return
        }
        // 如果正在加载，继续执行后面的逻辑来设置状态
      } else {
        // 如果没有版本说明，跳转到首页
        router.push('/')
        return
      }
    }

    // 使用 sessionStorage 来检测章节切换，因为组件重新挂载时 ref 会被重置
    const prevChapterParam = getPrevChapterParam()
    const isChanging = prevChapterParam !== undefined && prevChapterParam !== chapterParam
    
    const total = getTotalChapters(bookId)
    const book = getBook(bookId)

    // 同步更新状态，确保在浏览器绘制前完成
    // 关键：先设置loading=false和isChapterChanging，避免显示"加载中..."导致闪屏
    if (isVersionPage) {
      // 如果检测到切换，立即禁用动画
      if (isChanging) {
        setIsChapterChanging(true)
      }
      // 更新 sessionStorage（无论是否切换都要更新）
      setPrevChapterParam(chapterParam)
      setLoading(false)
      setCurrentChapterNum(0)
      setChapter(null)
      setTotalChapters(total)
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
        // 如果检测到切换，立即禁用动画
        if (isChanging) {
          setIsChapterChanging(true)
        }
        // 更新 sessionStorage（无论是否切换都要更新）
        setPrevChapterParam(chapterParam)
        setLoading(false)
        setChapter(ch)
        setCurrentChapterNum(num)
        setTotalChapters(total)
        setSceneMeta({
          aiRole: "解读助手",
          userRole: "读者",
          context: `正在阅读《${bookId}》第${ch.chapter}章：${ch.title}`,
          scenario: "读者对当前章节内容有疑问或想深入了解"
        })
      } else {
        // 如果章节不存在，跳转到首页
        router.push('/')
      }
    }
    
    // 章节切换完成，恢复动画（延迟到下一帧，确保DOM已更新）
    if (isChanging) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsChapterChanging(false)
        })
      })
    }
  }, [bookId, chapterParam, router, currentChapterNum, chapter, loading])

  // 监听内容区域宽度，用于决定是否显示导航按钮
  useEffect(() => {
    if (!contentAreaRef.current) return
    
    const updateWidth = () => {
      if (contentAreaRef.current) {
        setContentAreaWidth(contentAreaRef.current.offsetWidth)
      }
    }
    
    // 初始设置
    updateWidth()
    
    // 使用 ResizeObserver 监听宽度变化
    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(contentAreaRef.current)
    
    return () => {
      resizeObserver.disconnect()
    }
  }, [effectiveChatOpen, chatWidth, chapter, currentChapterNum])

  // 滚动操作单独处理，在内容渲染后执行
  useEffect(() => {
    if (!loading && (chapter || (currentChapterNum === 0 && hasVersionPage(bookId)))) {
      // 使用 setTimeout 0 确保在下一个事件循环执行，此时 DOM 已完全更新
      const timer = setTimeout(() => {
        contentScrollRef.current?.scrollTo({ top: 0, behavior: "instant" })
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [currentChapterNum, chapter, loading, bookId])

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
    setShowToc(false)
    // 标记正在切换章节，禁用过渡动画
    // 注意：这个状态会在组件重新挂载时丢失，所以useLayoutEffect中会重新设置
    setIsChapterChanging(true)
    router.push(`/read/${bookId}/${num}`)
    // 不再在这里重置isChapterChanging，因为组件会重新挂载
    // useLayoutEffect会在检测到章节切换时自动处理
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

  const handleSentenceClick = (sentence: string) => {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) return;
    
    // 如果点击的是当前已选中的，则取消选中
    if (selectedSentence === cleanSentence) {
      setSelectedSentence(null);
      return;
    }
    
    setSelectedSentence(cleanSentence);
  }

  const handleConfirmAnalysis = () => {
    if (!selectedSentence) return;
    
    // 确保 AI 窗口打开
    if (!effectiveChatOpen) {
      try {
        sessionStorage.setItem(MOBILE_CHAT_KEY, "1");
      } catch {}
      setIsChatOpen(true);
    }
    
    // 发送深度解析指令
    sendMessage(`请深度解析这一段经文：\n“${selectedSentence}”`);
    
    // 解析后立即清除选中状态，隐藏工具条
    setSelectedSentence(null);
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
  const fontSizeColor = presetColors[3]
  // 根据书籍篇幅动态调整快捷按钮文案
  const isFullText = totalChapters <= 1
  const dynamicPresetPrompts = presetPrompts.map(p => {
    return {
      ...p,
      // 保持原始简洁标签，范围通过上方的 Badge 体现
      label: p.label,
      text: isFullText ? p.text.replace('这一章', '整篇经文').replace('本章', '整篇经文') : p.text
    }
  })

  const handlePreset = (text: string) => {
    if (!sceneMeta || isLoadingChat || speechStatus === "recording" || speechStatus === "processing") return
    sendMessage(text)
  }

  // 将标题中的中文数字转换为阿拉伯数字
  const formatTitleWithArabicNumbers = (title: string, chapterNum: number): string => {
    // 如果标题格式是"第X章"（X为中文数字），直接用阿拉伯数字替换
    // 匹配：第 + 中文数字 + 章
    const chineseNumberPattern = /第[零一二三四五六七八九十百千万]+章/
    if (chineseNumberPattern.test(title)) {
      return title.replace(chineseNumberPattern, `第${chapterNum}章`)
    }
    return title
  }

  // 为文本中的生僻字添加读音标注（使用 HTML ruby 标签）
  const addPronunciationAnnotations = (text: string): string => {
    let result = text
    // 遍历所有生僻字，为每个字添加读音标注
    Object.keys(rareCharPronunciations).forEach(char => {
      const pronunciation = rareCharPronunciations[char]
      // 使用 ruby 标签添加读音标注
      const regex = new RegExp(char, 'g')
      result = result.replace(regex, `<ruby>${char}<rt>${pronunciation}</rt></ruby>`)
    })
    return result
  }

  // 格式化版本说明文本，提升排版美感
  const formatVersionNote = (text: string): string => {
    if (!text) return ""
    
    // 添加读音标注
    let formatted = addPronunciationAnnotations(text)
    
    // 识别三个理由的编号，添加视觉层次
    formatted = formatted
      .replace(/一、/g, '<div class="version-reason-item"><p class="version-reason-title">一、</p><p class="version-reason-content">')
      .replace(/二、/g, '</p></div><div class="version-reason-item"><p class="version-reason-title">二、</p><p class="version-reason-content">')
      .replace(/三、/g, '</p></div><div class="version-reason-item"><p class="version-reason-title">三、</p><p class="version-reason-content">')
    
    // 包装开头段落
    if (!formatted.startsWith('<div')) {
      formatted = '<p class="version-intro">' + formatted
    }
    
    // 将长段落按句号分割，添加段落间距
    formatted = formatted.replace(/。/g, '。</p><p class="version-paragraph">')
    
    // 添加闭合标签
    if (formatted.includes('三、')) {
      formatted += '</p></div>'
    } else {
      formatted += '</p>'
    }
    
    return formatted
  }

  const isVersionPage = currentChapterNum === 0 && hasVersionPage(bookId)
  const pageTitle = isVersionPage 
    ? "版本说明" 
    : (chapter?.title ? formatTitleWithArabicNumbers(chapter.title, currentChapterNum) : "")
  const showContent = !loading && (chapter !== null || isVersionPage)

  return (
    <div
      className={`h-screen flex flex-col bg-stone-50/60 ${pageEntered && !isChapterChanging ? "transition-opacity duration-300 ease-out" : ""} ${pageEntered ? "opacity-100" : "opacity-0"}`}
      aria-busy={!pageEntered}
    >
      {/* 首次进入阅读页引导浮层 */}
      {showReadGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowReadGuide(false)}
            aria-hidden
          />
          <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full p-6 animate-[fadeIn_0.2s_ease-in-out_forwards]">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">新手指南</h3>
            <ol className="space-y-3 text-sm text-gray-600 mb-4 list-decimal list-inside">
              <li>点击 <span className="inline-flex align-middle"><Image src="/icon_main_JingYun.png" alt="经鱼" width={20} height={20} className="object-contain" unoptimized /></span> 图标打开AI助手，使用「讲解」「大意」等快捷提问</li>
              <li>或点击经文句子请求深度解析</li>
            </ol>
            {GUIDE_VIDEO_URL && (
              <div className="mb-6">
                {!showVideoInGuide ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVideoInGuide(true)}
                    className="w-full justify-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    观看视频教程
                  </Button>
                ) : (
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-black aspect-video">
                    {(() => {
                      const url: string = GUIDE_VIDEO_URL
                      const bvidMatch = url.match(/BV[\w]+/)
                      const bvid = bvidMatch ? bvidMatch[0] : (url.startsWith("BV") ? url : null)
                      return bvid ? (
                        <iframe
                          src={`https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1`}
                          title="经鱼使用教程"
                          className="w-full h-full"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={url}
                          controls
                          autoPlay
                          className="w-full h-full"
                        />
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReadGuide(false)}
                className="text-gray-600"
              >
                我知道了
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  try {
                    localStorage.setItem(READ_GUIDE_KEY, "1")
                  } catch {}
                  setShowReadGuide(false)
                }}
              >
                不再提示
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 主要内容区域 - 左右分栏，右侧宽度可拖拽 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：章节内容（宽度与聊天窗口同步过渡，拖拽时无动画） */}
        <div
          ref={contentAreaRef}
          className="shrink-0 min-w-0 flex flex-col overflow-hidden border-r border-gray-200 bg-white relative w-full md:w-auto"
          style={{
            width: isMobile ? "100%" : effectiveChatOpen ? `calc(100% - ${chatWidth}px - 6px)` : "100%",
            transition: isMobile || !allowChatTransition || isResizing || isChapterChanging || justRestoredOpenRef.current ? "none" : "width 0.55s cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        >
          {/* 页面内导航：返回首页、标题、目录（章节信息在页脚） */}
          <div className="sticky top-0 z-10 max-w-[44rem] lg:max-w-[52rem] xl:max-w-[60rem] 2xl:max-w-[68rem] mx-auto w-full px-4 md:px-12 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] bg-white/95 backdrop-blur-sm border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={handleGoHome}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 -ml-2 shrink-0 min-h-[44px] touch-manipulation"
              >
                ← 返回首页
              </Button>
              {showContent && (
                <div className="flex-1 min-w-0 flex flex-col items-center">
                  <h1 
                    className="text-base md:text-xl lg:text-2xl xl:text-[1.75rem] font-semibold text-gray-900 tracking-tight text-center leading-tight truncate w-full"
                    style={{ fontFamily: '"LXGW WenKai", "Noto Serif SC", serif' }}
                  >
                    {pageTitle}
                  </h1>
                  <p className="text-[10px] md:text-xs text-amber-600/80 font-medium mt-0.5 animate-pulse">
                    提示：点击经文段落可选中并进行深度解析
                  </p>
                </div>
              )}
              <div className="flex items-center gap-1 md:gap-2 shrink-0">
                {/* PC端字体调整 - 放在Header右侧 */}
                {!isMobile && (
                  <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5 mr-1 border border-gray-200">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
                      className="h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-white/50 rounded-md"
                      title="减小字体"
                    >
                      <span className="text-xs font-bold">A-</span>
                    </Button>
                    <div className="w-px h-3.5 bg-gray-300 mx-0.5"></div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFontSize(prev => Math.min(40, prev + 2))}
                      className="h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-white/50 rounded-md"
                      title="增大字体"
                    >
                      <span className="text-sm font-bold">A+</span>
                    </Button>
                  </div>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowVideoInGuide(false)
                    setShowReadGuide(true)
                  }}
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 shrink-0 min-h-[44px] touch-manipulation"
                  title="新手指南"
                  aria-label="新手指南"
                >
                  <HelpCircle className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">新手指南</span>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowToc(true)}
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 shrink-0 min-h-[44px] touch-manipulation"
                  title="目录"
                  aria-label="目录"
                >
                  <List className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">目录</span>
                </Button>
              </div>
            </div>
          </div>
          <div ref={contentScrollRef} className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
            {/* 内容区：正文或版本详情（全宽），移除过渡动画避免闪动 */}
            {/* 调整为中间偏上布局：使用 padding-bottom 让内容在视觉上更靠上 */}
            <div className="min-h-full flex flex-col items-center pt-8 md:pt-12 pb-32">
              {!showContent ? (
                <div className="flex items-center justify-center py-20 min-h-[60vh]">
                  <span className="text-gray-500 text-sm">加载中...</span>
                </div>
              ) : (
                <>
                  {/* 正文内容：不设置最小高度，让短内容自然居中显示，响应式宽度，为导航按钮留出空间 */}
                  <article className="read-content max-w-[42rem] lg:max-w-[50rem] xl:max-w-[58rem] 2xl:max-w-[66rem] w-full mx-auto py-6 md:py-8 px-4 md:px-0 pb-24 md:pb-8" style={{ paddingLeft: isMobile ? 'max(1rem, env(safe-area-inset-left, 1rem))' : contentAreaWidth > 700 ? '4rem' : contentAreaWidth > 600 ? '3.5rem' : contentAreaWidth > 550 ? '3rem' : '2rem', paddingRight: isMobile ? 'max(1rem, env(safe-area-inset-right, 1rem))' : contentAreaWidth > 700 ? '4rem' : contentAreaWidth > 600 ? '3.5rem' : contentAreaWidth > 550 ? '3rem' : '2rem' }}>
                      {isVersionPage ? (
                        <>
                          {/* 版本详情页 - 居中显示，优化排版 */}
                          <div 
                            className="read-body select-text text-left w-full"
                            style={{ 
                              fontFamily: '"LXGW WenKai", "Noto Serif SC", serif', 
                              userSelect: 'text', 
                              WebkitUserSelect: 'text', 
                              letterSpacing: '0.08em',
                              fontSize: `${mounted ? fontSize : 22}px`,
                              lineHeight: 1.6
                            }}
                          >
                            <div 
                              className="version-note-content"
                              dangerouslySetInnerHTML={{ 
                                __html: formatVersionNote(getBook(bookId)?.versionNote ?? "") 
                              }}
                            />
                          </div>
                        </>
                      ) : chapter ? (
                        <>
                          {/* 章节正文 - 居中显示，适合短篇内容 */}
                          <div 
                            className="read-body select-text w-full text-gray-800"
                            style={{ fontFamily: '"LXGW WenKai", "Noto Serif SC", serif', userSelect: 'text', WebkitUserSelect: 'text' }}
                          >
                            <div className="space-y-4">
                              {chapter.content
                                .split('\n')
                                .filter(Boolean)
                                .map((line, i) => {
                                  const annotatedLine = addPronunciationAnnotations(line)
                                  const isSelected = selectedSentence === line.trim()
                                  return (
                                    <div
                                      key={i}
                                      onClick={() => handleSentenceClick(line)}
                                      className={`group relative cursor-pointer transition-all duration-300 rounded-xl p-3 -mx-3 border border-transparent hover:bg-amber-50/80 hover:border-amber-100 ${isSelected ? "bg-amber-100/90 shadow-sm ring-1 ring-amber-200 border-amber-200" : ""}`}
                                    >
                                      {/* 左侧装饰条，提示可点击 */}
                                      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-amber-200/50 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? "opacity-100 bg-amber-500" : ""}`} />
                                      
                                      <p 
                                        className="leading-[1.6] lg:leading-[1.7] text-gray-800 text-left font-bold"
                                        style={{ letterSpacing: '0.08em', fontSize: `${mounted ? fontSize : 22}px` }}
                                        dangerouslySetInnerHTML={{ __html: annotatedLine }}
                                      />
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>null</>
                      )}
                  </article>
                </>
              )}
            </div>
          </div>
          {/* 页脚：始终在底部；移动端增加上一章/下一章导航 */}
          <footer className="shrink-0 py-4 px-4 md:px-6 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-200 bg-white max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-20">
            <div className="max-w-[44rem] lg:max-w-[52rem] xl:max-w-[60rem] 2xl:max-w-[68rem] mx-auto">
              {/* 移动端：上一章 / 下一章 按钮 */}
              <div className="flex md:hidden items-center justify-center gap-3 mb-3">
                <Button
                  onClick={handlePrevChapter}
                  disabled={getPrevChapter(bookId, currentChapterNum) === null}
                  variant="outline"
                  size="sm"
                  className={`rounded-full border shadow-sm min-h-[44px] px-5 touch-manipulation ${navPrevColor.bg} ${navPrevColor.border} ${navPrevColor.text} ${navPrevColor.hover} disabled:opacity-50`}
                  aria-label="上一章"
                >
                  <ChevronLeft className="h-5 w-5 mr-0.5" />
                  上一章
                </Button>
                
                {/* 移动端字体调整 */}
                <div className="flex items-center bg-gray-100 rounded-full p-1 border border-gray-200">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
                    className="h-9 w-9 text-gray-600 hover:text-gray-900 rounded-full"
                    title="减小字体"
                  >
                    <span className="text-xs font-bold">A-</span>
                  </Button>
                  <div className="w-px h-4 bg-gray-300 mx-1"></div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFontSize(prev => Math.min(40, prev + 2))}
                    className="h-9 w-9 text-gray-600 hover:text-gray-900 rounded-full"
                    title="增大字体"
                  >
                    <span className="text-sm font-bold">A+</span>
                  </Button>
                </div>

                <Button
                  onClick={handleNextChapter}
                  disabled={getNextChapter(bookId, currentChapterNum) === null}
                  variant="outline"
                  size="sm"
                  className={`rounded-full border shadow-sm min-h-[44px] px-5 touch-manipulation ${navNextColor.bg} ${navNextColor.border} ${navNextColor.text} ${navNextColor.hover} disabled:opacity-50`}
                  aria-label="下一章"
                >
                  下一章
                  <ChevronRight className="h-5 w-5 ml-0.5" />
                </Button>
              </div>
              <div className="text-center">
                <span className="text-xs md:text-sm text-gray-500 tracking-widest">
                  {pageTitle} / 共{totalChapters}章
                </span>
              </div>
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
          {/* 悬浮箭头：仅桌面端显示；移动端用页脚导航 */}
          {!isMobile && contentAreaWidth > 550 && (
            <>
              <div className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <div className="pointer-events-auto flex flex-col gap-4 items-center">
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
              <div className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
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
            </>
          )}
        </div>

        {/* 拖拽条：仅桌面端 */}
        <div
          role="separator"
          aria-label="调整 AI 窗口宽度"
          onMouseDown={handleResizeStart}
          className={`hidden md:flex shrink-0 flex-col items-center justify-center bg-gray-200 hover:bg-emerald-400 active:bg-emerald-500 cursor-col-resize select-none overflow-hidden ${
            isResizing ? "bg-emerald-500" : ""
          } ${effectiveChatOpen ? "w-1.5" : "w-0 pointer-events-none"}`}
          style={{ transition: isMobile || !allowChatTransition || isResizing || isChapterChanging || justRestoredOpenRef.current ? "none" : "width 0.55s cubic-bezier(0.25, 0.1, 0.25, 1)" }}
        >
          <div className="w-0.5 h-8 rounded-full bg-gray-400 group-hover:bg-white pointer-events-none shrink-0" />
        </div>

        {/* 右侧：AI 聊天窗口；移动端固定从右滑入/滑出，仅用 transform 控制，无遮罩 */}
        <div
          className={`flex flex-col shrink-0 overflow-hidden ${!effectiveChatOpen ? "pointer-events-none" : ""} max-md:fixed max-md:inset-0 max-md:z-50 max-md:flex max-md:flex-col ${
            effectiveChatOpen ? "max-md:flex" : "max-md:pointer-events-none"
          } max-md:bg-transparent`}
          style={{
            width: isMobile ? "100%" : effectiveChatOpen ? chatWidth : 0,
            minWidth: isMobile ? "100%" : effectiveChatOpen ? MIN_CHAT_WIDTH : 0,
            transition: isMobile || !allowChatTransition || isResizing || isChapterChanging || justRestoredOpenRef.current ? "none" : "width 0.55s cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        >
          <div
            className={`flex flex-col flex-1 min-w-0 h-full bg-white border-l border-gray-200 max-md:w-full max-md:min-w-0 max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)] max-md:shadow-[-4px_0_20px_rgba(0,0,0,0.08)] ${!effectiveChatOpen ? "max-md:translate-x-full max-md:invisible" : "max-md:translate-x-0 max-md:visible"}`}
            style={{
              width: isMobile ? "100%" : (mounted ? chatWidth : DEFAULT_CHAT_WIDTH),
              minWidth: isMobile ? 0 : (mounted ? MIN_CHAT_WIDTH : DEFAULT_CHAT_WIDTH),
              transform: effectiveChatOpen ? "translateX(0)" : "translateX(100%)",
              transition: isMobile || !allowChatTransition || isResizing || isChapterChanging || justRestoredOpenRef.current ? "none" : "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
          >
            {/* 聊天标题：移动端加大关闭按钮触控区 */}
            <div className="shrink-0 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-700">AI 解读助手</h3>
                <p className="text-xs text-gray-500 mt-0.5">基于{isFullText ? '整篇经文' : '当前章节'}内容提问</p>
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
                  onClick={() => {
                    try {
                      sessionStorage.removeItem(MOBILE_CHAT_KEY)
                    } catch {}
                    setIsChatOpen(false)
                  }}
                  className="h-10 w-10 md:h-8 md:w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md touch-manipulation"
                  title="关闭聊天"
                  aria-label="关闭聊天"
                >
                  <X className="h-5 w-5 md:h-4 md:w-4" />
                </Button>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-sm text-gray-500 mt-8 space-y-3">
                  <p className="font-medium">有什么问题想了解吗？</p>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
                    <p>💡 <b>新功能提示：</b></p>
                    <p className="mt-1">你可以直接<b>点击页面的经文段落</b>，我会针对你选中的内容进行深度解析。或者直接点击以下快捷按钮</p>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {msg.role === "user" && (
                    <div
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-violet-500 text-white"
                    >
                      我
                    </div>
                  )}
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
              <div className="flex flex-wrap gap-x-3 gap-y-3 pt-1">
                {dynamicPresetPrompts.map((p, i) => {
                  const c = presetColors[i % presetColors.length]
                  return (
                    <Button
                      key={p.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!sceneMeta || isLoadingChat || speechStatus === "recording" || speechStatus === "processing"}
                      onClick={() => handlePreset(p.text)}
                      className={`relative text-xs h-9 px-4 rounded-xl border ${c.bg} ${c.border} ${c.text} ${c.hover} disabled:opacity-50 transition-all`}
                    >
                      {/* 按钮上的微型标签 */}
                      <span className={`absolute -top-2 -right-1.5 px-1.5 py-0.5 rounded-md border text-[8px] font-bold shadow-sm scale-90 z-10 ${
                        isFullText 
                          ? 'bg-blue-50 text-blue-600 border-blue-200' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      }`}>
                        {isFullText ? '全文' : '本章'}
                      </span>
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
        {!effectiveChatOpen && (
          <div className="fixed right-0 z-[100] flex justify-end pointer-events-none top-1/2 -translate-y-1/2 md:top-1/3 md:-translate-y-1/2 max-md:top-auto max-md:translate-y-0 max-md:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+90px)]">
            <Button
              onClick={() => {
                try {
                  sessionStorage.setItem(MOBILE_CHAT_KEY, "1")
                } catch {}
                setIsChatOpen(true)
              }}
              className="pointer-events-auto h-14 w-14 md:h-20 md:pl-5 md:pr-4 md:w-auto rounded-l-2xl rounded-r-none bg-gray-200/95 hover:bg-gray-300/95 text-gray-700 shadow-md border border-l border-gray-300/50 flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-[0.98] touch-manipulation min-h-[48px]"
              title="打开 AI 助手"
              aria-label="打开 AI 助手"
            >
              <span className="shrink-0 w-12 h-12 md:w-20 md:h-20 flex items-center justify-center bg-transparent rounded overflow-hidden">
                <Image src="/icon_jingyu.png?v=whale" alt="" width={80} height={80} className="w-full h-full object-contain bg-transparent" aria-hidden unoptimized />
              </span>
            </Button>
          </div>
        )}

        {/* 选中经文后的浮动操作条 (移动端 & PC 通用) */}
        {selectedSentence && (
          <div className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+60px)] left-1/2 -translate-x-1/2 z-[110] w-[92%] max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white/95 backdrop-blur-md border border-amber-200 shadow-xl rounded-2xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-amber-600 font-medium mb-0.5">已选中经文</p>
                <p className="text-xs text-gray-700 truncate font-bold italic">“{selectedSentence}”</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedSentence(null)}
                  className="h-9 px-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl"
                >
                  取消
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleConfirmAnalysis}
                  className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm flex items-center gap-1.5 font-bold"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  深度解析
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
