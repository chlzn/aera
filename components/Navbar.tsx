"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Navbar() {
  const pathname = usePathname()

  const links = [
    { href: "/", label: "Home" },
    { href: "/spending", label: "Spending" },
    { href: "/investments", label: "Investments" },
    { href: "/settings", label: "Settings" },
  ]

  return (
    <nav
      className="fixed z-40 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md bg-zinc-900/80 border border-white/5 rounded-[22px] px-3 py-2 backdrop-blur-xl shadow-[0_10px_36px_rgba(0,0,0,0.38)]"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="grid grid-cols-4 text-center text-sm">
        {links.map((link) => {
          const isActive = pathname === link.href

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`py-2 transition-colors ${
                isActive
                  ? "text-white font-medium"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {link.label}
              {isActive && (
                <div className="mt-1 h-[3px] w-6 mx-auto bg-[#F5A623] rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}