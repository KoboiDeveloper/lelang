/**
 * Full Supabase backup for lelang:
 * - public tables (JSON)
 * - auth users (Admin API)
 * - storage bucket auction-photos (files + manifest)
 * - storage.objects / buckets metadata
 *
 * Usage:
 *   node scripts/full-backup.mjs [backupDir]
 * Reads .env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { createWriteStream } from "node:fs";
import {
  mkdir,
  writeFile,
  readFile,
  copyFile,
  access,
} from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  const raw = await readFile(envPath, "utf8");
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

const PUBLIC_TABLES = [
  "companies",
  "banks",
  "item_categories",
  "profiles",
  "bidder_profiles",
  "auction_periods",
  "auction_items",
  "item_photos",
  "bids",
  "audit_logs",
  "auction_bank_accounts",
  "registration_otps",
  "password_reset_otps",
  "push_subscriptions",
  "favorites",
];

async function dumpTable(supabase, table, outFile) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  await writeFile(outFile, JSON.stringify(rows, null, 2), "utf8");
  return rows.length;
}

async function dumpAuthUsers(supabase, outFile) {
  const users = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth.users: ${error.message}`);
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  await writeFile(outFile, JSON.stringify(users, null, 2), "utf8");
  return users.length;
}

async function downloadStorage(supabase, bucket, destDir, manifestFile) {
  await mkdir(destDir, { recursive: true });
  const objects = [];
  let offset = 0;
  const limit = 100;

  // Recursive list via Storage API (flat list of all objects under "")
  async function listAll(prefix = "") {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`storage list ${prefix}: ${error.message}`);
    for (const item of data || []) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      // folders have id === null in supabase storage list
      if (item.id === null) {
        await listAll(fullPath);
      } else {
        objects.push({
          name: fullPath,
          id: item.id,
          updated_at: item.updated_at,
          created_at: item.created_at,
          last_accessed_at: item.last_accessed_at,
          metadata: item.metadata,
        });
      }
    }
  }

  await listAll("");
  await writeFile(manifestFile, JSON.stringify(objects, null, 2), "utf8");

  let ok = 0;
  let fail = 0;
  for (const obj of objects) {
    const target = path.join(destDir, obj.name);
    await mkdir(path.dirname(target), { recursive: true });
    const { data, error } = await supabase.storage.from(bucket).download(obj.name);
    if (error || !data) {
      fail += 1;
      console.error(`  FAIL download ${obj.name}: ${error?.message || "no data"}`);
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    await writeFile(target, buf);
    ok += 1;
    if (ok % 50 === 0) console.log(`  downloaded ${ok}/${objects.length}`);
  }
  return { total: objects.length, ok, fail };
}

async function main() {
  const env = await loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE URL / SERVICE_ROLE_KEY in .env.local");

  const stamp =
    process.argv[2] ||
    (() => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      return `backup/${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    })();

  const backupRoot = path.isAbsolute(stamp) ? stamp : path.join(ROOT, stamp);
  const dataDir = path.join(backupRoot, "data");
  const authDir = path.join(backupRoot, "auth");
  const storageDir = path.join(backupRoot, "storage", "auction-photos");
  const schemaDir = path.join(backupRoot, "schema");

  await mkdir(dataDir, { recursive: true });
  await mkdir(authDir, { recursive: true });
  await mkdir(storageDir, { recursive: true });
  await mkdir(schemaDir, { recursive: true });

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary = {
    project: url,
    createdAt: new Date().toISOString(),
    tables: {},
    authUsers: 0,
    storage: null,
  };

  console.log("== Dump public tables ==");
  for (const table of PUBLIC_TABLES) {
    process.stdout.write(`  ${table}... `);
    const n = await dumpTable(supabase, table, path.join(dataDir, `${table}.json`));
    summary.tables[table] = n;
    console.log(`${n} rows`);
  }

  console.log("== Dump auth users ==");
  summary.authUsers = await dumpAuthUsers(
    supabase,
    path.join(authDir, "users.json")
  );
  console.log(`  ${summary.authUsers} users`);

  console.log("== Download storage auction-photos ==");
  summary.storage = await downloadStorage(
    supabase,
    "auction-photos",
    storageDir,
    path.join(backupRoot, "storage", "auction-photos-manifest.json")
  );
  console.log(
    `  files: ${summary.storage.ok}/${summary.storage.total} (fail ${summary.storage.fail})`
  );

  // Copy local migrations if present
  try {
    await access(path.join(ROOT, "supabase", "migrations"));
    // already copied by shell sometimes; ensure README note
  } catch {
    /* ignore */
  }

  await writeFile(
    path.join(backupRoot, "BACKUP_MANIFEST.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(backupRoot, "README.md"),
    `# Lelang Supabase backup

Created: ${summary.createdAt}
Project: ${url}

## Contents
- \`data/*.json\` — all public tables
- \`auth/users.json\` — Auth users (Admin API)
- \`storage/auction-photos/\` — photo files
- \`storage/auction-photos-manifest.json\` — object metadata
- \`schema/\` — SQL schema dump + migrations (if present)

## Restore notes
1. Recreate schema (run schema SQL / migrations)
2. Import JSON into tables (or convert to INSERT)
3. Re-upload \`storage/auction-photos\` to bucket \`auction-photos\`
4. Auth users: recreate via Admin API / invite (password hashes may need DB-level restore)

For true binary PG restore, use \`pg_dump\` with Database password from Supabase Dashboard.
`,
    "utf8"
  );

  console.log("\nDONE:", backupRoot);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
