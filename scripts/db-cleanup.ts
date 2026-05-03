/**
 * unified DB cleanup harness — dry-run by default.
 *
 * usage:
 *   tsx scripts/db-cleanup.ts                                 (dry-run, all passes)
 *   tsx scripts/db-cleanup.ts --orphan-tasks                  (dry-run, single pass)
 *   tsx scripts/db-cleanup.ts --orphan-tasks --apply          (apply that pass)
 *   tsx scripts/db-cleanup.ts --orphan-tasks --orphan-periods --apply
 *
 * each pass is opt-in via a flag. running with no `--<pass>` flags reports on
 * every pass in dry-run mode. `--apply` without any pass flag is refused so
 * the harness cannot silently "apply all".
 *
 * pass implementations live alongside this scaffold; phase 1 wires them as
 * stubs and phases 2/3/4 fill in the real cleanup logic.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

const root = resolve(__dirname, "..");
for (const file of [".env.local", ".env"]) {
  const path = resolve(root, file);
  if (existsSync(path)) {
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
      }
    }
    break;
  }
}

import { db, type StorageAdapter } from "../src/lib/storage";

type PassId = "orphan-tasks" | "orphan-periods" | "old-notifications";

interface PassResult {
  id: PassId;
  scanned: number;
  touched: number;
  errors: string[];
}

interface PassContext {
  apply: boolean;
  scriptRunId: string;
  store: StorageAdapter;
}

interface Pass {
  id: PassId;
  flag: string;
  description: string;
  run(ctx: PassContext): Promise<PassResult>;
}

function header(id: PassId, line: string): void {
  console.log(`[${id}] ${line}`);
}

// pass scaffolds — phases 2/3/4 replace each body with the real logic.
const passes: Pass[] = [
  {
    id: "orphan-tasks",
    flag: "--orphan-tasks",
    description: "cancel scheduled tasks pointing at deleted groups/periods",
    async run(ctx) {
      header(
        "orphan-tasks",
        ctx.apply
          ? "(stub) would cancel scheduled tasks whose group/period is gone — implemented in phase 2"
          : "(stub) would cancel scheduled tasks whose group/period is gone — pass --apply to execute (phase 2)"
      );
      return { id: "orphan-tasks", scanned: 0, touched: 0, errors: [] };
    },
  },
  {
    id: "orphan-periods",
    flag: "--orphan-periods",
    description: "archive billing periods belonging to soft-deleted groups",
    async run(ctx) {
      header(
        "orphan-periods",
        ctx.apply
          ? "(stub) would archive billing periods under soft-deleted groups — implemented in phase 3"
          : "(stub) would archive billing periods under soft-deleted groups — pass --apply to execute (phase 3)"
      );
      return { id: "orphan-periods", scanned: 0, touched: 0, errors: [] };
    },
  },
  {
    id: "old-notifications",
    flag: "--old-notifications",
    description: "prune notification log entries older than the retention window",
    async run(ctx) {
      header(
        "old-notifications",
        ctx.apply
          ? "(stub) would prune old notifications past retention — implemented in phase 4"
          : "(stub) would prune old notifications past retention — pass --apply to execute (phase 4)"
      );
      return { id: "old-notifications", scanned: 0, touched: 0, errors: [] };
    },
  },
];

function parseArgs(argv: string[]): { selected: Pass[]; apply: boolean; help: boolean } {
  const flags = new Set(argv);
  const help = flags.has("--help") || flags.has("-h");
  const apply = flags.has("--apply");
  const selected = passes.filter((p) => flags.has(p.flag));
  return { selected, apply, help };
}

function printHelp(): void {
  console.log("db-cleanup — unified, dry-run-first cleanup harness");
  console.log("");
  console.log("usage: tsx scripts/db-cleanup.ts [pass-flags] [--apply]");
  console.log("");
  console.log("passes:");
  for (const p of passes) {
    console.log(`  ${p.flag.padEnd(22)} ${p.description}`);
  }
  console.log("");
  console.log("with no pass flag every pass runs in dry-run mode.");
  console.log("--apply requires at least one pass flag (refuses to apply all silently).");
}

async function main() {
  const argv = process.argv.slice(2);
  const { selected, apply, help } = parseArgs(argv);

  if (help) {
    printHelp();
    process.exit(0);
  }

  if (apply && selected.length === 0) {
    console.error(
      "refusing to --apply without an explicit pass flag. choose at least one of: " +
        passes.map((p) => p.flag).join(", ")
    );
    process.exit(2);
  }

  const toRun = selected.length > 0 ? selected : passes;
  const scriptRunId = randomUUID();
  const startedAt = Date.now();

  console.log("");
  console.log(`mode:         ${apply ? "APPLY (writes enabled)" : "DRY-RUN (no writes)"}`);
  console.log(`scriptRunId:  ${scriptRunId}`);
  console.log(`passes:       ${toRun.map((p) => p.id).join(", ")}`);
  console.log("");

  const store = await db();
  const ctx: PassContext = { apply, scriptRunId, store };

  const results: PassResult[] = [];
  for (const pass of toRun) {
    try {
      results.push(await pass.run(ctx));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${pass.id}] failed: ${message}`);
      results.push({ id: pass.id, scanned: 0, touched: 0, errors: [message] });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const totalErrors = results.reduce((acc, r) => acc + r.errors.length, 0);

  console.log("");
  console.log("summary:");
  console.log("  pass".padEnd(22) + "scanned".padStart(10) + "touched".padStart(10) + "errors".padStart(10));
  console.log("-".repeat(52));
  for (const r of results) {
    console.log(
      `  ${r.id}`.padEnd(22) +
        String(r.scanned).padStart(10) +
        String(r.touched).padStart(10) +
        String(r.errors.length).padStart(10)
    );
  }
  console.log(`  elapsed: ${elapsedMs}ms`);

  if (!apply) {
    console.log("");
    console.log("dry-run complete. re-run with the same pass flags plus --apply to execute.");
  }

  await store.close();
  process.exit(totalErrors === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
