// Placeholder for Phase 3 (LLM). We'll inject provider via env.
export async function summarize(input: { title?: string; summary?: string; content?: string }) {
    // No-op for Phase 1
    return input.summary || input.title || '';
  }