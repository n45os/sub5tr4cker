"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteGroupButton({
  groupId,
  groupName,
  redirectTo = "/dashboard",
  className,
  size = "sm",
  buttonVariant = "destructive",
  label = "Delete group",
}: {
  groupId: string;
  groupName: string;
  redirectTo?: string;
  className?: string;
  size?: "default" | "sm" | "xs";
  buttonVariant?: "destructive" | "outline";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof json?.error?.message === "string"
            ? json.error.message
            : "Could not delete this group."
        );
        setDeleting(false);
        return;
      }
      setOpen(false);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={size}
        className={className}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 className="size-3.5" />
        {label}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setError(null);
            setDeleting(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this group?</DialogTitle>
            <DialogDescription>
              <span className="block">
                This will remove{" "}
                <span className="font-medium text-foreground">
                  {groupName.trim() || "this group"}
                </span>{" "}
                from your workspace. Billing history stays in the database for audit
                purposes, but the group will no longer appear in the app.
              </span>
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter showCloseButton={false} className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Delete permanently"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
