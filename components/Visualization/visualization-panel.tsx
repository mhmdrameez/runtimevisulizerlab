"use client";

import { useEffect, useRef, useState } from "react";
import { EventLoopThreeScene } from "@/components/Visualization/event-loop-3d-scene";
import type { SimulationStep } from "@/types/simulator";

interface VisualizationPanelProps {
  step?: SimulationStep;
  stepIndex: number;
  totalSteps: number;
}

function getAnimationPhase(step: SimulationStep): "idle" | "macro" | "micro" | "stack" | "console" {
  const text = `${step.title} ${step.details}`.toLowerCase();
  if (text.includes("console.log") || text.includes("output")) return "console";
  if (text.includes("microtask")) return "micro";
  if (text.includes("macrotask") || text.includes("settimeout")) return "macro";
  if (text.includes("call stack") || text.includes("function") || text.includes("event loop tick")) return "stack";
  return "idle";
}

function ConsoleCard({ lines }: { lines: string[] }) {
  return (
    <article className="panel-3d rounded-xl border border-sky-400/40 bg-[#0f2236] p-3">
      <h3 className="mb-2 text-base font-semibold text-sky-100">Console Output</h3>
      <div className="max-h-[220px] min-h-[140px] overflow-auto rounded-md border border-sky-400/40 bg-[#04070d] p-2 font-mono text-sm text-zinc-100">
        {lines.length ? lines.map((line, i) => <p key={`${line}-${i}`}>{line}</p>) : <p className="text-zinc-500">No output yet.</p>}
      </div>
    </article>
  );
}

export function VisualizationPanel({ step, stepIndex, totalSteps }: VisualizationPanelProps) {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === sceneContainerRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    const container = sceneContainerRef.current;
    if (!container) return;

    if (document.fullscreenElement === container) {
      await document.exitFullscreen();
      return;
    }

    await container.requestFullscreen();
  };

  if (!step) {
    return <section className="rounded-xl border border-zinc-700 bg-[#0b1220] p-5 text-sm text-zinc-300">No simulation steps available.</section>;
  }

  const stackFrames = step.snapshot.callStack.map((frame) => frame.name);
  const callbackQueue = step.snapshot.eventLoop.macrotasks;
  const priorityQueue = step.snapshot.eventLoop.microtasks;
  const animationPhase = getAnimationPhase(step);

  return (
    <section ref={sceneContainerRef} className="scene-3d flex min-h-0 flex-col gap-3 overflow-auto pr-1">
      <article className="panel-3d rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-cyan-200">Step {stepIndex + 1} / {totalSteps}</p>
            <h2 className="text-xl font-semibold text-white">{step.title}</h2>
            <p className="text-base text-zinc-100">{step.details}</p>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md border border-cyan-300/40 bg-cyan-400/15 px-3 py-1.5 text-sm font-medium text-cyan-100 hover:bg-cyan-400/25"
          >
            {isFullscreen ? "Exit Full Screen" : "Full Screen"}
          </button>
        </div>
      </article>

      <div className={`rounded-xl ${isFullscreen ? "bg-[#050911] p-3" : ""}`}>
        <EventLoopThreeScene
          stepId={step.id}
          callStack={stackFrames}
          macrotasks={callbackQueue}
          microtasks={priorityQueue}
          hasConsoleOutput={step.snapshot.stdout.length > 0}
          phase={animationPhase}
          heightClassName={isFullscreen ? "h-[92vh]" : "h-[380px]"}
        />
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <article className="panel-3d rounded-xl border border-zinc-600 bg-[#121a2a] p-3 text-sm text-zinc-100">
          <h3 className="mb-2 text-base font-semibold text-white">Live State</h3>
          <p>Call Stack: {stackFrames.length}</p>
          <p>Priority Queue: {priorityQueue.length}</p>
          <p>Callback Queue: {callbackQueue.length}</p>
          <p>Context: {step.snapshot.executionContext.name}</p>
          <p>Phase: {step.snapshot.executionContext.phase}</p>
        </article>

        <ConsoleCard lines={step.snapshot.stdout} />
      </div>
    </section>
  );
}
