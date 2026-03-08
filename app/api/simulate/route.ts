import { NextResponse } from "next/server";
import { simulateRuntime } from "@/lib/engineSimulator/simulate-runtime";
import { buildNarrationNotes } from "@/lib/engineSimulator/narration-notes";
import type { SupportedLanguage } from "@/types/simulator";

interface CachedEntry {
  expiresAt: number;
  payload: {
    steps: ReturnType<typeof simulateRuntime>["steps"];
    narrationNotes: string[];
    error?: string;
    buildMs: number;
  };
}

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 80;
const simulationCache = new Map<string, CachedEntry>();

function makeCacheKey(language: SupportedLanguage, code: string): string {
  return `${language}:${code}`;
}

function pruneCacheIfNeeded(): void {
  if (simulationCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const now = Date.now();
  for (const [key, entry] of simulationCache.entries()) {
    if (entry.expiresAt <= now) {
      simulationCache.delete(key);
    }
  }

  while (simulationCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = simulationCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    simulationCache.delete(oldestKey);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      language?: SupportedLanguage;
    };

    const code = typeof body.code === "string" ? body.code : "";
    const language = (body.language ?? "javascript") as SupportedLanguage;

    if (code.length > 200_000) {
      return NextResponse.json({ error: "Code is too large to simulate." }, { status: 413 });
    }

    const cacheKey = makeCacheKey(language, code);
    const now = Date.now();
    const cached = simulationCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.payload);
    }

    const start = performance.now();
    const result = simulateRuntime(language, code);
    const buildMs = performance.now() - start;
    const narrationNotes = buildNarrationNotes(result.steps);
    const payload = {
      steps: result.steps,
      narrationNotes,
      error: result.error,
      buildMs,
    };

    simulationCache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      payload,
    });
    pruneCacheIfNeeded();

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Failed to simulate runtime." }, { status: 500 });
  }
}
