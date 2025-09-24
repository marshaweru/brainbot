// apps/web/app/analytics/page.tsx
import {
  getDrillsThisWeek,
  getSubjectBreakdown7d,
  getHourOfDayHistogram7d,
} from "@/lib/analytics/drills";
import SubjectFilter from "@/components/SubjectFilter";

export const dynamic = "force-dynamic"; // always fresh while iterating

const TG_BOT = "brainbotafrica_bot";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { [k: string]: string | string[] | undefined };
}) {
  const subject =
    typeof searchParams.subject === "string" && searchParams.subject.trim().length
      ? searchParams.subject.trim()
      : undefined;

  const [weekly, subjects, hours] = await Promise.all([
    getDrillsThisWeek(subject),
    getSubjectBreakdown7d(), // used for table + filter options
    getHourOfDayHistogram7d(subject),
  ]);

  const maxHour = Math.max(1, ...hours.map((h) => h.count));
  const subjectNames = subjects.map((s) => s.subject);

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white py-10 px-3">
      <div className="glass mx-auto max-w-5xl rounded-2xl shadow-glass p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gold-400">Analytics</h1>
          <div className="flex items-center gap-4">
            <SubjectFilter subjects={subjectNames} />
            <div className="text-xs text-white/60">
              {fmtDate(weekly.startISO)} – {fmtDate(weekly.endISO)}
            </div>
          </div>
        </div>

        {/* Headline stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Stat
            label={`Drills (this week${subject ? ` • ${subject}` : ""})`}
            value={weekly.total}
          />
          <Stat label="Students" value={weekly.uniqueUsers} />
          <Stat label="Avg / student" value={weekly.avgPerUser} />
        </div>

        {/* Two-up: subjects + time-of-day */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top subjects (7 days) */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold text-white/90 mb-3">Top subjects (7 days)</h2>
            {subjects.length === 0 ? (
              <p className="text-xs text-white/60">No drills yet. Go spark something. 🔥</p>
            ) : (
              <ul className="space-y-2">
                {subjects.map((s) => (
                  <li key={s.subject} className="flex items-center justify-between text-sm">
                    <span className="truncate">{s.subject}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60">
                        {s.drills} drills • {s.users} students
                      </span>
                      <a
                        href={`/drill?topic=${encodeURIComponent(s.subject)}`}
                        className="text-xs px-2 py-1 rounded bg-mint-500 text-ink-900 hover:bg-mint-400"
                        title={`Drill ${s.subject} on the web`}
                      >
                        Web
                      </a>
                      <a
                        href={`https://t.me/${TG_BOT}?start=${encodeURIComponent(
                          `drill_${s.subject}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 rounded bg-plum-400 text-ink-900 hover:bg-plum-500"
                        title={`Open ${s.subject} in Telegram`}
                      >
                        TG
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 text-[11px] text-white/50">
              Tip: use the filter above to see time-of-day just for one subject.
            </div>
          </section>

          {/* Time of day (7 days) */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold text-white/90 mb-3">
              Time of day (7 days{subject ? ` • ${subject}` : ""})
            </h2>
            <div className="h-32 flex items-end gap-1">
              {hours.map(({ hour, count }) => (
                <div key={hour} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-mint-400/80 rounded-t"
                    style={{ height: `${(count / maxHour) * 100 || 0}%` }}
                    title={`${hourLabel(hour)} — ${count} drills${
                      subject ? ` in ${subject}` : ""
                    }`}
                  />
                  <div className="text-[10px] text-white/50 mt-1">
                    {hour % 6 === 0 ? hourLabel(hour) : ""}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-white/50">
              Peak hours help you time nudges and teacher-led sessions.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/5 py-3 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[11px] text-white/60">{label}</div>
    </div>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function hourLabel(h: number) {
  const ampm = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ampm}`;
}
