"use client";
import React from "react";

type Range = "90d" | "6mo" | "all";

export default function FilterBar({
  availableSubjects,
  selectedSubjects,
  compare,
  range,
  onChange,
}: {
  availableSubjects: string[];
  selectedSubjects: string[];            // 0+ selections; empty means “All subjects”
  compare: boolean;
  range: Range;
  onChange: (next: {
    selectedSubjects?: string[];
    compare?: boolean;
    range?: Range;
  }) => void;
}) {
  const isSelected = (s: string) => selectedSubjects.includes(s);

  const toggleSubject = (s: string) => {
    if (isSelected(s)) {
      onChange({ selectedSubjects: selectedSubjects.filter(x => x !== s) });
    } else {
      onChange({ selectedSubjects: [...selectedSubjects, s] });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] border border-white/10 p-4">
      {/* Subjects row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onChange({ selectedSubjects: [] })}
          className={`px-3 py-2 rounded-xl text-sm border ${
            selectedSubjects.length === 0
              ? "bg-gold-500 text-ink-900 border-gold-500"
              : "bg-white/5 text-white border-white/10"
          }`}
        >
          All subjects
        </button>

        {availableSubjects.map((s) => (
          <button
            key={s}
            onClick={() => toggleSubject(s)}
            className={`px-3 py-2 rounded-xl text-sm border ${
              isSelected(s)
                ? "bg-gold-500 text-ink-900 border-gold-500"
                : "bg-white/5 text-white border-white/10"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-between">
        {/* Compare toggle */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => onChange({ compare: e.target.checked })}
          />
          <span className="text-steel-300">Compare selected subjects</span>
        </label>

        {/* Time range */}
        <div className="flex gap-2">
          {(["90d","6mo","all"] as Range[]).map((key) => {
            const label = key === "90d" ? "Last 90 days" : key === "6mo" ? "Last 6 months" : "All time";
            const active = range === key;
            return (
              <button
                key={key}
                onClick={() => onChange({ range: key })}
                className={`rounded-xl px-3 py-2 text-sm border ${
                  active ? "bg-gold-500 text-ink-900 border-gold-500" : "bg-white/5 text-white border-white/10"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
