# BrainBot — Lean Starter (Fresh)

Telegram-first KCSE study assistant with **Tailwind web UI**, **Telegram OAuth**, **M-PESA C2B**, **free 5‑hour intro**, and token budgets baked in.

## Run (PowerShell)
```powershell
pnpm i

# bot
Copy-Item .\apps\bot\.env.example .\apps\bot\.env
# fill TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, MONGODB_URI, MPESA_* and set MPESA_CALLBACK_URL
pnpm --filter @brainbot/bot dev

# web
Copy-Item .\apps\web\.env.local.example .\apps\web\.env.local
# set NEXT_PUBLIC_TG_BOT_USERNAME and TELEGRAM_BOT_TOKEN (server verify)
pnpm --filter @brainbot/web dev
```

## Telegram OAuth
- In @BotFather → `/setdomain` set your public domain (Render or tunnel).
- Visit `/login` to sign in with Telegram. Backend verifies the hash per Telegram spec.

## Token Budgets
- Normal subjects ~**800 tokens** cap per session.
- Languages ≤**1200 tokens** per session.
- Marking feedback ~**500 tokens** cap.
- Daily caps by plan (tokens): Lite/Pro **10k**, Plus **20k**, Ultra **30k**, First100 **15k**.

## M-PESA
- Confirmation: `/api/mpesa/c2b/confirmation` (live URL via Render).
- Plans: Lite 50, Pro 300, Plus 1750, Ultra 2500, Founder 1500 (first 100).
