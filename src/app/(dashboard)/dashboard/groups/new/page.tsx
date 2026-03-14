"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [paymentLink, setPaymentLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const numPrice = parseFloat(price);
    if (Number.isNaN(numPrice) || numPrice <= 0) {
      setError("Enter a valid price.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          service: { name: serviceName },
          billing: {
            mode: "equal_split",
            currentPrice: numPrice,
            currency,
            cycleDay: 1,
            cycleType: "monthly",
            adminIncludedInSplit: true,
            gracePeriodDays: 3,
          },
          payment: {
            platform: "revolut",
            link: paymentLink || null,
          },
          members: [],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || "Failed to create group.");
        setLoading(false);
        return;
      }
      router.push(`/dashboard/groups/${json.data._id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/dashboard"
        className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to groups
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        New subscription group
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200"
          >
            {error}
          </div>
        )}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Group name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label
            htmlFor="service"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Service name
          </label>
          <input
            id="service"
            type="text"
            required
            placeholder="e.g. YouTube Premium"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label
              htmlFor="price"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Total price per period
            </label>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="w-24">
            <label
              htmlFor="currency"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Currency
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
        <div>
          <label
            htmlFor="paymentLink"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Payment link (optional)
          </label>
          <input
            id="paymentLink"
            type="url"
            placeholder="https://revolut.me/..."
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Creating…" : "Create group"}
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
