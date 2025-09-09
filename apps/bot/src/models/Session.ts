// apps/bot/src/models/Session.ts
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

const SessionSchema = new Schema(
  {
    telegramId: { type: String, index: true, unique: true, required: true },
    mode: { type: String, enum: [null, "awaiting-subject", "in-progress"], default: null },
    subjectIndex: Number,
    subjectLabel: String,
    startedAt: Number,
    uploads: { type: [UploadSchema], default: [] },
  },
  { timestamps: true }
);

export type SessionDoc = InferSchemaType<typeof SessionSchema>;

export const SessionModel =
  mongoose.models.Session || mongoose.model<SessionDoc>("Session", SessionSchema);
