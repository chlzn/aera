"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  House,
  Wallet,
  ChartNoAxesCombined,
  SlidersHorizontal,
  Settings,
} from "lucide-react"

export default function Navbar() {
  const pathname = usePathname()

  const links = [
    { href: "/", label: "Home", icon: House },
    { href: "/spending", label: "Spending", icon: Wallet },
    { href: "/investments", label: "Invest", icon: ChartNoAxesCombined },
    { href: "/tools", label: "Tools", icon: SlidersHorizontal },
    { href: "/settings", label: "Settings", icon: Settings },
  ]

  return (
    <nav
      className="fixed z-40 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md bg-zinc-900/85 border border-white/5 rounded-[28px] backdrop-blur-xl px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.32)]"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="grid grid-cols-5">
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href))

          const Icon = link.icon

          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center justify-center gap-1 py-2 min-w-[60px] transition-all duration-200 ease-out active:scale-[0.96]"
            >
              <Icon
                size={20}
                strokeWidth={2}
                className={`transition-all duration-200 ease-out ${
                  isActive
                    ? "text-white scale-105"
                    : "text-zinc-500/80"
                }`}
              />

              <span
                className={`text-[10px] tracking-wide transition-all duration-200 ease-out ${
                  isActive
                    ? "text-white font-semibold scale-[1.03]"
                    : "text-zinc-500/80"
                }`}
              >
                {link.label}
              </span>

              <div
                className={`h-[2px] rounded-full bg-[#F5A623] transition-all duration-200 ease-out ${
                  isActive ? "w-7 opacity-100" : "w-4 opacity-0"
                }`}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}