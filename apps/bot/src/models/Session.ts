// apps/bot/src/models/Session.ts
import mongoose, { Schema, InferSchemaType } from "mongoose";

/**
 * Per-upload payload (unchanged).
 */
const UploadSchema = new Schema(
  {
    kind: { type: String, enum: ["photo", "voice", "document", "text"], required: true },
    text: String,
    fileId: String,
    mimeType: String,
    caption: String,
    duration: Number,
  },
  { _id: false }
);

// Default TTL safety net (kept from your original)
const TTL_HOURS = Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 3));

const SessionSchema = new Schema(
  {
    telegramId: { type: String, index: true, required: true }, // NOT unique (only active is unique)
    active: { type: Boolean, default: true, index: true },

    // Flow state
    mode: {
      type: String,
      enum: ["awaiting-subject", "in-progress", "finished"],
      default: "awaiting-subject",
    },

    // Subject/paper selection
    subjectIndex: Number,
    subjectLabel: { type: String, required: false },
    paper: { type: Number, enum: [1, 2, 3], required: false }, // will be set when assigned

    // Timestamps
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },

    /**
     * Exam & upload windows (NEW):
     * - examPreset: "2h" or "2h30"
     * - examEndsAt: when exam time ends
     * - uploadEndsAt: examEndsAt + 30m (buffer for uploads/marking)
     *
     * NOTE: we keep `expiresAt` as a legacy/TTL anchor. On timer start, we set:
     *   expiresAt = uploadEndsAt
     * so your existing TTL index still cleans up sessions after the upload buffer.
     */
    examPreset: { type: String, enum: ["2h", "2h30"], default: "2h" },
    examEndsAt: { type: Date, default: null },
    uploadEndsAt: { type: Date, default: null },

    // Uploads captured during the session
    uploads: { type: [UploadSchema], default: [] },

    // TTL anchor (Mongo auto-deletes when past) — defaults to a safety TTL,
    // but the timer service should overwrite this to `uploadEndsAt`.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + TTL_HOURS * 3600 * 1000),
    },
  },
  { timestamps: true }
);

/**
 * Invariants / Indexes
 */

// Exactly one *active* session per user
SessionSchema.index(
  { telegramId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

// TTL: expire immediately once `expiresAt` passes
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = InferSchemaType<typeof SessionSchema>;

export const SessionModel =
  (mongoose.models.Session as mongoose.Model<SessionDoc>) ||
  mongoose.model<SessionDoc>("Session", SessionSchema);
