"use client";

import { useState } from "react";
import type {
  MemoryEntry,
  RuntimeVerificationState,
  SimulationSnapshot,
  SimulationStep,
  SupportedLanguage,
  VisualizationMode,
} from "@/types/simulator";

interface VisualizationPanelProps {
  step?: SimulationStep;
  steps: SimulationStep[];
  stepIndex: number;
  totalSteps: number;
  language: SupportedLanguage;
  mode: VisualizationMode;
  verification: RuntimeVerificationState;
  performance: {
    estimatedRunMs: number;
    simulationBuildMs: number;
    lastRunMs: number | null;
    currentMemoryBytes: number;
    peakMemoryBytes: number;
    tips: string[];
  };
}

function SectionCard({
  title,
  children,
  collapsible = false,
  open = true,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <article className="rounded-xl border border-zinc-700 bg-[#101827] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">{title}</h3>
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
          >
            {open ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
      {open ? children : null}
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
      "JavaScript starts the program.",
      "The main program is put on the call stack.",
      "Now it can run each line one by one.",
    ];
  }

  if (text.includes("function hoisted")) {
    return [
      "JavaScript saves this function in memory.",
      "You can use this function later.",
    ];
  }

  if (text.includes("call stack push") || text.includes("function call")) {
    return [
      "A function is called.",
      "It is added to the call stack.",
      "JavaScript runs that function now.",
    ];
  }

  if (text.includes("call stack pop") || text.includes("function return")) {
    return [
      "The function finishes.",
      "It returns a value.",
      "It is removed from the call stack.",
    ];
  }

  if (text.includes("variable") || text.includes("assigned")) {
    return [
      "A variable is created or updated.",
      "Its value is saved in memory.",
    ];
  }

  if (text.includes("task queued") || text.includes("microtask") || text.includes("macrotask")) {
    return [
      "An async task is waiting in a queue.",
      "Microtasks run first.",
      "Then callback queue tasks run when stack is empty.",
    ];
  }

  if (text.includes("console.log")) {
    return [
      "console.log() runs.",
      "The value is shown in Console Output.",
    ];
  }

  return [
    "JavaScript runs this line.",
    "The runtime state is updated.",
  ];
}

function getEngineDetail(
  current: SimulationStep,
  previous?: SimulationStep,
  next?: SimulationStep,
): string[] {
  const prevStack = previous?.snapshot.callStack.length ?? 0;
  const currStack = current.snapshot.callStack.length;
  const prevMemory = previous?.snapshot.memoryHeap.length ?? 0;
  const currMemory = current.snapshot.memoryHeap.length;
  const prevMicro = previous?.snapshot.eventLoop.microtasks.length ?? 0;
  const currMicro = current.snapshot.eventLoop.microtasks.length;
  const prevMacro = previous?.snapshot.eventLoop.macrotasks.length ?? 0;
  const currMacro = current.snapshot.eventLoop.macrotasks.length;

  const details: string[] = [];
  details.push(`JavaScript executes line ${current.line}: ${current.lineExecuted.trim() || "(empty line)"}.`);

  if (currStack > prevStack) details.push("A function was pushed to the Call Stack.");
  if (currStack < prevStack) details.push("A function finished and was popped from the Call Stack.");
  if (currMemory > prevMemory) details.push("A new value/function was added to Memory.");
  if (currMemory < prevMemory) details.push("A memory item was removed or scope ended.");
  if (currMicro > prevMicro) details.push("A microtask callback was queued.");
  if (currMacro > prevMacro) details.push("A callback/macrotask was queued.");
  if (current.snapshot.stdout.length > (previous?.snapshot.stdout.length ?? 0)) {
    details.push("console.log ran and printed output.");
  }

  details.push(`Current stack size: ${currStack}, memory items: ${currMemory}.`);
  details.push(`Queue state now -> microtasks: ${currMicro}, callbacks: ${currMacro}.`);
  details.push(next ? `Then engine moves to next line: ${next.line}.` : "No next line left. Program execution is complete.");
  return details;
}

function getRuntimeLabels(language: SupportedLanguage) {
  if (language === "javascript") {
    return {
      runtimeTitle: "JavaScript Runtime",
      queueA: "Microtask Queue",
      queueB: "Callback Queue",
    };
  }

  if (language === "python") {
    return {
      runtimeTitle: "Python Interpreter Runtime",
      queueA: "Interpreter Queue",
      queueB: "Pending Callbacks",
    };
  }

  if (language === "go") {
    return {
      runtimeTitle: "Go Runtime",
      queueA: "Scheduler Queue",
      queueB: "Goroutine Queue",
    };
  }

  return {
    runtimeTitle: `${language.toUpperCase()} Runtime`,
    queueA: "Thread Queue",
    queueB: "Callback/IO Queue",
  };
}

function getEngineModel(
  language: SupportedLanguage,
  snapshot: SimulationSnapshot,
): Array<{ title: string; value: string }> {
  const stack = snapshot.callStack.map((f) => f.name).join(" -> ") || "empty";
  const memory = snapshot.memoryHeap.map((m) => `${m.key}:${m.value}`).join(", ") || "empty";
  const micro = snapshot.eventLoop.microtasks.join(", ") || "empty";
  const macro = snapshot.eventLoop.macrotasks.join(", ") || "empty";
  const webApis = snapshot.webApis.join(", ") || "idle";

  if (language === "javascript") {
    return [
      { title: "Call Stack", value: stack },
      { title: "Memory Heap", value: memory },
      { title: "Microtask Queue", value: micro },
      { title: "Callback Queue", value: macro },
      { title: "Event Loop", value: "Synchronous -> Microtasks -> Callback Queue" },
    ];
  }

  if (language === "python") {
    return [
      { title: "Call Stack", value: stack },
      { title: "Stack Frames", value: snapshot.executionContext.name },
      { title: "Objects in Memory", value: memory },
      { title: "Interpreter", value: "CPython-style line-by-line execution" },
      { title: "Console", value: snapshot.stdout.join(" | ") || "empty" },
    ];
  }

  if (language === "go") {
    return [
      { title: "Goroutines", value: macro === "empty" ? "none" : macro },
      { title: "Scheduler", value: webApis.includes("Go scheduler") ? "Active" : "Idle" },
      { title: "Stack", value: stack },
      { title: "Heap", value: memory },
      { title: "Channels/Async", value: "Modeled via runtime queue" },
    ];
  }

  return [
    { title: "Call Stack", value: stack },
    { title: "Heap / Memory", value: memory },
    { title: "Threads", value: macro === "empty" ? "main thread" : macro },
    { title: "Runtime Scheduler", value: webApis },
    { title: "Allocation", value: "Objects/data allocated during execution" },
  ];
}

export function VisualizationPanel({
  step,
  steps,
  stepIndex,
  totalSteps,
  language,
  mode,
  verification,
  performance,
}: VisualizationPanelProps) {
  const [showCurrentStep, setShowCurrentStep] = useState(true);
  const [showRuntime, setShowRuntime] = useState(true);
  const [showLanguageModel, setShowLanguageModel] = useState(false);
  const [showSimpleExplanation, setShowSimpleExplanation] = useState(true);
  const [showEngineStepDetails, setShowEngineStepDetails] = useState(false);
  const [showRuntimeVerification, setShowRuntimeVerification] = useState(false);

  if (!step) {
    return <section className="rounded-xl border border-zinc-700 bg-[#101827] p-5 text-sm text-zinc-300">No simulation steps available.</section>;
  }

  const prevStep = stepIndex > 0 ? steps[stepIndex - 1] : undefined;
  const nextStep = stepIndex < steps.length - 1 ? steps[stepIndex + 1] : undefined;
  const stackFrames = step.snapshot.callStack.map((frame) => frame.name);
  const memory = step.snapshot.memoryHeap;
  const microtasks = step.snapshot.eventLoop.microtasks;
  const callbacks = step.snapshot.eventLoop.macrotasks;
  const webApis = step.snapshot.webApis;
  const explanationLines = getSimpleExplanation(step);
  const labels = getRuntimeLabels(language);
  const engineModel = getEngineModel(language, step.snapshot);
  const detailedEngineSteps = getEngineDetail(step, prevStep, nextStep);
  const consoleOutputLines =
    language === "javascript" && verification.verifiedOutput.length
      ? verification.verifiedOutput
      : step.snapshot.stdout;

  return (
    <section className="flex min-h-[44dvh] flex-col gap-3 overflow-auto pr-1 lg:min-h-0">
      <SectionCard
        title="What Line Is Running"
        collapsible
        open={showCurrentStep}
        onToggle={() => setShowCurrentStep((current) => !current)}
      >
        <p className="text-sm text-zinc-400">Running Step {stepIndex + 1} of {totalSteps}</p>
        <p className="mt-2 text-sm text-zinc-300">Running Line {step.line}</p>
        <p className="mt-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 font-mono text-sm text-cyan-100">{step.lineExecuted}</p>
        <p className="mt-3 text-sm text-zinc-200"><span className="font-semibold text-zinc-100">Explanation:</span> {step.details}</p>
      </SectionCard>

      <SectionCard
        title="Inside JavaScript Right Now"
        collapsible
        open={showRuntime}
        onToggle={() => setShowRuntime((current) => !current)}
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
            <h4 className="mb-2 text-sm font-semibold text-zinc-100">Call Stack (what is running)</h4>
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
            <h4 className="mb-2 text-sm font-semibold text-zinc-100">Memory (saved values)</h4>
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
            <h4 className="mb-2 text-sm font-semibold text-zinc-100">Queues (waiting work)</h4>
            <p className="text-xs text-zinc-300">{labels.queueA}</p>
            <p className="mb-2 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200">{microtasks.join(", ") || "empty"}</p>
            <p className="text-xs text-zinc-300">{labels.queueB}</p>
            <p className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200">{callbacks.join(", ") || "empty"}</p>
          </div>
        </div>

        {mode === "advanced" ? (
          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
              <h4 className="mb-2 text-sm font-semibold text-zinc-100">Execution Context</h4>
              <p className="text-xs text-zinc-200">Name: {step.snapshot.executionContext.name}</p>
              <p className="text-xs text-zinc-200">Phase: {step.snapshot.executionContext.phase}</p>
              <p className="text-xs text-zinc-200">Bindings: {step.snapshot.executionContext.variables.join(", ") || "(none)"}</p>
            </div>
            <div className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
              <h4 className="mb-2 text-sm font-semibold text-zinc-100">Web APIs / Timers</h4>
              <p className="text-xs text-zinc-200">{webApis.join(", ") || "idle"}</p>
            </div>
            <div className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
              <h4 className="mb-2 text-sm font-semibold text-zinc-100">Engine Internals</h4>
              <p className="text-xs text-zinc-200">Event loop processes synchronous code first.</p>
              <p className="text-xs text-zinc-200">Then microtasks, then callback/thread queue.</p>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="How This Language Runs"
        collapsible
        open={showLanguageModel}
        onToggle={() => setShowLanguageModel((current) => !current)}
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {engineModel.map((item) => (
            <article key={item.title} className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
              <h4 className="mb-1 text-sm font-semibold text-zinc-100">{item.title}</h4>
              <p className="font-mono text-xs text-zinc-200">{item.value}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Simple Explanation"
        collapsible
        open={showSimpleExplanation}
        onToggle={() => setShowSimpleExplanation((current) => !current)}
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-200">
          {explanationLines.map((line, idx) => (
            <li key={`${line}-${idx}`}>{line}</li>
          ))}
        </ol>

        <div className="mt-3 rounded-lg border border-sky-400/40 bg-[#0f2236] p-3">
          <h4 className="mb-2 text-sm font-semibold text-sky-100">
            {language === "javascript" ? "Verified Console Output" : "Console Output"}
          </h4>
          <div className="max-h-36 overflow-auto font-mono text-xs text-zinc-100">
            {consoleOutputLines.length ? consoleOutputLines.map((line, i) => <p key={`${line}-${i}`}>{line}</p>) : <p className="text-zinc-400">No output yet.</p>}
          </div>
        </div>
      </SectionCard>

      {language === "javascript" ? (
        <SectionCard
          title="Runtime Verification"
          collapsible
          open={showRuntimeVerification}
          onToggle={() => setShowRuntimeVerification((current) => !current)}
        >
          {verification.status === "verifying" ? (
            <p className="text-sm text-zinc-300">Checking output against real JavaScript runtime...</p>
          ) : verification.status === "ok" ? (
            <p className="text-sm text-emerald-300">Runtime output verified. No corrections needed.</p>
          ) : verification.status === "mismatch" ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-200">Output mismatch found. Auto-fixes are shown below.</p>
              {verification.issues.map((issue) => (
                <article key={issue.id} className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <p>Line {issue.line}</p>
                  <p>Simulated: {issue.simulatedOutput}</p>
                  <p>Runtime: {issue.actualOutput}</p>
                  <p>Fix: {issue.fix}</p>
                </article>
              ))}
            </div>
          ) : verification.status === "error" ? (
            <p className="text-sm text-red-300">Verification error: {verification.error ?? "Unknown runtime verifier error."}</p>
          ) : (
            <p className="text-sm text-zinc-400">Verification will run automatically while you type.</p>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Inside JS Engine (Step Details)"
        collapsible
        open={showEngineStepDetails}
        onToggle={() => setShowEngineStepDetails((current) => !current)}
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-200">
          {detailedEngineSteps.map((line, idx) => (
            <li key={`${line}-${idx}`}>{line}</li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title="Performance & Suggestions">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
            <h4 className="mb-1 text-sm font-semibold text-zinc-100">Estimated Run Time</h4>
            <p className="font-mono text-sm text-zinc-200">{performance.estimatedRunMs.toFixed(0)} ms</p>
          </article>
          <article className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
            <h4 className="mb-1 text-sm font-semibold text-zinc-100">Simulation Build Time</h4>
            <p className="font-mono text-sm text-zinc-200">{performance.simulationBuildMs.toFixed(2)} ms</p>
          </article>
          <article className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
            <h4 className="mb-1 text-sm font-semibold text-zinc-100">Last Full Run</h4>
            <p className="font-mono text-sm text-zinc-200">
              {performance.lastRunMs === null ? "Not run yet" : `${performance.lastRunMs.toFixed(0)} ms`}
            </p>
          </article>
          <article className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
            <h4 className="mb-1 text-sm font-semibold text-zinc-100">Memory After Execute</h4>
            <p className="font-mono text-sm text-zinc-200">{performance.currentMemoryBytes} bytes</p>
          </article>
          <article className="rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
            <h4 className="mb-1 text-sm font-semibold text-zinc-100">Peak Memory</h4>
            <p className="font-mono text-sm text-zinc-200">{performance.peakMemoryBytes} bytes</p>
          </article>
        </div>

        <div className="mt-3 rounded-lg border border-zinc-600 bg-[#0b1220] p-3">
          <h4 className="mb-2 text-sm font-semibold text-zinc-100">How You Can Improve</h4>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-200">
            {performance.tips.map((tip, index) => (
              <li key={`${tip}-${index}`}>{tip}</li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-zinc-400">
            Tip: change code, run again, and compare run time and suggestions.
          </p>
        </div>
      </SectionCard>
    </section>
  );
}
