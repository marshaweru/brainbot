export const PLAN_LIMITS = {
  lite: {
    hours: 3,
    papersPerDay: 1,
    pdf: false,
    voice: true,
    drills: false
  },
  steady: {
    hours: 3,
    papersPerDay: 1,
    pdf: true,
    voice: true,
    drills: false
  },
  serious: {
    hours: 6,
    papersPerDay: 2,
    pdf: true,
    voice: true,
    drills: true
  },
  elite: {
    hours: 24,
    papersPerDay: 4,
    pdf: true,
    voice: true,
    drills: true
  }
};
