import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { dbConnect } from "@/lib/db/mongoose";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileEmailForm } from "@/components/features/profile/profile-email-form";
import { ProfilePasswordForm } from "@/components/features/profile/profile-password-form";
import { TelegramLinkCard } from "@/components/features/profile/telegram-link-card";
import { NotificationPreferencesCard } from "@/components/features/profile/notification-preferences-card";
import { User } from "@/models";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await dbConnect();
  const user = await User.findById(session.user.id)
    .select("email telegram notificationPreferences hashedPassword")
    .lean();

  const hasPassword = Boolean(user?.hashedPassword);
  const email = user?.email ?? session.user.email ?? "";
  const telegram = user?.telegram;
  const notificationPreferences = user?.notificationPreferences;
  const isLinked = Boolean(telegram?.chatId);
  const telegramUsername = telegram?.username ?? null;
  const telegramLinkedAt = telegram?.linkedAt
    ? String(telegram.linkedAt)
    : null;
  const prefEmail = notificationPreferences?.email ?? true;
  const prefTelegram = notificationPreferences?.telegram ?? false;
  const prefReminderFrequency =
    notificationPreferences?.reminderFrequency ?? "every_3_days";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your account email. You will use the new address to sign in
            and receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileEmailForm currentEmail={email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {hasPassword
              ? "Change your password. You will use the new password to sign in with email."
              : "Set a password to sign in with your email address. You currently sign in with Google or a magic link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfilePasswordForm hasPassword={hasPassword} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
          <CardDescription>
            Link your Telegram account to receive confirmation nudges and
            optional reminders via Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TelegramLinkCard
            isLinked={isLinked}
            username={telegramUsername}
            linkedAt={telegramLinkedAt}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>
            Choose how you want to receive payment reminders and updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesCard
            email={prefEmail}
            telegram={prefTelegram}
            reminderFrequency={prefReminderFrequency}
            telegramLinked={isLinked}
          />
        </CardContent>
      </Card>
    </div>
  );
}
