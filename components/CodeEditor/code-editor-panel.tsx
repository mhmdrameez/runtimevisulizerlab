"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEffect, useRef } from "react";

import type { SupportedLanguage } from "@/types/simulator";

interface CodeEditorPanelProps {
  code: string;
  onChange: (value: string) => void;
  activeLine: number;
  language: SupportedLanguage;
  parseError?: string;
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

export function CodeEditorPanel({ code, onChange, activeLine, language, parseError }: CodeEditorPanelProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const onMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

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
  };

  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;

    if (!editorInstance || !monaco) {
      return;
    }

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

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-[#0b1220]">
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2 text-xs text-zinc-300">
        <span>{getEditorLabel(language)}</span>
        <span className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400">Monaco</span>
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          language={language}
          value={code}
          onChange={(value) => onChange(value ?? "")}
          onMount={onMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            glyphMargin: true,
            smoothScrolling: true,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      {parseError ? (
        <p className="border-t border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">Parse error: {parseError}</p>
      ) : (
        <p className="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-400">Code changes auto-parse and regenerate simulation steps.</p>
      )}
    </section>
  );
}
