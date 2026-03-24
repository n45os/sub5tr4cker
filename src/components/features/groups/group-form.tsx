"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Loader2, Sparkles } from "lucide-react";
import { DeleteGroupButton } from "@/components/features/groups/delete-group-button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_THEME_OPTIONS, type EmailTheme } from "@/lib/email/themes";
import { buildPaymentReminderEmailHtml } from "@/lib/email/templates/payment-reminder";

type BillingMode = "equal_split" | "fixed_amount" | "variable";
type CycleType = "monthly" | "yearly";
type PaymentPlatform =
  | "revolut"
  | "paypal"
  | "bank_transfer"
  | "stripe"
  | "custom";

export interface GroupFormValues {
  name: string;
  description: string;
  serviceName: string;
  serviceIcon: string;
  serviceUrl: string;
  serviceAccentColor: string;
  serviceEmailTheme: EmailTheme;
  billingMode: BillingMode;
  currentPrice: string;
  currency: string;
  cycleDay: string;
  cycleType: CycleType;
  adminIncludedInSplit: boolean;
  paymentInAdvanceDays: string;
  gracePeriodDays: string;
  fixedMemberAmount: string;
  paymentPlatform: PaymentPlatform;
  paymentLink: string;
  paymentInstructions: string;
}

interface GroupFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<GroupFormValues>;
  groupId?: string;
}

const defaultValues: GroupFormValues = {
  name: "",
  description: "",
  serviceName: "",
  serviceIcon: "",
  serviceUrl: "",
  serviceAccentColor: "",
  serviceEmailTheme: "clean",
  billingMode: "equal_split",
  currentPrice: "",
  currency: "EUR",
  cycleDay: "1",
  cycleType: "monthly",
  adminIncludedInSplit: true,
  paymentInAdvanceDays: "0",
  gracePeriodDays: "3",
  fixedMemberAmount: "",
  paymentPlatform: "revolut",
  paymentLink: "",
  paymentInstructions: "",
};

function mergeValues(initialValues?: Partial<GroupFormValues>): GroupFormValues {
  return {
    ...defaultValues,
    ...initialValues,
  };
}

// label with optional (i) tooltip for fields that need a short explanation
function FieldLabel({
  htmlFor,
  hint,
  children,
}: {
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      {hint ? (
        <Tooltip>
          <TooltipTrigger
            className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            aria-label="Explanation"
          >
            <Info className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px]">
            {hint}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

export function GroupForm({
  mode,
  initialValues,
  groupId,
}: GroupFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<GroupFormValues>(() => mergeValues(initialValues));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageCopy = useMemo(
    () =>
      mode === "create"
        ? {
            title: "New subscription group",
            description:
              "Create a cleaner subscription workspace with billing rules, reminders, and payment instructions ready from day one.",
            submitLabel: "Create group",
          }
        : {
            title: "Edit subscription group",
            description:
              "Update the group details, billing behavior, and payment instructions without leaving the dashboard.",
            submitLabel: "Save changes",
          },
    [mode]
  );
  const normalizedAccentColor = /^#[0-9A-Fa-f]{6}$/.test(form.serviceAccentColor)
    ? form.serviceAccentColor
    : "#3b82f6";
  const templatePreviewHtml = useMemo(
    () =>
      buildPaymentReminderEmailHtml({
        memberName: "Alex",
        groupName: form.name.trim() || "Family subscription",
        periodLabel: "Apr 2026",
        amount: Number.parseFloat(form.currentPrice || "0") > 0
          ? Number.parseFloat(form.currentPrice)
          : 5.99,
        currency: form.currency.trim().toUpperCase() || "EUR",
        paymentPlatform: form.paymentPlatform,
        paymentLink: form.paymentLink.trim() || "https://example.com/pay",
        paymentInstructions:
          form.paymentInstructions.trim() || "Include your nickname in the transfer note.",
        confirmUrl: "https://example.com/member/demo-token?pay=periodId&open=confirm",
        ownerName: "Group admin",
        extraText:
          "This is a preview. Members will see the real period amount and payment details.",
        adjustmentReason: null,
        priceNote: null,
        accentColor: normalizedAccentColor,
        theme: form.serviceEmailTheme,
      }),
    [
      form.currency,
      form.currentPrice,
      form.name,
      form.paymentInstructions,
      form.paymentLink,
      form.paymentPlatform,
      form.serviceEmailTheme,
      normalizedAccentColor,
    ]
  );

  function updateField<K extends keyof GroupFormValues>(
    key: K,
    value: GroupFormValues[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateForm() {
    const currentPrice = Number(form.currentPrice);
    const cycleDay = Number(form.cycleDay);
    const gracePeriodDays = Number(form.gracePeriodDays);
    const paymentInAdvanceDays = Number(form.paymentInAdvanceDays);

    if (!form.name.trim() || !form.serviceName.trim()) {
      return "Group name and service name are required.";
    }

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return "Enter a valid price greater than zero.";
    }

    if (!Number.isInteger(cycleDay) || cycleDay < 1 || cycleDay > 28) {
      return "Cycle day must be a whole number between 1 and 28.";
    }

    if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0 || gracePeriodDays > 31) {
      return "Grace period must be a whole number between 0 and 31.";
    }

    if (
      !Number.isInteger(paymentInAdvanceDays) ||
      paymentInAdvanceDays < 0 ||
      paymentInAdvanceDays > 365
    ) {
      return "Payment in advance must be a whole number between 0 and 365.";
    }

    if (form.billingMode === "fixed_amount") {
      const fixedMemberAmount = Number(form.fixedMemberAmount);
      if (!Number.isFinite(fixedMemberAmount) || fixedMemberAmount <= 0) {
        return "Fixed member amount must be greater than zero.";
      }
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      service: {
        name: form.serviceName.trim(),
        icon: form.serviceIcon.trim() || null,
        url: form.serviceUrl.trim() || null,
        accentColor: /^#[0-9A-Fa-f]{6}$/.test(form.serviceAccentColor.trim())
          ? form.serviceAccentColor.trim()
          : null,
        emailTheme: form.serviceEmailTheme,
      },
      billing: {
        mode: form.billingMode,
        currentPrice: Number(form.currentPrice),
        currency: form.currency.trim().toUpperCase(),
        cycleDay: Number(form.cycleDay),
        cycleType: form.cycleType,
        adminIncludedInSplit: form.adminIncludedInSplit,
        paymentInAdvanceDays: Number(form.paymentInAdvanceDays),
        gracePeriodDays: Number(form.gracePeriodDays),
        fixedMemberAmount:
          form.billingMode === "fixed_amount"
            ? Number(form.fixedMemberAmount)
            : null,
      },
      payment: {
        platform: form.paymentPlatform,
        link: form.paymentLink.trim() || null,
        instructions: form.paymentInstructions.trim() || null,
      },
      ...(mode === "create" ? { members: [] } : {}),
    };

    setLoading(true);

    try {
      const response = await fetch(
        mode === "create" ? "/api/groups" : `/api/groups/${groupId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await response.json();

      if (!response.ok) {
        setError(json.error?.message || "Failed to save the group.");
        setLoading(false);
        return;
      }

      const nextGroupId = mode === "create" ? json.data?._id : groupId;
      router.push(`/dashboard/groups/${nextGroupId}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="accent" className="mb-3">
            <Sparkles className="size-3" />
            {mode === "create" ? "Setup flow" : "Configuration"}
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {pageCopy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {pageCopy.description}
          </p>
        </div>
        <Link href={mode === "create" ? "/dashboard" : `/dashboard/groups/${groupId}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>General details</CardTitle>
              <CardDescription>
                Name the group clearly and add enough context so members know what
                they are paying for.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="name">Group name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="e.g. Family streaming plan"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder="Optional context for members, deadlines, or access notes"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service identity</CardTitle>
              <CardDescription>
                Give the dashboard something richer than plain text by adding a
                short icon and a destination URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="service-name">Service name</Label>
                <Input
                  id="service-name"
                  value={form.serviceName}
                  onChange={(event) =>
                    updateField("serviceName", event.target.value)
                  }
                  placeholder="e.g. Streaming service"
                  required
                />
              </div>

              <div className="grid gap-2">
                <FieldLabel htmlFor="service-icon" hint="Short label or emoji shown on group cards (e.g. YT or 📺).">
                  Icon or emoji
                </FieldLabel>
                <Input
                  id="service-icon"
                  value={form.serviceIcon}
                  onChange={(event) =>
                    updateField("serviceIcon", event.target.value)
                  }
                  placeholder="e.g. 2–3 letters or emoji"
                  maxLength={20}
                />
              </div>

              <div className="grid gap-2">
                <FieldLabel htmlFor="service-url" hint="Optional link to the subscription service, shown on the group card.">
                  Service URL
                </FieldLabel>
                <Input
                  id="service-url"
                  type="url"
                  value={form.serviceUrl}
                  onChange={(event) =>
                    updateField("serviceUrl", event.target.value)
                  }
                  placeholder="https://…"
                />
              </div>

              <div className="grid gap-2">
                <FieldLabel htmlFor="service-accent" hint="Used as the accent color in notification emails for this group.">
                  Accent color
                </FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    id="service-accent"
                    type="color"
                    className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1"
                    value={
                      normalizedAccentColor
                    }
                    onChange={(event) =>
                      updateField("serviceAccentColor", event.target.value)
                    }
                    aria-label="Pick accent color"
                  />
                  <Input
                    type="text"
                    value={form.serviceAccentColor}
                    onChange={(event) =>
                      updateField("serviceAccentColor", event.target.value)
                    }
                    placeholder="#3b82f6"
                    className="font-mono"
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="grid gap-3">
                <FieldLabel htmlFor="service-email-theme" hint="Controls the notification email style for this group.">
                  Notification style
                </FieldLabel>
                <div
                  id="service-email-theme"
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {EMAIL_THEME_OPTIONS.map((themeOption) => {
                    const selected = form.serviceEmailTheme === themeOption.id;
                    return (
                      <button
                        key={themeOption.id}
                        type="button"
                        onClick={() => updateField("serviceEmailTheme", themeOption.id)}
                        className={`rounded-lg border p-3 text-left transition ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                        aria-pressed={selected}
                      >
                        <p className="text-sm font-medium">{themeOption.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {themeOption.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <FieldLabel htmlFor="template-preview" hint="Live preview of the payment reminder using this group's style settings.">
                  Preview notifications
                </FieldLabel>
                <iframe
                  id="template-preview"
                  title="Payment reminder preview"
                  srcDoc={templatePreviewHtml}
                  className="h-[380px] w-full rounded-lg border bg-white"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Billing rules</CardTitle>
              <CardDescription>
                Define how costs are split and when payment reminders should start.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <FieldLabel htmlFor="billing-mode" hint="Equal split shares the total evenly among members. Fixed amount sets a per-member price. Variable is for manual tracking each cycle.">
                  Billing mode
                </FieldLabel>
                <Select
                  value={form.billingMode}
                  onValueChange={(value) =>
                    updateField("billingMode", (value ?? form.billingMode) as BillingMode)
                  }
                >
                  <SelectTrigger id="billing-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal_split">Equal split</SelectItem>
                    <SelectItem value="fixed_amount">Fixed amount</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="current-price">Price per cycle</Label>
                <Input
                  id="current-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.currentPrice}
                  onChange={(event) =>
                    updateField("currentPrice", event.target.value)
                  }
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(value) =>
                    updateField("currency", value ?? form.currency)
                  }
                >
                  <SelectTrigger id="currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <FieldLabel htmlFor="fixed-member-amount" hint="Exact amount each member pays per cycle. Only used when billing mode is Fixed amount.">
                  Fixed member amount
                </FieldLabel>
                <Input
                  id="fixed-member-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.fixedMemberAmount}
                  onChange={(event) =>
                    updateField("fixedMemberAmount", event.target.value)
                  }
                  disabled={form.billingMode !== "fixed_amount"}
                  placeholder={
                    form.billingMode === "fixed_amount" ? "4.99" : "Only for fixed amount"
                  }
                />
              </div>

              <div className="grid gap-2">
                <FieldLabel htmlFor="cycle-day" hint="Day of the month (1–28) when each billing cycle starts. Used for reminders and period creation.">
                  Cycle day
                </FieldLabel>
                <Input
                  id="cycle-day"
                  type="number"
                  min="1"
                  max="28"
                  value={form.cycleDay}
                  onChange={(event) => updateField("cycleDay", event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cycle-type">Cycle type</Label>
                <Select
                  value={form.cycleType}
                  onValueChange={(value) =>
                    updateField("cycleType", (value ?? form.cycleType) as CycleType)
                  }
                >
                  <SelectTrigger id="cycle-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <FieldLabel
                  htmlFor="payment-in-advance-days"
                  hint="Create the billing period and open unpaid tracking this many days before each renewal (cycle day). 0 means the window opens on the renewal day."
                >
                  Payment in advance (days)
                </FieldLabel>
                <Input
                  id="payment-in-advance-days"
                  type="number"
                  min="0"
                  max="365"
                  value={form.paymentInAdvanceDays}
                  onChange={(event) =>
                    updateField("paymentInAdvanceDays", event.target.value)
                  }
                />
              </div>

              <div className="grid gap-2">
                <FieldLabel
                  htmlFor="grace-period-days"
                  hint="Days after the collection window opens before the first automated payment reminder is sent."
                >
                  Grace period days
                </FieldLabel>
                <Input
                  id="grace-period-days"
                  type="number"
                  min="0"
                  max="31"
                  value={form.gracePeriodDays}
                  onChange={(event) =>
                    updateField("gracePeriodDays", event.target.value)
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-4 md:col-span-2">
                <div className="space-y-1">
                  <FieldLabel htmlFor="admin-split" hint="When on, the admin is counted as a member so the total is split among everyone including them.">
                    Include admin in the split
                  </FieldLabel>
                  <p className="text-sm text-muted-foreground">
                    Turn this off if the admin pays but should not be counted in the
                    member split.
                  </p>
                </div>
                <Switch
                  id="admin-split"
                  checked={form.adminIncludedInSplit}
                  onCheckedChange={(checked) =>
                    updateField("adminIncludedInSplit", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment instructions</CardTitle>
              <CardDescription>
                Help members pay faster by linking the method and any extra context.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="payment-platform">Platform</Label>
                <Select
                  value={form.paymentPlatform}
                  onValueChange={(value) =>
                    updateField(
                      "paymentPlatform",
                      (value ?? form.paymentPlatform) as PaymentPlatform
                    )
                  }
                >
                  <SelectTrigger id="payment-platform" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revolut">Revolut</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <FieldLabel htmlFor="payment-link" hint="Optional link included in payment reminders (e.g. Revolut.me or PayPal).">
                  Payment link
                </FieldLabel>
                <Input
                  id="payment-link"
                  type="url"
                  value={form.paymentLink}
                  onChange={(event) =>
                    updateField("paymentLink", event.target.value)
                  }
                  placeholder="https://…"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="payment-instructions">Instructions</Label>
                <Textarea
                  id="payment-instructions"
                  value={form.paymentInstructions}
                  onChange={(event) =>
                    updateField("paymentInstructions", event.target.value)
                  }
                  rows={6}
                  placeholder="Share the name reference, bank notes, or transfer instructions."
                />
              </div>
            </CardContent>
          </Card>

          {mode === "edit" && groupId ? (
            <Card className="border-destructive/30 bg-destructive/3">
              <CardHeader>
                <CardTitle className="text-destructive">Danger zone</CardTitle>
                <CardDescription>
                  Deleting removes this group from your dashboard. Historical billing
                  records are retained for audit, but members will no longer see this
                  group.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteGroupButton
                  groupId={groupId}
                  groupName={form.name.trim() || "this group"}
                  size="default"
                  label="Delete group"
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href={mode === "create" ? "/dashboard" : `/dashboard/groups/${groupId}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {loading ? "Saving..." : pageCopy.submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
