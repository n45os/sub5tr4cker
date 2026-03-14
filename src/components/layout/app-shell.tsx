import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: "admin" | "user";
  };
  groups: Array<{ _id: string; name: string }>;
}

export function AppShell({ children, user, groups }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} groups={groups} />
      <SidebarInset className="min-h-svh bg-muted/30">
        <AppHeader user={user} />
        <main className="flex flex-1 flex-col px-4 py-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
