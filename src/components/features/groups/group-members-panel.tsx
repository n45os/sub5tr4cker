"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2, Mail, Pencil, UserMinus, UserPlus } from "lucide-react";
import { PaymentStatusBadge } from "@/components/features/billing/payment-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface MemberRow {
  _id: string;
  email: string;
  nickname: string;
  role: string;
  customAmount: number | null;
  /** when false, member has not linked an account (invite not accepted) */
  hasAccount?: boolean;
  acceptedAt?: string | null;
  /** first period member owes; null = from join date */
  billingStartsAt?: string | null;
}

export interface PeriodPaymentRow {
  _id: string;
  /** period start date (YYYY-MM-DD) for use as billing-starts value */
  periodStart: string;
  periodLabel: string;
  totalPrice: number;
  payments: Array<{
    memberId: string;
    memberNickname: string;
    amount: number;
    adjustedAmount?: number | null;
    status: string;
    memberConfirmedAt: string | null;
    adminConfirmedAt: string | null;
  }>;
  isFullyPaid: boolean;
}

interface GroupMembersPanelProps {
  groupId: string;
  members: MemberRow[];
  currency: string;
  isAdmin: boolean;
  periods?: PeriodPaymentRow[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "short" });
}

export function GroupMembersPanel({
  groupId,
  members,
  currency,
  isAdmin,
  periods = [],
}: GroupMembersPanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [billingStartsAt, setBillingStartsAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  // when set, show dialog asking whether to send invite email to the newly added member
  const [inviteDialog, setInviteDialog] = useState<{
    memberId: string;
    email: string;
  } | null>(null);
  // when set (with creditSummary or not), show post-add modal: credit summary → apply credits → notify + invite
  const [postAddModal, setPostAddModal] = useState<{
    memberId: string;
    email: string;
    nickname: string;
    creditSummary: Array<{
      memberId: string;
      memberNickname: string;
      memberEmail: string;
      totalCredit: number;
      periods: Array<{
        periodId: string;
        periodLabel: string;
        oldAmount: number;
        newAmount: number;
        credit: number;
      }>;
    }>;
    newShareAmount: number;
    currency: string;
  } | null>(null);
  const [postAddStep, setPostAddStep] = useState<1 | 2 | 3>(1);
  const [creditApplications, setCreditApplications] = useState<
    Record<string, { periodId: string; periodLabel: string } | null>
  >({});
  const [applyCreditsLoading, setApplyCreditsLoading] = useState(false);
  const [notifyMembersLoading, setNotifyMembersLoading] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [resendingMemberId, setResendingMemberId] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<{
    _id: string;
    nickname: string;
    customAmount: string;
    billingStartsAt: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [removeMember, setRemoveMember] = useState<{
    _id: string;
    nickname: string;
    email: string;
  } | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  async function handleResendInvite(memberId: string) {
    setResendingMemberId(memberId);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/members/${memberId}/send-invite`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to send invite.");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to send invite. Try again.");
    } finally {
      setResendingMemberId(null);
    }
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedNickname = nickname.trim();
    if (!trimmedEmail || !trimmedNickname) {
      setError("Email and nickname are required.");
      return;
    }
    const amount = customAmount.trim() ? Number(customAmount) : null;
    if (customAmount.trim() && (!Number.isFinite(amount) || (amount ?? 0) <= 0)) {
      setError("Custom amount must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const body: {
        email: string;
        nickname: string;
        customAmount: number | null;
        billingStartsAt?: string | null;
      } = {
        email: trimmedEmail,
        nickname: trimmedNickname,
        customAmount: amount,
      };
      if (billingStartsAt.trim()) {
        body.billingStartsAt = billingStartsAt.trim();
      } else {
        body.billingStartsAt = null;
      }
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "Failed to add member.");
        setLoading(false);
        return;
      }

      setEmail("");
      setNickname("");
      setCustomAmount("");
      setBillingStartsAt("");
      const summary = json.data.creditSummary ?? [];
      const defaults: Record<string, { periodId: string; periodLabel: string } | null> = {};
      for (const entry of summary) {
        const unpaidPeriod = periods.find((p) => {
          const pay = p.payments.find((x) => x.memberId === entry.memberId);
          return (
            pay &&
            pay.status !== "confirmed" &&
            pay.status !== "waived"
          );
        });
        defaults[entry.memberId] = unpaidPeriod
          ? { periodId: unpaidPeriod._id, periodLabel: unpaidPeriod.periodLabel }
          : null;
      }
      setCreditApplications(defaults);
      setPostAddStep(1);
      setPostAddModal({
        memberId: json.data._id,
        email: json.data.email,
        nickname: json.data.nickname,
        creditSummary: summary,
        newShareAmount: json.data.newShareAmount ?? 0,
        currency: json.data.currency ?? currency,
      });
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInvite() {
    if (!inviteDialog) return;
    setInviteSending(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/members/${inviteDialog.memberId}/send-invite`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to send invite.");
        return;
      }
      setInviteDialog(null);
      router.refresh();
    } catch {
      setError("Failed to send invite. Try again.");
    } finally {
      setInviteSending(false);
    }
  }

  async function handleApplyCredits() {
    if (!postAddModal) return;
    const toApply = postAddModal.creditSummary.filter(
      (c) => creditApplications[c.memberId] != null
    );
    if (toApply.length === 0) {
      setPostAddStep(3);
      return;
    }
    setApplyCreditsLoading(true);
    try {
      for (const entry of toApply) {
        const target = creditApplications[entry.memberId];
        if (!target) continue;
        const period = periods.find((p) => p._id === target.periodId);
        if (!period) continue;
        const payment = period.payments.find(
          (p) => p.memberId === entry.memberId
        );
        if (!payment) continue;
        const currentAmount = payment.adjustedAmount ?? payment.amount;
        const newAmount = Math.round((currentAmount - entry.totalCredit) * 100) / 100;
        const reason = `Credit from ${postAddModal.nickname} joining — overpaid ${entry.totalCredit.toFixed(2)} ${postAddModal.currency} on past periods`;
        const res = await fetch(
          `/api/groups/${groupId}/billing/${target.periodId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payments: [
                {
                  memberId: entry.memberId,
                  adjustedAmount: newAmount,
                  adjustmentReason: reason,
                },
              ],
            }),
          }
        );
        if (!res.ok) {
          const json = await res.json();
          setError(json?.error?.message ?? "Failed to apply credit.");
          return;
        }
      }
      setPostAddStep(3);
      router.refresh();
    } catch {
      setError("Failed to apply credits. Try again.");
    } finally {
      setApplyCreditsLoading(false);
    }
  }

  async function handlePostAddNotifyAndInvite(options: {
    sendInvite: boolean;
    notify: boolean;
  }) {
    if (!postAddModal) return;
    setNotifyMembersLoading(true);
    try {
      if (options.notify) {
        const res = await fetch(
          `/api/groups/${groupId}/notify-member-added`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              newMemberId: postAddModal.memberId,
              newMemberNickname: postAddModal.nickname,
              newShareAmount: postAddModal.newShareAmount,
              currency: postAddModal.currency,
              creditSummary: postAddModal.creditSummary,
            }),
          }
        );
        if (!res.ok) {
          const json = await res.json();
          setError(json?.error?.message ?? "Failed to notify members.");
          return;
        }
      }
      if (options.sendInvite) {
        const res = await fetch(
          `/api/groups/${groupId}/members/${postAddModal.memberId}/send-invite`,
          { method: "POST" }
        );
        if (!res.ok) {
          const json = await res.json();
          setError(json?.error?.message ?? "Failed to send invite.");
          return;
        }
      }
      setPostAddModal(null);
      setPostAddStep(1);
      setCreditApplications({});
      router.refresh();
    } catch {
      setError("Failed to send. Try again.");
    } finally {
      setNotifyMembersLoading(false);
    }
  }

  function openEditMember(member: MemberRow) {
    setEditMember({
      _id: member._id,
      nickname: member.nickname,
      customAmount: member.customAmount != null ? String(member.customAmount) : "",
      billingStartsAt: member.billingStartsAt ?? "",
    });
    setError(null);
  }

  async function handleSaveEditMember(event: React.FormEvent<HTMLFormElement>) {
    if (!editMember) return;
    event.preventDefault();
    setEditSaving(true);
    setError(null);
    try {
      const body: {
        nickname: string;
        customAmount: number | null;
        billingStartsAt?: string | null;
      } = {
        nickname: editMember.nickname.trim(),
        customAmount: editMember.customAmount.trim()
          ? Number(editMember.customAmount)
          : null,
      };
      if (editMember.billingStartsAt.trim()) {
        body.billingStartsAt = editMember.billingStartsAt.trim();
      } else {
        body.billingStartsAt = null;
      }
      const res = await fetch(
        `/api/groups/${groupId}/members/${editMember._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to update member.");
        setEditSaving(false);
        return;
      }
      setEditMember(null);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleRemoveMember() {
    if (!removeMember) return;
    setRemoveLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/members/${removeMember._id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to remove member.");
        setRemoveLoading(false);
        return;
      }
      setRemoveMember(null);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setRemoveLoading(false);
    }
  }

  return (
    <>
      <Dialog
        open={!!postAddModal}
        onOpenChange={(open) => {
          if (!open) {
            setPostAddModal(null);
            setPostAddStep(1);
            setCreditApplications({});
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Member added</DialogTitle>
            <DialogDescription>
              {postAddModal && postAddStep === 1 && postAddModal.creditSummary.length > 0 && (
                <>
                  {postAddModal.nickname} was added with billing from a past period.
                  Existing members who already paid now have credits. Review below, then choose where to apply them.
                </>
              )}
              {postAddModal && postAddStep === 1 && postAddModal.creditSummary.length === 0 && (
                <> {postAddModal.nickname} was added. You can send an invite below. </>
              )}
              {postAddModal && postAddStep === 2 && (
                <> Choose which period to apply each member&apos;s credit to. </>
              )}
              {postAddModal && postAddStep === 3 && (
                <> Notify existing members about the new price and optionally send an invite to {postAddModal.nickname}. </>
              )}
            </DialogDescription>
          </DialogHeader>
          {postAddModal && postAddStep === 1 && (
            <div className="space-y-4 py-2">
              {postAddModal.creditSummary.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    New share amount: <strong>{postAddModal.newShareAmount.toFixed(2)} {postAddModal.currency}</strong> per person
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead className="text-right">Total credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {postAddModal.creditSummary.map((c) => (
                        <TableRow key={c.memberId}>
                          <TableCell>{c.memberNickname}</TableCell>
                          <TableCell className="text-right font-mono">
                            {c.totalCredit.toFixed(2)} {postAddModal.currency}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPostAddStep(3);
                      }}
                    >
                      Skip credits
                    </Button>
                    <Button onClick={() => setPostAddStep(2)}>
                      Next — Apply credits
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPostAddModal(null);
                      setPostAddStep(1);
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setPostAddStep(3);
                    }}
                  >
                    Send invite
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
          {postAddModal && postAddStep === 2 && (
            <div className="space-y-4 py-2">
              {postAddModal.creditSummary.map((c) => {
                const unpaidPeriods = periods.filter((p) => {
                  const pay = p.payments.find((x) => x.memberId === c.memberId);
                  return pay && pay.status !== "confirmed" && pay.status !== "waived";
                });
                const selected = creditApplications[c.memberId];
                return (
                  <div key={c.memberId} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.memberNickname}</span>
                      <span className="text-sm text-muted-foreground font-mono">
                        {c.totalCredit.toFixed(2)} {postAddModal.currency} credit
                      </span>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">Apply to period</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={selected?.periodId ?? ""}
                        onChange={(e) => {
                          const periodId = e.target.value;
                          if (!periodId) {
                            setCreditApplications((prev) => ({ ...prev, [c.memberId]: null }));
                            return;
                          }
                          const period = unpaidPeriods.find((p) => p._id === periodId);
                          setCreditApplications((prev) => ({
                            ...prev,
                            [c.memberId]: period
                              ? { periodId: period._id, periodLabel: period.periodLabel }
                              : null,
                          }));
                        }}
                      >
                        <option value="">Don&apos;t apply</option>
                        {unpaidPeriods.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.periodLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setPostAddStep(1)}
                  disabled={applyCreditsLoading}
                >
                  Back
                </Button>
                <Button onClick={handleApplyCredits} disabled={applyCreditsLoading}>
                  {applyCreditsLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Apply credits"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
          {postAddModal && postAddStep === 3 && (
            <div className="space-y-4 py-2">
              <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPostAddModal(null);
                    setPostAddStep(1);
                    setCreditApplications({});
                  }}
                  disabled={notifyMembersLoading}
                >
                  Skip
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handlePostAddNotifyAndInvite({ sendInvite: true, notify: false })}
                  disabled={notifyMembersLoading}
                >
                  {notifyMembersLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="size-4 mr-2" />
                      Send invite to {postAddModal.nickname}
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handlePostAddNotifyAndInvite({ sendInvite: true, notify: true })}
                  disabled={notifyMembersLoading}
                >
                  {notifyMembersLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Notify members & send invite"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!inviteDialog}
        onOpenChange={(open) => !open && setInviteDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Member added</DialogTitle>
            <DialogDescription>
              {inviteDialog
                ? `Send an invite email to ${inviteDialog.email}? They'll get group details, payment instructions, and how to get reminders via Telegram.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setInviteDialog(null)}
              disabled={inviteSending}
            >
              Skip
            </Button>
            <Button
              onClick={handleSendInvite}
              disabled={inviteSending}
            >
              {inviteSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Mail className="size-4 mr-2" />
                  Send invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removeMember}
        onOpenChange={(open) => !open && setRemoveMember(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              {removeMember
                ? `Remove ${removeMember.nickname} (${removeMember.email}) from this group? They will no longer receive reminders or see this group. You can add them again later if needed.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRemoveMember(null)}
              disabled={removeLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removeLoading}
            >
              {removeLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <UserMinus className="size-4 mr-2" />
                  Remove
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editMember}
        onOpenChange={(open) => !open && setEditMember(null)}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveEditMember}>
            <DialogHeader>
              <DialogTitle>Edit member</DialogTitle>
              <DialogDescription>
                Change nickname, custom amount, or when billing starts for this member.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="edit-nickname">Nickname</Label>
                <Input
                  id="edit-nickname"
                  value={editMember?.nickname ?? ""}
                  onChange={(e) =>
                    setEditMember((prev) =>
                      prev ? { ...prev, nickname: e.target.value } : null
                    )
                  }
                  required
                  disabled={editSaving}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-custom-amount">
                  Custom amount ({currency})
                </Label>
                <Input
                  id="edit-custom-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                  value={editMember?.customAmount ?? ""}
                  onChange={(e) =>
                    setEditMember((prev) =>
                      prev ? { ...prev, customAmount: e.target.value } : null
                    )
                  }
                  disabled={editSaving}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-billing-starts">
                  Billing starts from
                </Label>
                <select
                  id="edit-billing-starts"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={editMember?.billingStartsAt ?? ""}
                  onChange={(e) =>
                    setEditMember((prev) =>
                      prev
                        ? { ...prev, billingStartsAt: e.target.value || "" }
                        : null
                    )
                  }
                  disabled={editSaving}
                >
                  <option value="">From join date</option>
                  {periods.map((p) => (
                    <option key={p._id} value={p.periodStart}>
                      {p.periodLabel}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Member will only owe from the selected billing period onward.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditMember(null)}
                disabled={editSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Everyone currently included in this subscription split.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isAdmin ? (
          <form
            onSubmit={handleAddMember}
            className="rounded-xl border bg-muted/30 p-4 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserPlus className="size-4" />
              Add member
            </div>
            {error ? (
              <p
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="member-email">Email</Label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-nickname">Nickname</Label>
                <Input
                  id="member-nickname"
                  type="text"
                  placeholder="Display name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-billing-starts">Billing starts from</Label>
                <select
                  id="member-billing-starts"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={billingStartsAt}
                  onChange={(e) => setBillingStartsAt(e.target.value)}
                  disabled={loading}
                >
                  <option value="">From join date</option>
                  {periods.map((p) => (
                    <option key={p._id} value={p.periodStart}>
                      {p.periodLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-custom-amount">
                  Custom amount ({currency})
                </Label>
                <Input
                  id="member-custom-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </form>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Nickname</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Billing starts</TableHead>
              <TableHead>Custom amount</TableHead>
              {periods.length > 0 ? (
                <TableHead className="text-right">Payment summary</TableHead>
              ) : null}
              {isAdmin ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={periods.length > 0 ? (isAdmin ? 9 : 8) : (isAdmin ? 7 : 6)}
                  className="py-8 text-center text-muted-foreground"
                >
                  {isAdmin
                    ? "No members yet. Use the form above to add someone."
                    : "No members in this group."}
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                // only include periods that have started (not future)
                const now = new Date();
                const memberPayments = periods
                  .filter((p) => !p.periodStart || new Date(p.periodStart) <= now)
                  .flatMap((p) => {
                    const pay = p.payments.find((x) => x.memberId === member._id);
                    return pay ? [{ period: p, payment: pay }] : [];
                  });
                const paidCount = memberPayments.filter(
                  (x) =>
                    x.payment.status === "confirmed" ||
                    x.payment.status === "waived"
                ).length;
                const overdueCount = memberPayments.filter(
                  (x) => x.payment.status === "overdue"
                ).length;
                const isExpanded = expandedMemberId === member._id;

                return (
                  <React.Fragment key={member._id}>
                    <TableRow
                      key={member._id}
                      className={cn(
                        isExpanded && "border-b-0"
                      )}
                    >
                      <TableCell className="w-8">
                        {periods.length > 0 && memberPayments.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() =>
                              setExpandedMemberId((id) =>
                                id === member._id ? null : member._id
                              )
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">
                        {member.nickname}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        {member.hasAccount === false ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="font-normal">
                              Invite pending
                            </Badge>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleResendInvite(member._id)}
                                disabled={resendingMemberId === member._id}
                              >
                                {resendingMemberId === member._id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  "Resend invite"
                                )}
                              </Button>
                            )}
                          </div>
                        ) : member.acceptedAt ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            Accepted {formatDate(member.acceptedAt)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-normal">
                            Account linked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{member.role}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.billingStartsAt
                          ? (periods.find((p) => p.periodStart === member.billingStartsAt)
                              ?.periodLabel ?? formatDate(member.billingStartsAt))
                          : "From join"}
                      </TableCell>
                      <TableCell>
                        {member.customAmount
                          ? `${member.customAmount} ${currency}`
                          : "Auto split"}
                      </TableCell>
                      {periods.length > 0 ? (
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {memberPayments.length === 0 ? (
                            "—"
                          ) : (
                            <>
                              {paidCount}/{memberPayments.length} periods paid
                              {overdueCount > 0 && (
                                <span className="ml-1 text-destructive">
                                  · {overdueCount} overdue
                                </span>
                              )}
                            </>
                          )}
                        </TableCell>
                      ) : null}
                      {isAdmin ? (
                        <TableCell className="w-10">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEditMember(member)}
                              aria-label="Edit member"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setError(null);
                                setRemoveMember({
                                  _id: member._id,
                                  nickname: member.nickname,
                                  email: member.email,
                                });
                              }}
                              aria-label="Remove member"
                            >
                              <UserMinus className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                    {isExpanded && memberPayments.length > 0 && (
                      <TableRow key={`${member._id}-expanded`}>
                        <TableCell colSpan={periods.length > 0 ? (isAdmin ? 9 : 8) : (isAdmin ? 7 : 6)} className="bg-muted/20 p-0">
                          <div className="px-4 py-3">
                            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Payment history
                            </p>
                            <ul className="space-y-2">
                              {memberPayments.map(({ period, payment }) => (
                                <li
                                  key={period._id}
                                  className="flex flex-wrap items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                                >
                                  <span className="font-medium">
                                    {period.periodLabel}
                                  </span>
                                  <span className="font-mono tabular-nums text-muted-foreground">
                                    {payment.amount} {currency}
                                  </span>
                                  <PaymentStatusBadge status={payment.status} />
                                  <span className="text-xs text-muted-foreground">
                                    Member: {formatDate(payment.memberConfirmedAt)} · Admin:{" "}
                                    {formatDate(payment.adminConfirmedAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </>
  );
}
