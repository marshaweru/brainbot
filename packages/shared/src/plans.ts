export type PlanCode = "LITE_DAY" | "PRO_WEEK" | "PLUS_MONTH" | "ULTRA_MONTH" | "FIRST100";

export const Plans: Record<PlanCode, { label: string; amount: number; hoursPerDay: number; subjectsPerDay: number; durationDays: number; }> = {
  LITE_DAY:   { label: "Lite (Day)",         amount: 50,   hoursPerDay: 2, subjectsPerDay: 2, durationDays: 1 },
  PRO_WEEK:   { label: "Pro (Week)",         amount: 300,  hoursPerDay: 2, subjectsPerDay: 2, durationDays: 7 },
  PLUS_MONTH: { label: "Plus (Month)",       amount: 1750, hoursPerDay: 5, subjectsPerDay: 3, durationDays: 30 },
  ULTRA_MONTH:{ label: "Ultra Plus (Month)", amount: 2500, hoursPerDay: 8, subjectsPerDay: 4, durationDays: 30 },
  FIRST100:   { label: "Founder Deal (2 mo)",amount: 1500, hoursPerDay: 5, subjectsPerDay: 2, durationDays: 60 },
};
