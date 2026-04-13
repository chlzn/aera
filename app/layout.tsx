import { CurrencyProvider } from "@/context/currency-context"
import AppShell from "@/components/AppShell"
import "./globals.css"

export const metadata = {
  title: "Aera",
  description: "Finance OS",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
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
        <CurrencyProvider>
          <AppShell>{children}</AppShell>
        </CurrencyProvider>
      </body>
    </html>
  )
}