// apps/bot/src/models/Performance.ts
import mongoose, { Schema, InferSchemaType } from "mongoose";

const PerformanceSchema = new Schema(
  {
    telegramId: { type: String, index: true, required: true },
    subjectLabel: { type: String, index: true, required: true },

    // Scores
    gradeNumeric: { type: Number, min: 0, max: 100 },
    gradeText: { type: String }, // e.g., "B+"

    // Content & feedback
    weakTopics: { type: [String], default: [] },
    feedback: { type: Schema.Types.Mixed }, // whatever toFeedback() returns
    raw: { type: Schema.Types.Mixed },      // optional: raw pipeline output

    // Phase-1+ additions (non-breaking, all optional)
    paper: { type: String },                // e.g., "Math P1 2021" or an id/code
    sessionId: { type: String },            // tie multiple writes to one run
    startedAt: { type: Date },              // when student began the paper
    finishedAt: { type: Date },             // when marking completed
  },
  { timestamps: true }
);

// Helpful compound indexes for scale
PerformanceSchema.index({ telegramId: 1, createdAt: -1 });
PerformanceSchema.index({ telegramId: 1, gradeNumeric: -1 });
PerformanceSchema.index({ subjectLabel: 1, createdAt: -1 });
PerformanceSchema.index({ sessionId: 1 }, { sparse: true });

// Virtual: duration in ms if both times exist
PerformanceSchema.virtual("durationMs").get(function (this: any) {
  const s = this.startedAt instanceof Date ? this.startedAt.getTime() : null;
  const f = this.finishedAt instanceof Date ? this.finishedAt.getTime() : null;
  return s != null && f != null && f >= s ? f - s : null;
});

// Ensure virtuals show up when you JSON the doc
PerformanceSchema.set("toJSON", { virtuals: true });
PerformanceSchema.set("toObject", { virtuals: true });

// Optional: if you want to auto-stamp finishedAt when score is first set
// PerformanceSchema.pre("save", function (next) {
//   if (this.isModified("gradeNumeric") && this.gradeNumeric != null && !this.finishedAt) {
//     this.finishedAt = new Date();
//   }
//   next();
// });

export type PerformanceDoc = InferSchemaType<typeof PerformanceSchema>;

export const PerformanceModel =
  mongoose.models.Performance ||
  mongoose.model<PerformanceDoc>("Performance", PerformanceSchema);
