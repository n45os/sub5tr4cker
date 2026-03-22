import { buildAutomatedMessageBadgeHtml } from "@/lib/email/branding";
import { buildEmailFooterHtml } from "@/lib/email/footer";
import { resolveEmailTheme } from "@/lib/email/themes";

export interface BuildEmailShellParams {
  title: string;
  bodyHtml: string;
  accentColor?: string | null;
  theme?: string | null;
  unsubscribeUrl?: string | null;
}

export function buildEmailShell(params: BuildEmailShellParams): string {
  const resolved = resolveEmailTheme(params.theme, params.accentColor);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #f1f5f9;
          padding: 20px;
          color: #0f172a;
        }
        p { margin: 0 0 14px; line-height: 1.55; }
        a { color: ${resolved.accent}; }
        .container {
          max-width: 640px;
          margin: 0 auto;
          background: #ffffff;
          overflow: hidden;
        }
        .header {
          padding: 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
          line-height: 1.25;
        }
        .body {
          padding: 24px;
        }
        .kicker {
          margin: 0 0 8px;
          color: #64748b;
          font-size: 12px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          font-weight: 600;
        }
        .amount-card,
        .summary-card,
        .section-card {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 10px;
          padding: 14px 16px;
          margin: 14px 0;
        }
        .amount-card .amount {
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 2px 0;
          color: #0f172a;
        }
        .muted {
          color: #64748b;
          font-size: 13px;
        }
        .note-box {
          background: #fffbeb;
          border-left: 4px solid #f59e0b;
          padding: 12px 14px;
          border-radius: 6px;
          margin: 14px 0;
          font-size: 13px;
          color: #78350f;
        }
        .cta { text-align: center; margin: 18px 0; }
        .btn {
          display: inline-block;
          background: ${resolved.accent};
          color: #ffffff !important;
          text-decoration: none;
          font-weight: 600;
          padding: 12px 26px;
        }
        .btn-secondary {
          background: #475569;
        }
        .btn-confirm {
          background: #16a34a;
        }
        .rows { margin-top: 10px; }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px dashed #dbe1ea;
          font-size: 14px;
        }
        .row:last-child { border-bottom: 0; }
        .row .label { color: #64748b; }
        .row .value { color: #0f172a; font-weight: 500; text-align: right; }
        .footer {
          padding: 16px 24px;
          background: #f8fafc;
          color: #94a3b8;
          font-size: 12px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        ${resolved.css}
      </style>
    </head>
    <body>
      <div class="container">
        ${buildAutomatedMessageBadgeHtml()}
        <div class="header">
          <h1>${params.title}</h1>
        </div>
        <div class="body">
          ${params.bodyHtml}
        </div>
        <div class="footer">
          ${buildEmailFooterHtml({ unsubscribeUrl: params.unsubscribeUrl ?? null })}
        </div>
      </div>
    </body>
    </html>
  `;
}
