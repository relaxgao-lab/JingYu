import { NextRequest, NextResponse } from 'next/server'
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { scenario } = await req.json()
    if (!scenario || typeof scenario !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid scenario' }, { status: 400 })
    }

    const prompt = `请根据我想对话的古代圣人"${scenario}"，生成一个JSON，固定规则：
1. aiRole：古代圣人的名字（从"${scenario}"中提取，如"老子"、"孔子"、"佛陀"等）
2. userRole：固定为"学生"（现代学生）
3. context：描述超时空对话场景，现代学生穿越时空向古代圣人请教，例如："一位现代学生通过时空之门，来到古代，向${scenario.split(/[，,]/)[0]?.trim() || scenario}请教智慧与人生之道。"

只返回JSON，不要多余解释。格式：{ "aiRole": "圣人名字", "userRole": "学生", "context": "超时空对话场景描述" }`

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 300,
    })
    const content = completion.choices[0].message.content

    let meta = null
    try {
      meta = typeof content === 'string' ? JSON.parse(content) : content
    } catch {
      return NextResponse.json({ error: 'AI 返回内容不是有效 JSON' }, { status: 500 })
    }
    if (!meta || !meta.aiRole || !meta.userRole || !meta.context) {
      return NextResponse.json({ error: 'AI 返回内容不完整' }, { status: 500 })
    }
    return NextResponse.json(meta)
  } catch (e) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
