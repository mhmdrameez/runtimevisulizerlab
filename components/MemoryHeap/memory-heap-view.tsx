"use client";

import type { MemoryEntry } from "@/types/simulator";

interface MemoryHeapViewProps {
  entries: MemoryEntry[];
}

export function MemoryHeapView({ entries }: MemoryHeapViewProps) {
  return (
    <article className="panel-3d rounded-xl border border-zinc-700 bg-[#0b1220] p-3">
      <h3 className="mb-2 text-sm font-semibold text-emerald-200">Memory Heap</h3>
      <div className="flex min-h-[120px] flex-col gap-2 overflow-auto">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div key={entry.id} className="queue-pill queue-pill-3d rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
              <p className="text-emerald-200">
                {entry.scope}.{entry.key}
              </p>
              <p className="truncate text-zinc-200">{entry.value}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-zinc-400">Heap is empty.</p>
        )}
      </div>
    </article>
  );
}