// apps/bot/src/models/Feedback.ts
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const SectionSchema = new Schema(
  {
    section: { type: String, required: true },
    score: { type: Number, required: true },
    outOf: { type: Number, required: true },
  },
  { _id: false }
);

const WeakTopicSchema = new Schema(
  {
    topic: { type: String, required: true },
    tip: { type: String, required: true },
  },
  { _id: false }
);

const RubricRowSchema = new Schema(
  {
    criterion: { type: String, required: true },
    levels: { type: [String], default: [] },
  },
  { _id: false }
);

const FeedbackSchema = new Schema(
  {
    telegramId: { type: String, index: true, required: true },

    paper: { type: String, required: true },
    subject: { type: String, required: true },

    totalScore: { type: Number, required: true },
    outOf: { type: Number, required: true },
    grade: { type: String, required: true },

    sections: { type: [SectionSchema], default: [] },
    weakTopics: { type: [WeakTopicSchema], default: [] },
    rubric: { type: [RubricRowSchema], default: [] },
  },
  { timestamps: true }
);

export type FeedbackDoc = InferSchemaType<typeof FeedbackSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export const FeedbackModel =
  mongoose.models.Feedback ||
  mongoose.model<FeedbackDoc>("Feedback", FeedbackSchema);
