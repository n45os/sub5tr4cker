/**
 * db-maintenance — verify indexes against the codebase, then run `compact`.
 *
 * usage:
 *   tsx scripts/db-maintenance.ts             (dry-run, all collections)
 *   tsx scripts/db-maintenance.ts --apply     (apply: drop+create indexes, compact)
 *
 * mongo-only — local SQLite mode is a no-op skip (sqlite manages its own
 * indexes via better-sqlite3 schema setup; nothing to compact-equivalent).
 *
 * dry-run prints the expected-vs-current index diff per collection plus current
 * data/index sizes. --apply drops unexpected indexes, creates missing ones,
 * then runs `compact` per collection and reports bytes reclaimed (storage size
 * before − after). compact pauses writes briefly per collection — schedule for
 * an off-hours window.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

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

import mongoose, { type Model } from "mongoose";
import { db } from "../src/lib/storage";
import {
  AuditEvent,
  BillingPeriod,
  Group,
  Notification,
  PriceHistory,
  ScheduledTask,
  Settings,
  User,
} from "../src/models";

type IndexDir = 1 | -1;

interface ExpectedIndex {
  key: Record<string, IndexDir>;
  unique?: boolean;
  sparse?: boolean;
}

interface CollectionPlan {
  // mongoose model loose-typed so the heterogeneous list compiles cleanly
  model: Model<unknown>;
  expected: ExpectedIndex[];
}

// hand-curated expected index list, mirroring src/models/*.ts. there is no
// central registry, so any new schema-level `.index(...)` (or unique-on-field)
// must be echoed here for the diff to stay clean. `_id_` is implicit and never
// listed.
const plans: CollectionPlan[] = [
  {
    model: User as unknown as Model<unknown>,
    expected: [
      { key: { email: 1 }, unique: true },
      { key: { "telegram.chatId": 1 }, sparse: true, unique: true },
      { key: { "telegramLinkCode.code": 1 }, sparse: true, unique: true },
      { key: { authIdentityId: 1 }, sparse: true, unique: true },
    ],
  },
  {
    model: Group as unknown as Model<unknown>,
    expected: [
      { key: { admin: 1 } },
      { key: { "members.user": 1 } },
      { key: { "members.email": 1 } },
      { key: { inviteCode: 1 }, sparse: true, unique: true },
    ],
  },
  {
    model: BillingPeriod as unknown as Model<unknown>,
    expected: [
      { key: { group: 1, periodStart: 1 }, unique: true },
      { key: { "payments.status": 1 } },
      { key: { "payments.confirmationToken": 1 }, sparse: true },
    ],
  },
  {
    model: PriceHistory as unknown as Model<unknown>,
    expected: [{ key: { group: 1, effectiveFrom: 1 } }],
  },
  {
    model: Notification as unknown as Model<unknown>,
    expected: [
      { key: { recipient: 1 } },
      { key: { group: 1 } },
      { key: { type: 1 } },
      { key: { createdAt: 1 } },
    ],
  },
  {
    model: AuditEvent as unknown as Model<unknown>,
    expected: [
      { key: { actor: 1 } },
      { key: { group: 1 } },
      { key: { action: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    model: Settings as unknown as Model<unknown>,
    expected: [
      { key: { key: 1 }, unique: true },
      { key: { category: 1 } },
    ],
  },
  {
    model: ScheduledTask as unknown as Model<unknown>,
    expected: [
      { key: { status: 1, runAt: 1 } },
      { key: { lockedAt: 1 }, sparse: true },
      { key: { idempotencyKey: 1 }, unique: true },
      { key: { type: 1, "payload.groupId": 1 } },
      { key: { createdAt: 1 } },
    ],
  },
];

function indexName(key: Record<string, IndexDir>): string {
  return Object.entries(key)
    .map(([k, v]) => `${k}_${v}`)
    .join("_");
}

// compound-index key order is significant: matches drop along with the order
// the schema declared, so a mismatch on order is a real difference, not noise.
function keysEqual(
  a: Record<string, number>,
  b: Record<string, number>
): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) return false;
    if (a[ak[i]] !== b[bk[i]]) return false;
  }
  return true;
}

interface CurrentIndex {
  name: string;
  key: Record<string, number>;
  unique?: boolean;
  sparse?: boolean;
}

interface IndexDiff {
  collection: string;
  current: CurrentIndex[];
  toCreate: ExpectedIndex[];
  toDrop: CurrentIndex[];
}

async function diffIndexes(plan: CollectionPlan): Promise<IndexDiff> {
  const coll = plan.model.collection;
  const raw = (await coll.indexes()) as Array<{
    name: string;
    key: Record<string, number>;
    unique?: boolean;
    sparse?: boolean;
  }>;
  const current: CurrentIndex[] = raw.map((i) => ({
    name: i.name,
    key: i.key,
    unique: i.unique,
    sparse: i.sparse,
  }));

  const toCreate: ExpectedIndex[] = [];
  const matched = new Set<string>();

  for (const exp of plan.expected) {
    const match = current.find(
      (c) =>
        c.name !== "_id_" &&
        keysEqual(c.key, exp.key as Record<string, number>) &&
        Boolean(c.unique) === Boolean(exp.unique) &&
        Boolean(c.sparse) === Boolean(exp.sparse)
    );
    if (match) {
      matched.add(match.name);
    } else {
      toCreate.push(exp);
    }
  }

  const toDrop = current.filter(
    (c) => c.name !== "_id_" && !matched.has(c.name)
  );

  return { collection: coll.name, current, toCreate, toDrop };
}

interface CollStats {
  size: number;
  storageSize: number;
  totalIndexSize: number;
  count: number;
}

async function readStats(collName: string): Promise<CollStats> {
  const native = mongoose.connection.db;
  if (!native) return { size: 0, storageSize: 0, totalIndexSize: 0, count: 0 };
  try {
    const res = (await native.command({ collStats: collName })) as Record<
      string,
      unknown
    >;
    return {
      size: Number(res.size ?? 0),
      storageSize: Number(res.storageSize ?? 0),
      totalIndexSize: Number(res.totalIndexSize ?? 0),
      count: Number(res.count ?? 0),
    };
  } catch {
    return { size: 0, storageSize: 0, totalIndexSize: 0, count: 0 };
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function fmtSignedBytes(n: number): string {
  if (n === 0) return "0B";
  if (n > 0) return `+${fmtBytes(n)}`;
  return `-${fmtBytes(-n)}`;
}

async function applyIndexDiff(
  plan: CollectionPlan,
  diff: IndexDiff
): Promise<{ created: number; dropped: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let dropped = 0;

  for (const drop of diff.toDrop) {
    try {
      await plan.model.collection.dropIndex(drop.name);
      dropped++;
    } catch (err) {
      errors.push(
        `drop ${diff.collection}.${drop.name}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  for (const exp of diff.toCreate) {
    const opts: { unique?: boolean; sparse?: boolean; name: string } = {
      name: indexName(exp.key),
    };
    if (exp.unique) opts.unique = true;
    if (exp.sparse) opts.sparse = true;
    try {
      await plan.model.collection.createIndex(
        exp.key as Record<string, number>,
        opts
      );
      created++;
    } catch (err) {
      errors.push(
        `create ${diff.collection}.${opts.name}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { created, dropped, errors };
}

async function runCompact(
  collName: string
): Promise<{ ok: boolean; error: string | null }> {
  const native = mongoose.connection.db;
  if (!native) return { ok: false, error: "no native db handle" };
  try {
    await native.command({ compact: collName });
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function printDiff(diff: IndexDiff): void {
  const total = diff.current.filter((c) => c.name !== "_id_").length;
  console.log(
    `[${diff.collection}] indexes: current=${total} create=${diff.toCreate.length} drop=${diff.toDrop.length}`
  );
  if (diff.toCreate.length > 0) {
    console.log(`  + ${diff.toCreate.map((e) => indexName(e.key)).join(", ")}`);
  }
  if (diff.toDrop.length > 0) {
    console.log(`  - ${diff.toDrop.map((d) => d.name).join(", ")}`);
  }
}

function parseArgs(argv: string[]): { apply: boolean; help: boolean } {
  const flags = new Set(argv);
  return {
    apply: flags.has("--apply"),
    help: flags.has("--help") || flags.has("-h"),
  };
}

function printHelp(): void {
  console.log(
    "db-maintenance — verify indexes vs codebase + compact each collection"
  );
  console.log("");
  console.log("usage: tsx scripts/db-maintenance.ts [--apply]");
  console.log("");
  console.log(
    "dry-run (default) prints the expected-vs-current index diff and per-"
  );
  console.log(
    "collection size; --apply drops unexpected indexes, creates missing,"
  );
  console.log("then runs compact and reports bytes reclaimed.");
}

async function main() {
  const argv = process.argv.slice(2);
  const { apply, help } = parseArgs(argv);

  if (help) {
    printHelp();
    process.exit(0);
  }

  if (process.env.SUB5TR4CKER_MODE === "local") {
    console.log("skipped: db-maintenance is advanced (mongo) mode only.");
    process.exit(0);
  }

  console.log("");
  console.log(
    `mode: ${apply ? "APPLY (writes enabled)" : "DRY-RUN (no writes)"}`
  );
  console.log("");

  const store = await db();
  const startedAt = Date.now();

  let totalCreated = 0;
  let totalDropped = 0;
  let totalReclaimed = 0;
  const errors: string[] = [];

  for (const plan of plans) {
    const collName = plan.model.collection.name;

    const before = await readStats(collName);
    console.log(
      `[${collName}] docs=${before.count} data=${fmtBytes(before.size)} storage=${fmtBytes(before.storageSize)} indexes=${fmtBytes(before.totalIndexSize)}`
    );

    const diff = await diffIndexes(plan);
    printDiff(diff);

    if (apply) {
      const res = await applyIndexDiff(plan, diff);
      totalCreated += res.created;
      totalDropped += res.dropped;
      errors.push(...res.errors);
      if (res.dropped + res.created > 0) {
        console.log(
          `  applied: dropped=${res.dropped} created=${res.created}`
        );
      }

      const compactRes = await runCompact(collName);
      if (!compactRes.ok) {
        errors.push(`compact ${collName}: ${compactRes.error}`);
        console.log(`  compact: failed (${compactRes.error})`);
        continue;
      }

      const after = await readStats(collName);
      // row-count must not change; surface drift loudly.
      if (after.count !== before.count) {
        errors.push(
          `row-count drift on ${collName}: ${before.count} → ${after.count}`
        );
      }
      const reclaimed = before.storageSize - after.storageSize;
      totalReclaimed += reclaimed;
      console.log(
        `  compact: storage ${fmtBytes(before.storageSize)} -> ${fmtBytes(after.storageSize)} (${fmtSignedBytes(-reclaimed)})`
      );
    }
  }

  console.log("");
  console.log("summary:");
  if (apply) {
    console.log(`  indexes: created=${totalCreated} dropped=${totalDropped}`);
    console.log(`  reclaimed: ${fmtSignedBytes(-totalReclaimed)}`);
  } else {
    console.log(
      "  dry-run complete. re-run with --apply to drop unexpected indexes, create missing, and compact."
    );
  }
  if (errors.length > 0) {
    console.log(`  errors: ${errors.length}`);
    for (const e of errors) console.log(`    - ${e}`);
  }
  console.log(`  elapsed: ${Date.now() - startedAt}ms`);

  await store.close();
  process.exit(errors.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
