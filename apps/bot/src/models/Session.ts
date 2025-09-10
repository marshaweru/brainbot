import mongoose, { Schema, InferSchemaType } from "mongoose";

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

const TTL_HOURS = Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 3));

const SessionSchema = new Schema(
  {
    telegramId: { type: String, index: true, required: true },
    active: { type: Boolean, default: true, index: true },

    mode: {
      type: String,
      enum: ["awaiting-subject", "in-progress"],
      default: "awaiting-subject",
    },

    subjectIndex: Number,
    subjectLabel: String,

    startedAt: { type: Date, default: Date.now },

    // we keep uploads in the doc so /finish can read them
    uploads: { type: [UploadSchema], default: [] },

    // TTL anchor; Mongo will auto-delete after this timestamp
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + TTL_HOURS * 3600 * 1000),
      index: true,
    },
  },
  { timestamps: true }
);

// one *active* session per user
SessionSchema.index(
  { telegramId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

// TTL: delete when expiresAt passes
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = InferSchemaType<typeof SessionSchema>;

export const SessionModel =
  mongoose.models.Session || mongoose.model<SessionDoc>("Session", SessionSchema);
