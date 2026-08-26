"use client";

import { useState } from "react";

export default function Header() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-[15px] font-semibold tracking-tight text-gray-900">
          Downcript
        </span>

        <div className="relative">
          <button
            onClick={() => setHelpOpen((o) => !o)}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Help
          </button>
          {helpOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setHelpOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg z-20 text-sm text-gray-600 leading-relaxed">
                <p className="font-medium text-gray-900 mb-1">How this works</p>
                <p>
                  Pick a source, provide a video, and it&apos;s transcribed locally on this
                  machine. Everything — YouTube, Instagram, Dailymotion, uploads, and Google
                  Drive folders — shares one queue, so you can queue several at once and they
                  run one at a time.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
