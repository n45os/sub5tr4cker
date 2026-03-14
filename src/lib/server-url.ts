import { headers } from "next/headers";

export async function getServerBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost:3054";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return `${protocol}://${host}`;
}
