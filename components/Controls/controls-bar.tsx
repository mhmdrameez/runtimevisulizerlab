"use client";

interface ControlsBarProps {
  onRun: () => void;
  onStepForward: () => void;
  onPause: () => void;
  onReset: () => void;
  running: boolean;
  canStep: boolean;
  stepIndex: number;
  totalSteps: number;
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
  running,
  canStep,
  stepIndex,
  totalSteps,
}: ControlsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-700/70 px-4 py-3">
      <ControlButton label="Run" onClick={onRun} variant="primary" disabled={running || totalSteps === 0} />
      <ControlButton label="Step Forward" onClick={onStepForward} disabled={!canStep} />
      <ControlButton label="Pause" onClick={onPause} variant="warn" disabled={!running} />
      <ControlButton label="Reset" onClick={onReset} disabled={stepIndex === 0 && !running} />

      <p className="ml-auto rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
        Step {Math.min(stepIndex + 1, Math.max(totalSteps, 1))} / {Math.max(totalSteps, 1)}
      </p>
    </div>
  );
}