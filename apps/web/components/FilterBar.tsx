// apps/web/components/FilterBar.tsx
"use client";
import React, { useCallback, useMemo, useState } from "react";

type Range = "90d" | "6mo" | "all";

export default function FilterBar({
  availableSubjects,
  selectedSubjects,
  compare,
  range,
  onChange,
}: {
  availableSubjects: string[];
  selectedSubjects: string[]; // empty = “All subjects”
  compare: boolean;
  range: Range;
  onChange: (next: {
    selectedSubjects?: string[];
    compare?: boolean;
    range?: Range;
  }) => void;
}) {
  // Local search filter (optional)
  const [q, setQ] = useState("");

  // Normalize, dedupe, sort once
  const subjects = useMemo(() => {
    const set = new Set(
      (availableSubjects || [])
        .filter(Boolean)
        .map((s) => s.trim())
        .filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [availableSubjects]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return subjects;
    return subjects.filter((s) => s.toLowerCase().includes(needle));
  }, [subjects, q]);

  const isSelected = useCallback(
    (s: string) => selectedSubjects.includes(s),
    [selectedSubjects]
  );

  const toggleSubject = useCallback(
    (s: string) => {
      if (isSelected(s)) {
        onChange({ selectedSubjects: selectedSubjects.filter((x) => x !== s) });
      } else {
        onChange({ selectedSubjects: [...selectedSubjects, s] });
      }
    },
    [isSelected, onChange, selectedSubjects]
  );

  const selectAll = useCallback(() => onChange({ selectedSubjects: [] }), [onChange]);
  const clearAll = useCallback(() => onChange({ selectedSubjects: [] }), [onChange]);

  const setCompare = useCallback(
    (val: boolean) => onChange({ compare: val }),
    [onChange]
  );

  const setRangeKey = useCallback(
    (key: Range) => onChange({ range: key }),
    [onChange]
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] border border-white/10 p-4">
      {/* Top row: subject search + quick actions */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subjects…"
            className="w-56 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none"
            aria-label="Search subjects"
          />
          <button
            onClick={selectAll}
            className="rounded-xl px-3 py-2 text-xs border bg-white/5 border-white/10 hover:bg-white/10"
            type="button"
          >
            All subjects
          </button>
          {selectedSubjects.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-xl px-3 py-2 text-xs border bg-white/5 border-white/10 hover:bg-white/10"
              type="button"
            >
              Clear
            </button>
          )}
        </div>

        {/* Compare toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
          />
          <span className="text-steel-300">Compare selected subjects</span>
        </label>
      </div>

      {/* Subjects row (scrollable if long) */}
      <div className="flex flex-wrap gap-2 max-h-40 overflow-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-xs text-steel-300 px-2 py-1">No subjects match “{q}”.</div>
        ) : (
          filtered.map((s) => {
            const active = isSelected(s) || (selectedSubjects.length === 0 && false);
            return (
              <button
                key={s}
                onClick={() => toggleSubject(s)}
                aria-pressed={active}
                className={`px-3 py-2 rounded-xl text-sm border transition
                  ${active
                    ? "bg-gold-500 text-ink-900 border-gold-500"
                    : "bg-white/5 text-white border-white/10 hover:bg-white/10"}`}
                type="button"
                title={s}
              >
                {s}
              </button>
            );
          })
        )}
      </div>

      {/* Bottom controls: time range */}
      <div className="flex items-center justify-end gap-2">
        {(["90d", "6mo", "all"] as Range[]).map((key) => {
          const label =
            key === "90d" ? "Last 90 days" : key === "6mo" ? "Last 6 months" : "All time";
          const active = range === key;
          return (
            <button
              key={key}
              onClick={() => setRangeKey(key)}
              aria-pressed={active}
              className={`rounded-xl px-3 py-2 text-sm border transition
                ${active
                  ? "bg-gold-500 text-ink-900 border-gold-500"
                  : "bg-white/5 text-white border-white/10 hover:bg-white/10"}`}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
