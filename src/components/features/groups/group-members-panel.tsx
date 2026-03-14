"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2, UserPlus } from "lucide-react";
import { PaymentStatusBadge } from "@/components/features/billing/payment-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
}

export interface PeriodPaymentRow {
  _id: string;
  periodLabel: string;
  totalPrice: number;
  payments: Array<{
    memberId: string;
    memberNickname: string;
    amount: number;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

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
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          nickname: trimmedNickname,
          customAmount: amount,
        }),
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
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
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
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
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
              <TableHead>Role</TableHead>
              <TableHead>Custom amount</TableHead>
              {periods.length > 0 ? (
                <TableHead className="text-right">Payment summary</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={periods.length > 0 ? 6 : 4}
                  className="py-8 text-center text-muted-foreground"
                >
                  {isAdmin
                    ? "No members yet. Use the form above to add someone."
                    : "No members in this group."}
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const memberPayments = periods.flatMap((p) => {
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
                      <TableCell className="capitalize">{member.role}</TableCell>
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
                    </TableRow>
                    {isExpanded && memberPayments.length > 0 && (
                      <TableRow key={`${member._id}-expanded`}>
                        <TableCell colSpan={periods.length > 0 ? 6 : 4} className="bg-muted/20 p-0">
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
  );
}
