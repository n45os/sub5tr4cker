"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfilePasswordFormProps {
  hasPassword: boolean;
}

export function ProfilePasswordForm({ hasPassword }: ProfilePasswordFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (hasPassword && !currentPassword.trim()) {
      setError("Current password is required.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError("New password must be 8–128 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      const body: { newPassword: string; currentPassword?: string } = {
        newPassword,
      };
      if (hasPassword) {
        body.currentPassword = currentPassword;
      }
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "Failed to update password.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
          Password updated.
        </p>
      ) : null}
      {hasPassword ? (
        <div className="grid gap-2">
          <Label htmlFor="profile-current-password">Current password</Label>
          <Input
            id="profile-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
          />
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="profile-new-password">
          {hasPassword ? "New password" : "Password"}
        </Label>
        <Input
          id="profile-new-password"
          type="password"
          autoComplete={hasPassword ? "new-password" : "new-password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-confirm-password">Confirm password</Label>
        <Input
          id="profile-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : hasPassword ? (
          "Change password"
        ) : (
          "Set password"
        )}
      </Button>
    </form>
  );
}
