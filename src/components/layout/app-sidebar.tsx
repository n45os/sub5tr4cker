"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

const ADMIN_TOOLS = [
  { title: "Notifications hub", href: "/dashboard/notifications", icon: Bell },
  {
    title: "Scheduled sends",
    href: "/dashboard/scheduled-tasks",
    icon: CalendarClock,
  },
  { title: "Payments", href: "/dashboard/payments", icon: Wallet },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

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
  groups: Array<{ _id: string; name: string }>;
}

export function AppSidebar({ user, groups }: AppSidebarProps) {
  const pathname = usePathname();
  const adminToolsActive = ADMIN_TOOLS.some((item) =>
    isActive(pathname, item.href)
  );
  const [adminToolsOpen, setAdminToolsOpen] = useState(adminToolsActive);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" />}
              tooltip="sub5tr4cker"
            >
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <CreditCard className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="font-logo truncate font-semibold">sub5tr4cker</span>
                <span className="font-mono truncate text-xs text-muted-foreground">
                  Subscription ops
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>My groups</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groups.map((group) => (
                <SidebarMenuItem key={group._id}>
                  <SidebarMenuButton
                    render={<Link href={`/dashboard/groups/${group._id}`} />}
                    isActive={pathname === `/dashboard/groups/${group._id}`}
                    tooltip={group.name}
                  >
                    <Users className="size-4 shrink-0" />
                    <span className="truncate">{group.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/dashboard/activity" />}
                  isActive={isActive(pathname, "/dashboard/activity")}
                  tooltip="Activity"
                >
                  <Activity />
                  <span>Activity</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/dashboard/settings" />}
              isActive={isActive(pathname, "/dashboard/settings")}
              tooltip="Settings"
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Collapsible open={adminToolsOpen} onOpenChange={setAdminToolsOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton tooltip="Admin tools">
                    <ShieldCheck />
                    <span>Admin tools</span>
                    <ChevronDown
                      className={`ml-auto size-4 transition-transform ${adminToolsOpen ? "rotate-180" : ""}`}
                    />
                  </SidebarMenuButton>
                }
              />
              <CollapsibleContent>
                <SidebarMenuSub>
                  {ADMIN_TOOLS.map((item) => (
                    <SidebarMenuSubItem key={item.href}>
                      <SidebarMenuSubButton
                        render={<Link href={item.href} />}
                        isActive={isActive(pathname, item.href)}
                      >
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="w-full rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-3 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                    <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium">
                      {user.name || "sub5tr4cker user"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email || "No email"}
                    </p>
                  </div>
                  <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{user.name || user.email || "Account"}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link href="/dashboard/profile" />}>
                    <User className="size-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
                    <Settings className="size-4" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="cursor-default focus:bg-accent focus:text-accent-foreground"
                >
                  <ThemeToggle />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={<a href="/api/auth/n450s/logout?post_logout_redirect_uri=/" />}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
