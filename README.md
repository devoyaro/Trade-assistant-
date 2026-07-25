# Trade-assistant-
# Telegram Financial Adviser Bot

Tracks your CELO/crypto portfolio and NSE stock holdings, sends price alerts,
gives basic EMA/RSI trend signals, and answers general financial questions.

## 1. Create the bot on Telegram
1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, follow the prompts, and copy the token it gives you.

## 2. Set up storage (Supabase)
1. Create a free project at https://supabase.com.
2. Open the SQL Editor and run everything in `schema.sql`.
   - If you already have a `holdings` table from your web Portfolio Intelligence
     Platform, you can point this bot at that same table instead — just make
     sure the column names line up (or adjust `src/db.js`).
3. In Supabase, go to Settings → API and copy the **Project URL** and the
   **service_role key** (not the anon key — the bot needs write access).

## 3. Configure environment variables
Copy `.env.example` to `.env` and fill in:
- `TELEGRAM_BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ANTHROPIC_API_KEY` (optional, only needed for `/ask`)

## 4. Run it locally
```bash
npm install
npm start
```
Message your bot on Telegram and try `/start`.

## 5. Deploy so it runs 24/7
This bot uses long-polling, so it needs a process that stays running (not a
serverless function that sleeps). Easiest free/cheap options:

- **Railway.app** — connect your GitHub repo, add the env vars in the
  dashboard, it builds and runs `npm start` automatically. Has a free tier.
- **Render.com** — create a "Background Worker" (not a Web Service, since
  this bot doesn't listen on a port), add env vars, deploy.
- **Your own VPS** — `pm2 start src/bot.js --name financial-bot` keeps it
  alive across reboots.

Since you weren't sure on hosting yet: Railway is the simplest starting point
— push this folder to a GitHub repo, connect it in Railway, paste in the four
env vars, and it's live in a few minutes.

## Commands
- `/addcrypto <symbol> <qty>` — e.g. `/addcrypto celo 620`
- `/addstock <symbol> <qty> <price>` — e.g. `/addstock kcb 100 42.5`
- `/portfolio` — view holdings and total value
- `/price <symbol>` — current crypto price (CoinGecko)
- `/signal <symbol>` — EMA20/EMA50 trend + RSI(14)
- `/alert <symbol> <above|below> <price>` — price alert, checked every 5 min
- `/ask <question>` — general financial Q&A (Claude-powered)

## Known limitations / next steps
- NSE prices are manual (no reliable free live-price API for the Kenyan
  market) — you re-enter them with `/addstock`. A future version could add
  a scraper for nse.co.ke or a paid data feed.
- `/addstock` currently inserts a new row each time rather than updating
  in place — fine for now, but worth adding an `/updatestock` command.
- Alerts are one-shot (they mark `triggered = true` and stop firing).
- `/signal` uses daily closes only; intraday signals would need Binance
  kline data instead of CoinGecko's `market_chart` endpoint.
  
