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
import { Types } from "mongoose";
import {
  AuditEvent,
  BillingPeriod,
  Group,
  Notification,
  ScheduledTask,
} from "../src/models";
import { getSetting } from "../src/lib/settings/service";

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

const DEFAULT_NOTIFICATION_RETENTION_DAYS = 365;

// resolution order: getSetting("general.notificationRetentionDays") → env
// NOTIFICATION_RETENTION_DAYS → 365. unregistered setting key is fine; the
// service returns null when no definition or row exists.
async function resolveRetentionDays(): Promise<number> {
  let raw: string | null = null;
  try {
    raw = await getSetting("general.notificationRetentionDays");
  } catch {
    raw = null;
  }
  if (!raw) raw = process.env.NOTIFICATION_RETENTION_DAYS ?? null;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return DEFAULT_NOTIFICATION_RETENTION_DAYS;
}

// pass scaffolds — phases 2/3/4 replace each body with the real logic.
const passes: Pass[] = [
  {
    id: "orphan-tasks",
    flag: "--orphan-tasks",
    description: "cancel scheduled tasks pointing at deleted groups/periods",
    async run(ctx) {
      // local SQLite installs are single-user and don't accumulate cross-user
      // orphans worth a batch pass. advanced (mongo) mode is the only target.
      if (process.env.SUB5TR4CKER_MODE === "local") {
        header("orphan-tasks", "skipped: orphan-task cleanup is advanced (mongo) mode only.");
        return { id: "orphan-tasks", scanned: 0, touched: 0, errors: [] };
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // candidates: pending, or locked with stale lockedAt
      const candidates = await ScheduledTask.find({
        $or: [
          { status: "pending" },
          { status: "locked", lockedAt: { $lt: oneHourAgo } },
        ],
      })
        .lean()
        .exec();

      // batch-fetch all referenced groups + periods to avoid n+1 lookups
      const groupIds = new Set<string>();
      const periodIds = new Set<string>();
      for (const task of candidates) {
        const payload = (task.payload ?? {}) as Record<string, unknown>;
        if (typeof payload.groupId === "string") groupIds.add(payload.groupId);
        if (typeof payload.billingPeriodId === "string") periodIds.add(payload.billingPeriodId);
        const refs = Array.isArray(payload.payments) ? payload.payments : [];
        for (const r of refs as Array<Record<string, unknown>>) {
          if (typeof r.groupId === "string") groupIds.add(r.groupId);
          if (typeof r.billingPeriodId === "string") periodIds.add(r.billingPeriodId);
        }
      }

      const toObjectIds = (ids: Set<string>) => {
        const out: Types.ObjectId[] = [];
        for (const id of ids) {
          if (Types.ObjectId.isValid(id)) out.push(new Types.ObjectId(id));
        }
        return out;
      };

      const liveGroups = await Group.find({ _id: { $in: toObjectIds(groupIds) } })
        .select("_id")
        .lean()
        .exec();
      const liveGroupIds = new Set(liveGroups.map((g) => String(g._id)));

      const livePeriods = await BillingPeriod.find({ _id: { $in: toObjectIds(periodIds) } })
        .lean()
        .exec();
      const periodById = new Map(livePeriods.map((p) => [String(p._id), p]));

      const isPaymentActionable = (status: string | undefined): boolean =>
        status === "pending" || status === "member_confirmed";

      const isSingleRefOrphan = (payload: Record<string, unknown>): boolean => {
        const groupId = typeof payload.groupId === "string" ? payload.groupId : null;
        const periodId = typeof payload.billingPeriodId === "string" ? payload.billingPeriodId : null;
        const paymentId = typeof payload.paymentId === "string" ? payload.paymentId : null;

        if (groupId && !liveGroupIds.has(groupId)) return true;
        if (periodId && !periodById.has(periodId)) return true;
        if (periodId && paymentId) {
          const period = periodById.get(periodId);
          if (!period) return true;
          const payment = (period.payments ?? []).find(
            (p: { _id: Types.ObjectId; status: string }) => String(p._id) === paymentId
          );
          if (!payment) return true;
          if (!isPaymentActionable(payment.status)) return true;
        }
        return false;
      };

      const orphanIds: string[] = [];
      for (const task of candidates) {
        const payload = (task.payload ?? {}) as Record<string, unknown>;

        if (task.type === "aggregated_payment_reminder") {
          // aggregated reminder is orphan only when every referenced payment
          // is gone or no longer actionable — otherwise the worker still has
          // useful work to do for the surviving refs.
          const refs = Array.isArray(payload.payments)
            ? (payload.payments as Array<Record<string, unknown>>)
            : [];
          if (refs.length === 0) {
            orphanIds.push(String(task._id));
            continue;
          }
          let anyAlive = false;
          for (const ref of refs) {
            const groupId = typeof ref.groupId === "string" ? ref.groupId : null;
            const periodId = typeof ref.billingPeriodId === "string" ? ref.billingPeriodId : null;
            const paymentId = typeof ref.paymentId === "string" ? ref.paymentId : null;
            if (!groupId || !liveGroupIds.has(groupId)) continue;
            if (!periodId) continue;
            const period = periodById.get(periodId);
            if (!period) continue;
            const payment = (period.payments ?? []).find(
              (p: { _id: Types.ObjectId; status: string }) =>
                paymentId ? String(p._id) === paymentId : false
            );
            if (!payment) continue;
            if (isPaymentActionable(payment.status)) {
              anyAlive = true;
              break;
            }
          }
          if (!anyAlive) orphanIds.push(String(task._id));
        } else {
          if (isSingleRefOrphan(payload)) orphanIds.push(String(task._id));
        }
      }

      const scanned = candidates.length;
      const touched = orphanIds.length;

      if (touched === 0) {
        header(
          "orphan-tasks",
          `scanned ${scanned} candidate task(s); 0 orphans found.`
        );
        return { id: "orphan-tasks", scanned, touched: 0, errors: [] };
      }

      if (!ctx.apply) {
        const sample = orphanIds.slice(0, 5).join(",");
        const more = orphanIds.length > 5 ? "..." : "";
        header(
          "orphan-tasks",
          `would cancel ${touched} of ${scanned} task(s) — sample: ${sample}${more} — pass --apply to execute.`
        );
        return { id: "orphan-tasks", scanned, touched, errors: [] };
      }

      // apply: status flip via raw collection driver — `cancellationReason`
      // is not in the ScheduledTask schema, so strict mode would drop it.
      const now = new Date();
      const updateRes = await ScheduledTask.collection.updateMany(
        { _id: { $in: orphanIds.map((id) => new Types.ObjectId(id)) } },
        {
          $set: {
            status: "cancelled",
            cancelledAt: now,
            cancellationReason: "orphan-cleanup",
            updatedAt: now,
          },
        }
      );

      // one batch audit row via raw collection — `scheduled_tasks_orphan_cleanup`
      // is not in the AuditEvent action enum; bypassing strict mode keeps the
      // schema unchanged while preserving the audit trail.
      const sampleIds = orphanIds.slice(0, 10);
      await AuditEvent.collection.insertOne({
        actor: null,
        actorName: "System (db-cleanup --orphan-tasks)",
        action: "scheduled_tasks_orphan_cleanup",
        group: null,
        billingPeriod: null,
        targetMember: null,
        metadata: {
          count: orphanIds.length,
          scriptRunId: ctx.scriptRunId,
          sampleIds,
        },
        createdAt: now,
        updatedAt: now,
      });

      header(
        "orphan-tasks",
        `cancelled ${updateRes.modifiedCount} of ${scanned} task(s); audit event written (scriptRunId=${ctx.scriptRunId}).`
      );

      return {
        id: "orphan-tasks",
        scanned,
        touched: updateRes.modifiedCount,
        errors: [],
      };
    },
  },
  {
    id: "orphan-periods",
    flag: "--orphan-periods",
    description: "archive billing periods belonging to soft-deleted groups",
    async run(ctx) {
      // local SQLite installs are single-user — no soft-deleted-group cleanup
      // worth a batch pass. advanced (mongo) mode is the only target.
      if (process.env.SUB5TR4CKER_MODE === "local") {
        header("orphan-periods", "skipped: orphan-period cleanup is advanced (mongo) mode only.");
        return { id: "orphan-periods", scanned: 0, touched: 0, errors: [] };
      }

      // soft-deleted groups
      const inactiveGroups = await Group.find({ isActive: false })
        .select("_id")
        .lean()
        .exec();
      const inactiveGroupIds = inactiveGroups.map((g) => new Types.ObjectId(String(g._id)));

      if (inactiveGroupIds.length === 0) {
        header("orphan-periods", "scanned 0 inactive group(s); 0 periods to archive.");
        return { id: "orphan-periods", scanned: 0, touched: 0, errors: [] };
      }

      // billing periods under those groups that aren't already archived.
      // `archivedAt: null` matches both missing and explicit-null values.
      const periodFilter = {
        group: { $in: inactiveGroupIds },
        archivedAt: null,
      };

      const targetPeriods = await BillingPeriod.find(periodFilter)
        .select("_id group")
        .lean()
        .exec();

      const scanned = targetPeriods.length;
      const groupCount = inactiveGroupIds.length;

      if (scanned === 0) {
        header(
          "orphan-periods",
          `scanned ${groupCount} inactive group(s); 0 unarchived period(s) found.`
        );
        return { id: "orphan-periods", scanned: 0, touched: 0, errors: [] };
      }

      if (!ctx.apply) {
        const sample = targetPeriods
          .slice(0, 5)
          .map((p) => String(p._id))
          .join(",");
        const more = targetPeriods.length > 5 ? "..." : "";
        header(
          "orphan-periods",
          `would archive ${scanned} period(s) across ${groupCount} inactive group(s) — sample: ${sample}${more} — pass --apply to execute.`
        );
        return { id: "orphan-periods", scanned, touched: 0, errors: [] };
      }

      // apply via raw collection driver — `archivedAt` / `archivalReason` are
      // not in the BillingPeriod schema, so strict mode would drop them.
      const now = new Date();
      const updateRes = await BillingPeriod.collection.updateMany(
        {
          group: { $in: inactiveGroupIds },
          archivedAt: null,
        },
        {
          $set: {
            archivedAt: now,
            archivalReason: "group-soft-deleted",
            updatedAt: now,
          },
        }
      );

      // batch audit row via raw collection — `billing_periods_archived_for_inactive_groups`
      // is not in the AuditEvent action enum; bypassing strict mode keeps the
      // schema unchanged while preserving the audit trail.
      await AuditEvent.collection.insertOne({
        actor: null,
        actorName: "System (db-cleanup --orphan-periods)",
        action: "billing_periods_archived_for_inactive_groups",
        group: null,
        billingPeriod: null,
        targetMember: null,
        metadata: {
          groupCount,
          periodCount: updateRes.modifiedCount,
          scriptRunId: ctx.scriptRunId,
        },
        createdAt: now,
        updatedAt: now,
      });

      header(
        "orphan-periods",
        `archived ${updateRes.modifiedCount} of ${scanned} period(s) across ${groupCount} inactive group(s); audit event written (scriptRunId=${ctx.scriptRunId}).`
      );

      return {
        id: "orphan-periods",
        scanned,
        touched: updateRes.modifiedCount,
        errors: [],
      };
    },
  },
  {
    id: "old-notifications",
    flag: "--old-notifications",
    description: "prune notification log entries older than the retention window",
    async run(ctx) {
      // local SQLite installs are single-user — notification volume is tiny and
      // the `notifications` table stores rows as JSON blobs that the script
      // would need raw sqlite access to delete. advanced (mongo) mode is the
      // only target; sqlite-mode pruning is deferred until adapter support exists.
      if (process.env.SUB5TR4CKER_MODE === "local") {
        header(
          "old-notifications",
          "skipped: old-notification pruning is advanced (mongo) mode only."
        );
        return { id: "old-notifications", scanned: 0, touched: 0, errors: [] };
      }

      const retentionDays = await resolveRetentionDays();
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // filter: createdAt strictly before the cutoff. `type !== "audit"` honors
      // the brief's safety clause even though the current Notification enum
      // does not include "audit"; if it ever does, those rows are preserved.
      const filter = {
        createdAt: { $lt: cutoff },
        type: { $ne: "audit" },
      };

      const scanned = await Notification.countDocuments(filter).exec();

      if (scanned === 0) {
        header(
          "old-notifications",
          `retention=${retentionDays}d cutoff=${cutoff.toISOString()} — 0 old notification(s) found.`
        );
        return { id: "old-notifications", scanned: 0, touched: 0, errors: [] };
      }

      if (!ctx.apply) {
        header(
          "old-notifications",
          `retention=${retentionDays}d cutoff=${cutoff.toISOString()} — would delete ${scanned} notification(s) — pass --apply to execute.`
        );
        return { id: "old-notifications", scanned, touched: 0, errors: [] };
      }

      // hard delete: notifications are append-only delivery logs, not state.
      const deleteRes = await Notification.deleteMany(filter).exec();

      // batch audit row via raw collection — `old_notifications_pruned` is not
      // in the AuditEvent action enum; bypassing strict mode keeps the schema
      // unchanged while preserving the audit trail.
      const now = new Date();
      await AuditEvent.collection.insertOne({
        actor: null,
        actorName: "System (db-cleanup --old-notifications)",
        action: "old_notifications_pruned",
        group: null,
        billingPeriod: null,
        targetMember: null,
        metadata: {
          count: deleteRes.deletedCount ?? 0,
          retentionDays,
          cutoff: cutoff.toISOString(),
          scriptRunId: ctx.scriptRunId,
        },
        createdAt: now,
        updatedAt: now,
      });

      header(
        "old-notifications",
        `retention=${retentionDays}d cutoff=${cutoff.toISOString()} — deleted ${deleteRes.deletedCount ?? 0} of ${scanned} notification(s); audit event written (scriptRunId=${ctx.scriptRunId}).`
      );

      return {
        id: "old-notifications",
        scanned,
        touched: deleteRes.deletedCount ?? 0,
        errors: [],
      };
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
