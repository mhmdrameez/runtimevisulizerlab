"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CodeEditorPanel } from "@/components/CodeEditor/code-editor-panel";
import { ControlsBar } from "@/components/Controls/controls-bar";
import { VisualizationPanel } from "@/components/Visualization/visualization-panel";
import { buildSimulationSteps } from "@/lib/engineSimulator/build-simulation";
import { parseJavaScript } from "@/lib/parser/analyze-code";

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

const PLAYBACK_MS = 900;

export function SimulatorWorkbench() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const { steps, parseError } = useMemo(() => {
    const parsed = parseJavaScript(code);
    return {
      steps: buildSimulationSteps(parsed.program),
      parseError: parsed.error,
    };
  }, [code]);

  const currentStep = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];

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
        }
        return next;
      });
    }, PLAYBACK_MS);

    return clearPlaybackTimer;
  }, [isRunning, stepIndex, steps.length]);

  useEffect(() => clearPlaybackTimer, []);

  const onRun = () => {
    if (steps.length === 0) {
      return;
    }

    if (stepIndex >= steps.length - 1) {
      setStepIndex(0);
    }

    setIsRunning(true);
  };

  const onPause = () => {
    clearPlaybackTimer();
    setIsRunning(false);
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
  };

  return (
    <main className="h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top,#162039_0%,#0d111c_42%,#090c13_100%)] px-4 py-4 text-zinc-100 sm:px-6">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col rounded-2xl border border-cyan-400/20 bg-[#0a0e17]/95 shadow-[0_20px_80px_rgba(2,8,23,0.6)]">
        <header className="flex items-center justify-between border-b border-zinc-700/60 px-5 py-3">
          <div>
            <h1 className="font-mono text-sm uppercase tracking-[0.22em] text-cyan-300">JavaScript Engine Lab</h1>
            <p className="text-xs text-zinc-400">Visualize call stack, memory heap, execution context, and event loop.</p>
          </div>
          <p className="rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
            Next.js 16.1.6 + React 19.2.3
          </p>
        </header>

        <ControlsBar
          onRun={onRun}
          onPause={onPause}
          onStepForward={onStepForward}
          onReset={onReset}
          running={isRunning}
          canStep={stepIndex < steps.length - 1}
          stepIndex={stepIndex}
          totalSteps={steps.length}
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
            parseError={parseError}
          />
          <VisualizationPanel step={currentStep} stepIndex={stepIndex} totalSteps={steps.length} />
        </section>
      </div>
    </main>
  );
}
