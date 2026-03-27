import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/mongoose", () => ({
  dbConnect: vi.fn(() => Promise.resolve()),
}));

const mockFindOne = vi.fn();
const mockCreate = vi.fn();
const mockFindByIdAndUpdate = vi.fn();

vi.mock("@/models/scheduled-task", () => ({
  ScheduledTask: {
    findOne: mockFindOne,
    create: mockCreate,
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({
          cursor: vi.fn(() => ({
            [Symbol.asyncIterator]: function () {
              return { next: () => Promise.resolve({ done: true }) };
            },
          })),
        })),
      })),
    })),
    findByIdAndUpdate: mockFindByIdAndUpdate,
    countDocuments: vi.fn(() => Promise.resolve(0)),
  },
}));

describe("enqueueTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockImplementation((doc: { idempotencyKey: string }) => Promise.resolve({ _id: "new-id", ...doc }));
  });

  it("creates a task when no existing task with idempotency key", async () => {
    const { enqueueTask } = await import("./queue");
    const runAt = new Date("2026-03-18T10:00:00Z");
    const result = await enqueueTask({
      type: "payment_reminder",
      runAt,
      payload: { groupId: "g1", billingPeriodId: "p1", paymentId: "pay1" },
    });
    expect(mockFindOne).toHaveBeenCalledWith({
      idempotencyKey: "payment_reminder:p1:pay1:2026-03-18",
    });
    expect(mockCreate).toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result?.idempotencyKey).toBe("payment_reminder:p1:pay1:2026-03-18");
  });

  it("returns null when a task with same idempotency key already exists", async () => {
    mockFindOne.mockResolvedValue({ _id: "existing", idempotencyKey: "payment_reminder:p1:pay1:2026-03-18" });
    const { enqueueTask } = await import("./queue");
    const runAt = new Date("2026-03-18T10:00:00Z");
    const result = await enqueueTask({
      type: "payment_reminder",
      runAt,
      payload: { groupId: "g1", billingPeriodId: "p1", paymentId: "pay1" },
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

describe("failTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByIdAndUpdate.mockImplementation(
      (_id: unknown, update: { $set?: { status?: string; runAt?: Date; attempts?: number } }) =>
        Promise.resolve({ _id: "task-1", ...update?.$set })
    );
  });

  it("marks task failed when attempts reach maxAttempts", async () => {
    const { failTask } = await import("./queue");
    const task = {
      _id: "task-1",
      attempts: 4,
      maxAttempts: 5,
      status: "locked",
    } as never;
    await failTask(task, new Error("send failed"));
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "failed",
          attempts: 5,
          lockedAt: null,
          lockedBy: null,
        }),
      })
    );
  });

  it("sets status back to pending with future runAt when attempts below max", async () => {
    const { failTask } = await import("./queue");
    const task = {
      _id: "task-1",
      attempts: 0,
      maxAttempts: 5,
      status: "locked",
    } as never;
    const before = Date.now();
    await failTask(task, new Error("send failed"));
    const update = mockFindByIdAndUpdate.mock.calls[0][1];
    expect(update.$set.status).toBe("pending");
    expect(update.$set.attempts).toBe(1);
    expect(new Date(update.$set.runAt).getTime()).toBeGreaterThanOrEqual(before);
  });
});
