"use client"

import { useState } from "react"
import { useCurrency } from "@/context/currency-context"

export default function Settings() {
  const { currency, setCurrency } = useCurrency()
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)

  const handleExport = () => {
    const data = {
      entries: localStorage.getItem("entries"),
      investments: localStorage.getItem("investments"),
    }

    const blob = new Blob([JSON.stringify(data)], {
      type: "application/json",
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "aera-data.json"
    a.click()
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)

        if (data.entries) {
          localStorage.setItem("entries", data.entries)
        }

        if (data.investments) {
          localStorage.setItem("investments", data.investments)
        }

        window.location.reload()
      } catch {
        alert("Invalid file")
      }
    }

    reader.readAsText(file)
  }

  const handleReset = () => {
    localStorage.removeItem("entries")
    localStorage.removeItem("investments")
    window.location.reload()
  }

  const sectionClass =
    "rounded-[26px] bg-zinc-900/45 border border-white/5 p-5 space-y-4"

  const itemClass =
    "w-full flex items-center justify-between px-4 py-3 rounded-[18px] bg-zinc-800/40 border border-white/5 text-sm transition hover:bg-zinc-800/60"

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold">Settings</h1>
          </header>

          {/* Preferences */}
          <section className="mb-6">
            <p className="text-white text-sm mb-3">Preferences</p>

            <div className={sectionClass}>
              <div className={itemClass}>
                <span>Currency</span>

                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-transparent text-zinc-400 outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="BRL">BRL</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </section>

          {/* Data */}
          <section className="mb-6">
            <p className="text-white text-sm mb-3">Data</p>

            <div className={sectionClass}>
              <button onClick={handleExport} className={itemClass}>
                Export your data
              </button>

              <label className={itemClass}>
                Import your data
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </section>

          {/* Coming soon */}
          <section className="mb-6">
            <p className="text-white text-sm mb-3">Sync & Premium</p>

            <div className={sectionClass}>
              <div className="text-zinc-500 text-sm">
                Bank sync, multiple accounts, cloud backup, and premium insights.
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="mb-24">
            <p className="text-white text-sm mb-3">Danger zone</p>

            <div className={sectionClass}>
              <button
                onClick={() => setIsResetModalOpen(true)}
                className="w-full text-left px-4 py-3 rounded-[18px] border border-red-500/20 text-red-400 hover:bg-red-500/5 transition text-sm"
              >
                Delete all data
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* MODAL */}
      {isResetModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-5"
          onClick={() => setIsResetModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[26px] bg-zinc-900 border border-white/5 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white text-sm mb-4">
              This will permanently delete all your data.
              <br />
              This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 rounded-full bg-zinc-800 text-zinc-300 py-3 text-sm"
              >
                Cancel
              </button>

              <button
                onClick={handleReset}
                className="flex-1 rounded-full bg-red-500 text-white py-3 text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}