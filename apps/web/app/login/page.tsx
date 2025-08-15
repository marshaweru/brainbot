'use client';
import { useEffect } from 'react';

export default function Login() {
  const bot = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || '';
  useEffect(() => {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', bot);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-request-access', 'write');
    s.setAttribute('data-userpic', 'true');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    document.getElementById('tg-login')?.appendChild(s);

    (window as any).onTelegramAuth = (user: any) => {
      fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      }).then(() => (window.location.href = '/dashboard'));
    };
    return () => { (window as any).onTelegramAuth = null; };
  }, [bot]);

  return (
    <main className="grid place-items-center min-h-[60vh]">
      <div className="card max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold text-white">Continue with Telegram</h1>
        <p className="text-gray-300 mt-2">Secure sign-in using your Telegram account.</p>
        <div id="tg-login" className="mt-4" />
        <p className="text-xs text-gray-400 mt-3">
          If you see “Bot domain invalid”, set @BotFather → <code>/setdomain</code> to this site.
        </p>
      </div>
    </main>
  );
}
