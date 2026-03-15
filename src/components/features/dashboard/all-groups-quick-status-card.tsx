import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AllGroupsQuickStatusCardProps {
  children: React.ReactNode;
}

export function AllGroupsQuickStatusCard({ children }: AllGroupsQuickStatusCardProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>All groups quick status</CardTitle>
        <CardDescription>
          Payment status across your groups and bulk notify unpaid members.
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
