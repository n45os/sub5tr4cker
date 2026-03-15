"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface NoPeriodsCardProps {
  groupId: string;
  cycleDay: number;
  isAdmin?: boolean;
}

export function NoPeriodsCard({ groupId, cycleDay, isAdmin = true }: NoPeriodsCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createFirstPeriod = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/billing/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthsAhead: 1 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to create period");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>No billing periods yet</CardTitle>
        <CardDescription>
          {isAdmin
            ? `A daily cron job creates periods automatically once each cycle has started (on or after day ${cycleDay}). If you're before that day or the job hasn't run yet, create the first period manually below.`
            : "The admin hasn't created any billing periods for this group yet. Check back later."}
        </CardDescription>
      </CardHeader>
      {isAdmin && (
        <CardContent>
          <Button
            onClick={createFirstPeriod}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            <Plus className="mr-2 size-4" />
            Create first period
          </Button>
          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
