"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bell,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    isActive: (pathname: string) => pathname === "/dashboard",
  },
  {
    title: "Groups",
    href: "/dashboard/groups/new",
    icon: Users,
    isActive: (pathname: string) => pathname.startsWith("/dashboard/groups"),
  },
  {
    title: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    isActive: (pathname: string) =>
      pathname.startsWith("/dashboard/notifications"),
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    isActive: (pathname: string) => pathname.startsWith("/dashboard/settings"),
  },
];

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "ST";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

interface AppSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" />}
              tooltip="SubsTrack"
            >
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <CreditCard className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="font-display truncate font-semibold">SubsTrack</span>
                <span className="truncate text-xs text-muted-foreground">
                  Subscription ops
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={item.isActive(pathname)}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/dashboard/groups/new" />}
                  tooltip="New group"
                >
                  <Plus />
                  <span>New group</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-3 text-sidebar-foreground">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
              <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">
                {user.name || "SubsTrack user"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email || "No email"}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="mt-3 w-full justify-start group-data-[collapsible=icon]:hidden"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
