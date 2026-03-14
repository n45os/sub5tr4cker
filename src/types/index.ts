import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "user";
    } & DefaultSession["user"];
  }
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export type PaymentStatus =
  | "pending"
  | "member_confirmed"
  | "confirmed"
  | "overdue"
  | "waived";

export type BillingMode = "equal_split" | "fixed_amount" | "variable";

export type PaymentPlatform =
  | "revolut"
  | "paypal"
  | "bank_transfer"
  | "stripe"
  | "custom";

export type NotificationChannel = "email" | "telegram";
