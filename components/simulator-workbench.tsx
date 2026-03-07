"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CodeEditorPanel } from "@/components/CodeEditor/code-editor-panel";
import { ControlsBar } from "@/components/Controls/controls-bar";
import { VisualizationPanel } from "@/components/Visualization/visualization-panel";
import { simulateRuntime } from "@/lib/engineSimulator/simulate-runtime";
import { buildPerformanceTips } from "@/lib/engineSimulator/perf-insights";
import type { VisualizationMode } from "@/types/simulator";

const DEFAULT_CODE = `function add(a, b) {
  return a + b;
}

const result = add(2, 3);
console.log(result);

queueMicrotask(() => {
  console.log("microtask fired");
});

setTimeout(() => {
  console.log("macrotask fired");
}, 0);`;
const EMPTY_CODE = "";

const PLAYBACK_MS = 900;

function estimateHeapBytes(memory: Array<{ key: string; value: string; scope: string }>): number {
  return memory.reduce((total, item) => {
    const chars = item.key.length + item.value.length + item.scope.length;
    return total + chars * 2 + 24;
  }, 0);
}

export function SimulatorWorkbench() {
  const language = "javascript" as const;
  const [mode, setMode] = useState<VisualizationMode>("beginner");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const runStartRef = useRef<number | null>(null);

  const { steps, error } = useMemo(() => {
    return simulateRuntime(language, code);
  }, [code]);
  const simulationBuildMs = Math.max(0.2, steps.length * 0.15 + code.length * 0.002);
  const performanceTips = useMemo(() => buildPerformanceTips(code), [code]);
  const estimatedRunMs = Math.max(0, (steps.length - 1) * (PLAYBACK_MS / playbackSpeed));

  const currentStep = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];
  const currentMemoryBytes = currentStep ? estimateHeapBytes(currentStep.snapshot.memoryHeap) : 0;
  const peakMemoryBytes = steps.reduce((peak, s) => {
    const bytes = estimateHeapBytes(s.snapshot.memoryHeap);
    return Math.max(peak, bytes);
  }, 0);

  const clearPlaybackTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    clearPlaybackTimer();

    if (!isRunning || steps.length === 0) {
      return;
    }

    if (stepIndex >= steps.length - 1) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setStepIndex((current) => {
        const next = Math.min(current + 1, steps.length - 1);
        if (next >= steps.length - 1) {
          setIsRunning(false);
          if (runStartRef.current !== null) {
            setLastRunMs(performance.now() - runStartRef.current);
            runStartRef.current = null;
          }
        }
        return next;
      });
    }, PLAYBACK_MS / playbackSpeed);

    return clearPlaybackTimer;
  }, [isRunning, stepIndex, steps.length, playbackSpeed]);

  useEffect(() => clearPlaybackTimer, []);

  const onRun = () => {
    if (steps.length === 0) {
      return;
    }

    if (stepIndex >= steps.length - 1) {
      setStepIndex(0);
    }

    runStartRef.current = performance.now();
    setIsRunning(true);
  };

  const onPause = () => {
    clearPlaybackTimer();
    setIsRunning(false);
    runStartRef.current = null;
  };

  const onStepForward = () => {
    clearPlaybackTimer();
    setIsRunning(false);
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const onReset = () => {
    clearPlaybackTimer();
    setIsRunning(false);
    setStepIndex(0);
    runStartRef.current = null;
  };

  const onClear = () => {
    clearPlaybackTimer();
    setIsRunning(false);
    setStepIndex(0);
    setCode(EMPTY_CODE);
    runStartRef.current = null;
    setLastRunMs(null);
  };

  return (
    <main className="h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top,#162039_0%,#0d111c_42%,#090c13_100%)] px-4 py-4 text-zinc-100 sm:px-6">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col rounded-2xl border border-cyan-400/20 bg-[#0a0e17]/95 shadow-[0_20px_80px_rgba(2,8,23,0.6)]">
        <header className="flex items-center justify-between border-b border-zinc-700/60 px-5 py-3">
          <div>
            <h1 className="font-mono text-sm uppercase tracking-[0.22em] text-cyan-300">INSIDE JS</h1>
            <p className="text-xs text-zinc-400">A simple lab to understand JavaScript runtime.</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100">JavaScript</p>
            <button
              type="button"
              onClick={() => setMode((current) => (current === "beginner" ? "advanced" : "beginner"))}
              className="rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300"
            >
              {mode === "beginner" ? "Simple View" : "More Details"}
            </button>
          </div>
        </header>

        <ControlsBar
          onRun={onRun}
          onPause={onPause}
          onStepForward={onStepForward}
          onReset={onReset}
          onClear={onClear}
          speed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          running={isRunning}
          canStep={stepIndex < steps.length - 1}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          canClear={code.trim().length > 0 || stepIndex > 0 || isRunning}
        />

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1.1fr_1fr]">
          <CodeEditorPanel
            code={code}
            onChange={(value) => {
              clearPlaybackTimer();
              setIsRunning(false);
              setStepIndex(0);
              setCode(value);
            }}
            activeLine={currentStep?.snapshot.activeLine ?? 1}
            language={language}
            parseError={error}
          />
          <VisualizationPanel
            step={currentStep}
            steps={steps}
            stepIndex={stepIndex}
            totalSteps={steps.length}
            language={language}
            mode={mode}
            performance={{
              estimatedRunMs,
              simulationBuildMs,
              lastRunMs,
              currentMemoryBytes,
              peakMemoryBytes,
              tips: performanceTips,
            }}
          />
        </section>
      </div>
    </main>
  );
}
