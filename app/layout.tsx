import type { Metadata, Viewport } from "next"
import { CurrencyProvider } from "@/context/currency-context"
import { LanguageProvider } from "@/context/language-context"
import AppShell from "@/components/AppShell"
import "./globals.css"

export const metadata: Metadata = {
  title: "Aera",
  description: "Personal finance OS",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>

      <body>
        <LanguageProvider>
          <CurrencyProvider>
            <AppShell>{children}</AppShell>
          </CurrencyProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}