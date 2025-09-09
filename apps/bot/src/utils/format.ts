// apps/bot/src/utils/format.ts

/** HTML helpers for Telegram parse_mode: "HTML" */
export const html = {
  esc: (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),

  h1: (t: string) => `<b>${t}</b>`,
  h2: (t: string) => `<b>${t}</b>`,

  /** KPI line like: "<b>Score:</b> 78/100" */
  kpi: (label: string, value: string) => `<b>${label}:</b> ${value}`,

  code: (t: string) => `<code>${t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</code>`,

  /** Preformatted block for mono “tables” */
  pre: (t: string) => `<pre>${t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</pre>`,
};
