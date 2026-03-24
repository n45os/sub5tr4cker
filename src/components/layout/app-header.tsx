"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function getHeaderMeta(pathname: string) {
  if (pathname === "/dashboard/groups") {
    return {
      title: "Your groups",
      description:
        "Review pricing, due dates, and unpaid balances at a glance.",
    };
  }

  if (pathname.startsWith("/dashboard/groups/new")) {
    return {
      title: "Create a new group",
      description: "Set up billing, pricing, and payment details in one place.",
    };
  }

  if (pathname.startsWith("/dashboard/groups/") && pathname.endsWith("/edit")) {
    return {
      title: "Edit group",
      description: "Adjust billing rules, service details, and payment instructions.",
    };
  }

  if (pathname.startsWith("/dashboard/groups/")) {
    return {
      title: "Group dashboard",
      description: "Track members, billing progress, and outgoing notifications.",
    };
  }

  if (pathname.startsWith("/dashboard/activity")) {
    return {
      title: "Activity log",
      description:
        "Sent notifications and scheduled reminder and follow-up runs.",
    };
  }

  if (pathname.startsWith("/dashboard/payments")) {
    return {
      title: "Payments",
      description: "Payment history and status across all your groups.",
    };
  }

  if (pathname.startsWith("/dashboard/notifications")) {
    return {
      title: "Notification templates",
      description: "Preview every email and Telegram touchpoint before it is sent.",
    };
  }

  if (pathname.startsWith("/dashboard/profile")) {
    return {
      title: "Profile",
      description: "Manage your account, notification preferences, and Telegram link.",
    };
  }

  if (pathname.startsWith("/dashboard/settings")) {
    return {
      title: "Workspace settings",
      description: "Manage runtime configuration without editing env files.",
    };
  }

  if (pathname.startsWith("/dashboard/scheduled-tasks")) {
    return {
      title: "Scheduled tasks",
      description: "Queued notification delivery — cancel, retry, or bulk cancel.",
    };
  }

  return {
    title: "Overview",
    description: "Keep subscriptions, reminders, and payment follow-ups in sync.",
  };
}

function getBreadcrumbs(
  pathname: string,
  groups: Array<{ _id: string; name: string }>
) {
  const parts = pathname.split("/").filter(Boolean);
  const breadcrumbs = [{ label: "Dashboard", href: "/dashboard" }];

  if (parts[1] === "groups") {
    breadcrumbs.push({ label: "Groups", href: "/dashboard/groups" });
  }

  if (parts[1] === "activity") {
    breadcrumbs.push({ label: "Activity", href: "/dashboard/activity" });
  }

  if (parts[1] === "payments") {
    breadcrumbs.push({ label: "Payments", href: "/dashboard/payments" });
  }

  if (parts[1] === "scheduled-tasks") {
    breadcrumbs.push({
      label: "Scheduled tasks",
      href: "/dashboard/scheduled-tasks",
    });
  }

  if (parts[1] === "notifications") {
    breadcrumbs.push({
      label: "Notifications",
      href: "/dashboard/notifications",
    });
  }

  if (parts[1] === "profile") {
    breadcrumbs.push({ label: "Profile", href: "/dashboard/profile" });
  }

  if (parts[1] === "settings") {
    breadcrumbs.push({ label: "Settings", href: "/dashboard/settings" });
  }

  if (parts[2] === "new") {
    breadcrumbs.push({ label: "New group", href: pathname });
  } else if (parts[1] === "groups" && parts[2]) {
    const g = groups.find((x) => x._id === parts[2]);
    const groupLabel = g?.name?.trim() ? g.name : "Group";
    breadcrumbs.push({
      label: groupLabel,
      href: `/dashboard/groups/${parts[2]}`,
    });
  }

  if (parts[3] === "edit") {
    breadcrumbs.push({ label: "Edit", href: pathname });
  }

  if (parts[3] === "billing") {
    breadcrumbs.push({ label: "Billing", href: pathname });
  }

  return breadcrumbs;
}

interface AppHeaderProps {
  groups: Array<{ _id: string; name: string }>;
}

export function AppHeader({ groups }: AppHeaderProps) {
  const pathname = usePathname();
  const meta = getHeaderMeta(pathname);
  const breadcrumbs = getBreadcrumbs(pathname, groups);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="flex flex-col gap-4 px-4 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {breadcrumbs.map((item, index) => (
              <div key={`${item.href}-${item.label}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3" /> : null}
                <Link
                  href={item.href}
                  className={cn(
                    "transition-colors hover:text-foreground",
                    index === breadcrumbs.length - 1 && "text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              </div>
            ))}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{meta.title}</h1>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
