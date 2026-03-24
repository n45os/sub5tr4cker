"use client";

import Link from "next/link";
import { Bell, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ImportHistoryDialog } from "@/components/features/billing/import-history-dialog";
import { DeleteGroupButton } from "@/components/features/groups/delete-group-button";
import { InitializeNotifyButton } from "@/components/features/groups/initialize-notify-button";

export function GroupDetailAdminActions({
  groupId,
  groupName,
  memberCount,
  initializedAt,
  memberEmails,
  currency,
}: {
  groupId: string;
  groupName: string;
  memberCount: number;
  initializedAt: string | null;
  memberEmails: string[];
  currency: string;
}) {
  const alreadyInitialized = !!initializedAt;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/dashboard/groups/${groupId}/edit`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        <Pencil className="size-4" />
        Edit group
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
          aria-label="More group actions"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <InitializeNotifyButton
            groupId={groupId}
            memberCount={memberCount}
            initializedAt={initializedAt}
            renderTrigger={({ onClick }) => (
              <DropdownMenuItem
                onClick={() => {
                  onClick();
                }}
              >
                <Bell className="size-4" />
                {alreadyInitialized ? "Re-notify group" : "Initialize & notify"}
              </DropdownMenuItem>
            )}
          />
          <ImportHistoryDialog
            groupId={groupId}
            memberEmails={memberEmails}
            currency={currency}
            renderTrigger={({ onClick }) => (
              <DropdownMenuItem onClick={() => onClick()}>
                <Upload className="size-4" />
                Import history
              </DropdownMenuItem>
            )}
          />
          <DropdownMenuSeparator />
          <DeleteGroupButton
            groupId={groupId}
            groupName={groupName}
            label="Delete group"
            renderTrigger={({ onClick }) => (
              <DropdownMenuItem variant="destructive" onClick={() => onClick()}>
                <Trash2 className="size-4" />
                Delete group
              </DropdownMenuItem>
            )}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
