"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Loader2, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InviteLinkState {
  inviteLinkEnabled: boolean;
  inviteCode: string | null;
  inviteUrl: string | null;
}

interface InviteLinkCardProps {
  groupId: string;
}

export function InviteLinkCard({ groupId }: InviteLinkCardProps) {
  const router = useRouter();
  const [state, setState] = useState<InviteLinkState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchState() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/invite-link`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to load invite link");
        setState(null);
        return;
      }
      setState(json.data);
    } catch {
      setError("Failed to load invite link");
      setState(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchState();
  }, [groupId]);

  async function handleGenerate() {
    setActionLoading("generate");
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/invite-link`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to create invite link");
        setActionLoading(null);
        return;
      }
      setState(json.data);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleEnabled(enabled: boolean) {
    setActionLoading("toggle");
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/invite-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to update");
        setActionLoading(null);
        return;
      }
      setState(json.data);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDestroy() {
    setActionLoading("destroy");
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/invite-link`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to revoke link");
        setActionLoading(null);
        return;
      }
      setState(json.data);
      setDestroyOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  function copyUrl() {
    if (!state?.inviteUrl) return;
    void navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            Invite link
          </CardTitle>
          <CardDescription>Share a link so others can join without you adding them.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasLink = !!state?.inviteCode;
  const enabled = state?.inviteLinkEnabled ?? false;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            Invite link
          </CardTitle>
          <CardDescription>
            Share a link so others can join without you adding them. You can lock or revoke it anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {!hasLink ? (
            <Button
              onClick={handleGenerate}
              disabled={!!actionLoading}
            >
              {actionLoading === "generate" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Generate invite link
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="flex-1 min-w-0 rounded bg-muted px-2 py-1.5 text-xs truncate">
                  {state.inviteUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyUrl}
                  disabled={!!actionLoading}
                >
                  {copied ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    Registration via link is {enabled ? "on" : "locked"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {enabled
                      ? "Anyone with the link can join."
                      : "Only you can add members until you turn it back on."}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => handleToggleEnabled(checked)}
                  disabled={!!actionLoading}
                  aria-label="Allow joining via invite link"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDestroyOpen(true)}
                  disabled={!!actionLoading}
                >
                  <Trash2 className="size-4" />
                  Revoke invite link
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={destroyOpen} onOpenChange={setDestroyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invite link?</DialogTitle>
            <DialogDescription>
              The current link will stop working. No one else can join via it. You can generate a new link later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setDestroyOpen(false)}
              disabled={!!actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDestroy}
              disabled={!!actionLoading}
            >
              {actionLoading === "destroy" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Revoke link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
