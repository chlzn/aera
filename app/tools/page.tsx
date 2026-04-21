import Link from "next/link"

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
            className="block rounded-[28px] bg-zinc-900/55 border border-white/5 p-6 transition-colors duration-200 ease-out hover:bg-zinc-900/75"
          >
            <p className="text-white text-base font-medium">Future Simulator</p>
            <p className="text-zinc-500 text-sm mt-2">
              See how your money evolves over time.
            </p>
          </Link>
        </section>
      </div>
    </main>
  )
}