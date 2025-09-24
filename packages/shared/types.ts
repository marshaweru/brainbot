import type { PlanTier } from "./plan.js";
import type { SubjectName } from "./subjects.js";

/** Nominal types for clarity/safety (still plain strings/numbers at runtime). */
export type ObjectIdString = string & { readonly __objectId: unique symbol };
export type ISODateString = string & { readonly __isoDate: unique symbol };
export type TelegramId = number & { readonly __telegramId: unique symbol };
export type WebUserId = string & { readonly __wid: unique symbol };

/** Common literals */
export type SessionPaper = 1 | 2 | 3;
export type SessionStatus = "in-progress" | "marked" | "expired";
export type PaymentMethod = "stk" | "c2b";
export type PaymentStatus = "pending" | "success" | "failed";

/** Core user record used across web/admin/bot (DB-agnostic). */
export interface User {
  _id: ObjectIdString;

  /** Anonymous web id (wid) if the user started on web before linking Telegram. */
  webUserId?: WebUserId;

  /** Telegram user id once linked; number in Telegram APIs. */
  telegramId?: TelegramId;

  username?: string;
  phone?: string;

  /** Current plan tier; "free" allowed here for unauthenticated/trial. */
  tier: PlanTier;

  /** Subscription expiry (ISO string) or null for non-expiring/free. */
  expiresAt?: ISODateString | null;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Study session lifecycle. */
export interface Session {
  _id: ObjectIdString;
  userId: ObjectIdString;

  subject: SubjectName;
  paper: SessionPaper;

  /** Tier snapshot when the session started (in case of later upgrades). */
  tierAtStart: PlanTier;

  startedAt: ISODateString;
  endedAt?: ISODateString;

  status: SessionStatus;
}

/** A marked attempt/result for a given session. */
export interface Attempt {
  _id: ObjectIdString;
  userId: ObjectIdString;
  sessionId: ObjectIdString;

  score: number;
  outOf: number;
  grade: string;

  /** Fine-grained rubric trail (render-friendly). */
  rubric: { step: string; note: string; correct: boolean; mark: string }[];

  /** Section-level breakdown (e.g., Algebra, Geometry…). */
  criteria: { name: string; score: number; outOf: number }[];

  /** Optional exported PDF link for the attempt. */
  pdfUrl?: string;

  createdAt: ISODateString;
}

/** Payment record (MPESA-first, extensible later). */
export interface Payment {
  _id: ObjectIdString;
  userId?: ObjectIdString;

  amountKES: number;

  /** Target tier purchased (cannot be "free"). */
  tier: Exclude<PlanTier, "free">;

  method: PaymentMethod;
  status: PaymentStatus;

  /**
   * Raw MPESA payload (as returned by STK/C2B webhooks).
   * Keep loose here; normalize in your repo layer if needed.
   */
  mpesa?: Record<string, unknown>;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Legacy alias kept for backwards compat (remove once fully migrated). */
export type ObjectId = ObjectIdString;
