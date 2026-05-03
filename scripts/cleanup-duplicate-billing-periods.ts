/**
 * one-shot cleanup: merge groups whose `billingperiods` collection contains
 * two rows for the same logical UTC year+month (the bug fixed in phase 1).
 *
 * usage:
 *   pnpm cleanup:dup-periods           (dry-run; writes nothing)
 *   pnpm tsx scripts/cleanup-duplicate-billing-periods.ts --apply
 *
 * what it does:
 *   - groups periods by (group, periodStart UTC year + month)
 *   - skips already-archived rows (idempotent on re-runs)
 *   - picks the OLDEST (by createdAt) row in each cluster as canonical
 *   - merges payments[] into the canonical row, keeping the most-advanced
 *     status per memberId and porting timestamps
 *   - sets `archivedAt = new Date()` on the discarded rows (audit trail —
 *     not deleted)
 *   - writes one `period_duplicate_merged` audit event per merge
 *
 * advanced (Mongo) mode only — local SQLite installations don't ship with the
 * pre-fix bug because they're per-user; if you need to verify locally, hit a
 * dev MongoDB instead.
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

import { Types } from "mongoose";
import { dbConnect } from "../src/lib/db/mongoose";
import { AuditEvent, BillingPeriod, Group } from "../src/models";
import type {
  IBillingPeriod,
  IMemberPayment,
} from "../src/models/billing-period";

const APPLY = process.argv.includes("--apply");

// status priority — higher index wins on conflicts; waived/confirmed are both
// terminal admin decisions
const STATUS_RANK: Record<IMemberPayment["status"], number> = {
  pending: 1,
  overdue: 2,
  member_confirmed: 3,
  waived: 4,
  confirmed: 4,
};

interface RawPeriod extends IBillingPeriod {
  archivedAt?: Date | null;
}

interface MergeDiff {
  memberId: string;
  before: IMemberPayment["status"];
  after: IMemberPayment["status"];
}

interface PlannedMerge {
  groupId: string;
  groupName: string;
  yearMonth: string;
  keptId: string;
  discardedIds: string[];
  payments: IMemberPayment[];
  diffs: MergeDiff[];
}

function chooseWinner(
  current: IMemberPayment | null,
  candidate: IMemberPayment
): IMemberPayment {
  if (!current) return candidate;
  const cur = STATUS_RANK[current.status] ?? 0;
  const cnd = STATUS_RANK[candidate.status] ?? 0;
  if (cnd > cur) return candidate;
  if (cnd < cur) return current;
  // tie — prefer the one with the most-recent admin/member confirmation
  const tA =
    candidate.adminConfirmedAt?.getTime() ??
    candidate.memberConfirmedAt?.getTime() ??
    0;
  const tB =
    current.adminConfirmedAt?.getTime() ??
    current.memberConfirmedAt?.getTime() ??
    0;
  return tA > tB ? candidate : current;
}

function planMerge(
  group: { id: string; name: string; admin: Types.ObjectId },
  cluster: RawPeriod[]
): PlannedMerge {
  const sorted = [...cluster].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const kept = sorted[0];
  const discarded = sorted.slice(1);

  const winners = new Map<string, IMemberPayment>();
  for (const period of sorted) {
    for (const p of period.payments) {
      const key = String(p.memberId);
      winners.set(key, chooseWinner(winners.get(key) ?? null, p));
    }
  }

  // build diff vs the canonical row's pre-merge state
  const baseline = new Map<string, IMemberPayment["status"]>();
  for (const p of kept.payments) baseline.set(String(p.memberId), p.status);

  const diffs: MergeDiff[] = [];
  for (const [memberId, winner] of winners) {
    const before = baseline.get(memberId) ?? "pending";
    if (before !== winner.status || !baseline.has(memberId)) {
      diffs.push({ memberId, before, after: winner.status });
    }
  }

  return {
    groupId: group.id,
    groupName: group.name,
    yearMonth: `${kept.periodStart.getUTCFullYear()}-${String(
      kept.periodStart.getUTCMonth() + 1
    ).padStart(2, "0")}`,
    keptId: String(kept._id),
    discardedIds: discarded.map((d) => String(d._id)),
    payments: Array.from(winners.values()),
    diffs,
  };
}

async function main() {
  await dbConnect();

  // pull every period that hasn't been archived yet. archived rows from a
  // previous run are skipped so re-runs are no-ops on already-merged clusters.
  const allPeriods = (await BillingPeriod.find({
    $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
  })
    .lean<RawPeriod[]>()
    .exec()) as RawPeriod[];

  // bucket by (group, yyyy-mm UTC)
  const buckets = new Map<string, RawPeriod[]>();
  for (const p of allPeriods) {
    const groupId = String((p as unknown as { group: Types.ObjectId }).group);
    const key = `${groupId}|${p.periodStart.getUTCFullYear()}-${p.periodStart.getUTCMonth()}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }

  const duplicateClusters = Array.from(buckets.entries()).filter(
    ([, rows]) => rows.length > 1
  );

  if (duplicateClusters.length === 0) {
    console.log("no duplicate billing periods found — nothing to do.");
    process.exit(0);
  }

  // load all groups touched by duplicates, in one pass
  const groupIds = Array.from(
    new Set(
      duplicateClusters.map(([key]) => key.split("|")[0]!)
    )
  );
  const groups = await Group.find({
    _id: { $in: groupIds.map((id) => new Types.ObjectId(id)) },
  })
    .lean<Array<{ _id: Types.ObjectId; name: string; admin: Types.ObjectId }>>()
    .exec();
  const groupById = new Map(
    groups.map((g) => [String(g._id), { id: String(g._id), name: g.name, admin: g.admin }])
  );

  const plans: PlannedMerge[] = [];
  for (const [key, rows] of duplicateClusters) {
    const groupId = key.split("|")[0]!;
    const group = groupById.get(groupId);
    if (!group) {
      console.warn(`! group ${groupId} referenced by duplicates but not found — skipping`);
      continue;
    }
    plans.push(planMerge(group, rows));
  }

  // report
  console.log("");
  console.log(
    `mode: ${APPLY ? "APPLY (writes enabled)" : "DRY-RUN (no writes)"}`
  );
  console.log(`duplicate clusters: ${plans.length}`);
  console.log("");
  console.log(
    "group".padEnd(28) +
      " " +
      "year-month".padEnd(10) +
      " " +
      "keep".padEnd(26) +
      " " +
      "archive".padEnd(26) +
      " " +
      "payment merges"
  );
  console.log("-".repeat(110));
  for (const plan of plans) {
    const groupCol = `${plan.groupName.slice(0, 26)}`.padEnd(28);
    const ymCol = plan.yearMonth.padEnd(10);
    const keepCol = plan.keptId.padEnd(26);
    const archiveCol = plan.discardedIds.join(",").padEnd(26);
    const mergeCol =
      plan.diffs.length === 0
        ? "(no status changes)"
        : plan.diffs
            .map((d) => `${d.memberId.slice(-6)}: ${d.before}→${d.after}`)
            .join(", ");
    console.log(
      `${groupCol} ${ymCol} ${keepCol} ${archiveCol} ${mergeCol}`
    );
  }
  console.log("");

  if (!APPLY) {
    console.log("dry-run complete. re-run with --apply to perform merges.");
    process.exit(0);
  }

  // apply
  let mergedCount = 0;
  let archivedCount = 0;
  let paymentsTouched = 0;
  let auditWritten = 0;
  const errors: Array<{ groupId: string; yearMonth: string; error: string }> = [];

  for (const plan of plans) {
    try {
      // write merged payments onto the canonical row. payments is a subdocument
      // array — replacing it wholesale preserves payment _id where we kept the
      // winner from the canonical row. winners that came from a discarded row
      // bring the discarded row's subdocument _id with them, which is fine for
      // an audit-trail field but unusual; consumers query by memberId not
      // payment _id so this is benign.
      await BillingPeriod.updateOne(
        { _id: new Types.ObjectId(plan.keptId) },
        { $set: { payments: plan.payments } }
      );

      // archive each discarded row via the raw collection driver to bypass
      // schema strict-mode (archivedAt isn't in the BillingPeriod schema)
      for (const discardedId of plan.discardedIds) {
        await BillingPeriod.collection.updateOne(
          { _id: new Types.ObjectId(discardedId) },
          { $set: { archivedAt: new Date() } }
        );
        archivedCount += 1;
      }

      const group = groupById.get(plan.groupId)!;
      await AuditEvent.create({
        actor: group.admin,
        actorName: "System (cleanup script)",
        action: "period_duplicate_merged",
        group: new Types.ObjectId(plan.groupId),
        billingPeriod: new Types.ObjectId(plan.keptId),
        metadata: {
          source: "cleanup-duplicate-billing-periods",
          keptId: plan.keptId,
          discardedIds: plan.discardedIds,
          yearMonth: plan.yearMonth,
          mergedPayments: plan.diffs,
        },
      });
      auditWritten += 1;

      mergedCount += 1;
      paymentsTouched += plan.diffs.length;
    } catch (err) {
      errors.push({
        groupId: plan.groupId,
        yearMonth: plan.yearMonth,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("");
  console.log("apply complete:");
  console.log(`  groups touched:    ${mergedCount}`);
  console.log(`  periods archived:  ${archivedCount}`);
  console.log(`  payments merged:   ${paymentsTouched}`);
  console.log(`  audit events:      ${auditWritten}`);
  console.log(`  errors:            ${errors.length}`);
  for (const e of errors) {
    console.log(`    - group ${e.groupId} ${e.yearMonth}: ${e.error}`);
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
