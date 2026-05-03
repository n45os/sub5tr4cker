import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface RegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickFirst(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const authServiceUrl = process.env.AUTH_SERVICE_URL?.replace(/\/+$/, "");
  if (!authServiceUrl) {
    redirect("/login");
  }

  const inviteCode =
    pickFirst(params.invite) ?? pickFirst(params.invite_code);
  const continueUrl =
    pickFirst(params.continue) ?? pickFirst(params.callbackUrl);

  const target = new URL(`${authServiceUrl}/signup`);
  if (inviteCode) target.searchParams.set("invite_code", inviteCode);
  if (continueUrl) target.searchParams.set("continue", continueUrl);

  redirect(target.toString());
}
