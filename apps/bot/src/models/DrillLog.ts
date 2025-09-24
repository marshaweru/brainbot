import mongoose, { Schema, InferSchemaType, model } from "mongoose";

const DrillLogSchema = new Schema(
  {
    telegramId: { type: String, required: true, index: true },
    subjectLabel: { type: String, required: true },
    topic: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ["easy", "normal", "hard", "insane"],
      required: true,
    },
    outOf: { type: Number, required: true },     // number of questions served
    score: { type: Number, default: null },      // set on finish (optional)
    startedAt: { type: Date, default: () => new Date(), index: true },
    lastActivityAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: false, collection: "drill_logs" }
);

// Helpful compound index for dashboards (latest per user/topic)
DrillLogSchema.index({ telegramId: 1, startedAt: -1 });

export type DrillLogDoc = InferSchemaType<typeof DrillLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DrillLogModel =
  mongoose.models.DrillLog || model("DrillLog", DrillLogSchema);
