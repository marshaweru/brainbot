// apps/web/app/api/receipt/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Helper: build base URL from headers (works on localhost + Render)
function baseURL(req: NextRequest) {
  const h = req.headers;
  const forwardedHost = h.get("x-forwarded-host");
  const host = forwardedHost ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  try {
    // Try to reuse your existing receipts feed
    const res = await fetch(`${baseURL(req)}/api/receipts`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (res.ok) {
      const j = await res.json();
      const list: any[] = Array.isArray(j?.receipts) ? j.receipts : [];
      const receipt = list.find((r) => r?.receipt === id || r?.checkoutId === id) || null;

      if (receipt) {
        const out = NextResponse.json({ ok: true, receipt });
        out.headers.set("Cache-Control", "no-store, max-age=0");
        return out;
      }
    }

    // Dev fallback: synthesize a minimal receipt so page doesn’t 404 during demos
    if (process.env.NODE_ENV !== "production") {
      const mock = {
        amount: 1499,
        tier: "Limited-Edition Prep Pass",
        days: 30,
        receipt: id.match(/^[A-Za-z0-9]+$/) ? id : null,
        checkoutId: id.match(/^[A-Za-z0-9]+$/) ? id : null,
        txAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const out = NextResponse.json({ ok: true, receipt: mock });
      out.headers.set("Cache-Control", "no-store, max-age=0");
      return out;
    }

    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server error" }, { status: 500 });
  }
}
