// apps/bot/src/services/progress-chart.ts

// Color-coded, thinned labels + tiny legend
export function sparkline(nums: number[]): string {
  if (!nums.length) return "—";
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = Math.max(1e-6, max - min);

  const chars = nums.map((n) => {
    const idx = Math.min(7, Math.max(0, Math.floor(((n - min) / range) * 7)));
    return blocks[idx];
  });

  return chars.join("");
}

type LabelSpec = string | { text: string; color?: string; opacity?: number };

export function buildProgressSVG(
  xs: Date[],
  ys: number[],
  opts: {
    title?: string;
    width?: number;
    height?: number;
    labels?: (LabelSpec | null | undefined)[];
    showLabels?: boolean;
    labelEvery?: number; // show every Kth label (default 3)
  } = {}
): Buffer {
  const width = Math.max(320, opts.width ?? 720);
  const height = Math.max(160, opts.height ?? 320);
  const pad = 44;
  const W = width - pad * 2;
  const H = height - pad * 2;

  if (xs.length !== ys.length) throw new Error("xs/ys length mismatch");
  const L = xs.length;
  if (!L) {
    const empty = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#fff"/>
      <text x="50%" y="50%" text-anchor="middle" font-family="Inter, Helvetica, Arial" font-size="14" fill="#666">No data yet</text>
    </svg>`;
    return Buffer.from(empty);
  }

  const tMin = Math.min(...xs.map((d) => d.getTime()));
  const tMax = Math.max(...xs.map((d) => d.getTime()));
  const yMin = 0;
  const yMax = 100;
  const sx = (t: number) => pad + ((t - tMin) / Math.max(1, tMax - tMin)) * W;
  const sy = (y: number) => pad + H - ((y - yMin) / Math.max(1, yMax - yMin)) * H;

  const pts = xs
    .map((d, i) => `${sx(d.getTime()).toFixed(1)},${sy(ys[i]).toFixed(1)}`)
    .join(" ");
  const path = xs
    .map(
      (d, i) =>
        `${i ? "L" : "M"} ${sx(d.getTime()).toFixed(1)} ${sy(ys[i]).toFixed(1)}`
    )
    .join(" ");

  // grid
  const gridY = [0, 25, 50, 75, 100]
    .map((v) => {
      const y = sy(v).toFixed(1);
      return (
        `<line x1="${pad}" y1="${y}" x2="${pad + W}" y2="${y}" stroke="#eee"/>` +
        `<text x="${pad - 8}" y="${Number(y) + 4}" text-anchor="end" font-size="10" fill="#666" font-family="Inter, Helvetica, Arial">${v}</text>`
      );
    })
    .join("");

  const title = opts.title
    ? `<text x="${pad}" y="${pad - 14}" font-size="14" font-weight="600" font-family="Inter, Helvetica, Arial" fill="#111">${escapeXml(
        opts.title
      )}</text>`
    : "";

  const dots = xs
    .map(
      (d, i) =>
        `<circle cx="${sx(d.getTime()).toFixed(1)}" cy="${sy(
          ys[i]
        ).toFixed(1)}" r="2.5" fill="#111"/>`
    )
    .join("");

  // Labels: default dim gray; allow per-label color + thinning
  const showLabels = opts.showLabels !== false;
  let labelsSvg = "";
  let sawColor = false;

  if (showLabels && opts.labels && opts.labels.length === L) {
    const every = Math.max(1, Math.floor(opts.labelEvery ?? 3)); // default 3
    labelsSvg = xs
      .map((d, i) => {
        const spec = opts.labels![i];
        if (!spec || i % every !== 0) return "";
        const lbl = typeof spec === "string" ? { text: spec } : spec;
        const text = (lbl.text || "").toString().trim();
        if (!text) return "";
        const x = sx(d.getTime());
        const y = sy(ys[i]);
        const dy =
          i % 4 === 0 ? -10 : i % 4 === 1 ? -18 : i % 4 === 2 ? 14 : 20;
        const color = lbl.color || "#666";
        const opacity = lbl.opacity ?? (lbl.color ? 0.9 : 0.6);
        if (lbl.color) sawColor = true;
        return `<text x="${x.toFixed(
          1
        )}" y="${(y + dy).toFixed(
          1
        )}" text-anchor="middle" font-size="9" fill="${color}" opacity="${opacity}" font-family="Inter, Helvetica, Arial">${escapeXml(
          text
        )}</text>`;
      })
      .join("");
  }

  // Legend if we saw colored labels (P1/P2/P3)
  const legend = sawColor
    ? [
        { label: "P1", color: "#2563eb" },
        { label: "P2", color: "#16a34a" },
        { label: "P3", color: "#dc2626" },
      ]
        .map((item, idx) => {
          const x = pad + idx * 60;
          const y = pad - 26;
          return (
            `<rect x="${x}" y="${y - 8}" width="8" height="8" rx="2" fill="${
              item.color
            }"/>` +
            `<text x="${x + 12}" y="${y}" font-size="10" fill="#444" font-family="Inter, Helvetica, Arial">${
              item.label
            }</text>`
          );
        })
        .join("")
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#fff"/>
  ${title}
  <g>
    ${legend}
    ${gridY}
    <polyline fill="none" stroke="#111" stroke-width="2" points="${pts}" opacity="0.12"/>
    <path d="${path}" fill="none" stroke="#111" stroke-width="2.5"/>
    ${dots}
    ${labelsSvg}
  </g>
</svg>`;
  return Buffer.from(svg);
}

function escapeXml(s: string) {
  return s.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );
}
