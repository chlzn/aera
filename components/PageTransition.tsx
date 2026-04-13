"use client"

import { usePathname } from "next/navigation"
import { ReactNode } from "react"

export default function PageTransition({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()

  return (
    <div
      key={pathname}
      className="animate-[pageEnter_200ms_ease-out]"
    >
      {children}
    </div>
  )
}