// Insight model placeholder
import mongoose, { Schema, InferSchemaType, Types } from "mongoose";

const InsightSchema = new Schema(
  {
    subject: { type: String, index: true, required: true },
    topic:   { type: String, index: true, required: true },
    tips:    { type: [String], default: [] },
    source:  { type: String, default: "manual" },
    quality: { type: Number, default: 0 },
  },
  { timestamps: true }
);

InsightSchema.index({ subject: 1, topic: 1 }, { unique: true, name: "uniq_subject_topic" });
InsightSchema.index({ topic: "text", subject: "text" });

export type InsightDoc = InferSchemaType<typeof InsightSchema> & { _id: Types.ObjectId };
export const InsightModel =
  mongoose.models.Insight || mongoose.model<InsightDoc>("Insight", InsightSchema);
