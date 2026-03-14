import { NextResponse } from "next/server";

/**
 * Health check for Docker and reverse proxies.
 * GET /api/health -> { status: "ok" }
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
