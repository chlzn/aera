import { CurrencyProvider } from "@/context/currency-context"
import "./globals.css"
import Navbar from "@/components/Navbar"

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
          {children}
          <Navbar />
        </CurrencyProvider>
      </body>
    </html>
  )
}