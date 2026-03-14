"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteJoinFormProps {
  inviteCode: string;
  groupName: string;
}

export function InviteJoinForm({ inviteCode, groupName }: InviteJoinFormProps) {
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          email: email.trim(),
          nickname: nickname.trim(),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        const message =
          json.error?.code === "ALREADY_MEMBER"
            ? "You’re already a member of this group."
            : json.error?.code === "INVITE_DISABLED"
              ? "Registration via this link is currently disabled."
              : json.error?.message ?? "Something went wrong. Try again.";
        setError(message);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
        <p className="font-medium">You’ve joined {groupName}.</p>
        <p className="mt-1 text-muted-foreground">
          The group admin will see you in the members list. You may receive payment reminders by email when billing periods are active.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-nickname">Display name</Label>
        <Input
          id="invite-nickname"
          type="text"
          placeholder="How others see you in the group"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          minLength={1}
          maxLength={100}
          disabled={loading}
          autoComplete="nickname"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {loading ? "Joining…" : "Join group"}
      </Button>
    </form>
  );
}
