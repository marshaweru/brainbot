// apps/bot/src/models/UserPlan.ts
import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

// Keep schema minimal; trial window is set in repo.getUserPlan()
const UserPlanSchema = new Schema(
  {
    telegramId: { type: String, unique: true, index: true, required: true },
    tier: {
      type: String,
      enum: ["free", "lite", "steady", "serious", "elite", "limited"],
      default: "free",
      index: true,
    },
    // null = lifetime. Trial expiry is set in code, not as a schema default.
    expiresAt: { type: Date, default: null },
    papersUsed: { type: Number, default: 0 },
    lastSession: { type: Date, default: null },

    // optional provenance for upgrades (receipts, txn ids, etc.)
    receipts: { type: [Schema.Types.Mixed], default: [] },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
    versionKey: false,
  }
);

// Strong TS types
export type UserPlanDoc = InferSchemaType<typeof UserPlanSchema>; // { telegramId, tier, expiresAt, ... }
export type UserPlanModelType = Model<UserPlanDoc>;

export const UserPlanModel: UserPlanModelType =
  (mongoose.models.UserPlan as UserPlanModelType) ||
  mongoose.model<UserPlanDoc, UserPlanModelType>("UserPlan", UserPlanSchema);
