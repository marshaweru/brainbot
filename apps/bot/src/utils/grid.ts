// apps/bot/src/utils/grid.ts
import { html } from "./format.js";

type Cell = string | number | null | undefined;
type Row = Cell[];

const str = (c: Cell) => (c == null ? "" : String(c));
const padRight = (s: string, n: number) => s.padEnd(n, " ");
const padLeft = (s: string, n: number) => s.padStart(n, " ");

/** Render a crisp mono box-drawn table for Telegram <pre> blocks */
export function monoGrid(headers: Row, rows: Row[], opts?: { title?: string; alignRight?: number[] }): string {
  const cols = headers.length;
  const all = [headers, ...rows];

  const widths = Array.from({ length: cols }, (_, j) =>
    Math.max(...all.map((r) => str(r[j]).length), 3)
  );

  const line = (l: string, m: string, r: string, h: string) =>
    l + widths.map((w) => h.repeat(w + 2)).join(m) + r;

  const top = line("┌", "┬", "┐", "─");
  const mid = line("├", "┼", "┤", "─");
  const bottom = line("└", "┴", "┘", "─");

  const fmt = (r: Row) =>
    "│" +
    r
      .map((c, i) => {
        const s = str(c);
        const w = widths[i];
        const isRight = opts?.alignRight?.includes(i);
        const padded = isRight ? padLeft(s, w) : padRight(s, w);
        return " " + padded + " ";
      })
      .join("│") +
    "│";

  const lines = [top, fmt(headers), mid, ...rows.map(fmt), bottom];
  if (opts?.title) lines.unshift(opts.title);

  // Wrap for Telegram safe HTML
  return html.pre(lines.join("\n"));
}
