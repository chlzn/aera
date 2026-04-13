"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import SplashScreen from "@/components/SplashScreen"

export default function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false)
    }, 700)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <SplashScreen isVisible={showSplash} />
      <div
        className={`transition-opacity duration-300 ease-out ${
          showSplash ? "opacity-0" : "opacity-100"
        }`}
      >
        {children}
        <Navbar />
      </div>
    </>
  )
}