/**
 * Extract JSON payload from Supabase MCP execute_sql tool output files.
 * Usage: node scripts/extract-mcp-backup.mjs <mcpOutputFile> <outJsonFile> [fieldName=data]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const [, , inFile, outFile, field = "data"] = process.argv;
if (!inFile || !outFile) {
  console.error("Usage: node scripts/extract-mcp-backup.mjs <in> <out> [field]");
  process.exit(1);
}

const raw = await readFile(inFile, "utf8");
let text = raw;

try {
  const outer = JSON.parse(raw);
  if (typeof outer.result === "string") text = outer.result;
} catch {
  /* already plain text */
}

const opens = [...text.matchAll(/<untrusted-data-[0-9a-f-]+>/gi)];
const closes = [...text.matchAll(/<\/untrusted-data-[0-9a-f-]+>/gi)];
if (!opens.length || !closes.length) {
  console.error("Missing untrusted-data tags in", inFile);
  process.exit(1);
}

// Pick the open tag that has a close tag after it and non-empty JSON-looking content.
let chosen = null;
for (const open of opens) {
  const openEnd = open.index + open[0].length;
  const close = closes.find((c) => c.index > openEnd);
  if (!close) continue;
  const body = text.slice(openEnd, close.index).trim();
  if (body.startsWith("[") || body.startsWith("{")) {
    chosen = { openEnd, closeIndex: close.index, body };
    break;
  }
}
if (!chosen) {
  console.error("Could not locate JSON payload in", inFile);
  process.exit(1);
}

const parsed = JSON.parse(chosen.body);
let payload = parsed;
if (Array.isArray(parsed) && parsed.length === 1 && parsed[0] && typeof parsed[0] === "object") {
  if (parsed[0][field] !== undefined) payload = parsed[0][field];
  else if (parsed[0].payload !== undefined) payload = parsed[0].payload;
  else if (parsed[0].data !== undefined) payload = parsed[0].data;
}

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(payload, null, 2), "utf8");
const count = Array.isArray(payload)
  ? payload.length
  : payload && typeof payload === "object"
    ? Object.keys(payload).length
    : typeof payload === "string"
      ? `str:${payload.length}`
      : 0;
console.log(`Wrote ${outFile} (${count})`);
