import Link from "next/link"
import { ArrowUpRight, TrendingUp } from "lucide-react"

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
          <p className="text-zinc-500 mt-2">
            Smart utilities to plan your money better.
          </p>
        </header>

        <section>
          <Link
            href="/tools/future-simulator"
            className="group block rounded-[28px] bg-zinc-900/55 border border-white/5 p-6 sm:p-7 transition-all duration-200 ease-out hover:bg-zinc-900/72 active:scale-[0.995]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.03] border border-white/[0.05] text-zinc-400 transition-colors duration-200 group-hover:text-zinc-300">
                  <TrendingUp size={17} strokeWidth={2} />
                </div>

                <div>
                  <p className="text-white text-base font-medium">
                    Future Simulator
                  </p>
                  <p className="text-zinc-500 text-sm mt-2">
                    See how your money evolves over time.
                  </p>
                </div>
              </div>

              <div className="text-zinc-600 transition-all duration-200 group-hover:text-zinc-400 group-hover:translate-x-[1px] group-hover:-translate-y-[1px]">
                <ArrowUpRight size={18} strokeWidth={2} />
              </div>
            </div>
          </Link>
        </section>
      </div>
    </main>
  )
}