import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getNotificationTemplatePreview,
} from "@/lib/plugins/templates";
import { TemplateTestActions } from "@/components/features/notifications/template-test-actions";
import { EMAIL_THEME_OPTIONS } from "@/lib/email/themes";
import { getSetting } from "@/lib/settings/service";

export default async function NotificationTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const { type } = await params;
  const { theme } = await searchParams;
  const [emailEnabledSetting, telegramEnabledSetting] = await Promise.all([
    getSetting("email.enabled"),
    getSetting("telegram.enabled"),
  ]);
  const selectedTheme = theme ?? "clean";
  const template = getNotificationTemplatePreview(type, { theme: selectedTheme });
  const emailEnabled = emailEnabledSetting !== "false";
  const telegramEnabled = telegramEnabledSetting !== "false";

  if (!template) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {template.channels.map((channel) => (
              <Badge key={channel} variant="secondary" className="capitalize">
                {channel}
              </Badge>
            ))}
          </div>
          <CardTitle className="text-3xl">{template.name}</CardTitle>
          <CardDescription className="max-w-2xl">
            {template.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Email preview</CardTitle>
                <CardDescription>
                  {template.subject}
                  {!emailEnabled ? " Email is currently disabled for this workspace." : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap gap-2">
                  {EMAIL_THEME_OPTIONS.map((themeOption) => {
                    const isActive = selectedTheme === themeOption.id;
                    return (
                      <Link
                        key={themeOption.id}
                        href={`/dashboard/notifications/${template.type}?theme=${themeOption.id}`}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {themeOption.name}
                      </Link>
                    );
                  })}
                </div>
                <iframe
                  title={`${template.name} email preview`}
                  srcDoc={template.emailHtml}
                  className="min-h-[540px] w-full rounded-xl border bg-white"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Telegram preview</CardTitle>
                <CardDescription>
                  Telegram content shown with the same body used during delivery.
                  {!telegramEnabled ? " Telegram is currently disabled for this workspace." : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-lg rounded-[28px] bg-[#17212b] p-4 text-sm text-white shadow-xl">
                  <div className="rounded-[22px] bg-[#22303c] px-4 py-3 whitespace-pre-wrap">
                    {template.telegramText
                      .replaceAll("<b>", "")
                      .replaceAll("</b>", "")
                      .replaceAll("<s>", "")
                      .replaceAll("</s>", "")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Variables</CardTitle>
                <CardDescription>
                  Dynamic fields this template expects at runtime.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {template.variables.map((variable) => (
                  <Badge key={variable} variant="outline">
                    {variable}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Send a test</CardTitle>
                <CardDescription>
                  Use the current workspace settings to verify each delivery channel.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TemplateTestActions
                  channels={template.channels}
                  channelEnabled={{
                    email: emailEnabled,
                    telegram: telegramEnabled,
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
