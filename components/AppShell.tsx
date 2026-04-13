"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import SplashScreen from "@/components/SplashScreen"
import PageTransition from "@/components/PageTransition"

export default function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false)
    }, 1400)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Splash */}
      <SplashScreen isVisible={showSplash} />

      {/* App */}
      <div
        className={`transition-opacity duration-200 ease-out ${
          showSplash ? "opacity-0" : "opacity-100"
        }`}
      >
        <PageTransition>
          {children}
        </PageTransition>

        <Navbar />
      </div>
    </>
  )
}