/**
 * Robustly extracts and parses the first complete JSON object from an LLM response.
 * Handles: direct JSON, markdown fences, and JSON embedded in surrounding text.
 * Uses brace-counting so a greedy regex can't grab trailing stray `}` characters.
 */
export function extractFirstJSON(content: string): unknown {
  const trimmed = content.trim();

  // 1. Try direct parse first (cleanest path)
  try { return JSON.parse(trimmed); } catch {}

  // 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // 3. Brace-count scan to find the first complete JSON object
  const start = trimmed.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in LLM response");

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(trimmed.slice(start, i + 1));
      }
    }
  }

  throw new Error("No complete JSON object found in LLM response");
}
