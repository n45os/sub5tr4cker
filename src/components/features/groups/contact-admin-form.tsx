"use client";

import { useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ContactAdminFormProps {
  groupId: string;
  memberToken?: string;
}

export function ContactAdminForm({ groupId, memberToken }: ContactAdminFormProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setStatus("idle");
    setErrorMsg(null);

    try {
      const body: Record<string, string> = { message };
      if (subject.trim()) body.subject = subject;
      if (memberToken) body.memberToken = memberToken;

      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        setErrorMsg(json.error?.message ?? "Failed to send message.");
        setStatus("error");
        return;
      }

      setStatus("sent");
      setSubject("");
      setMessage("");
    } catch {
      setErrorMsg("Something went wrong. Try again.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          Message admin
        </CardTitle>
        <CardDescription>
          Send a message to the group admin. They will receive it via their preferred notification channel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="contact-subject">Subject (optional)</Label>
            <Input
              id="contact-subject"
              placeholder="e.g. Payment question"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              required
            />
          </div>
          {status === "sent" && (
            <p className="text-sm text-green-600">Message sent to the admin.</p>
          )}
          {status === "error" && errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !message.trim()}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Send message
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
