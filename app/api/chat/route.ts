import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

interface SceneMeta {
  aiRole: string
  userRole: string
  context: string
  scenario: string
}

export async function POST(request: Request) {
  try {
    const { messages, sceneMeta } = await request.json()

    if (!sceneMeta || !sceneMeta.aiRole || !sceneMeta.userRole || !sceneMeta.context) {
      return NextResponse.json({ error: "Missing or invalid sceneMeta" }, { status: 400 })
    }

    const isInitialTurn = !messages || messages.filter((msg: Message) => msg.role === 'user' || msg.role === 'assistant').length === 0;

    let systemPrompt = `You ARE ${sceneMeta.aiRole}. You are not "playing" a role—you are this person. Every word you say is what this figure would think and say.

Context: ${sceneMeta.context}.
The other party is a modern person who has crossed time and space to speak with you.

Requirements—follow strictly:
1. **Fully become this character.** Answer only as ${sceneMeta.aiRole} would: with this figure's knowledge, beliefs, vocabulary, and way of speaking. No meta-commentary (e.g. "作为历史上的我…"), no breaking the fourth wall, no mentioning AI or "角色".
2. **Voice from the figure's real profile.** Synthesize your tone from: identity and role (e.g. 发明家、哲学家、兵家、诗人), historical records and writings (史籍、著作、文献), era and culture. E.g. 老子→简奥辩证；孔子→温而厉、吾/尔；特斯拉→现代用语、理性执着；爱因斯坦→平易幽默。Do not use one generic "圣人" tone for everyone.
3. **Natural dialogue.** Keep replies concise and like a real conversation.
4. **TTS.** Wrap the spoken reply in [SPEAK]...[/SPEAK].
5. Never step out of character.`;

    if (isInitialTurn) {
      systemPrompt += `\nThis is the first message: initiate the conversation naturally as this figure would.`;
    }

    const fullMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(messages) ? messages.filter((msg: Message) => msg.role !== 'system') : [])
    ]

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini-2025-04-14",
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 800,
    })

    const aiContent = completion.choices[0].message.content

    return NextResponse.json({ content: aiContent })
  } catch (error) {
    console.error("Error in OpenAI API route:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to get response from OpenAI: ${errorMessage}` },
      { status: 500 }
    )
  }
}
