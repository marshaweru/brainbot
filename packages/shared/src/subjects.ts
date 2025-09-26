/** KCSE core subjects BrainBot supports */
export const SUBJECTS = [
  "English",
  "Kiswahili",
  "Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "History & Government",
  "Geography",
  "CRE",
  "Business Studies"
] as const;

export type Subject = (typeof SUBJECTS)[number];
