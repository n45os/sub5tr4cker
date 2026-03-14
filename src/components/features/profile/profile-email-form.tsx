"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileEmailFormProps {
  currentEmail: string;
}

export function ProfileEmailForm({ currentEmail }: ProfileEmailFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(currentEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Email is required.");
      return;
    }
    if (trimmed === currentEmail.trim().toLowerCase()) {
      setError("Enter a new email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "Failed to update email.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-600 dark:text-green-500">
          Email updated. Your session now uses the new address.
        </p>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="profile-email">Email address</Label>
        <Input
          id="profile-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Update email"
        )}
      </Button>
    </form>
  );
}
