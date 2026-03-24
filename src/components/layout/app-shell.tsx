import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  groups: Array<{ _id: string; name: string }>;
}

export function AppShell({ children, user, groups }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} groups={groups} />
      <SidebarInset className="min-h-svh min-w-0 overflow-x-hidden bg-muted/30">
        <AppHeader groups={groups} />
        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden px-4 py-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
