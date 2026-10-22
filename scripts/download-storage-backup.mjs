/**
 * Download auction-photos into an existing backup folder (after egress quota is fixed).
 *
 * Usage:
 *   node scripts/download-storage-backup.mjs backup/20260918-095630
 *
 * Needs .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function loadEnvLocal() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function main() {
  const backupArg = process.argv[2];
  if (!backupArg) {
    console.error("Usage: node scripts/download-storage-backup.mjs <backupDir>");
    process.exit(1);
  }
  const backupRoot = path.isAbsolute(backupArg) ? backupArg : path.join(ROOT, backupArg);
  const manifestPath = path.join(backupRoot, "storage", "auction-photos-manifest.json");
  const destDir = path.join(backupRoot, "storage", "auction-photos");
  const objects = JSON.parse(await readFile(manifestPath, "utf8"));

  const env = await loadEnvLocal();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ok = 0;
  let fail = 0;
  for (const obj of objects) {
    const name = obj.name;
    const target = path.join(destDir, name);
    await mkdir(path.dirname(target), { recursive: true });
    const { data, error } = await supabase.storage.from("auction-photos").download(name);
    if (error || !data) {
      fail += 1;
      console.error(`FAIL ${name}: ${error?.message || "no data"}`);
      continue;
    }
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
    ok += 1;
    if (ok % 25 === 0) console.log(`downloaded ${ok}/${objects.length}`);
  }
  console.log(`DONE ok=${ok} fail=${fail} total=${objects.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
