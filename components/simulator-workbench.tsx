"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeEditorPanel } from "@/components/CodeEditor/code-editor-panel";
import { ControlsBar } from "@/components/Controls/controls-bar";
import { VisualizationPanel } from "@/components/Visualization/visualization-panel";
import { simulateRuntime } from "@/lib/engineSimulator/simulate-runtime";
import { verifyJavaScriptRuntimeOutput } from "@/lib/engineSimulator/verify-js-runtime-output";
import { buildPerformanceTips } from "@/lib/engineSimulator/perf-insights";
import type { RuntimeVerificationState, VisualizationMode } from "@/types/simulator";

const GITHUB_URL = "https://github.com/mhmdrameez/runtimevisulizerlab";

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
const AUTO_RUN_DEBOUNCE_MS = 850;
const VERIFY_DEBOUNCE_MS = 260;

function estimateHeapBytes(memory: Array<{ key: string; value: string; scope: string }>): number {
  return memory.reduce((total, item) => {
    const chars = item.key.length + item.value.length + item.scope.length;
    return total + chars * 2 + 24;
  }, 0);
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M12 .5a12 12 0 0 0-3.79 23.38c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.1-.75.09-.74.09-.74 1.2.09 1.84 1.23 1.84 1.23 1.08 1.85 2.83 1.31 3.52 1 .11-.78.42-1.31.77-1.61-2.66-.3-5.47-1.33-5.47-5.9 0-1.3.46-2.35 1.22-3.18-.12-.3-.53-1.54.12-3.2 0 0 1-.32 3.28 1.22a11.42 11.42 0 0 1 5.97 0c2.27-1.54 3.27-1.22 3.27-1.22.65 1.66.24 2.9.12 3.2.76.83 1.22 1.88 1.22 3.18 0 4.58-2.81 5.59-5.49 5.89.44.38.82 1.11.82 2.25v3.33c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

export function SimulatorWorkbench() {
  const language = "javascript" as const;
  const [mode, setMode] = useState<VisualizationMode>("beginner");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoRunOnType, setAutoRunOnType] = useState(false);
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const syncWithNarration = true;
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const [verification, setVerification] = useState<RuntimeVerificationState>({
    status: "idle",
    verifiedOutput: [],
    issues: [],
    error: undefined,
  });
  const timerRef = useRef<number | null>(null);
  const runStartRef = useRef<number | null>(null);
  const lastNarratedStepIdRef = useRef<string | null>(null);
  const autoRunDebounceRef = useRef<number | null>(null);
  const lastAutoRunCodeRef = useRef<string>("");
  const verifyRequestIdRef = useRef(0);

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

  const clearAutoRunDebounce = () => {
    if (autoRunDebounceRef.current !== null) {
      window.clearTimeout(autoRunDebounceRef.current);
      autoRunDebounceRef.current = null;
    }
  };

  const isLineCompleteForAutoRun = (source: string): boolean => {
    const trimmedEnd = source.trimEnd();
    if (!trimmedEnd) {
      return false;
    }

    const lastChar = trimmedEnd.at(-1) ?? "";
    if ([";", "}", ")"].includes(lastChar)) {
      return true;
    }

    return /\n\s*$/.test(source);
  };

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const finishRunIfNeeded = useCallback(() => {
    setIsRunning(false);
    if (runStartRef.current !== null) {
      setLastRunMs(performance.now() - runStartRef.current);
      runStartRef.current = null;
    }
  }, []);

  const speakText = useCallback((text: string, onDone?: () => void) => {
    if (!narrationEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone?.();
      return;
    }

    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Math.min(1.4, Math.max(0.75, playbackSpeed));
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => onDone?.();
    window.speechSynthesis.speak(utterance);
  }, [narrationEnabled, playbackSpeed, stopSpeech]);

  useEffect(() => {
    clearPlaybackTimer();

    if (!isRunning || steps.length === 0 || (narrationEnabled && syncWithNarration)) {
      return;
    }

    if (stepIndex >= steps.length - 1) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setStepIndex((current) => {
        const next = Math.min(current + 1, steps.length - 1);
        if (next >= steps.length - 1) {
          finishRunIfNeeded();
        }
        return next;
      });
    }, PLAYBACK_MS / playbackSpeed);

    return clearPlaybackTimer;
  }, [isRunning, stepIndex, steps.length, playbackSpeed, narrationEnabled, syncWithNarration, finishRunIfNeeded]);

  useEffect(() => clearPlaybackTimer, []);

  useEffect(() => {
    if (!isRunning || !narrationEnabled || !syncWithNarration || !currentStep) {
      return;
    }

    if (lastNarratedStepIdRef.current === currentStep.id) {
      return;
    }
    lastNarratedStepIdRef.current = currentStep.id;

    speakText(`Step ${stepIndex + 1}. ${currentStep.details}`, () => {
      setStepIndex((current) => {
        if (current >= steps.length - 1) {
          finishRunIfNeeded();
          return current;
        }

        const next = current + 1;
        if (next >= steps.length - 1) {
          finishRunIfNeeded();
        }
        return next;
      });
    });
  }, [isRunning, narrationEnabled, syncWithNarration, currentStep, stepIndex, steps.length, finishRunIfNeeded, speakText]);

  useEffect(() => {
    if (!isRunning || !narrationEnabled || syncWithNarration || !currentStep) {
      return;
    }

    if (lastNarratedStepIdRef.current === currentStep.id) {
      return;
    }
    lastNarratedStepIdRef.current = currentStep.id;
    speakText(`Step ${stepIndex + 1}. ${currentStep.details}`);
  }, [isRunning, narrationEnabled, syncWithNarration, currentStep, stepIndex, speakText]);

  const onRun = useCallback(() => {
    if (steps.length === 0) {
      return;
    }

    if (stepIndex >= steps.length - 1) {
      setStepIndex(0);
    }

    runStartRef.current = performance.now();
    lastNarratedStepIdRef.current = null;
    setIsRunning(true);
  }, [steps.length, stepIndex]);

  const onPause = () => {
    clearPlaybackTimer();
    setIsRunning(false);
    runStartRef.current = null;
    stopSpeech();
  };

  const onStepForward = () => {
    clearPlaybackTimer();
    setIsRunning(false);
    stopSpeech();
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const onReset = useCallback(() => {
    clearPlaybackTimer();
    setIsRunning(false);
    setStepIndex(0);
    runStartRef.current = null;
    lastNarratedStepIdRef.current = null;
    stopSpeech();
  }, [stopSpeech]);

  const onClear = () => {
    clearPlaybackTimer();
    clearAutoRunDebounce();
    setIsRunning(false);
    setStepIndex(0);
    setCode(EMPTY_CODE);
    runStartRef.current = null;
    setLastRunMs(null);
    lastNarratedStepIdRef.current = null;
    stopSpeech();
  };

  const onExplainStep = () => {
    if (!currentStep) {
      return;
    }
    speakText(`Current line ${currentStep.line}. ${currentStep.lineExecuted}. ${currentStep.details}`);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        onRun();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRun]);

  useEffect(() => {
    clearAutoRunDebounce();
    if (!autoRunOnType) {
      return;
    }
    if (isRunning || code.trim().length === 0 || steps.length === 0 || error) {
      return;
    }

    if (lastAutoRunCodeRef.current === code) {
      return;
    }

    if (!isLineCompleteForAutoRun(code)) {
      return;
    }

    autoRunDebounceRef.current = window.setTimeout(() => {
      if (lastAutoRunCodeRef.current === code) {
        return;
      }
      lastAutoRunCodeRef.current = code;
      onReset();
      runStartRef.current = performance.now();
      lastNarratedStepIdRef.current = null;
      setIsRunning(true);
    }, AUTO_RUN_DEBOUNCE_MS);

    return clearAutoRunDebounce;
  }, [code, autoRunOnType, steps.length, error, isRunning, onReset]);

  useEffect(() => {
    verifyRequestIdRef.current += 1;
    const requestId = verifyRequestIdRef.current;

    if (language !== "javascript" || !code.trim() || error || steps.length === 0) {
      const idleTimer = window.setTimeout(() => {
        if (verifyRequestIdRef.current !== requestId) {
          return;
        }
        setVerification({
          status: "idle",
          verifiedOutput: [],
          issues: [],
          error: undefined,
        });
      }, 0);
      return () => window.clearTimeout(idleTimer);
    }

    const statusTimer = window.setTimeout(() => {
      if (verifyRequestIdRef.current !== requestId) {
        return;
      }
      setVerification((previous) => ({
        ...previous,
        status: "verifying",
        error: undefined,
      }));
    }, 0);

    const timer = window.setTimeout(async () => {
      const result = await verifyJavaScriptRuntimeOutput(code, steps);
      if (verifyRequestIdRef.current !== requestId) {
        return;
      }
      setVerification(result);
    }, VERIFY_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(statusTimer);
      window.clearTimeout(timer);
    };
  }, [language, code, error, steps]);

  return (
    <main className="min-h-dvh w-full overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top,#162039_0%,#0d111c_42%,#090c13_100%)] px-3 py-3 text-zinc-100 sm:px-6 sm:py-4">
      <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] max-w-[1600px] flex-col rounded-2xl border border-cyan-400/20 bg-[#0a0e17]/95 shadow-[0_20px_80px_rgba(2,8,23,0.6)] sm:min-h-[calc(100dvh-2rem)]">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700/60 px-4 py-3 sm:px-5">
          <div>
            <h1 className="font-mono text-sm uppercase tracking-[0.22em] text-cyan-300">INSIDE JS</h1>
            <p className="text-xs text-zinc-400">A simple lab to understand JavaScript runtime.</p>
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <p className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100">JavaScript</p>
            <a
              href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-500/25"
            >
              Contribute
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              aria-label="Open GitHub repository"
              title="Open GitHub repository"
            >
              <GitHubIcon />
              <span>GitHub</span>
            </a>
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
          onExplainStep={onExplainStep}
          autoRunOnType={autoRunOnType}
          onToggleAutoRunOnType={() => {
            clearAutoRunDebounce();
            lastAutoRunCodeRef.current = "";
            setAutoRunOnType((current) => !current);
          }}
          narrationEnabled={narrationEnabled}
          onToggleNarration={() => {
            setNarrationEnabled((current) => {
              const next = !current;
              if (!next) {
                stopSpeech();
              }
              lastNarratedStepIdRef.current = null;
              return next;
            });
          }}
          speed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          running={isRunning}
          canStep={stepIndex < steps.length - 1}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          canClear={code.trim().length > 0 || stepIndex > 0 || isRunning}
        />

        <section className="grid grid-cols-1 gap-3 p-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[1.1fr_1fr]">
          <CodeEditorPanel
            code={code}
            onChange={(value) => {
              clearPlaybackTimer();
              clearAutoRunDebounce();
              setIsRunning(false);
              setStepIndex(0);
              setCode(value);
            }}
            activeLine={currentStep?.snapshot.activeLine ?? 1}
            language={language}
            parseError={error}
            verificationIssues={verification.issues}
          />
          <VisualizationPanel
            step={currentStep}
            steps={steps}
            stepIndex={stepIndex}
            totalSteps={steps.length}
            language={language}
            mode={mode}
            verification={verification}
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
