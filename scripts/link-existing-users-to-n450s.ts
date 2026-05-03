/**
 * one-time: link every local User row to its matching n450s_auth identity by
 * email. idempotent — re-running is a no-op once every match has been linked.
 *
 * env:
 *   AUTH_SERVICE_URL          — n450s_auth base URL (required)
 *   N450S_ADMIN_TOKEN         — bearer token for /admin/api (required)
 *   MONGODB_URI               — local mongo URI (required, advanced mode)
 *
 * usage:
 *   pnpm tsx scripts/link-existing-users-to-n450s.ts            # dry run
 *   pnpm tsx scripts/link-existing-users-to-n450s.ts --apply    # write
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
import { User } from "../src/models";

interface AuthIdentityRow {
  id: string;
  email: string | null;
  emailVerified?: boolean;
}

interface UsersSyncResponse {
  matched?: AuthIdentityRow[];
  authOnly?: AuthIdentityRow[];
  backendOnly?: unknown[];
  mismatches?: Array<{ identity: AuthIdentityRow }>;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`missing required env var: ${key}`);
    process.exit(1);
  }
  return v;
}

async function fetchAuthIdentities(): Promise<AuthIdentityRow[]> {
  const base = requireEnv("AUTH_SERVICE_URL").replace(/\/+$/, "");
  const token = requireEnv("N450S_ADMIN_TOKEN");
  const res = await fetch(`${base}/admin/api/users-sync`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`users-sync failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as UsersSyncResponse;
  const all: AuthIdentityRow[] = [];
  for (const row of body.matched ?? []) all.push(row);
  for (const row of body.authOnly ?? []) all.push(row);
  for (const m of body.mismatches ?? []) all.push(m.identity);
  return all;
}

function buildEmailIndex(rows: AuthIdentityRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (!r.email || !r.id) continue;
    const key = r.email.toLowerCase().trim();
    if (!map.has(key)) map.set(key, r.id);
  }
  return map;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  console.log(apply ? "[apply] writing changes" : "[dry-run] no writes — pass --apply to commit");

  await dbConnect();
  const identities = await fetchAuthIdentities();
  const byEmail = buildEmailIndex(identities);
  console.log(`fetched ${identities.length} n450s identities (${byEmail.size} with usable email)`);

  const users = await User.find({ authIdentityId: null }).lean();
  console.log(`found ${users.length} local users without authIdentityId`);

  let linked = 0;
  let alreadyLinked = 0;
  const unmatched: Array<{ id: string; email: string; name: string }> = [];

  for (const u of users) {
    const email = (u.email ?? "").toLowerCase().trim();
    const sub = email ? byEmail.get(email) : null;
    if (!sub) {
      unmatched.push({ id: String(u._id), email: u.email, name: u.name });
      continue;
    }
    if (apply) {
      const result = await User.updateOne(
        { _id: u._id, authIdentityId: null },
        { $set: { authIdentityId: sub } }
      );
      if (result.modifiedCount === 1) linked += 1;
      else alreadyLinked += 1;
    } else {
      linked += 1;
    }
  }

  console.log("");
  console.log("summary");
  console.log(`  ${apply ? "linked" : "would link"}: ${linked}`);
  if (apply && alreadyLinked > 0) {
    console.log(`  already linked (race): ${alreadyLinked}`);
  }
  console.log(`  unmatched: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log("");
    console.log("unmatched users (no auth identity by email — invite manually):");
    for (const u of unmatched) {
      console.log(`  - ${u.email}  (${u.name})  [user._id=${u.id}]`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
