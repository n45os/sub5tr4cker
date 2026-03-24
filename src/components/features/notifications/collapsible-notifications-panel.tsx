"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GroupNotificationsPanel } from "./group-notifications-panel";

interface CollapsibleNotificationsPanelProps {
  groupId: string;
  isAdmin: boolean;
  initialPreferences: {
    remindersEnabled: boolean;
    followUpsEnabled: boolean;
    priceChangeEnabled: boolean;
    saveEmailParams: boolean;
  };
  recentNotifications: Array<{
    _id: string;
    type: string;
    channel: string;
    status: string;
    subject: string | null;
    preview: string;
    recipientEmail: string;
    createdAt: string;
  }>;
}

export function CollapsibleNotificationsPanel(
  props: CollapsibleNotificationsPanelProps,
) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Notifications & delivery log</h3>
          <p className="text-sm text-muted-foreground">
            Notification preferences and recent delivery history.
          </p>
        </div>
        <CollapsibleTrigger
          render={
            <Button variant="ghost" size="sm">
              <ChevronDown
                className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
              />
              {open ? "Collapse" : "Expand"}
            </Button>
          }
        />
      </div>
      <CollapsibleContent className="mt-4">
        <GroupNotificationsPanel {...props} />
      </CollapsibleContent>
    </Collapsible>
  );
}
