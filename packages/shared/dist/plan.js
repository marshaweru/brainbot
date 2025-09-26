export const PLANS = {
    free: {
        code: "free",
        label: "Free",
        amount: 0,
        days: 0,
        papersPerDay: 0,
        hoursPerDay: 0,
        pdf: false,
        voice: false,
        drills: false
    },
    lite: {
        code: "lite",
        label: "Lite Pass",
        amount: 69,
        days: 1,
        papersPerDay: 1,
        hoursPerDay: 3,
        pdf: false,
        voice: false,
        drills: true
    },
    steady: {
        code: "steady",
        label: "Steady Pass",
        amount: 199,
        days: 7,
        papersPerDay: 2,
        hoursPerDay: 4,
        pdf: true,
        voice: false,
        drills: true
    },
    serious: {
        code: "serious",
        label: "Serious Pass",
        amount: 499,
        days: 30,
        papersPerDay: 3,
        hoursPerDay: 6,
        pdf: true,
        voice: true,
        drills: true
    },
    limited: {
        code: "limited",
        label: "Limited",
        amount: 0,
        days: 0,
        papersPerDay: 0,
        hoursPerDay: 0,
        pdf: false,
        voice: false,
        drills: false
    },
    elite: {
        code: "elite",
        label: "Elite",
        amount: 1999,
        days: 30,
        papersPerDay: 6,
        hoursPerDay: 24,
        pdf: true,
        voice: true,
        drills: true
    }
};
