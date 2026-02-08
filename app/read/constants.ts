/**
 * 道德经及其他经典中的生僻字读音映射表
 */
export const rareCharPronunciations: Record<string, string> = {
  '攘': 'rǎng', '颣': 'lèi', '渝': 'yú', '隅': 'yú', '琭': 'lù', '珞': 'luò',
  '蹶': 'jué', '讷': 'nè', '咎': 'jiù', '刍': 'chú', '牖': 'yǒu', '歙': 'xī',
  '兕': 'sì', '虿': 'chài', '虺': 'huǐ', '螫': 'shì', '攫': 'jué', '牝': 'pìn',
  '嗄': 'shà', '刿': 'guì', '啬': 'sè', '柢': 'dǐ', '莅': 'lì', '徼': 'jiào',
  '橐': 'tuó', '籥': 'yuè', '埏': 'shān', '埴': 'zhí', '畋': 'tián', '诘': 'jié',
  '皦': 'jiǎo', '惚': 'hū', '恍': 'huǎng', '澹': 'dàn', '飂': 'liáo', '窈': 'yǎo',
  '赘': 'zhuì', '辎': 'zī', '谪': 'zhé', '楗': 'jiàn', '忒': 'tè', '羸': 'léi',
  '隳': 'huī', '毂': 'gǔ', '辐': 'fú', '辙': 'zhé', '瑕': 'xiá', '筹': 'chóu',
  '袭': 'xí', '矜': 'jīn', '恬': 'tián', '譬': 'pì', '恃': 'shì', '饵': 'ěr',
  '斲': 'zhuó', '繟': 'chǎn', '狎': 'xiá', '湛': 'zhàn', '挫': 'cuò', '羁': 'jī',
  '绠': 'gěng', '汲': 'jí', '怵': 'chù', '沕': 'mì', '暋': 'mǐn', '惛': 'hūn',
  '沌': 'dùn', '呴': 'xǔ', '濡': 'rú', '壑': 'hè', '眴': 'shùn', '睨': 'nì',
  '撄': 'yīng', '瘈': 'zhì', '瘼': 'mò', '瘵': 'zhài', '瘳': 'chōu', '瘰': 'luǒ',
  '疴': 'kē', '痼': 'gù', '痃': 'xuán', '痄': 'zhà', '痦': 'wù', '痖': 'yǎ',
  '痗': 'mèi', '冥': 'míng', '缪': 'miù', '懽': 'huān', '渊': 'yuān', '冲': 'chōng',
  '盈': 'yíng', '锐': 'ruì', '纷': 'fēn', '谷': 'gǔ', '神': 'shén', '门': 'mén',
  '根': 'gēn', '绵': 'mián', '勤': 'qín', '若': 'ruò', '狗': 'gǒu', '屈': 'qū',
  '竭': 'jié', '攴': 'pū', '浴': 'yù', '涣': 'huàn', '释': 'shì', '俨': 'yǎn',
  '魇': 'yǎn', '阽': 'diàn', '棙': 'lì', '缗': 'mín', '鬻': 'yù', '牡': 'mǔ', '弥': 'mí',
  '祇': 'qí', '钵': 'bō', '袒': 'tǎn', '膝': 'xī', '耨': 'nòu', '藐': 'miǎo', '涅': 'niè',
  '槃': 'pán', '偈': 'jì', '陀': 'tuó', '洹': 'huán', '迦': 'jiā', '牟': 'móu', '尼': 'ní',
  '菩': 'pú', '萨': 'sà', '诃': 'hē', '祗': 'zhī', '梵': 'fàn', '筏': 'fá', '涕': 'tì',
  '泣': 'qì', '瞋': 'chēn', '嗔': 'chēn', '怖': 'bù', '畏': 'wèi', '劫': 'jié', '垢': 'gòu',
  '秽': 'huì', '僧': 'sēng', '什': 'shí', '鸠': 'jiū', '摩': 'mó'
};

/**
 * AI 助手的快捷提问词
 */
export const presetPrompts = [
  { label: "讲解", text: "请用现代人容易听懂的白话文讲解这一章的意思。" },
  { label: "大意", text: "请用白话文概括本章大意。" },
  { label: "重点", text: "请用白话文说明本章有哪些重点。" },
  { label: "联系现实", text: "请用白话文说说本章对现代人有什么启发。" },
];

/**
 * 预设配色方案
 */
export const presetColors = [
  { bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-700", hover: "hover:bg-slate-200/50" },
  { bg: "bg-violet-100", border: "border-violet-200", text: "text-violet-700", hover: "hover:bg-violet-200/50" },
  { bg: "bg-pink-100", border: "border-pink-200", text: "text-pink-700", hover: "hover:bg-pink-200/50" },
  { bg: "bg-amber-100", border: "border-amber-200", text: "text-amber-800", hover: "hover:bg-amber-200/50" },
  { bg: "bg-emerald-100", border: "border-emerald-200", text: "text-emerald-700", hover: "hover:bg-emerald-200/50" },
];

/**
 * 章节卡片配色方案
 */
export const chapterCardColors = [
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
];
