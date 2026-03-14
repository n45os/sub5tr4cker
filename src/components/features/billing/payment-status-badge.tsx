"use client";

import {
  AlertTriangle,
  Check,
  HourglassIcon,
  Minus,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentStatus =
  | "pending"
  | "member_confirmed"
  | "confirmed"
  | "overdue"
  | "waived";

const statusConfig: Record<
  PaymentStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  confirmed: {
    label: "Confirmed",
    icon: Check,
    className:
      "bg-status-confirmed/15 text-status-confirmed border-status-confirmed/30 dark:bg-status-confirmed/20 dark:border-status-confirmed/40",
  },
  member_confirmed: {
    label: "Member confirmed",
    icon: UserCheck,
    className:
      "bg-status-member-confirmed/15 text-status-member-confirmed border-status-member-confirmed/30 dark:bg-status-member-confirmed/20 dark:border-status-member-confirmed/40",
  },
  pending: {
    label: "Pending",
    icon: HourglassIcon,
    className:
      "bg-status-pending/15 text-status-pending border-status-pending/30 dark:bg-status-pending/20 dark:border-status-pending/40",
  },
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    className:
      "bg-status-overdue/15 text-status-overdue border-status-overdue/30 dark:bg-status-overdue/20 dark:border-status-overdue/40",
  },
  waived: {
    label: "Waived",
    icon: Minus,
    className:
      "bg-status-waived/10 text-muted-foreground border-border dark:bg-status-waived/15",
  },
};

interface PaymentStatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
}

export function PaymentStatusBadge({
  status,
  className,
  showIcon = true,
}: PaymentStatusBadgeProps) {
  const normalized = status.replace(/-/g, "_") as PaymentStatus;
  const config = statusConfig[normalized] ?? {
    label: status.replace(/_/g, " "),
    icon: HourglassIcon,
    className:
      "bg-muted text-muted-foreground border-border",
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="size-3 shrink-0" />}
      {config.label}
    </span>
  );
}
