import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileEmailForm } from "@/components/features/profile/profile-email-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

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
          <ProfileEmailForm currentEmail={session.user.email ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
