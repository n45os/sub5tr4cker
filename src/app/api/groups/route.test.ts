import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db/mongoose", () => ({
  dbConnect: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/models", () => ({
  Group: { find: vi.fn(() => ({ lean: vi.fn(() => ({ exec: vi.fn(() => []) })) })) },
  BillingPeriod: { findOne: vi.fn(() => ({ sort: vi.fn(() => ({ lean: vi.fn(() => ({ exec: vi.fn(() => null) })) })) })) },
}));

const { auth } = await import("@/lib/auth");

describe("GET /api/groups", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const request = new Request("http://localhost/api/groups");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 with empty groups when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", email: "u@example.com" },
    } as never);

    const request = new Request("http://localhost/api/groups");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data?.groups).toEqual([]);
  });
});
