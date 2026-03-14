"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "ST";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getHeaderMeta(pathname: string) {
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

  if (pathname.startsWith("/dashboard/notifications")) {
    return {
      title: "Notification templates",
      description: "Preview every email and Telegram touchpoint before it is sent.",
    };
  }

  if (pathname.startsWith("/dashboard/settings")) {
    return {
      title: "Workspace settings",
      description: "Manage runtime configuration without editing env files.",
    };
  }

  return {
    title: "Overview",
    description: "Keep subscriptions, reminders, and payment follow-ups in sync.",
  };
}

function getBreadcrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const breadcrumbs = [{ label: "Dashboard", href: "/dashboard" }];

  if (parts[1] === "groups") {
    breadcrumbs.push({ label: "Groups", href: "/dashboard" });
  }

  if (parts[1] === "notifications") {
    breadcrumbs.push({
      label: "Notifications",
      href: "/dashboard/notifications",
    });
  }

  if (parts[1] === "settings") {
    breadcrumbs.push({ label: "Settings", href: "/dashboard/settings" });
  }

  if (parts[2] === "new") {
    breadcrumbs.push({ label: "New group", href: pathname });
  } else if (parts[2]) {
    breadcrumbs.push({ label: "Group", href: `/dashboard/groups/${parts[2]}` });
  }

  if (parts[3] === "edit") {
    breadcrumbs.push({ label: "Edit", href: pathname });
  }

  return breadcrumbs;
}

interface AppHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname();
  const meta = getHeaderMeta(pathname);
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="flex flex-col gap-4 px-4 py-4 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Badge variant="outline" className="hidden sm:inline-flex">
              <Sparkles className="size-3" />
              Refined workspace
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/groups/new"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Create group
            </Link>
            <Button variant="outline" className="h-10 px-3">
              <Avatar className="size-7">
                <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                <AvatarFallback>
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline">
                {user.email || "Signed in"}
              </span>
            </Button>
          </div>
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
            <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
