export type QueueType = "microtask" | "macrotask";
export type SupportedLanguage = "javascript" | "python" | "go" | "java" | "c" | "cpp";
export type VisualizationMode = "beginner" | "advanced";

export interface StackFrame {
  id: string;
  name: string;
  line: number;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  scope: string;
}

export interface ExecutionContextView {
  name: string;
  phase: "creation" | "execution";
  variables: string[];
}

export interface EventLoopState {
  microtasks: string[];
  macrotasks: string[];
}

export interface SimulationSnapshot {
  callStack: StackFrame[];
  memoryHeap: MemoryEntry[];
  executionContext: ExecutionContextView;
  eventLoop: EventLoopState;
  webApis: string[];
  stdout: string[];
  activeLine: number;
}

export interface SimulationStep {
  id: string;
  line: number;
  lineExecuted: string;
  title: string;
  details: string;
  snapshot: SimulationSnapshot;
}

export interface FunctionInfo {
  name: string;
  params: string[];
  body: Operation[];
  line: number;
}

export type Operation =
  | {
      type: "variable";
      name: string;
      kind: "const" | "let" | "var";
      value: string;
      line: number;
    }
  | {
      type: "functionCall";
      name: string;
      args: string[];
      assignTo?: string;
      line: number;
    }
  | {
      type: "consoleLog";
      args: string[];
      line: number;
    }
  | {
      type: "return";
      value: string;
      line: number;
    }
  | {
      type: "loop";
      kind: "for" | "while" | "do-while";
      iterations: number;
      body: Operation[];
      line: number;
    }
  | {
      type: "asyncTask";
      queue: QueueType;
      label: string;
      body: Operation[];
      line: number;
    };

export interface ParsedProgram {
  functions: Record<string, FunctionInfo>;
  operations: Operation[];
}

export interface ParseResult {
  program: ParsedProgram;
  error?: string;
}
