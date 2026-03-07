import { buildSimulationSteps } from "@/lib/engineSimulator/build-simulation";
import { parseJavaScript } from "@/lib/parser/analyze-code";
import type {
  MemoryEntry,
  SimulationSnapshot,
  SimulationStep,
  StackFrame,
  SupportedLanguage,
} from "@/types/simulator";

export interface RuntimeSimulationResult {
  steps: SimulationStep[];
  error?: string;
}

const EMPTY_RESULT: RuntimeSimulationResult = {
  steps: [],
};

function makeBaseSnapshot(): SimulationSnapshot {
  return {
    callStack: [{ id: "global", name: "Global()", line: 1 }],
    memoryHeap: [],
    executionContext: {
      name: "Global",
      phase: "execution",
      variables: [],
    },
    eventLoop: {
      microtasks: [],
      macrotasks: [],
    },
    webApis: [],
    stdout: [],
    activeLine: 1,
  };
}

function cloneSnapshot(snapshot: SimulationSnapshot): SimulationSnapshot {
  return {
    callStack: snapshot.callStack.map((frame) => ({ ...frame })),
    memoryHeap: snapshot.memoryHeap.map((entry) => ({ ...entry })),
    executionContext: {
      ...snapshot.executionContext,
      variables: [...snapshot.executionContext.variables],
    },
    eventLoop: {
      microtasks: [...snapshot.eventLoop.microtasks],
      macrotasks: [...snapshot.eventLoop.macrotasks],
    },
    webApis: [...snapshot.webApis],
    stdout: [...snapshot.stdout],
    activeLine: snapshot.activeLine,
  };
}

function upsertMemory(memory: MemoryEntry[], key: string, value: string, scope = "global") {
  const existing = memory.find((entry) => entry.key === key && entry.scope === scope);
  if (existing) {
    existing.value = value;
    return;
  }

  memory.push({
    id: `${scope}-${key}`,
    key,
    value,
    scope,
  });
}

function detectVariable(line: string): { name: string; value: string } | null {
  const assignMatch = line.match(/^(?:const|let|var|int|float|double|String|char|bool|auto)?\s*([A-Za-z_][\w]*)\s*=\s*(.+?);?$/);
  if (!assignMatch) return null;
  return { name: assignMatch[1], value: assignMatch[2].trim() };
}

function detectFunctionDeclaration(language: SupportedLanguage, line: string): string | null {
  if (language === "python") {
    const m = line.match(/^def\s+([A-Za-z_][\w]*)\s*\(/);
    return m?.[1] ?? null;
  }

  if (language === "go") {
    const m = line.match(/^func\s+([A-Za-z_][\w]*)\s*\(/);
    return m?.[1] ?? null;
  }

  const cFamily = line.match(/^(?:public\s+|private\s+|static\s+|inline\s+|virtual\s+|final\s+|)\s*(?:[A-Za-z_][\w<>:]*)\s+([A-Za-z_][\w]*)\s*\([^)]*\)\s*\{?$/);
  if (cFamily && !["if", "for", "while", "switch", "catch"].includes(cFamily[1])) {
    return cFamily[1];
  }

  return null;
}

function detectFunctionCall(line: string): string | null {
  const m = line.match(/([A-Za-z_][\w]*)\s*\(/);
  if (!m) return null;
  const name = m[1];
  if (["if", "for", "while", "switch", "return", "print", "console", "fmt", "System"].includes(name)) {
    return null;
  }
  return name;
}

function detectConsoleLine(language: SupportedLanguage, line: string): string | null {
  if (language === "javascript" && line.includes("console.log")) return line;
  if (language === "python" && line.includes("print(")) return line;
  if (language === "go" && line.includes("fmt.Println")) return line;
  if (language === "java" && line.includes("System.out.println")) return line;
  if ((language === "c" || language === "cpp") && (line.includes("printf(") || line.includes("cout"))) return line;
  return null;
}

function extractOutput(line: string): string {
  const inside = line.match(/\((.*)\)/)?.[1]?.trim();
  if (!inside) return "output";
  return inside.replace(/^['\"]|['\"]$/g, "");
}

function simulateGeneric(language: SupportedLanguage, code: string): RuntimeSimulationResult {
  const lines = code.split(/\r?\n/);
  if (lines.length === 0) return EMPTY_RESULT;

  const steps: SimulationStep[] = [];
  const snapshot = makeBaseSnapshot();
  const pendingPops: StackFrame[] = [];

  lines.forEach((raw, index) => {
    const lineNumber = index + 1;
    const line = raw.trim();
    if (!line) return;

    if (pendingPops.length) {
      snapshot.callStack.pop();
      pendingPops.pop();
    }

    let action = "Interpreter executes this line.";

    const fnDecl = detectFunctionDeclaration(language, line);
    if (fnDecl) {
      upsertMemory(snapshot.memoryHeap, fnDecl, `function ${fnDecl}()`);
      if (!snapshot.executionContext.variables.includes(fnDecl)) {
        snapshot.executionContext.variables.push(fnDecl);
      }
      action = `Function ${fnDecl} is loaded into memory.`;
    }

    const variable = detectVariable(line);
    if (variable) {
      upsertMemory(snapshot.memoryHeap, variable.name, variable.value);
      if (!snapshot.executionContext.variables.includes(variable.name)) {
        snapshot.executionContext.variables.push(variable.name);
      }
      action = `Variable ${variable.name} is stored in memory.`;
    }

    const consoleLine = detectConsoleLine(language, line);
    if (consoleLine) {
      snapshot.stdout.push(extractOutput(consoleLine));
      action = "A value is printed to console output.";
    }

    if (language === "javascript") {
      if (line.includes("Promise") || line.includes("queueMicrotask")) {
        snapshot.eventLoop.microtasks.push("microtask callback");
        action = "A microtask callback is queued.";
      }
      if (line.includes("setTimeout")) {
        snapshot.eventLoop.macrotasks.push("setTimeout callback");
        snapshot.webApis.push("setTimeout timer");
        action = "setTimeout is registered in Web APIs and callback queue.";
      }
    }

    if (language === "go" && line.startsWith("go ")) {
      snapshot.eventLoop.macrotasks.push("goroutine");
      snapshot.webApis.push("Go scheduler");
      action = "A new goroutine is scheduled by the Go runtime.";
    }

    if ((language === "java" || language === "cpp" || language === "c") && /thread|pthread|std::thread/i.test(line)) {
      snapshot.eventLoop.macrotasks.push("thread task");
      snapshot.webApis.push("runtime thread scheduler");
      action = "A new thread is created and scheduled by runtime.";
    }

    const fnCall = detectFunctionCall(line);
    if (fnCall && !line.includes("=") && !consoleLine) {
      const frame: StackFrame = {
        id: `${fnCall}-${lineNumber}`,
        name: `${fnCall}()`,
        line: lineNumber,
      };
      snapshot.callStack.push(frame);
      pendingPops.push(frame);
      action = `Function ${fnCall}() is pushed to the Call Stack.`;
    }

    snapshot.activeLine = lineNumber;

    const runtimeName =
      language === "python"
        ? "Python Interpreter"
        : language === "go"
          ? "Go Runtime"
          : language === "javascript"
            ? "JavaScript Engine"
            : `${language.toUpperCase()} Runtime`;

    steps.push({
      id: `step-${lineNumber}-${steps.length + 1}`,
      line: lineNumber,
      lineExecuted: raw,
      title: `${runtimeName} Step`,
      details: action,
      snapshot: cloneSnapshot(snapshot),
    });
  });

  return { steps };
}

export function simulateRuntime(language: SupportedLanguage, code: string): RuntimeSimulationResult {
  if (language === "javascript") {
    const parsed = parseJavaScript(code);
    return {
      steps: buildSimulationSteps(parsed.program, code),
      error: parsed.error,
    };
  }

  return simulateGeneric(language, code);
}