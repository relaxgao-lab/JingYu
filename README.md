# Converse with Sages / 与神对话

AI 辅助对话应用：与诸子百家（老子、孔子、庄子等）进行语音和文字对话。

## 功能

- **语音对话**：麦克风录音 → Whisper 转文字 → AI 回复 → TTS 朗读
- **文字对话**：输入文字与古人对话
- **人物选择**：预设老子、孔子、庄子、墨子、孟子，或自定义输入

## 快速开始

1. **复制整个 `converse-with-sages-starter` 文件夹**到你的项目目录，或作为新项目使用

2. **安装依赖**：
   ```bash
   cd converse-with-sages-starter
   pnpm install
   # 或 npm install / yarn
   ```

3. **配置环境变量**：复制 `.env.example` 为 `.env`，填入 `OPENAI_API_KEY`
   ```bash
   cp .env.example .env
   ```

4. **启动开发服务器**：
   ```bash
   pnpm dev
   ```

5. 打开 http://localhost:3000 访问应用

## 项目结构

```
converse-with-sages-starter/
├── app/
│   ├── api/
│   │   ├── chat/           # AI 对话 API
│   │   ├── whisper/        # 语音转文字
│   │   ├── openai-tts/     # 文字转语音
│   │   └── scene-meta/     # 场景/人物元数据
│   ├── conversation/       # 语音服务
│   │   ├── audio-recorder-service.ts
│   │   ├── whisper-speech-service.ts
│   │   ├── speech-utils.ts
│   │   └── types.ts
│   ├── talk/              # 对话页面
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/ui/         # UI 组件
├── config.ts             # TTS 配置 (openai / system)
├── lib/utils.ts
└── package.json
```

## 依赖

- Next.js 15
- React 19
- OpenAI API (Whisper、Chat、TTS)
- Tailwind CSS
- Radix UI (Button、Input)
- Lucide React (图标)

## 自定义

- 修改 `config.ts` 中的 `TTS_PROVIDER` 切换 TTS（`openai` 或 `system`）
- 修改 `app/api/chat/route.ts` 中的 system prompt 调整 AI 角色表现
- 修改 `app/api/scene-meta/route.ts` 中的 prompt 调整人物设定生成逻辑
# converse-with-sages-starter
# JingYu
