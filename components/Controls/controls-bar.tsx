"use client";

interface ControlsBarProps {
  onRun: () => void;
  onStepForward: () => void;
  onPause: () => void;
  onReset: () => void;
  onClear: () => void;
  onExplainStep: () => void;
  autoRunOnType: boolean;
  onToggleAutoRunOnType: () => void;
  narrationEnabled: boolean;
  onToggleNarration: () => void;
  speed: number;
  onSpeedChange: (value: number) => void;
  running: boolean;
  canStep: boolean;
  stepIndex: number;
  totalSteps: number;
  canClear: boolean;
}

function ControlButton({
  label,
  onClick,
  disabled,
  variant = "neutral",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "warn" | "neutral";
}) {
  const variantClass =
    variant === "primary"
      ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-400/30"
      : variant === "warn"
        ? "border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-400/25"
        : "border-zinc-600 bg-zinc-800/80 text-zinc-100 hover:bg-zinc-700";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-1.5 text-sm transition ${variantClass} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  );
}

export function ControlsBar({
  onRun,
  onStepForward,
  onPause,
  onReset,
  onClear,
  onExplainStep,
  autoRunOnType,
  onToggleAutoRunOnType,
  narrationEnabled,
  onToggleNarration,
  speed,
  onSpeedChange,
  running,
  canStep,
  stepIndex,
  totalSteps,
  canClear,
}: ControlsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-700/70 px-4 py-3">
      <ControlButton label="Run" onClick={onRun} variant="primary" disabled={running || totalSteps === 0} />
      <ControlButton label="Step Forward" onClick={onStepForward} disabled={!canStep} />
      <ControlButton label="Pause" onClick={onPause} variant="warn" disabled={!running} />
      <ControlButton label="Reset" onClick={onReset} disabled={stepIndex === 0 && !running} />
      <ControlButton label="Clear" onClick={onClear} disabled={!canClear} />
      <ControlButton label="Explain Step" onClick={onExplainStep} disabled={totalSteps === 0} />
      <ControlButton
        label={autoRunOnType ? "Auto Run On" : "Auto Run Off"}
        onClick={onToggleAutoRunOnType}
        variant={autoRunOnType ? "primary" : "neutral"}
      />
      <ControlButton
        label={narrationEnabled ? "Voice On" : "Voice Off"}
        onClick={onToggleNarration}
        variant={narrationEnabled ? "primary" : "neutral"}
      />

      <label className="ml-2 flex items-center gap-2 text-xs text-zinc-300">
        <span>Speed</span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
          className="h-1.5 w-28 cursor-pointer accent-cyan-400"
        />
        <span className="w-9 text-right font-mono">{speed.toFixed(1)}x</span>
      </label>

      <p className="ml-auto rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
        Step {Math.min(stepIndex + 1, Math.max(totalSteps, 1))} / {Math.max(totalSteps, 1)}
      </p>
      <p className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
        Run shortcut: Ctrl/Cmd + Enter
      </p>
    </div>
  );
}
