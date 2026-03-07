"use client";

import type { MemoryEntry, SimulationStep } from "@/types/simulator";

interface VisualizationPanelProps {
  step?: SimulationStep;
  steps: SimulationStep[];
  stepIndex: number;
  totalSteps: number;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-zinc-700 bg-[#101827] p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-200">{title}</h3>
      {children}
    </article>
  );
}

function isMemoryChanged(prev: MemoryEntry[] | undefined, current: MemoryEntry): boolean {
  if (!prev) return true;
  const found = prev.find((item) => item.key === current.key && item.scope === current.scope);
  if (!found) return true;
  return found.value !== current.value;
}

function getSimpleExplanation(step: SimulationStep): string[] {
  const text = `${step.title} ${step.details}`.toLowerCase();

  if (text.includes("global execution context")) {
    return [
      "JavaScript creates the global execution context.",
      "Global() is pushed to the Call Stack.",
      "The program is ready to execute line by line.",
    ];
  }

  if (text.includes("function hoisted")) {
    return [
      "JavaScript stores the function in memory.",
      "You can call this function later in the code.",
    ];
  }

  if (text.includes("call stack push") || text.includes("function call")) {
    return [
      "A function is called.",
      "It is pushed to the Call Stack.",
      "JavaScript starts executing that function.",
    ];
  }

  if (text.includes("call stack pop") || text.includes("function return")) {
    return [
      "The function finishes its work.",
      "Its return value is produced.",
      "The function is popped from the Call Stack.",
    ];
  }

  if (text.includes("variable") || text.includes("assigned")) {
    return [
      "JavaScript creates or updates a variable.",
      "The variable is stored in memory.",
    ];
  }

  if (text.includes("task queued") || text.includes("microtask") || text.includes("macrotask")) {
    return [
      "An async callback is queued.",
      "Microtasks run before callback queue tasks.",
      "The Event Loop will execute it when the Call Stack is free.",
    ];
  }

  if (text.includes("console.log")) {
    return [
      "JavaScript executes console.log().",
      "The value is printed to Console Output.",
    ];
  }

  return [
    "JavaScript executes the current line.",
    "Runtime state updates after this step.",
  ];
}

export function VisualizationPanel({ step, steps, stepIndex, totalSteps }: VisualizationPanelProps) {
  if (!step) {
    return <section className="rounded-xl border border-zinc-700 bg-[#101827] p-5 text-sm text-zinc-300">No simulation steps available.</section>;
  }

  const prevStep = stepIndex > 0 ? steps[stepIndex - 1] : undefined;
  const stackFrames = step.snapshot.callStack.map((frame) => frame.name);
  const memory = step.snapshot.memoryHeap;
  const microtasks = step.snapshot.eventLoop.microtasks;
  const callbacks = step.snapshot.eventLoop.macrotasks;
  const explanationLines = getSimpleExplanation(step);

  return (
    <section className="flex min-h-0 flex-col gap-3 overflow-auto pr-1">
      <SectionCard title="Current Step">
        <p className="text-sm text-zinc-400">Running Step {stepIndex + 1} of {totalSteps}</p>
        <p className="mt-2 text-sm text-zinc-300">Running Line {step.line}</p>
        <p className="mt-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 font-mono text-sm text-cyan-100">{step.lineExecuted}</p>
        <p className="mt-3 text-sm text-zinc-200"><span className="font-semibold text-zinc-100">Explanation:</span> {step.details}</p>
      </SectionCard>

      <SectionCard title="JavaScript Runtime">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
            <h4 className="mb-2 text-sm font-semibold text-zinc-100">Call Stack</h4>
            <div className="space-y-2">
              {stackFrames.length ? (
                [...stackFrames].reverse().map((frame, idx) => {
                  const isNew = !prevStep?.snapshot.callStack.some((f) => f.name === frame);
                  return (
                    <p
                      key={`${frame}-${idx}`}
                      className={`rounded px-2 py-1 text-xs transition ${isNew ? "bg-amber-500/20 text-amber-100" : "bg-zinc-800 text-zinc-200"}`}
                    >
                      {frame}
                    </p>
                  );
                })
              ) : (
                <p className="text-xs text-zinc-500">empty</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
            <h4 className="mb-2 text-sm font-semibold text-zinc-100">Memory</h4>
            <div className="space-y-2">
              {memory.length ? (
                memory.map((entry) => {
                  const changed = isMemoryChanged(prevStep?.snapshot.memoryHeap, entry);
                  return (
                    <p
                      key={entry.id}
                      className={`rounded px-2 py-1 text-xs transition ${changed ? "bg-emerald-500/20 text-emerald-100" : "bg-zinc-800 text-zinc-200"}`}
                    >
                      {entry.key} {"->"} {entry.value}
                    </p>
                  );
                })
              ) : (
                <p className="text-xs text-zinc-500">empty</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
            <h4 className="mb-2 text-sm font-semibold text-zinc-100">Queues</h4>
            <p className="text-xs text-zinc-300">Microtask Queue</p>
            <p className="mb-2 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200">{microtasks.join(", ") || "empty"}</p>
            <p className="text-xs text-zinc-300">Callback Queue</p>
            <p className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200">{callbacks.join(", ") || "empty"}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Simple Explanation">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-200">
          {explanationLines.map((line, idx) => (
            <li key={`${line}-${idx}`}>{line}</li>
          ))}
        </ol>

        <div className="mt-3 rounded-lg border border-sky-400/40 bg-[#0f2236] p-3">
          <h4 className="mb-2 text-sm font-semibold text-sky-100">Console Output</h4>
          <div className="max-h-36 overflow-auto font-mono text-xs text-zinc-100">
            {step.snapshot.stdout.length ? step.snapshot.stdout.map((line, i) => <p key={`${line}-${i}`}>{line}</p>) : <p className="text-zinc-400">No output yet.</p>}
          </div>
        </div>
      </SectionCard>
    </section>
  );
}
