// apps/bot/src/models/drill.ts
import mongoose, { Schema, InferSchemaType, model, Types, type Model } from "mongoose";

const DrillSchema = new Schema(
  {
    telegramId: { type: String, index: true, required: true },

    subjectLabel: { type: String, required: true }, // e.g., "Mathematics"
    topic: { type: String, required: true },        // e.g., "Quadratic equations"

    // Q/A set that was served
    questions: [
      {
        q: { type: String, required: true },
        a: { type: String }, // optional correct answer if generated
      },
    ],

    // Store normalized difficulty; "medium" is treated as "normal" by handlers
    difficulty: {
      type: String,
      enum: ["easy", "normal", "hard", "insane"],
      default: "normal",
      index: true,
    },

    // Scoring
    score: { type: Number, default: 0 },  // student’s achieved score
    outOf: { type: Number, default: 0 },  // max possible
  },
  {
    timestamps: true,     // adds createdAt, updatedAt
    versionKey: false,
  }
);

// Auto-backfill outOf if caller forgot to set it
DrillSchema.pre("save", function (next) {
  // @ts-ignore `this` is a document
  if (this.isModified("questions") || this.outOf === 0) {
    // @ts-ignore
    const qlen = Array.isArray(this.questions) ? this.questions.length : 0;
    if (qlen && (!this.outOf || this.outOf < qlen)) {
      // @ts-ignore
      this.outOf = qlen;
    }
  }
  next();
});

// Index by user + topic (newest first) for fast “repeat” queries
DrillSchema.index({ telegramId: 1, subjectLabel: 1, topic: 1, createdAt: -1 });
// Also speed up “recent for user” lists
DrillSchema.index({ telegramId: 1, createdAt: -1 });

export type DrillDoc = InferSchemaType<typeof DrillSchema> & { _id: Types.ObjectId };
export type DrillModelType = Model<DrillDoc>;

export const DrillModel: DrillModelType =
  (mongoose.models.Drill as DrillModelType) || model<DrillDoc, DrillModelType>("Drill", DrillSchema);
