"use client"

import AeraLogo from "@/components/AeraLogo"

export default function SplashScreen({
  isVisible,
}: {
  isVisible: boolean
}) {
  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-black transition-opacity duration-500 ease-out ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex flex-col items-center">
        <AeraLogo size={44} />
      </div>
    </div>
  )
}