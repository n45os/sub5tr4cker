"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
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

export interface MemberRow {
  _id: string;
  email: string;
  nickname: string;
  role: string;
  customAmount: number | null;
}

interface GroupMembersPanelProps {
  groupId: string;
  members: MemberRow[];
  currency: string;
  isAdmin: boolean;
}

export function GroupMembersPanel({
  groupId,
  members,
  currency,
  isAdmin,
}: GroupMembersPanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              <TableHead>Nickname</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Custom amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  {isAdmin
                    ? "No members yet. Use the form above to add someone."
                    : "No members in this group."}
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member._id}>
                  <TableCell className="font-medium">{member.nickname}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell className="capitalize">{member.role}</TableCell>
                  <TableCell>
                    {member.customAmount
                      ? `${member.customAmount} ${currency}`
                      : "Auto split"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
