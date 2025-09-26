// Minimal starter syllabus. Add/expand canonicals + aliases over time.
// Shape is friendly to future DB syncs.

export type Syllabus = Record<
  string, // Subject label, e.g., "Mathematics"
  {
    topics: Record<
      string,     // Canonical topic name (what we display & store)
      string[]    // Aliases/synonyms students might type
    >;
  }
>;

// Seed just enough to prove the plumbing works.
// Fill this out later or swap to a DB-backed loader.
export const SYLLABUS: Syllabus = {
  Mathematics: {
    topics: {
      "Quadratic equations": ["quadratics", "solving quadratics", "roots of quadratics"],
      "Surds": ["radicals"],
      "Indices and Logarithms": ["indices", "logs", "logarithms"],
      "Trigonometry": ["trig", "sine cosine tangent", "sin cos tan"],
      "Probability": ["probabilities", "basic probability"],
      "Differentiation": ["derivatives", "differential calculus"],
      "Integration": ["integrals", "integral calculus", "area under curve"],
      "Vectors": ["vector algebra"],
      "Statistics": ["mean median mode", "data handling"],
      "Sequences and Series": ["arithmetic sequences", "geometric series"],
    },
  },

  English: {
    topics: {
      "Comprehension": ["reading comprehension"],
      "Summary writing": ["summaries"],
      "Grammar": ["parts of speech", "tenses"],
      "Functional writing": ["letters", "reports", "speeches"],
      "Literary analysis": ["set books", "poetry analysis", "drama analysis"],
    },
  },

  "History & Government": {
    topics: {
      "Precolonial Kenya": ["pre-colonial kenya"],
      "Colonial Kenya": ["colonialism in kenya"],
      "Citizenship": ["civics"],
      "The Cold War": ["cold war"],
      "African Nationalism": ["nationalism in africa"],
    },
  },

  // Add more subjects as you go:
  // Chemistry, Biology, Physics, Geography, Business Studies, CRE, Kiswahili, etc.
};
