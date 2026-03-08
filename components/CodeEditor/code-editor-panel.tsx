"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";

import type { RuntimeVerificationIssue, SupportedLanguage } from "@/types/simulator";

interface CodeEditorPanelProps {
  code: string;
  onChange: (value: string) => void;
  onRunShortcut?: () => void;
  activeLine: number;
  language: SupportedLanguage;
  parseError?: string;
  verificationIssues?: RuntimeVerificationIssue[];
}

function getEditorLabel(language: SupportedLanguage): string {
  const extMap: Record<SupportedLanguage, string> = {
    javascript: "js",
    python: "py",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
  };

  return `editor.${extMap[language]}`;
}

export function CodeEditorPanel({ code, onChange, onRunShortcut, activeLine, language, parseError, verificationIssues = [] }: CodeEditorPanelProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const lastActiveLineRef = useRef<number>(-1);
  const [inlineEditorError, setInlineEditorError] = useState<string>("");

  const onMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true,
      checkJs: true,
      target: monaco.languages.typescript.ScriptTarget.ES2022,
    });

    monaco.editor.defineTheme("engine-lab", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "e5e7eb", background: "0d111c" },
        { token: "keyword", foreground: "7dd3fc" },
        { token: "number", foreground: "fbbf24" },
        { token: "string", foreground: "86efac" },
      ],
      colors: {
        "editor.background": "#0d111c",
        "editorLineNumber.foreground": "#64748b",
        "editorCursor.foreground": "#67e8f9",
        "editor.selectionBackground": "#1d4ed840",
      },
    });

    monaco.editor.setTheme("engine-lab");

    editorInstance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => onRunShortcut?.(),
    );
  };

  const getErrorLocation = (error: string): { line: number; column: number } | null => {
    const match = error.match(/\((\d+):(\d+)\)/);
    if (!match) {
      return null;
    }

    return {
      line: Number(match[1]),
      column: Number(match[2]) + 1,
    };
  };

  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;

    if (!editorInstance || !monaco) {
      return;
    }

    if (lastActiveLineRef.current === activeLine) {
      return;
    }
    lastActiveLineRef.current = activeLine;

    decorationsRef.current = editorInstance.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: "engine-active-line",
          glyphMarginClassName: "engine-active-glyph",
        },
      },
    ]);

    editorInstance.revealLineInCenter(activeLine);
  }, [activeLine]);

  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorInstance || !monaco) {
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      return;
    }

    if (!parseError) {
      monaco.editor.setModelMarkers(model, "runtime-parse", []);
      return;
    }

    const position = getErrorLocation(parseError) ?? { line: 1, column: 1 };
    const safeLine = Math.min(Math.max(position.line, 1), model.getLineCount());
    const safeColumn = Math.min(Math.max(position.column, 1), model.getLineMaxColumn(safeLine));

    monaco.editor.setModelMarkers(model, "runtime-parse", [
      {
        severity: monaco.MarkerSeverity.Error,
        message: parseError,
        startLineNumber: safeLine,
        startColumn: safeColumn,
        endLineNumber: safeLine,
        endColumn: Math.min(safeColumn + 1, model.getLineMaxColumn(safeLine)),
      },
    ]);
  }, [parseError]);

  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorInstance || !monaco) {
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      return;
    }

    if (!verificationIssues.length) {
      monaco.editor.setModelMarkers(model, "runtime-verify", []);
      return;
    }

    monaco.editor.setModelMarkers(
      model,
      "runtime-verify",
      verificationIssues.map((issue) => {
        const safeLine = Math.min(Math.max(issue.line, 1), model.getLineCount());
        const startColumn = 1;
        const endColumn = model.getLineMaxColumn(safeLine);
        return {
          severity: monaco.MarkerSeverity.Warning,
          message: `Output mismatch. ${issue.fix}`,
          startLineNumber: safeLine,
          startColumn,
          endLineNumber: safeLine,
          endColumn,
        };
      }),
    );
  }, [verificationIssues]);

  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorInstance || !monaco) {
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      return;
    }

    const refreshInlineError = () => {
      const markers = monaco.editor
        .getModelMarkers({ resource: model.uri })
        .filter((marker) => marker.severity === monaco.MarkerSeverity.Error)
        .sort((a, b) =>
          a.startLineNumber === b.startLineNumber
            ? a.startColumn - b.startColumn
            : a.startLineNumber - b.startLineNumber,
        );

      const first = markers[0];
      if (!first) {
        setInlineEditorError("");
        return;
      }

      const lineText = model.getLineContent(first.startLineNumber).trim() || "(empty line)";
      const compactMessage = first.message.replace(/\s+/g, " ").trim();
      setInlineEditorError(`${lineText}   // error: ${compactMessage}`);
    };

    refreshInlineError();
    const disposable = monaco.editor.onDidChangeMarkers(() => refreshInlineError());
    return () => disposable.dispose();
  }, [language, parseError]);

  return (
    <section className="flex min-h-[46dvh] min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-[#0b1220] sm:min-h-[52dvh] lg:min-h-0">
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2 text-xs text-zinc-300">
        <span>{getEditorLabel(language)}</span>
        <span className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400">Monaco</span>
      </div>

      <div className="h-[42dvh] min-h-[18rem] flex-1 overflow-hidden sm:h-[48dvh] lg:h-auto lg:min-h-0">
        <Editor
          language={language}
          value={code}
          onChange={(value) => onChange(value ?? "")}
          onMount={onMount}
          className="h-full w-full"
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            glyphMargin: true,
            smoothScrolling: true,
            wordWrap: "off",
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              alwaysConsumeMouseWheel: false,
            },
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      {parseError ? (
        <p className="border-t border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">Live error: {parseError}</p>
      ) : (
        <p className="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-400">
          Real-time syntax and output verification run in the background.
        </p>
      )}

      {inlineEditorError ? (
        <p className="border-t border-red-300/30 bg-red-500/8 px-3 py-2 font-mono text-xs text-red-200">
          {inlineEditorError}
        </p>
      ) : null}
    </section>
  );
}
