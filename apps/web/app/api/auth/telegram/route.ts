import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function checkTelegramAuth(data: Record<string, any>) {
  const token = process.env.TELEGRAM_BOT_TOKEN as string;
  if (!token) return false;
  const secret = crypto.createHash('sha256').update(token).digest();
  const receivedHash = data.hash;

  const entries = Object.entries(data)
    .filter(([k]) => k !== 'hash')
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}=${v}`);
  const dataCheckString = entries.join('\n');

  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return hmac === receivedHash;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!checkTelegramAuth(body)) {
    return NextResponse.json({ ok: false, error: 'invalid hash' }, { status: 401 });
  }
  // TODO: find/create user in DB and set session cookie
  return NextResponse.json({ ok: true });
}
