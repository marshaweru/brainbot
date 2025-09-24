// apps/web/components/SubjectFilter.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

export default function SubjectFilter({ subjects }: { subjects: string[] }) {
  const router = useRouter();
  const rawPath = usePathname();
  const sp = useSearchParams();

  // If we're not already on /analytics, push filters to /analytics
  const effectiveBase =
    rawPath && rawPath.includes("/analytics") ? rawPath : "/analytics";

  // Safe read of current ?subject=
  const current: string = sp?.get("subject") ?? "";

  const onChange = (next: string) => {
    // Build mutable params even if sp is null
    const existing =
      sp?.toString() ??
      (typeof window !== "undefined" ? window.location.search.slice(1) : "");
    const p = new URLSearchParams(existing);

    if (next) p.set("subject", next);
    else p.delete("subject");

    const qs = p.toString();
    router.push(qs ? `${effectiveBase}?${qs}` : effectiveBase);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.currentTarget.value); // always string
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-white/60">Filter by subject:</label>
      <select
        value={current}
        onChange={handleSelectChange}
        className="bg-white/10 border border-white/20 text-sm rounded-lg px-2 py-1"
        title="Filter analytics by subject"
      >
        <option value="">All</option>
        {subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
