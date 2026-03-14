import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    const headerStore = await headers();
    const pathname = headerStore.get("x-pathname") ?? "/dashboard";
    const callbackUrl =
      pathname && pathname !== "/login"
        ? `/login?callbackUrl=${encodeURIComponent(pathname)}`
        : "/login";
    redirect(callbackUrl);
  }

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    >
      {children}
    </AppShell>
  );
}
