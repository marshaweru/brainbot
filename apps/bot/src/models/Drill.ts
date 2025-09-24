import mongoose, { Schema, InferSchemaType, model, Types } from "mongoose";

const DrillSchema = new Schema(
  {
    telegramId: { type: String, index: true, required: true },

    subjectLabel: { type: String, required: true }, // e.g. "Mathematics"
    topic: { type: String, required: true },        // e.g. "Algebra"

    // Q/A set that was served
    questions: [
      {
        q: { type: String, required: true },
        a: { type: String }, // optional correct answer if generated
      },
    ],

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },

    score: { type: Number, default: 0 },  // student’s achieved score
    outOf: { type: Number, default: 0 },  // max possible

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index by user + topic for fast “repeat drills” queries
DrillSchema.index({ telegramId: 1, subjectLabel: 1, topic: 1, createdAt: -1 });

export type DrillDoc = InferSchemaType<typeof DrillSchema> & {
  _id: Types.ObjectId;
};

export const DrillModel =
  mongoose.models.Drill || model("Drill", DrillSchema);
