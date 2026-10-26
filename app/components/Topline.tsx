"use client";

import { Section } from "@/app/lib/uiTypes";
import { useActiveCount } from "@/app/hooks/useActiveCount";
import CommandPalette from "@/app/components/CommandPalette";

export default function Topline({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const activeCount = useActiveCount();

  return (
    <div className="sticky top-0 z-[5] flex items-center gap-3 px-12 py-2.5 bg-gradient-to-b from-bg from-40% to-transparent">
      <CommandPalette onNavigate={onNavigate} />
      <div className="ml-auto flex items-center gap-2.5">
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-2 h-[30px] px-3 rounded-full bg-surface border border-line text-text-2 text-[12.5px]">
            <span className="w-[7px] h-[7px] rounded-full bg-ok shadow-[0_0_10px_var(--color-ok)]" />
            {activeCount} running
          </span>
        )}
      </div>
    </div>
  );
}
