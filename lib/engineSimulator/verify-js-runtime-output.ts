import type { RuntimeVerificationIssue, RuntimeVerificationState, SimulationStep } from "@/types/simulator";

interface WorkerResult {
  logs: string[];
  error?: string;
}

function collectSimulatedConsoleOutputs(steps: SimulationStep[]): Array<{ line: number; output: string }> {
  const outputs: Array<{ line: number; output: string }> = [];
  let prevCount = 0;

  for (const step of steps) {
    const currentCount = step.snapshot.stdout.length;
    if (currentCount <= prevCount) {
      prevCount = currentCount;
      continue;
    }

    for (let index = prevCount; index < currentCount; index += 1) {
      outputs.push({
        line: step.line,
        output: step.snapshot.stdout[index] ?? "",
      });
    }

    prevCount = currentCount;
  }

  return outputs;
}

async function runInWorker(code: string, timeoutMs: number): Promise<WorkerResult> {
  if (typeof window === "undefined") {
    return { logs: [] };
  }

  const workerSource = `
self.onmessage = async (event) => {
  const source = String(event.data?.code ?? "");
  const logs = [];
  const microtasks = [];
  const macrotasks = [];

  const toText = (value) => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const consoleShim = {
    ...console,
    log: (...args) => {
      logs.push(args.map(toText).join(" "));
    },
  };

  const queueMicrotaskShim = (cb) => {
    microtasks.push(cb);
  };

  const setTimeoutShim = (cb, delay, ...args) => {
    macrotasks.push(() => cb(...args));
    return macrotasks.length;
  };

  const clearTimeoutShim = () => {};

  const drainMicrotasks = async () => {
    while (microtasks.length) {
      const task = microtasks.shift();
      try {
        task();
      } catch {}
      await Promise.resolve();
    }
  };

  try {
    const fn = new Function("console", "queueMicrotask", "setTimeout", "clearTimeout", "Promise", source);
    const maybePromise = fn(consoleShim, queueMicrotaskShim, setTimeoutShim, clearTimeoutShim, Promise);
    if (maybePromise && typeof maybePromise.then === "function") {
      await maybePromise;
    }
    await Promise.resolve();
    await drainMicrotasks();
    while (macrotasks.length) {
      const task = macrotasks.shift();
      task();
      await Promise.resolve();
      await drainMicrotasks();
    }
    self.postMessage({ logs });
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    self.postMessage({ logs, error: message });
  }
};
`;

  const blob = new Blob([workerSource], { type: "text/javascript" });
  const workerUrl = URL.createObjectURL(blob);

  try {
    const result = await new Promise<WorkerResult>((resolve) => {
      const worker = new Worker(workerUrl);
      const timer = window.setTimeout(() => {
        worker.terminate();
        resolve({
          logs: [],
          error: `Verification timed out after ${timeoutMs}ms.`,
        });
      }, timeoutMs);

      worker.onmessage = (event: MessageEvent<WorkerResult>) => {
        window.clearTimeout(timer);
        worker.terminate();
        resolve(event.data);
      };

      worker.onerror = () => {
        window.clearTimeout(timer);
        worker.terminate();
        resolve({
          logs: [],
          error: "Runtime verification worker failed to execute code.",
        });
      };

      worker.postMessage({ code });
    });

    return result;
  } finally {
    URL.revokeObjectURL(workerUrl);
  }
}

export async function verifyJavaScriptRuntimeOutput(
  code: string,
  steps: SimulationStep[],
  timeoutMs = 1200,
): Promise<RuntimeVerificationState> {
  if (!code.trim() || steps.length === 0) {
    return {
      status: "idle",
      verifiedOutput: [],
      issues: [],
    };
  }

  const simulated = collectSimulatedConsoleOutputs(steps);
  const workerResult = await runInWorker(code, timeoutMs);
  const actual = workerResult.logs;
  const maxCount = Math.max(simulated.length, actual.length);
  const issues: RuntimeVerificationIssue[] = [];

  for (let index = 0; index < maxCount; index += 1) {
    const sim = simulated[index];
    const simulatedOutput = sim?.output ?? "(no simulated output)";
    const actualOutput = actual[index] ?? "(no runtime output)";

    // Runtime produced output for behavior not yet modeled by simulator.
    // Don't surface this as an editor mismatch warning.
    if (!sim && actual[index] !== undefined) {
      continue;
    }

    if (simulatedOutput === actualOutput) {
      continue;
    }

    issues.push({
      id: `verify-${index}`,
      line: sim?.line ?? steps.at(-1)?.line ?? 1,
      simulatedOutput,
      actualOutput,
      fix: `Use runtime output "${actualOutput}" instead of "${simulatedOutput}".`,
    });
  }

  if (workerResult.error) {
    return {
      status: issues.length ? "mismatch" : "error",
      verifiedOutput: actual,
      issues,
      error: workerResult.error,
    };
  }

  return {
    status: issues.length ? "mismatch" : "ok",
    verifiedOutput: actual,
    issues,
  };
}
