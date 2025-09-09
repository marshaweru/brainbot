# BrainBot — KCSE AI Study App & Telegram Bot

**Gen Z, glassmorphism UI. 3-hour free trial. KCSE-style only.**
- 10 core subjects
- AI red-pen marking
- Voice/photo upload
- M-PESA plans & upgrades

---

## 🚀 Setup

1. Clone/download repo, open in VS Code
2. Copy `.env.example` ➡️ `.env`, fill in your:
   - TELEGRAM_BOT_TOKEN
   - MONGODB_URI
   - OPENAI_API_KEY
   - PAYBILL_NO (default: 4168557)
   - ADMIN_TELEGRAM_ID (for alerts)

---

## 🖥️ Web App

```sh
cd apps/web
npm install
npm run dev
