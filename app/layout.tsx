import type { Metadata, Viewport } from 'next'
import './globals.css'
const siteUrl = 'https://jingyu.relaxgao.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: '经鱼·心随经转',
  description: 'AI让你成为自己的老师，与你一起读懂经典，读懂自己',
  keywords: ['经鱼', '心随经转', 'AI', '经典', '道德经', '金刚经', '心经', '六祖坛经'],
  authors: [{ name: 'RelaxGao' }],
  creator: 'RelaxGao',
  publisher: 'RelaxGao',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: siteUrl,
    siteName: '经鱼·心随经转',
    title: '经鱼·心随经转',
    description: 'AI让你成为自己的老师，与你一起读懂经典，读懂自己',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '经鱼·心随经转',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '经鱼·心随经转',
    description: 'AI让你成为自己的老师，与你一起读懂经典，读懂自己',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
