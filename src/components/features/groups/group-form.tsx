"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

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
  billingMode: BillingMode;
  currentPrice: string;
  currency: string;
  cycleDay: string;
  cycleType: CycleType;
  adminIncludedInSplit: boolean;
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
  billingMode: "equal_split",
  currentPrice: "",
  currency: "EUR",
  cycleDay: "1",
  cycleType: "monthly",
  adminIncludedInSplit: true,
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
      },
      billing: {
        mode: form.billingMode,
        currentPrice: Number(form.currentPrice),
        currency: form.currency.trim().toUpperCase(),
        cycleDay: Number(form.cycleDay),
        cycleType: form.cycleType,
        adminIncludedInSplit: form.adminIncludedInSplit,
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
          <Badge variant="outline" className="mb-3">
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
                  placeholder="Family YouTube Premium"
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
                  placeholder="YouTube Premium"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="service-icon">Icon or emoji</Label>
                <Input
                  id="service-icon"
                  value={form.serviceIcon}
                  onChange={(event) =>
                    updateField("serviceIcon", event.target.value)
                  }
                  placeholder="YT"
                  maxLength={20}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="service-url">Service URL</Label>
                <Input
                  id="service-url"
                  type="url"
                  value={form.serviceUrl}
                  onChange={(event) =>
                    updateField("serviceUrl", event.target.value)
                  }
                  placeholder="https://youtube.com/premium"
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
                <Label htmlFor="billing-mode">Billing mode</Label>
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
                <Label htmlFor="fixed-member-amount">Fixed member amount</Label>
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
                <Label htmlFor="cycle-day">Cycle day</Label>
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
                <Label htmlFor="grace-period-days">Grace period days</Label>
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
                  <Label htmlFor="admin-split">Include admin in the split</Label>
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
                <Label htmlFor="payment-link">Payment link</Label>
                <Input
                  id="payment-link"
                  type="url"
                  value={form.paymentLink}
                  onChange={(event) =>
                    updateField("paymentLink", event.target.value)
                  }
                  placeholder="https://revolut.me/your-link"
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
