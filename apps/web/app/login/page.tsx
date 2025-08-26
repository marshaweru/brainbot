// apps/web/app/login/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import TelegramLoginButton from "@/components/TelegramLoginButton";

export const metadata: Metadata = { title: "Login • BrainBot" };

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl bg-slate-900/40 p-8 shadow">
          <h1 className="text-2xl font-semibold mb-4">You’re in ✅</h1>
          <p className="mb-6">Head to your space to see study packs and PDFs.</p>
          <Link
            className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-black"
            href="/dashboard"
          >
            Go to My Space
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-2xl bg-slate-900/40 p-8 shadow">
        <h1 className="text-2xl font-semibold mb-2">Continue with Telegram</h1>
        <p className="text-slate-400 mb-6">
          Secure sign-in using your Telegram account.
          {process.env.NEXT_PUBLIC_TG_BOT_USERNAME ? "" : " (Set NEXT_PUBLIC_TG_BOT_USERNAME in .env.local)"}
        </p>

        <TelegramLoginButton />

        <p className="mt-6 text-sm text-slate-500">
          Seeing “Bot domain invalid”? Set your site domain at <code>@BotFather → /setdomain</code> to your production
          origin (e.g. <code>https://brainbot.xyz</code>).
        </p>
      </div>
    </main>
  );
}
