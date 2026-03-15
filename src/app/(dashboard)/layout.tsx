import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getServerBaseUrl } from "@/lib/server-url";

async function getSidebarGroups(
  cookieHeader: string
): Promise<Array<{ _id: string; name: string }>> {
  const baseUrl = await getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/groups`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  const groups = json.data?.groups ?? [];
  return groups.map((g: { _id: string; name: string }) => ({
    _id: g._id,
    name: g.name,
  }));
}

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

  const cookieStore = await cookies();
  const groups = await getSidebarGroups(cookieStore.toString());

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      groups={groups}
    >
      {children}
    </AppShell>
  );
}
