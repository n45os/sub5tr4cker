import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageAdapter } from "@/lib/storage";
import type {
  StorageBillingPeriod,
  StorageGroup,
  StorageMemberPayment,
  StorageUser,
} from "@/lib/storage/types";

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>(
    "@/lib/storage"
  );
  return { ...actual, db: vi.fn() };
});

vi.mock("@/lib/billing/admin-confirm", () => ({
  applyAdminPaymentDecision: vi.fn(),
  confirmAllMemberConfirmed: vi.fn(),
}));

vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(async () => "https://app.example.com"),
}));

vi.mock("@/lib/notifications/service", () => ({
  sendNotification: vi.fn(async () => ({
    email: { sent: false },
    telegram: { sent: false },
  })),
}));

vi.mock("@/lib/tasks/queue", () => ({
  enqueueTask: vi.fn(),
}));

vi.mock("@/jobs/run-notification-tasks", () => ({
  runNotificationTasks: vi.fn(),
}));

import { db } from "@/lib/storage";
import {
  applyAdminPaymentDecision,
  confirmAllMemberConfirmed,
} from "@/lib/billing/admin-confirm";
import { sendNotification } from "@/lib/notifications/service";

import { registerHandlers } from "./handlers";

// ─── helpers ──────────────────────────────────────────────────────────────────

const ADMIN_USER: StorageUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@example.com",
  authIdentityId: null,
  role: "admin",
  emailVerified: null,
  image: null,
  hashedPassword: null,
  telegram: { chatId: 999, username: "adminbot", linkedAt: new Date() },
  telegramLinkCode: null,
  notificationPreferences: {
    email: true,
    telegram: true,
    reminderFrequency: "every_3_days",
  },
  welcomeEmailSentAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const STRANGER_USER: StorageUser = {
  ...ADMIN_USER,
  id: "stranger-1",
  name: "Stranger",
  email: "stranger@example.com",
  telegram: { chatId: 222, username: "stranger", linkedAt: new Date() },
};

function buildGroup(): StorageGroup {
  const epoch = new Date("2025-01-01T00:00:00.000Z");
  return {
    id: "group-1",
    name: "Family Plan",
    description: null,
    adminId: ADMIN_USER.id,
    service: {
      name: "YouTube Premium",
      icon: null,
      url: null,
      accentColor: null,
      emailTheme: "clean",
    },
    billing: {
      mode: "equal_split",
      currentPrice: 20,
      currency: "EUR",
      cycleDay: 1,
      cycleType: "monthly",
      adminIncludedInSplit: false,
      fixedMemberAmount: null,
      gracePeriodDays: 3,
      paymentInAdvanceDays: 0,
    },
    payment: {
      platform: "revolut",
      link: null,
      instructions: null,
      stripeAccountId: null,
    },
    notifications: {
      remindersEnabled: true,
      followUpsEnabled: true,
      priceChangeEnabled: false,
      saveEmailParams: false,
    },
    members: [
      {
        id: "m1",
        userId: null,
        email: "alex@example.com",
        nickname: "Alex",
        role: "member",
        joinedAt: epoch,
        leftAt: null,
        isActive: true,
        customAmount: null,
        acceptedAt: epoch,
        unsubscribedFromEmail: false,
        billingStartsAt: null,
      },
      {
        id: "m2",
        userId: null,
        email: "sofia@example.com",
        nickname: "Sofia",
        role: "member",
        joinedAt: epoch,
        leftAt: null,
        isActive: true,
        customAmount: null,
        acceptedAt: epoch,
        unsubscribedFromEmail: false,
        billingStartsAt: null,
      },
    ],
    announcements: { notifyOnPriceChange: false, extraText: null },
    telegramGroup: { chatId: null, linkedAt: null },
    isActive: true,
    inviteCode: null,
    inviteLinkEnabled: false,
    initializedAt: epoch,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

function makePayment(
  memberId: string,
  nickname: string,
  status: StorageMemberPayment["status"],
  memberConfirmedAt: Date | null = null
): StorageMemberPayment {
  return {
    id: `pay-${memberId}`,
    memberId,
    memberEmail: `${nickname.toLowerCase()}@example.com`,
    memberNickname: nickname,
    amount: 10,
    adjustedAmount: null,
    adjustmentReason: null,
    status,
    memberConfirmedAt,
    adminConfirmedAt: status === "confirmed" ? new Date() : null,
    confirmationToken: null,
    notes: null,
  };
}

function buildPeriod(payments: StorageMemberPayment[]): StorageBillingPeriod {
  return {
    id: "period-1",
    groupId: "group-1",
    periodStart: new Date("2026-05-01T00:00:00Z"),
    collectionOpensAt: new Date("2026-05-01T00:00:00Z"),
    periodEnd: new Date("2026-06-01T00:00:00Z"),
    periodLabel: "May 2026",
    totalPrice: 20,
    currency: "EUR",
    priceNote: null,
    payments,
    reminders: [],
    isFullyPaid: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

interface FakeStoreState {
  group: StorageGroup;
  period: StorageBillingPeriod;
  userByChatId: Map<number, StorageUser>;
}

function installFakeStore(initial?: {
  payments?: StorageMemberPayment[];
}): FakeStoreState {
  const state: FakeStoreState = {
    group: buildGroup(),
    period: buildPeriod(
      initial?.payments ?? [
        makePayment("m1", "Alex", "member_confirmed", new Date()),
        makePayment("m2", "Sofia", "member_confirmed", new Date()),
      ]
    ),
    userByChatId: new Map([
      [ADMIN_USER.telegram!.chatId, ADMIN_USER],
      [STRANGER_USER.telegram!.chatId, STRANGER_USER],
    ]),
  };

  const fakeStore: Partial<StorageAdapter> = {
    getBillingPeriodById: vi.fn(async (id: string) =>
      id === state.period.id ? state.period : null
    ),
    getGroup: vi.fn(async (id: string) =>
      id === state.group.id ? state.group : null
    ),
    getUserByTelegramChatId: vi.fn(async (chatId: number) =>
      state.userByChatId.get(chatId) ?? null
    ),
  };
  vi.mocked(db).mockResolvedValue(fakeStore as StorageAdapter);
  return state;
}

// build a fake grammy bot, capture the callback_query handler, and return a
// dispatcher that invokes it with the given callback data + chat
function buildDispatcher() {
  let callbackHandler:
    | ((ctx: Record<string, unknown>) => Promise<void>)
    | null = null;
  const fakeBot = {
    command: vi.fn(),
    on: vi.fn((event: string, handler: typeof callbackHandler) => {
      if (event === "callback_query:data") callbackHandler = handler;
    }),
  };
  registerHandlers(fakeBot as unknown as Parameters<typeof registerHandlers>[0]);

  return function dispatch(args: {
    data: string;
    chatId: number | null;
  }) {
    if (!callbackHandler) throw new Error("callback handler not registered");
    const calls = {
      answerCallbackQuery: vi.fn(async () => undefined),
      editMessageText: vi.fn(async () => undefined),
      reply: vi.fn(async () => undefined),
    };
    const ctx: Record<string, unknown> = {
      callbackQuery: { data: args.data },
      chat: args.chatId == null ? undefined : { id: args.chatId },
      ...calls,
    };
    return { ctx, calls, run: () => callbackHandler!(ctx) };
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("admin_confirm callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorized admin → applies decision, answers callback, edits message", async () => {
    const state = installFakeStore();
    vi.mocked(applyAdminPaymentDecision).mockResolvedValue({
      ok: true,
      period: {
        ...state.period,
        payments: state.period.payments.map((p) =>
          p.memberId === "m1"
            ? { ...p, status: "confirmed", adminConfirmedAt: new Date() }
            : p
        ),
      },
      payment: { ...state.period.payments[0], status: "confirmed" },
    });

    const dispatch = buildDispatcher();
    const { calls, run } = dispatch({
      data: "admin_confirm:period-1:m1",
      chatId: ADMIN_USER.telegram!.chatId,
    });
    await run();

    expect(applyAdminPaymentDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: "group-1",
        periodId: "period-1",
        memberId: "m1",
        action: "confirm",
        actor: expect.objectContaining({ id: ADMIN_USER.id }),
      })
    );
    expect(calls.answerCallbackQuery).toHaveBeenCalledWith({
      text: "Confirmed ✓",
    });
    // remaining unverified member (Sofia) renders in the next message
    expect(calls.editMessageText).toHaveBeenCalledTimes(1);
    const [text] = calls.editMessageText.mock.calls[0];
    expect(text).toContain("Sofia");
    expect(text).not.toContain("Alex");
  });

  it("non-admin → show_alert toast, no DB change", async () => {
    installFakeStore();
    const dispatch = buildDispatcher();
    const { calls, run } = dispatch({
      data: "admin_confirm:period-1:m1",
      chatId: STRANGER_USER.telegram!.chatId,
    });
    await run();

    expect(applyAdminPaymentDecision).not.toHaveBeenCalled();
    expect(calls.answerCallbackQuery).toHaveBeenCalledWith({
      text: "Not authorized",
      show_alert: true,
    });
    expect(calls.editMessageText).not.toHaveBeenCalled();
  });

  it("already-confirmed payment → 'Already confirmed' toast and no extra DB write", async () => {
    installFakeStore({
      payments: [
        makePayment("m1", "Alex", "confirmed"),
        makePayment("m2", "Sofia", "member_confirmed", new Date()),
      ],
    });
    const dispatch = buildDispatcher();
    const { calls, run } = dispatch({
      data: "admin_confirm:period-1:m1",
      chatId: ADMIN_USER.telegram!.chatId,
    });
    await run();

    expect(calls.answerCallbackQuery).toHaveBeenCalledWith({
      text: "Already confirmed",
    });
    expect(applyAdminPaymentDecision).not.toHaveBeenCalled();
  });

  it("rerendered message shows the member self-confirm timestamp for the still-unverified member", async () => {
    const aliceConfirmedAt = new Date(Date.now() - 30 * 60 * 1000); // 30m ago
    const state = installFakeStore({
      payments: [
        makePayment("m1", "Alex", "member_confirmed", new Date()),
        makePayment("m2", "Sofia", "member_confirmed", aliceConfirmedAt),
      ],
    });
    vi.mocked(applyAdminPaymentDecision).mockResolvedValue({
      ok: true,
      period: {
        ...state.period,
        payments: [
          { ...state.period.payments[0], status: "confirmed" },
          state.period.payments[1],
        ],
      },
      payment: { ...state.period.payments[0], status: "confirmed" },
    });

    const dispatch = buildDispatcher();
    const { calls, run } = dispatch({
      data: "admin_confirm:period-1:m1",
      chatId: ADMIN_USER.telegram!.chatId,
    });
    await run();

    const [text] = calls.editMessageText.mock.calls[0];
    // formatRelativeTime emits "30m ago" for ~30 minutes
    expect(text).toMatch(/Sofia.*30m ago/);
  });
});

describe("admin_reject callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorized admin → applies reject decision, answers, notifies the member", async () => {
    const state = installFakeStore();
    vi.mocked(applyAdminPaymentDecision).mockResolvedValue({
      ok: true,
      period: {
        ...state.period,
        payments: state.period.payments.map((p) =>
          p.memberId === "m1"
            ? { ...p, status: "pending", memberConfirmedAt: null }
            : p
        ),
      },
      payment: { ...state.period.payments[0], status: "pending" },
    });

    const dispatch = buildDispatcher();
    const { calls, run } = dispatch({
      data: "admin_reject:period-1:m1",
      chatId: ADMIN_USER.telegram!.chatId,
    });
    await run();

    expect(applyAdminPaymentDecision).toHaveBeenCalledWith(
      expect.objectContaining({ action: "reject", memberId: "m1" })
    );
    expect(calls.answerCallbackQuery).toHaveBeenCalledWith({
      text: "Rejected ✕",
    });
    // member-rejection notification fires through unified service
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [, content] = vi.mocked(sendNotification).mock.calls[0];
    expect(content).toMatchObject({
      type: "payment_reminder",
      groupId: "group-1",
      billingPeriodId: "period-1",
    });
    expect(content.subject).toContain("rejected");
  });

  it("non-admin → show_alert toast, no DB change, no notification", async () => {
    installFakeStore();
    const dispatch = buildDispatcher();
    const { calls, run } = dispatch({
      data: "admin_reject:period-1:m1",
      chatId: STRANGER_USER.telegram!.chatId,
    });
    await run();

    expect(applyAdminPaymentDecision).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
    expect(calls.answerCallbackQuery).toHaveBeenCalledWith({
      text: "Not authorized",
      show_alert: true,
    });
  });
});

describe("admin_confirm_all callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorized admin → bulk-confirms, shows count toast, edits message", async () => {
    const state = installFakeStore();
    vi.mocked(confirmAllMemberConfirmed).mockResolvedValue({
      ok: true,
      period: {
        ...state.period,
        payments: state.period.payments.map((p) => ({
          ...p,
          status: "confirmed",
        })),
        isFullyPaid: true,
      },
      confirmedMemberIds: ["m1", "m2"],
    });

    const dispatch = buildDispatcher();
    const { calls, run } = dispatch({
      data: "admin_confirm_all:period-1",
      chatId: ADMIN_USER.telegram!.chatId,
    });
    await run();

    expect(confirmAllMemberConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: "group-1",
        periodId: "period-1",
        actor: expect.objectContaining({ id: ADMIN_USER.id }),
      })
    );
    expect(calls.answerCallbackQuery).toHaveBeenCalledWith({
      text: "Confirmed 2 ✓",
    });
    const [text] = calls.editMessageText.mock.calls[0];
    expect(text).toContain("All 2 payments confirmed");
    expect(text).toContain("May 2026");
  });

  it("non-admin → show_alert toast, no bulk update", async () => {
    installFakeStore();
    const dispatch = buildDispatcher();
    const { calls, run } = dispatch({
      data: "admin_confirm_all:period-1",
      chatId: STRANGER_USER.telegram!.chatId,
    });
    await run();

    expect(confirmAllMemberConfirmed).not.toHaveBeenCalled();
    expect(calls.answerCallbackQuery).toHaveBeenCalledWith({
      text: "Not authorized",
      show_alert: true,
    });
  });

  it("nothing to confirm → 'Nothing to confirm' toast, no message edit", async () => {
    const state = installFakeStore();
    vi.mocked(confirmAllMemberConfirmed).mockResolvedValue({
      ok: true,
      period: state.period,
      confirmedMemberIds: [],
    });

    const dispatch = buildDispatcher();
    const { calls, run } = dispatch({
      data: "admin_confirm_all:period-1",
      chatId: ADMIN_USER.telegram!.chatId,
    });
    await run();

    expect(calls.answerCallbackQuery).toHaveBeenCalledWith({
      text: "Nothing to confirm",
    });
    expect(calls.editMessageText).not.toHaveBeenCalled();
  });
});
