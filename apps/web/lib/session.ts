// apps/web/lib/session.ts
'use server';

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type SessionPayload = {
  sub: string;              // Telegram ID (stringified)
  username?: string | null; // optional Telegram username
  exp: number;              // unix seconds
};

/* ---------- token utils (same scheme your /api/auth/telegram uses) ---------- */

function b64urlToBuf(s: string) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function verify(token: string): SessionPayload | null {
  const [h, b, sig] = token.split('.');
  if (!h || !b || !sig) return null;

  const secret = process.env.WEB_SESSION_SECRET || '';
  if (!secret) return null;

  const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest();
  const actual = b64urlToBuf(sig);

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(b64urlToBuf(b).toString('utf8')) as SessionPayload;
    if (!payload?.sub || !payload?.exp) return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ------------------------------- public API -------------------------------- */

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get('bb_session')?.value;
  if (!token) return null;
  return verify(token);
}

/**
 * Hard guard: if no session, bounce to /login?redirect=<to>
 * Use inside server components/pages or route handlers.
 */
export async function requireSession(redirectTo = '/dashboard'): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  return session;
}

/**
 * Convenience wrapper for pages: runs your callback only when signed in.
 * Example:
 *   export default async function Page() {
 *     return withSession(async (s) => <div>Hello {s.username}</div>, '/dashboard');
 *   }
 */
export async function withSession<T>(
  cb: (s: SessionPayload) => Promise<T> | T,
  redirectTo = '/dashboard'
): Promise<T> {
  const session = await getSession();
  if (!session) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  return await cb(session);
}
