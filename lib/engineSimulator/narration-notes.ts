import type { SimulationStep } from "@/types/simulator";

export function buildNarrationNotes(steps: SimulationStep[]): string[] {
  return steps.map((step, index) => {
    const lineText = step.lineExecuted.trim() || "empty line";
    return `Step ${index + 1}. Line ${step.line}. ${lineText}. ${step.details}`;
  });
}
