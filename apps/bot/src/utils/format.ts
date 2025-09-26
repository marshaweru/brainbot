// apps/bot/src/utils/format.ts

/** HTML helpers for Telegram parse_mode: "HTML" */
export const html = {
  /** Escape unsafe chars (& < >) */
  esc: (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),

  /** Heading styles (Telegram doesn’t support size, so use <b>) */
  h1: (t: string) => `<b>${html.esc(t)}</b>`,
  h2: (t: string) => `<b>${html.esc(t)}</b>`,

  /** KPI line like: "<b>Score:</b> 78/100" */
  kpi: (label: string, value: string | number) =>
    `<b>${html.esc(label)}:</b> ${html.esc(String(value))}`,

  /** Inline code */
  code: (t: string) => `<code>${html.esc(t)}</code>`,

  /** Preformatted block for mono “tables” or structured feedback */
  pre: (t: string) => `<pre>${html.esc(t)}</pre>`,

  /** Italics (for examiner insights, notes, etc.) */
  i: (t: string) => `<i>${html.esc(t)}</i>`,

  /** Link with safe label */
  link: (label: string, url: string) =>
    `<a href="${html.esc(url)}">${html.esc(label)}</a>`,

  /** Bullet point helper */
  li: (t: string) => `• ${html.esc(t)}`,
};
