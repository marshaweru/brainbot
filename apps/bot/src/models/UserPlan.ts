import mongoose, { Schema, InferSchemaType } from "mongoose";

const UserPlanSchema = new Schema(
  {
    telegramId: { type: String, unique: true, index: true, required: true },
    tier: {
      type: String,
      enum: ["free", "lite", "steady", "serious", "elite", "limited"],
      default: "free",
      index: true,
    },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 3 * 3600 * 1000) }, // free trial 3h
    papersUsed: { type: Number, default: 0 },
    lastSession: { type: Date, default: null },
  },
  { timestamps: true }
);

export type UserPlanDoc = InferSchemaType<typeof UserPlanSchema>;

export const UserPlanModel =
  mongoose.models.UserPlan || mongoose.model<UserPlanDoc>("UserPlan", UserPlanSchema);
