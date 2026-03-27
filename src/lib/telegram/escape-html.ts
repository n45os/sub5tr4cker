/** escape free text for Telegram HTML parse mode (see core.telegram.org/bots/api#html-style) */
export function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
