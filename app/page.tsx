"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { hasVersionPage, getBook } from "@/lib/classics"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import OlarkChat from '@/components/ui/OlarkChat'

interface SceneMeta {
  aiRole: string
  userRole: string
  context: string
  scenario: string
}

// 左侧：道德经
const leftClassic = [
  { label: "道德经", value: "《道德经》，老子著，道家哲学核心经典", intro: "道家哲学核心经典" },
]

// 右侧：金刚经
const rightClassic = [
  { label: "金刚经", value: "《金刚经》，大乘佛教重要经典", intro: "大乘佛教重要经典" },
]

// 底部：其余所有经典（包括心经）
const bottomClassics = [
  // 心经
  { label: "心经", value: "《心经》，佛教核心经典", intro: "佛教核心经典" },
  // 道教经典（去掉道德经）
  { label: "南华经", value: "《南华经》（庄子），道家重要经典", intro: "道家重要经典" },
  { label: "冲虚真经", value: "《冲虚真经》（列子），道家经典", intro: "道家经典" },
  { label: "文始真经", value: "《文始真经》（关尹子），道家经典", intro: "道家经典" },
  { label: "通玄真经", value: "《通玄真经》（文子），道家经典", intro: "道家经典" },
  { label: "黄庭经", value: "《黄庭经》，道教养生经典", intro: "道教养生经典" },
  { label: "阴符经", value: "《阴符经》，道教重要经典", intro: "道教重要经典" },
  { label: "清静经", value: "《清静经》（常清静经），道教经典", intro: "道教经典" },
  { label: "太上感应篇", value: "《太上感应篇》，道教劝善经典", intro: "道教劝善经典" },
  { label: "抱朴子", value: "《抱朴子》，道教重要经典", intro: "道教重要经典" },
  // 佛教经典（去掉金刚经）
  { label: "六祖坛经", value: "《六祖坛经》，禅宗重要经典", intro: "禅宗重要经典" },
  // 其他经典
  { label: "孙子兵法", value: "《孙子兵法》，兵家经典", intro: "兵家经典" },
  { label: "黄帝内经", value: "《黄帝内经》，医学经典", intro: "医学经典" },
]

// 参考 EnglishAI 的 pastel 卡片配色（每张卡片不同柔和色）
const pastelCards = [
  { bg: "bg-slate-100", border: "border-slate-200", ring: "focus:ring-slate-300", avatar: "bg-slate-200 text-slate-700" },
  { bg: "bg-violet-100", border: "border-violet-200", ring: "focus:ring-violet-300", avatar: "bg-violet-200 text-violet-700" },
  { bg: "bg-pink-100", border: "border-pink-200", ring: "focus:ring-pink-300", avatar: "bg-pink-200 text-pink-700" },
  { bg: "bg-amber-100", border: "border-amber-200", ring: "focus:ring-amber-300", avatar: "bg-amber-200 text-amber-800" },
  { bg: "bg-emerald-100", border: "border-emerald-200", ring: "focus:ring-emerald-300", avatar: "bg-emerald-200 text-emerald-700" },
  { bg: "bg-sky-100", border: "border-sky-200", ring: "focus:ring-sky-300", avatar: "bg-sky-200 text-sky-700" },
  { bg: "bg-teal-100", border: "border-teal-200", ring: "focus:ring-teal-300", avatar: "bg-teal-200 text-teal-700" },
  { bg: "bg-orange-100", border: "border-orange-200", ring: "focus:ring-orange-300", avatar: "bg-orange-200 text-orange-700" },
  { bg: "bg-cyan-100", border: "border-cyan-200", ring: "focus:ring-cyan-300", avatar: "bg-cyan-200 text-cyan-700" },
]

// 底部区域书籍封面图片数组
const bottomCoverImages = [
  '/cover_book-1.jpg',
  '/cover_book-2.jpg',
  '/cover_book-3.jpg',
  '/cover_book-4.jpg',
  '/cover_book-5.jpg',
]

// 书籍名称到ID的映射
const bookNameToId: Record<string, string> = {
  '道德经': 'daodejing',
  '金刚经': 'jingangjing',
  '心经': 'xinjing',
  '南华经': 'nanhuajing',
  '冲虚真经': 'chongxuzhenjing',
  '文始真经': 'wenshizhenjing',
  '通玄真经': 'tongxuanzhenjing',
  '黄庭经': 'huangtingjing',
  '阴符经': 'yinfujing',
  '清静经': 'qingjingjing',
  '太上感应篇': 'taishangganyingpian',
  '抱朴子': 'baopuzi',
  '六祖坛经': 'liuzutanjing',
  '孙子兵法': 'sunzibingfa',
  '黄帝内经': 'huangdineijing',
}

export default function HomePage() {
  const router = useRouter()
  const [scenario, setScenario] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [comingSoonMessage, setComingSoonMessage] = useState<string | null>(null)
  const bottomStripRef = useRef<HTMLDivElement>(null)
  const [bottomStripPaused, setBottomStripPaused] = useState(false)

  useEffect(() => {
    let touchStartY = 0
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }
    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      if (touchY > touchStartY && scrollTop === 0) {
        e.preventDefault()
      }
    }
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  useEffect(() => {
    if (bottomStripRef.current && !bottomStripPaused) {
      const el = bottomStripRef.current
      const step = 1
      const interval = setInterval(() => {
        if (!el || bottomStripPaused) return
        const segmentWidth = el.scrollWidth / 2
        if (segmentWidth <= 0) return
        el.scrollLeft += step
        if (el.scrollLeft >= segmentWidth - step) el.scrollLeft -= segmentWidth
      }, 30)
      return () => clearInterval(interval)
    }
  }, [bottomStripPaused])


  // 处理阅读经典（跳转到阅读页；有版本详情页的书籍先进入第 0 页）
  const handleReadClassic = (bookId: string) => {
    const startChapter = hasVersionPage(bookId) ? 0 : 1
    router.push(`/read/${bookId}/${startChapter}`)
  }

  // 处理书籍点击：检查是否有内容，有则跳转阅读页，无则显示提示
  const handleBookClick = (bookName: string) => {
    const bookId = bookNameToId[bookName]
    if (!bookId) {
      setComingSoonMessage(`${bookName} 内容正在制作中`)
      setTimeout(() => setComingSoonMessage(null), 3000)
      return
    }
    
    const book = getBook(bookId)
    if (book) {
      // 有内容，跳转到阅读页
      handleReadClassic(bookId)
    } else {
      // 无内容，显示提示
      setComingSoonMessage(`${bookName} 内容正在制作中`)
      setTimeout(() => setComingSoonMessage(null), 3000)
    }
  }

  const handleStartScenario = async (override?: string) => {
    const toUse = (override ?? scenario).trim()
    if (!toUse) return
    // 点击卡片时不更新输入框，只使用传入的值
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const resp = await fetch("/api/scene-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: toUse }),
      })
      const data = await resp.json()
      if (data?.aiRole && data?.userRole && data?.context) {
        const sceneMeta: SceneMeta = {
          aiRole: data.aiRole,
          userRole: data.userRole,
          context: data.context,
          scenario: toUse,
        }
        // 保存状态到 localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('converse-sages-state', JSON.stringify({
            sceneMeta,
            messages: [],
            scenario: toUse,
            isSpeechEnabled: true,
          }))
        }
        // 跳转到对话页面
        router.push('/chat')
      } else {
        setErrorMessage("AI returned incomplete data")
      }
    } catch {
      setErrorMessage("Failed to get scene meta")
    } finally {
      setIsLoading(false)
    }
  }

  // 离开首页时隐藏 OlarkChat
  useEffect(() => {
    return () => {
      // 组件卸载时隐藏 Olark 聊天框
      if (typeof window !== 'undefined' && (window as any).olark) {
        try {
          (window as any).olark('api.box.hide')
        } catch (e) {
          console.warn('Failed to hide Olark:', e)
        }
      }
    }
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <OlarkChat/>
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm flex justify-between items-center shrink-0">
          {errorMessage}
          <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)}>关闭</Button>
        </div>
      )}
      {comingSoonMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 半透明背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-[fadeIn_0.2s_ease-in-out_forwards]"
            onClick={() => setComingSoonMessage(null)}
          ></div>
          {/* 浮窗内容 */}
          <div className="relative bg-white border border-gray-200 text-gray-700 px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 animate-[fadeIn_0.2s_ease-in-out_forwards]">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium">{comingSoonMessage}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setComingSoonMessage(null)}
              className="h-6 w-6 p-0 hover:bg-gray-100 rounded"
            >
              ×
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 bg-white overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* 主内容 + 底部横条（主内容块拉满剩余高度，主行内容靠底） */}
        <div className="flex-1 flex flex-col min-h-0 w-full pt-[max(1rem,env(safe-area-inset-top))]">
        {/* 主行：手机端简单垂直堆叠占用剩余空间，桌面端 grid 三列 */}
        <div className="flex-1 flex flex-col justify-end md:grid md:grid-cols-[280px_1fr_280px] md:gap-8 w-full max-w-7xl mx-auto px-3 md:px-6 md:items-center md:py-4 min-h-0">
          {/* 左：道德经 */}
          <div className="order-2 md:order-1 flex md:flex md:justify-end items-center md:items-stretch overflow-x-auto md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-3 px-3 md:mx-0 md:px-0 mb-2 md:mb-0">
            {leftClassic.map((s, i) => {
              const p = pastelCards[i % pastelCards.length]
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleReadClassic('daodejing')}
                  disabled={isLoading}
                  className="relative flex items-center justify-center shrink-0 w-[200px] h-[320px] md:w-[260px] md:h-[420px] rounded-r-lg md:rounded-r-xl border-t-2 border-r-2 border-b-2 border-gray-300 hover:shadow-2xl hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-60 transition-all touch-manipulation overflow-hidden"
                  aria-label={`读${s.label}`}
                  style={{
                    backgroundImage: "url('/cover_daodejing.jpg')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: '12px 8px 20px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.08), inset -2px 0 8px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* 书脊 */}
                  <div className="absolute left-0 top-0 bottom-0 w-3 md:w-4 bg-gradient-to-b from-gray-600 via-gray-500 to-gray-600 rounded-l-lg shadow-inner">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/20 via-transparent to-white/20"></div>
                  </div>
                  
                  {/* 封面装饰边框 */}
                  <div className="absolute inset-2 md:inset-3 border border-gray-400/30 rounded-lg pointer-events-none"></div>
                  
                  {/* 书名竖排居中 */}
                  <div className="relative z-10 flex items-center justify-center">
                    <span 
                      className="text-2xl md:text-4xl font-bold text-gray-900 tracking-wider"
                      style={{ 
                        fontFamily: 'serif',
                        writingMode: 'vertical-rl',
                        textOrientation: 'upright',
                        letterSpacing: '0.2em'
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* 中：标语 + 标题 + 副标题 + 输入区（一组，紧凑层级） */}
          <section className="order-1 md:order-2 shrink-0 flex flex-col items-center justify-center text-center px-3 md:px-4 mb-3 md:mb-0 w-full">
            {/* 上方标语：两行紧贴 */}
            <div className="flex flex-col gap-1 mb-3 md:mb-4">
              <p className="text-3xl md:text-5xl text-gray-500 font-medium tracking-wide">经鱼·心随经转</p>
              <p className="text-base md:text-base text-gray-400 leading-relaxed">点击书籍，开始阅读</p>
            </div>
            {/* 主标题：有设计感的层次 */}
            <div className="flex flex-col gap-2 md:gap-2.5 mb-4 md:mb-5">
           
              <div className="flex items-center justify-center gap-2 mt-1">
                <div className="h-px w-8 md:w-12 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                <p className="text-sm md:text-base text-gray-600 font-medium tracking-wide">AI让你成为自己的老师，与你读经，读懂自己</p>
                <div className="h-px w-8 md:w-12 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              </div>
            </div>
            {/* 输入区 */}
            <div className="w-full max-w-xs flex flex-col gap-2 md:gap-2.5 relative">
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Input
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  placeholder="如：道德经、金刚经、心经..."
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return
                    if (scenario.trim()) handleStartScenario()
                  }}
                  disabled={isLoading}
                  className="rounded-lg border-gray-200 bg-white text-base md:text-base h-10 md:h-11 focus-visible:ring-0 focus-visible:outline-none"
                />
                <Button
                  onClick={() => handleStartScenario()}
                  disabled={isLoading || !scenario.trim()}
                  className="rounded-lg shrink-0 px-5 md:px-6 h-10 md:h-11 text-sm md:text-base font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  开始
                </Button>
              </div>
              {/* 悬浮提示 */}
              {isLoading && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ease-in-out animate-[fadeIn_0.2s_ease-in-out_forwards,slideUp_0.2s_ease-in-out_forwards]">
                  <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                    <span>生成场景中...</span>
                  </div>
                  {/* 小三角箭头 */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          </section>

          {/* 右：金刚经 */}
          <div className="order-3 flex md:flex md:justify-start items-center md:items-stretch overflow-x-auto md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-3 px-3 md:mx-0 md:px-0">
            {rightClassic.map((s, i) => {
              const p = pastelCards[(i + 1) % pastelCards.length]
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleBookClick(s.label)}
                  disabled={isLoading}
                  className="relative flex items-center justify-center shrink-0 w-[200px] h-[320px] md:w-[260px] md:h-[420px] rounded-l-lg md:rounded-l-xl border-t-2 border-l-2 border-b-2 border-gray-300 hover:shadow-2xl hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-60 transition-all touch-manipulation overflow-hidden"
                  aria-label={`读${s.label}`}
                  style={{
                    backgroundImage: "url('/cover_jingangjing.jpg')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: '-12px 8px 20px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.08), inset 2px 0 8px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* 书脊 */}
                  <div className="absolute right-0 top-0 bottom-0 w-3 md:w-4 bg-gradient-to-b from-gray-600 via-gray-500 to-gray-600 rounded-r-lg shadow-inner">
                    <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/20 via-transparent to-white/20"></div>
                  </div>
                  
                  {/* 封面装饰边框 */}
                  <div className="absolute inset-2 md:inset-3 border border-gray-400/30 rounded-lg pointer-events-none"></div>
                  
                  {/* 书名竖排居中 */}
                  <div className="relative z-10 flex items-center justify-center">
                    <span 
                      className="text-2xl md:text-4xl font-bold text-gray-900 tracking-wider"
                      style={{ 
                        fontFamily: 'serif',
                        writingMode: 'vertical-rl',
                        textOrientation: 'upright',
                        letterSpacing: '0.2em'
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 底部：其余经典（pastel 卡片风格） */}
        <div className="shrink-0 w-full pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div
            ref={bottomStripRef}
            onMouseEnter={() => setBottomStripPaused(true)}
            onMouseLeave={() => setBottomStripPaused(false)}
            className="overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex gap-2 md:gap-4 min-w-max justify-center py-1">
              {[...bottomClassics, ...bottomClassics].map((s, i) => {
                // 基于书籍在原始数组中的索引选择样式和封面，确保重复时使用相同样式
                const originalIndex = i % bottomClassics.length
                const p = pastelCards[originalIndex % pastelCards.length]
                const coverImage = bottomCoverImages[originalIndex % bottomCoverImages.length]
                return (
                  <button
                    key={`${s.label}-${i}`}
                    type="button"
                    onClick={() => handleBookClick(s.label)}
                    disabled={isLoading}
                    className={`relative flex items-center justify-center shrink-0 w-24 md:w-32 h-32 md:h-40 rounded-r-sm md:rounded-r-md border-t border-r border-b border-gray-300 hover:shadow-xl hover:scale-[1.05] focus:outline-none focus:ring-2 ${p.ring} focus:ring-offset-2 disabled:opacity-60 transition-transform touch-manipulation overflow-hidden`}
                    aria-label={`读${s.label}`}
                    style={{
                      backgroundImage: `url('${coverImage}')`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      boxShadow: '6px 4px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08), inset -1px 0 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    {/* 半透明背景色层，用于区分不同书籍 */}
                    <div className={`absolute inset-0 ${p.bg} opacity-60 rounded-r-sm md:rounded-r-md pointer-events-none`}></div>
                    
                    {/* 书脊 */}
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-gray-600 via-gray-500 to-gray-600 rounded-l-sm shadow-inner z-10">
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/20 via-transparent to-white/20"></div>
                    </div>
                    
                    {/* 封面装饰边框 */}
                    <div className="absolute inset-1 border border-gray-400/30 rounded-sm pointer-events-none z-10"></div>
                    
                    {/* 书名竖排居中 */}
                    <div className="relative z-20 flex items-center justify-center">
                      <span 
                        className="text-sm md:text-base font-bold text-gray-900 tracking-wider drop-shadow-sm"
                        style={{ 
                          fontFamily: 'serif',
                          writingMode: 'vertical-rl',
                          textOrientation: 'upright',
                          letterSpacing: '0.1em'
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
