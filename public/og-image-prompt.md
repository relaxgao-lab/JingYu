# Open Graph Image Generation Prompt

## 图片规格
- 尺寸：1200x630px（16:8.4 比例）
- 格式：PNG（透明背景或纯色背景）
- 风格：现代简约 + 传统文化元素

## AI 生成 Prompt（英文版）

```
Create a modern, elegant social media preview image (1200x630px) for "Converse with Sages" - an AI-powered platform for cross-temporal dialogues with ancient sages. 

Visual elements:
- Left side: A modern student silhouette or figure in contemporary clothing, holding a glowing digital device or scroll
- Right side: Ancient Chinese sage silhouette (like Laozi, Confucius, or Buddha) in traditional robes, emanating wisdom light
- Center: A bridge or portal connecting the two figures, representing time travel and dialogue
- Background: Soft gradient from warm amber/orange (left, modern) to deep stone/gold (right, ancient), with subtle geometric patterns
- Text overlay: Large title "Converse with Sages" in elegant serif font (top), Chinese subtitle "与先贤对话" below it in smaller size
- Style: Minimalist, clean, professional, with a sense of wisdom and tranquility
- Color palette: Amber, gold, warm stone, deep brown, with subtle gradients
- Mood: Serene, contemplative, bridging past and present
```

## AI 生成 Prompt（中文版 - 适用于中文AI工具）

```
创建一个现代优雅的社交媒体预览图（1200x630px），用于"Converse with Sages"（与先贤对话）平台。

视觉元素：
- 左侧：现代学生剪影，穿着现代服装，手持发光的数字设备或卷轴
- 右侧：古代中国圣人剪影（如老子、孔子或佛陀），身着传统长袍，散发智慧光芒
- 中间：连接两个人的桥梁或传送门，象征时空穿越和对话
- 背景：从温暖的琥珀/橙色（左侧，现代）到深色石头/金色（右侧，古代）的柔和渐变，带有微妙的几何图案
- 文字叠加：顶部大标题"Converse with Sages"使用优雅衬线字体，下方较小字号的中文副标题"与先贤对话"
- 风格：极简、干净、专业，带有智慧和宁静感
- 配色：琥珀色、金色、暖石色、深棕色，带有微妙渐变
- 氛围：宁静、沉思、连接古今
```

## 简化版 Prompt（如果上面的太复杂）

**英文简化版：**
```
Social media preview image 1200x630px: Modern student on left, ancient Chinese sage on right, connected by a glowing bridge. Background: warm amber to gold gradient. Text: "Converse with Sages" and "与先贤对话". Minimalist, elegant, serene style.
```

**中文简化版：**
```
社交媒体预览图1200x630px：左侧现代学生，右侧古代中国圣人，由发光桥梁连接。背景：琥珀到金色渐变。文字："Converse with Sages"和"与先贤对话"。极简、优雅、宁静风格。
```

## 使用建议

1. **Midjourney**: 使用英文版 prompt，添加参数 `--ar 1.91:1 --v 6`
2. **DALL-E 3**: 使用英文版 prompt，指定尺寸 1200x630
3. **Stable Diffusion**: 使用中文或英文版，设置宽高比 1.91:1
4. **其他工具**: 根据工具特点调整 prompt

## 生成后处理

生成图片后，可能需要：
- 使用 Figma/Canva 添加文字标题（如果 AI 生成的文字不够清晰）
- 调整对比度和色彩
- 确保文字清晰可读
- 保存为 PNG 格式，命名为 `og-image.png`
