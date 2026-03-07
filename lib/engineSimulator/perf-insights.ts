export interface PerformanceInsights {
  estimatedRunMs: number;
  simulationBuildMs: number;
  tips: string[];
}

export function buildPerformanceTips(code: string): string[] {
  const tips: string[] = [];

  const loopCount = (code.match(/\bfor\s*\(|\bwhile\s*\(/g) ?? []).length;
  const nestedLoopLikely = /for\s*\([^)]*\)\s*\{[\s\S]*for\s*\(/m.test(code) || /while\s*\([^)]*\)\s*\{[\s\S]*while\s*\(/m.test(code);
  const logCount = (code.match(/console\.log\s*\(/g) ?? []).length;
  const varCount = (code.match(/\bvar\s+/g) ?? []).length;
  const timeoutCount = (code.match(/setTimeout\s*\(/g) ?? []).length;
  const funcCount = (code.match(/\bfunction\s+[A-Za-z_][\w]*\s*\(/g) ?? []).length;

  if (nestedLoopLikely) {
    tips.push("Nested loops can be slow. Try reducing repeated work or using a lookup object/map.");
  } else if (loopCount > 0) {
    tips.push("Loops are fine, but keep loop body small for better performance.");
  }

  if (logCount >= 4) {
    tips.push("Too many console.log calls can slow execution. Remove logs in production code.");
  }

  if (varCount > 0) {
    tips.push("Prefer let/const over var for clearer scope and fewer bugs.");
  }

  if (timeoutCount > 0) {
    tips.push("setTimeout callbacks run later. Keep callback logic short to avoid UI lag.");
  }

  if (funcCount >= 5) {
    tips.push("You have many functions. Group related logic into modules for readability.");
  }

  if (tips.length === 0) {
    tips.push("Code looks simple. Try adding more inputs and edge cases to test behavior.");
    tips.push("Practice by changing values and watching how stack, memory, and queues update.");
  }

  return tips;
}