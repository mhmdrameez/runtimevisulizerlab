"use client";

import type { StackFrame } from "@/types/simulator";

interface CallStackViewProps {
  frames: StackFrame[];
}

export function CallStackView({ frames }: CallStackViewProps) {
  const displayFrames = [...frames].reverse();

  return (
    <article className="panel-3d rounded-xl border border-zinc-700 bg-[#0b1220] p-3">
      <h3 className="mb-2 text-sm font-semibold text-cyan-200">Call Stack</h3>
      <div className="flex min-h-[120px] flex-col gap-2">
        {displayFrames.length > 0 ? (
          displayFrames.map((frame) => (
            <div key={frame.id} className="stack-frame stack-frame-3d rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
              {frame.name}
            </div>
          ))
        ) : (
          <p className="text-xs text-zinc-400">Stack is empty.</p>
        )}
      </div>
    </article>
  );
}