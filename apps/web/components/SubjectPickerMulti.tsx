// apps/web/components/SubjectPickerMulti.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_SUBJECTS = [
  "Mathematics",
  "English",
  "Kiswahili",
  "Biology",
  "Chemistry",
  "Physics",
  "Geography",
  "History & Government",
  "CRE",
  "Business Studies",
];

type Props = {
  value?: string[];                         // controlled selection
  onChange?: (subjects: string[]) => void;  // emits sorted, unique list
  subjects?: string[];
  className?: string;
  maxSelect?: number;                       // optional cap
  showActions?: boolean;                    // show Select All / Clear
};

export default function SubjectPickerMulti({
  value,
  onChange,
  subjects = DEFAULT_SUBJECTS,
  className = "",
  maxSelect,
  showActions = true,
}: Props) {
  const items = useMemo(
    () => subjects.filter(Boolean).map((s) => String(s)),
    [subjects]
  );

  // internal mirror so keyboard focus is smooth even if parent is slow
  const [selected, setSelected] = useState<string[]>(
    dedupeSort(value?.length ? value : [])
  );
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    if (value) setSelected(dedupeSort(value));
  }, [value?.join("|")]); // join for shallow change detection

  const emit = useCallback(
    (next: string[]) => {
      const clean = dedupeSort(next);
      setSelected(clean);
      onChange?.(clean);
    },
    [onChange]
  );

  const toggle = useCallback(
    (idx: number) => {
      const s = items[idx];
      if (!s) return;

      const isSelected = selected.includes(s);
      if (isSelected) {
        emit(selected.filter((x) => x !== s));
      } else {
        if (typeof maxSelect === "number" && selected.length >= maxSelect) return;
        emit([...selected, s]);
      }
    },
    [items, selected, emit, maxSelect]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const cols = 3; // feels grid-like for arrow keys
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((i) => Math.min(items.length - 1, i + (e.key === "ArrowRight" ? 1 : cols)));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((i) => Math.max(0, i - (e.key === "ArrowLeft" ? 1 : cols)));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(focusIndex);
      }
    },
    [items.length, toggle, focusIndex]
  );

  const allSelected = selected.length === items.length && items.length > 0;

  return (
    <div className={`flex flex-col gap-2 mb-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-white/90">Pick subjects:</span>
        {showActions && (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              className="rounded-md border border-white/15 px-2 py-1 text-white/80 hover:bg-white/10"
              onClick={() => emit(items)}
              disabled={allSelected}
            >
              Select all
            </button>
            <button
              type="button"
              className="rounded-md border border-white/15 px-2 py-1 text-white/80 hover:bg-white/10"
              onClick={() => emit([])}
              disabled={selected.length === 0}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div
        role="group"
        aria-label="KCSE subjects (multiple selection)"
        className="flex flex-wrap gap-2"
        onKeyDown={onKeyDown}
      >
        {items.map((s, idx) => {
          const isOn = selected.includes(s);
          const focused = idx === focusIndex;

          return (
            <button
              key={s}
              type="button"
              role="checkbox"
              aria-checked={isOn}
              aria-label={s}
              tabIndex={focused ? 0 : -1}
              onFocus={() => setFocusIndex(idx)}
              onClick={() => toggle(idx)}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold border transition outline-none",
                isOn
                  ? "bg-blue-600 text-white border-blue-700"
                  : "bg-white text-blue-700 border-blue-200 hover:bg-brand-500 hover:text-white hover:border-brand-500",
                "focus:ring-2 focus:ring-brand-500/60 focus:ring-offset-0",
              ].join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "h-4 w-4 rounded-[4px] border flex items-center justify-center",
                  isOn ? "bg-white text-blue-700 border-white" : "bg-white/0 border-current text-transparent",
                ].join(" ")}
              >
                ✓
              </span>
              {s}
            </button>
          );
        })}
      </div>

      {typeof maxSelect === "number" && (
        <div className="text-[11px] text-white/60">
          {selected.length}/{maxSelect} selected
        </div>
      )}
    </div>
  );
}

function dedupeSort(arr: string[]) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}
