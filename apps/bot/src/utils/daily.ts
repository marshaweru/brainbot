export const TZ = 'Africa/Nairobi';
export function nairobiDate(d: Date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); }
export function fmtDate(d: Date) {
  return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric', timeZone: TZ });
}
export async function ensureDailyReset(usersCol: any, user: any) {
  const today = nairobiDate(); if (user?.daily?.date === today) return false;
  await usersCol.updateOne({ telegramId: user.telegramId },
    { $set: { 'daily.date': today, 'daily.minutesUsed': 0, 'daily.subjectsDone': 0, updatedAt: new Date() } });
  return true;
}
