import { notFound } from "next/navigation";
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
  type NotificationTemplateType,
} from "@/lib/email/templates";
import { TemplateTestActions } from "@/components/features/notifications/template-test-actions";

export default async function NotificationTemplatePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const template = getNotificationTemplatePreview(type as NotificationTemplateType);

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
                <CardDescription>{template.subject}</CardDescription>
              </CardHeader>
              <CardContent>
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
                <TemplateTestActions channels={template.channels} />
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
