import type {
  FunctionInfo,
  MemoryEntry,
  Operation,
  ParsedProgram,
  SimulationSnapshot,
  SimulationStep,
  StackFrame,
} from "@/types/simulator";

interface RuntimeState {
  callStack: StackFrame[];
  memoryHeap: MemoryEntry[];
  eventLoop: {
    microtasks: string[];
    macrotasks: string[];
  };
  webApis: string[];
  stdout: string[];
  contextVariables: string[];
  contextName: string;
  contextPhase: "creation" | "execution";
  activeLine: number;
}

interface Scope {
  name: string;
  values: Record<string, string>;
}

interface Task {
  queue: "microtask" | "macrotask";
  label: string;
  body: Operation[];
  line: number;
}

const MAX_LOOP_ITERATIONS = 10;

function makeInitialState(): RuntimeState {
  return {
    callStack: [],
    memoryHeap: [],
    eventLoop: {
      microtasks: [],
      macrotasks: [],
    },
    webApis: [],
    stdout: [],
    contextVariables: [],
    contextName: "Global",
    contextPhase: "creation",
    activeLine: 1,
  };
}

function snapshot(state: RuntimeState): SimulationSnapshot {
  return {
    callStack: state.callStack.map((frame) => ({ ...frame })),
    memoryHeap: state.memoryHeap.map((entry) => ({ ...entry })),
    executionContext: {
      name: state.contextName,
      phase: state.contextPhase,
      variables: [...state.contextVariables],
    },
    eventLoop: {
      microtasks: [...state.eventLoop.microtasks],
      macrotasks: [...state.eventLoop.macrotasks],
    },
    webApis: [...state.webApis],
    stdout: [...state.stdout],
    activeLine: state.activeLine,
  };
}

function replaceMemoryEntry(
  state: RuntimeState,
  name: string,
  value: string,
  scope: string,
): void {
  const existingIndex = state.memoryHeap.findIndex(
    (entry) => entry.key === name && entry.scope === scope,
  );

  if (existingIndex >= 0) {
    state.memoryHeap[existingIndex] = {
      ...state.memoryHeap[existingIndex],
      value,
    };
    return;
  }

  state.memoryHeap.push({
    id: `${scope}-${name}`,
    key: name,
    value,
    scope,
  });
}

function interpolate(value: string, scope: Scope): string {
  return value.replace(/\b[a-zA-Z_$][\w$]*\b/g, (token) => {
    if (Object.hasOwn(scope.values, token)) {
      return scope.values[token];
    }

    return token;
  });
}

function evaluateExpression(value: string, scope: Scope): string {
  const rawExpression = value.trim();
  const expression = interpolate(value, scope).trim();

  if (!expression) {
    return "undefined";
  }

  if (rawExpression.includes("+")) {
    const parts = rawExpression.split("+").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      const resolvedParts = parts.map((part) => {
        if (Object.hasOwn(scope.values, part)) {
          return scope.values[part];
        }

        if ((part.startsWith("\"") && part.endsWith("\"")) || (part.startsWith("'") && part.endsWith("'"))) {
          return part.slice(1, -1);
        }

        if (/^-?\d+(\.\d+)?$/.test(part)) {
          return part;
        }

        return part;
      });

      const allNumeric = resolvedParts.every((part) => /^-?\d+(\.\d+)?$/.test(part));
      if (allNumeric) {
        return String(resolvedParts.reduce((sum, part) => sum + Number(part), 0));
      }

      return resolvedParts.join("");
    }
  }

  if (
    /^[-+*/().\d\s]+$/.test(expression) &&
    /[+\-*/]/.test(expression)
  ) {
    try {
      const computed = Function(`"use strict"; return (${expression});`)();
      return String(computed);
    } catch {
      return expression;
    }
  }

  if ((expression.startsWith("\"") && expression.endsWith("\"")) || (expression.startsWith("'") && expression.endsWith("'"))) {
    return expression.slice(1, -1);
  }

  if (Object.hasOwn(scope.values, expression)) {
    return scope.values[expression];
  }

  return expression;
}

function splitTopLevel(input: string, separator: string): string[] {
  const chunks: string[] = [];
  let current = "";
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: "'" | "\"" | null = null;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") depthParen += 1;
    if (char === ")") depthParen = Math.max(0, depthParen - 1);
    if (char === "[") depthBracket += 1;
    if (char === "]") depthBracket = Math.max(0, depthBracket - 1);
    if (char === "{") depthBrace += 1;
    if (char === "}") depthBrace = Math.max(0, depthBrace - 1);

    if (char === separator && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      if (current.trim()) {
        chunks.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function findTopLevelColon(input: string): number {
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: "'" | "\"" | null = null;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (char === "(") depthParen += 1;
    if (char === ")") depthParen = Math.max(0, depthParen - 1);
    if (char === "[") depthBracket += 1;
    if (char === "]") depthBracket = Math.max(0, depthBracket - 1);
    if (char === "{") depthBrace += 1;
    if (char === "}") depthBrace = Math.max(0, depthBrace - 1);

    if (char === ":" && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      return index;
    }
  }

  return -1;
}

function normalizeObjectKey(raw: string): string {
  const key = raw.trim();
  if ((key.startsWith("\"") && key.endsWith("\"")) || (key.startsWith("'") && key.endsWith("'"))) {
    return key.slice(1, -1);
  }
  return key;
}

function removeStructuredMemoryEntries(state: RuntimeState, name: string, scope: string): void {
  state.memoryHeap = state.memoryHeap.filter(
    (entry) => !(entry.scope === scope && (entry.key.startsWith(`${name}[`) || entry.key.startsWith(`${name}.`))),
  );
}

function resolveStructuredValue(rawValue: string, scope: Scope): {
  value: string;
  entries: Array<{ key: string; value: string }>;
} | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    const items = inner ? splitTopLevel(inner, ",") : [];
    const values = items.map((item) => evaluateExpression(item, scope));
    return {
      value: `[${values.join(", ")}]`,
      entries: values.map((item, index) => ({
        key: `[${index}]`,
        value: item,
      })),
    };
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = trimmed.slice(1, -1).trim();
    const pairs = inner ? splitTopLevel(inner, ",") : [];
    const entries: Array<{ key: string; value: string }> = [];

    for (const pair of pairs) {
      const colonIndex = findTopLevelColon(pair);
      if (colonIndex < 0) {
        continue;
      }

      const rawKey = pair.slice(0, colonIndex).trim();
      const rawPropValue = pair.slice(colonIndex + 1).trim();
      if (!rawKey) {
        continue;
      }

      entries.push({
        key: `.${normalizeObjectKey(rawKey)}`,
        value: evaluateExpression(rawPropValue, scope),
      });
    }

    const rendered = entries.map((entry) => `${entry.key.slice(1)}: ${entry.value}`).join(", ");
    return {
      value: `{${rendered}}`,
      entries,
    };
  }

  return null;
}

function syncStructuredMemoryEntries(
  state: RuntimeState,
  name: string,
  scope: string,
  entries: Array<{ key: string; value: string }>,
): void {
  removeStructuredMemoryEntries(state, name, scope);
  for (const entry of entries) {
    replaceMemoryEntry(state, `${name}${entry.key}`, entry.value, scope);
  }
}

function getLineText(lines: string[], line: number): string {
  const text = lines[line - 1] ?? "";
  return text.trim() || "(empty line)";
}

function isWebApiLabel(label: string): boolean {
  const text = label.toLowerCase();
  return text.includes("settimeout") || text.includes("fetch") || text.includes("dom");
}

export function buildSimulationSteps(program: ParsedProgram, source = ""): SimulationStep[] {
  const sourceLines = source.split(/\r?\n/);
  const state = makeInitialState();
  const steps: SimulationStep[] = [];
  const scope: Scope = {
    name: "global",
    values: {},
  };
  const tasks: Task[] = [];

  const pushStep = (title: string, details: string, line: number) => {
    state.activeLine = line;
    steps.push({
      id: `step-${steps.length + 1}`,
      line,
      lineExecuted: getLineText(sourceLines, line),
      title,
      details,
      snapshot: snapshot(state),
    });
  };

  const runOperations = (
    operations: Operation[],
    activeScope: Scope,
    fnMap: Record<string, FunctionInfo>,
  ): string | null => {
    for (const operation of operations) {
      switch (operation.type) {
        case "variable": {
          const structured = resolveStructuredValue(operation.value, activeScope);
          const resolved = structured?.value ?? evaluateExpression(operation.value, activeScope);
          activeScope.values[operation.name] = resolved;
          if (!state.contextVariables.includes(operation.name)) {
            state.contextVariables.push(operation.name);
          }
          replaceMemoryEntry(state, operation.name, resolved, activeScope.name);
          syncStructuredMemoryEntries(state, operation.name, activeScope.name, structured?.entries ?? []);
          pushStep(
            "Variable Allocated",
            `${operation.kind} ${operation.name} is stored in memory with value ${resolved}.`,
            operation.line,
          );
          break;
        }
        case "consoleLog": {
          const output = operation.args
            .map((arg) => evaluateExpression(arg, activeScope))
            .join(" ");
          state.stdout.push(output);
          pushStep(
            "console.log Executed",
            `console.log output -> ${output}`,
            operation.line,
          );
          break;
        }
        case "functionCall": {
          const fn = fnMap[operation.name];
          if (!fn) {
            pushStep(
              "Function Call",
              `Called ${operation.name}(), but simulator has no body for it.`,
              operation.line,
            );
            break;
          }

          state.callStack.push({
            id: `${operation.name}-${steps.length + 1}`,
            name: `${operation.name}()`,
            line: operation.line,
          });
          state.contextName = `${operation.name} Context`;
          state.contextPhase = "creation";
          state.contextVariables = [...fn.params];
          pushStep(
            "Call Stack Push",
            `${operation.name}() pushed to call stack; function execution context created.`,
            operation.line,
          );

          const functionScope: Scope = {
            name: operation.name,
            values: {
              ...scope.values,
            },
          };

          fn.params.forEach((param, index) => {
            const value = evaluateExpression(operation.args[index] ?? "undefined", activeScope);
            functionScope.values[param] = value;
            replaceMemoryEntry(state, param, value, functionScope.name);
            pushStep(
              "Parameter Initialized",
              `${param} initialized with value ${value}.`,
              operation.line,
            );
          });

          state.contextPhase = "execution";
          const returnValue = runOperations(fn.body, functionScope, fnMap) ?? "undefined";

          state.callStack.pop();
          state.contextName = activeScope.name === "global" ? "Global" : `${activeScope.name} Context`;
          state.contextPhase = "execution";
          state.contextVariables = Object.keys(activeScope.values);
          pushStep(
            "Call Stack Pop",
            `${operation.name}() returned ${returnValue} and popped from call stack.`,
            operation.line,
          );

          if (operation.assignTo) {
            activeScope.values[operation.assignTo] = returnValue;
            replaceMemoryEntry(state, operation.assignTo, returnValue, activeScope.name);
            if (!state.contextVariables.includes(operation.assignTo)) {
              state.contextVariables.push(operation.assignTo);
            }
            pushStep(
              "Return Value Assigned",
              `${operation.assignTo} receives return value ${returnValue}.`,
              operation.line,
            );
          }

          break;
        }
        case "return": {
          const result = evaluateExpression(operation.value, activeScope);
          pushStep(
            "Function Return",
            `Return statement resolved with value ${result}.`,
            operation.line,
          );
          return result;
        }
        case "loop": {
          const safeIterations = Math.min(Math.max(operation.iterations, 1), MAX_LOOP_ITERATIONS);
          pushStep(
            "Loop Entered",
            `${operation.kind} loop scheduled for ${safeIterations} iterations in simulation.`,
            operation.line,
          );

          for (let index = 0; index < safeIterations; index += 1) {
            pushStep(
              "Loop Iteration",
              `Iteration ${index + 1} of ${safeIterations}.`,
              operation.line,
            );
            const loopReturn = runOperations(operation.body, activeScope, fnMap);
            if (loopReturn !== null) {
              return loopReturn;
            }
          }

          break;
        }
        case "asyncTask": {
          if (isWebApiLabel(operation.label) && !state.webApis.includes(operation.label)) {
            state.webApis.push(operation.label);
            pushStep(
              "Web API Registered",
              `${operation.label} is now handled by Web APIs.`,
              operation.line,
            );
          }

          tasks.push({
            queue: operation.queue,
            label: operation.label,
            body: operation.body,
            line: operation.line,
          });

          const target = operation.queue === "microtask" ? state.eventLoop.microtasks : state.eventLoop.macrotasks;
          target.push(operation.label);
          pushStep(
            "Task Queued",
            `${operation.label} added to ${operation.queue} queue.`,
            operation.line,
          );
          break;
        }
        default:
          break;
      }
    }

    return null;
  };

  state.callStack.push({
    id: "global-frame",
    name: "Global()",
    line: 1,
  });
  pushStep(
    "Global Execution Context",
    "Global execution context created and pushed to call stack.",
    1,
  );

  Object.values(program.functions).forEach((fn) => {
    replaceMemoryEntry(state, fn.name, `function ${fn.name}(${fn.params.join(", ")})`, "global");
    if (!state.contextVariables.includes(fn.name)) {
      state.contextVariables.push(fn.name);
    }
    pushStep(
      "Function Hoisted",
      `${fn.name} is stored in memory during creation phase.`,
      fn.line,
    );
  });

  state.contextPhase = "execution";
  runOperations(program.operations, scope, program.functions);

  const runQueuedTask = (task: Task) => {
    if (task.queue === "microtask") {
      state.eventLoop.microtasks = state.eventLoop.microtasks.filter((name) => name !== task.label);
    } else {
      state.eventLoop.macrotasks = state.eventLoop.macrotasks.filter((name) => name !== task.label);
    }
    state.webApis = state.webApis.filter((name) => name !== task.label);

    pushStep(
      "Event Loop Tick",
      `Event loop moved ${task.label} from ${task.queue} queue to call stack.`,
      task.line,
    );

    state.callStack.push({
      id: `${task.label}-${steps.length + 1}`,
      name: task.label,
      line: task.line,
    });

    const taskScope: Scope = {
      name: task.label,
      values: {
        ...scope.values,
      },
    };

    state.contextName = `${task.label} Context`;
    state.contextPhase = "execution";
    state.contextVariables = Object.keys(taskScope.values);

    runOperations(task.body, taskScope, program.functions);

    state.callStack.pop();
    state.contextName = "Global";
    state.contextPhase = "execution";
    state.contextVariables = Object.keys(scope.values);
    pushStep("Callback Complete", `${task.label} completed and popped from call stack.`, task.line);
  };

  tasks
    .filter((task) => task.queue === "microtask")
    .forEach((task) => runQueuedTask(task));

  tasks
    .filter((task) => task.queue === "macrotask")
    .forEach((task) => runQueuedTask(task));

  state.callStack.pop();
  pushStep("Program Finished", "Global execution context popped; program finished.", steps.at(-1)?.snapshot.activeLine ?? 1);

  return steps;
}
