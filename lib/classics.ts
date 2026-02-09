import { Book, Chapter } from '@/app/read/types'
import daodejingData from '@/data/classics/daodejing.json'
import jingangjingData from '@/data/classics/jingangjing.json'
import qingjingjingData from '@/data/classics/qingjingjing.json'
import xinjingData from '@/data/classics/xinjing.json'

// 书籍标识映射
const bookMap: Record<string, Book> = {
  'daodejing': daodejingData as Book,
  '道德经': daodejingData as Book,
  'jingangjing': jingangjingData as Book,
  '金刚经': jingangjingData as Book,
  'qingjingjing': qingjingjingData as Book,
  '清静经': qingjingjingData as Book,
  'xinjing': xinjingData as Book,
  '心经': xinjingData as Book,
}

/**
 * 根据书籍标识获取书籍数据
 */
export function getBook(bookId: string): Book | null {
  return bookMap[bookId] || null
}

/**
 * 根据书籍标识和章节号获取章节内容
 */
export function getChapter(bookId: string, chapterNumber: number): Chapter | null {
  const book = getBook(bookId)
  if (!book) return null
  
  const chapter = book.chapters.find(ch => ch.chapter === chapterNumber)
  return chapter || null
}

/**
 * 获取书籍的所有章节列表
 */
export function getChapters(bookId: string): Chapter[] {
  const book = getBook(bookId)
  return book?.chapters || []
}

/**
 * 获取书籍的总章节数
 */
export function getTotalChapters(bookId: string): number {
  const book = getBook(bookId)
  return book?.totalChapters || 0
}

/** 有独立版本详情页的书籍（进入时先显示版本说明，再进入第一章） */
const BOOKS_WITH_VERSION_PAGE: string[] = ['daodejing', 'jingangjing', 'qingjingjing', 'xinjing']

/**
 * 是否有版本详情页（第 0 页）
 */
export function hasVersionPage(bookId: string): boolean {
  return BOOKS_WITH_VERSION_PAGE.includes(bookId)
}

/**
 * 检查章节是否存在（含版本详情页 chapter 0）
 */
export function hasChapter(bookId: string, chapterNumber: number): boolean {
  if (chapterNumber === 0) return hasVersionPage(bookId)
  const book = getBook(bookId)
  if (!book) return false
  return chapterNumber >= 1 && chapterNumber <= book.totalChapters
}

/**
 * 获取下一章章节号
 */
export function getNextChapter(bookId: string, currentChapter: number): number | null {
  if (currentChapter === 0) return 1
  const total = getTotalChapters(bookId)
  if (currentChapter < total) {
    return currentChapter + 1
  }
  return null
}

/**
 * 获取上一章章节号
 */
export function getPrevChapter(bookId: string, currentChapter: number): number | null {
  if (currentChapter === 1 && hasVersionPage(bookId)) return 0
  if (currentChapter > 1) {
    return currentChapter - 1
  }
  return null
}
