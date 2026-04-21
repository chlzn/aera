"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Navbar() {
  const pathname = usePathname()

  const links = [
    { href: "/", label: "Home" },
    { href: "/spending", label: "Spending" },
    { href: "/investments", label: "Invest" },
    { href: "/tools", label: "Tools" },
    { href: "/settings", label: "Settings" },
  ]

  return (
    <nav
      className="fixed z-40 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md bg-zinc-900/85 border border-white/5 rounded-[28px] backdrop-blur-xl px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.32)]"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="grid grid-cols-5 text-center">
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href))

          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center justify-center gap-1 py-2 transition-all duration-150"
            >
              <span
                className={`text-[12px] leading-none ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-zinc-500"
                }`}
              >
                {link.label}
              </span>

              <div
                className={`h-[2px] w-5 rounded-full transition-all duration-150 ${
                  isActive
                    ? "bg-[#F5A623] opacity-100"
                    : "opacity-0"
                }`}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}