import { getAccentColor } from "@/lib/email/branding";

export const EMAIL_THEME_IDS = [
  "clean",
  "minimal",
  "bold",
  "rounded",
  "corporate",
] as const;

export type EmailTheme = (typeof EMAIL_THEME_IDS)[number];

export interface EmailThemeOption {
  id: EmailTheme;
  name: string;
  description: string;
}

export const EMAIL_THEME_OPTIONS: EmailThemeOption[] = [
  {
    id: "clean",
    name: "Clean",
    description: "Balanced cards with soft shadows and classic CTAs",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Calm layout with subtle accent line and low-contrast framing",
  },
  {
    id: "bold",
    name: "Bold",
    description: "High-emphasis heading and strong action buttons",
  },
  {
    id: "rounded",
    name: "Rounded",
    description: "Friendly corners and softer visual rhythm",
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "Sharper structure and formal hierarchy",
  },
];

export interface ResolvedEmailTheme {
  id: EmailTheme;
  accent: string;
  css: string;
}

function isEmailTheme(value: string | null | undefined): value is EmailTheme {
  if (!value) return false;
  return (EMAIL_THEME_IDS as readonly string[]).includes(value);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = hex.replace("#", "");
  return {
    r: Number.parseInt(n.slice(0, 2), 16),
    g: Number.parseInt(n.slice(2, 4), 16),
    b: Number.parseInt(n.slice(4, 6), 16),
  };
}

function alpha(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function getThemeCss(theme: EmailTheme, accent: string): string {
  const accentSoft = alpha(accent, 0.12);
  const accentStrong = alpha(accent, 0.2);
  const accentBorder = alpha(accent, 0.35);

  if (theme === "minimal") {
    return `
      .container { border-radius: 6px; border: 1px solid #e2e8f0; box-shadow: none; }
      .header { background: #ffffff; color: #0f172a; border-top: 4px solid ${accent}; border-bottom: 1px solid #e2e8f0; }
      .header h1 { letter-spacing: -0.01em; }
      .body { padding: 28px; }
      .btn { border-radius: 6px; background: #0f172a; }
      .btn-secondary { background: #475569; }
      .section-card, .amount-card, .summary-card { border-radius: 6px; }
    `;
  }

  if (theme === "bold") {
    return `
      .container { border-radius: 14px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16); }
      .header { background: linear-gradient(135deg, ${accent}, #0f172a); color: #ffffff; padding: 32px 24px; }
      .header h1 { font-size: 24px; letter-spacing: -0.02em; }
      .body { padding: 28px; }
      .btn { border-radius: 10px; padding: 13px 30px; box-shadow: 0 8px 20px ${accentStrong}; }
      .amount-card { border: 1px solid ${accentBorder}; background: ${accentSoft}; }
      .section-card { border-left: 4px solid ${accent}; }
    `;
  }

  if (theme === "rounded") {
    return `
      .container { border-radius: 20px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12); }
      .header { background: ${accent}; color: #ffffff; border-bottom-left-radius: 18px; border-bottom-right-radius: 18px; }
      .body { padding: 28px; }
      .btn { border-radius: 9999px; padding: 12px 28px; }
      .btn-secondary { border-radius: 9999px; }
      .section-card, .amount-card, .summary-card { border-radius: 14px; }
    `;
  }

  if (theme === "corporate") {
    return `
      .container { border-radius: 4px; border: 1px solid #dbe3ee; box-shadow: 0 6px 16px rgba(15, 23, 42, 0.09); }
      .header { background: #0f172a; color: #ffffff; border-bottom: 4px solid ${accent}; }
      .header h1 { font-size: 20px; letter-spacing: 0; text-transform: uppercase; }
      .body { padding: 24px; }
      .btn { border-radius: 4px; padding: 11px 24px; }
      .section-card, .amount-card, .summary-card { border-radius: 4px; border-color: #cbd5e1; }
      .kicker { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
    `;
  }

  return `
    .container { border-radius: 10px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1); }
    .header { background: ${accent}; color: #ffffff; }
    .header h1 { letter-spacing: -0.01em; }
    .btn { border-radius: 8px; }
    .amount-card { border: 1px solid ${accentBorder}; background: ${accentSoft}; }
  `;
}

export function resolveEmailTheme(
  theme: string | null | undefined,
  accentColor: string | null | undefined
): ResolvedEmailTheme {
  const id = isEmailTheme(theme) ? theme : "clean";
  const accent = getAccentColor(accentColor);
  return {
    id,
    accent,
    css: getThemeCss(id, accent),
  };
}
