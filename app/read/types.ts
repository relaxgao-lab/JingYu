export interface Chapter {
  chapter: number
  title: string
  content: string
  translation?: string
}

export interface Book {
  book: string
  author: string
  totalChapters: number
  chapters: Chapter[]
  note?: string
  versionNote?: string
}

export interface ReadingState {
  book: string
  currentChapter: number
  totalChapters: number
}
