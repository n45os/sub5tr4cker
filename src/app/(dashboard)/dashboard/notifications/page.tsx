import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getNotificationTemplates } from "@/lib/email/templates";

export default function NotificationsPage() {
  const templates = getNotificationTemplates();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card className="border-border/70">
        <CardHeader>
          <Badge variant="outline" className="w-fit">
            Template center
          </Badge>
          <CardTitle className="text-3xl">Notification previews</CardTitle>
          <CardDescription className="max-w-2xl">
            Review every outbound message in one place. These previews use the same
            builders the jobs and routes use at runtime.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {templates.map((template) => (
          <Link
            key={template.type}
            href={`/dashboard/notifications/${template.type}`}
            className="block"
          >
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  {template.channels.map((channel) => (
                    <Badge key={channel} variant="secondary" className="capitalize">
                      {channel}
                    </Badge>
                  ))}
                </div>
                <CardTitle>{template.name}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Variables: {template.variables.join(", ")}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
