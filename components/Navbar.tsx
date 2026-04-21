"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Navbar() {
  const pathname = usePathname()

  const links = [
    { href: "/", label: "Home" },
    { href: "/spending", label: "Spending" },
    { href: "/investments", label: "Investments" },
    { href: "/tools", label: "Tools" },
    { href: "/settings", label: "Settings" },
  ]

  return (
    <nav
      className="fixed z-40 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md bg-zinc-900/80 border border-white/5 rounded-[28px] backdrop-blur-xl px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.32)]"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="grid grid-cols-5 text-center text-sm">
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href))

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`py-2 transition-all duration-150 ease-out ${
                isActive
                  ? "text-white font-semibold"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {link.label}

              {isActive && (
                <div className="mt-1 h-[2px] w-8 mx-auto rounded-full bg-[#F5A623] transition-all duration-150 ease-out" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}