/**
 * one-time: set collectionOpensAt = periodStart for BillingPeriod rows missing it
 * run: pnpm tsx scripts/backfill-collection-opens-at.ts
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

import { dbConnect } from "../src/lib/db/mongoose";
import { BillingPeriod } from "../src/models";

async function main() {
  await dbConnect();
  const cursor = BillingPeriod.find({
    $or: [{ collectionOpensAt: { $exists: false } }, { collectionOpensAt: null }],
  }).cursor();
  let n = 0;
  for await (const doc of cursor) {
    await BillingPeriod.updateOne(
      { _id: doc._id },
      { $set: { collectionOpensAt: doc.periodStart } }
    );
    n += 1;
  }
  console.log("updated", n, "periods");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
