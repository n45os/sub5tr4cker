export function normalizeAppUrl(appUrl: string | null | undefined): string | null {
  const value = appUrl?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return a === 0;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized === "::1" || normalized === "[::1]") {
    return true;
  }
  if (normalized.endsWith(".local")) {
    return true;
  }
  return isPrivateIpv4(normalized);
}

export function isPublicAppUrl(appUrl: string | null | undefined): boolean {
  const normalized = normalizeAppUrl(appUrl);
  if (!normalized) return false;

  try {
    const url = new URL(normalized);
    return !isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

export function getInviteLinkAvailability(
  appUrl: string | null | undefined
): {
  available: boolean;
  normalizedAppUrl: string | null;
  reason: string | null;
} {
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  if (!normalizedAppUrl) {
    return {
      available: false,
      normalizedAppUrl: null,
      reason: "Set a public App URL before using web invite links.",
    };
  }

  if (!isPublicAppUrl(normalizedAppUrl)) {
    return {
      available: false,
      normalizedAppUrl,
      reason: "Web invite links are unavailable for local or private app URLs. Use a Telegram invite link instead.",
    };
  }

  return {
    available: true,
    normalizedAppUrl,
    reason: null,
  };
}
