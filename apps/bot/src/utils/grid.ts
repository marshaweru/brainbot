// apps/bot/src/utils/grid.ts

// Mono “table” (box drawing). Looks crisp on Telegram mobile/desktop.
type Cell = string | number;
type Row = Cell[];

const pad = (s: Cell, n: number) => String(s).padEnd(n, " ");

export function monoGrid(headers: Row, rows: Row[]): string {
  const cols = headers.length;
  const all = [headers, ...rows];

  const widths = Array.from({ length: cols }, (_, j) =>
    Math.max(...all.map((r) => String(r[j] ?? "").length), 3)
  );

  const line = (l: string, m: string, r: string, h: string) =>
    l + widths.map((w) => h.repeat(w + 2)).join(m) + r;

  const top = line("┌", "┬", "┐", "─");
  const mid = line("├", "┼", "┤", "─");
  const bottom = line("└", "┴", "┘", "─");

  const fmt = (r: Row) =>
    "│" + r.map((c, i) => " " + pad(c, widths[i]) + " ").join("│") + "│";

  return [top, fmt(headers), mid, ...rows.map(fmt), bottom].join("\n");
}
