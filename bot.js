require('dotenv').config();
const { Telegraf } = require('telegraf');
const cron = require('node-cron');

const db = require('./db');
const { getPrice, getPrices, getHistory } = require('./coingecko');
const { summarize } = require('./signals');
const { askClaude } = require('./ask');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ---------- /start ----------
bot.start(async (ctx) => {
  await db.ensureUser(ctx.chat.id, ctx.from.username || ctx.from.first_name);
  await ctx.reply(
    "Hey! I'm your financial adviser bot.\n\n" +
    'Commands:\n' +
    '/addcrypto <symbol> <qty> — track a crypto holding (e.g. /addcrypto celo 620)\n' +
    '/addstock <symbol> <qty> <price> — track an NSE stock (e.g. /addstock kcb 100 42.5)\n' +
    '/portfolio — view your holdings and total value\n' +
    '/price <symbol> — current crypto price\n' +
    '/signal <symbol> — EMA/RSI trend signal\n' +
    '/alert <symbol> <above|below> <price> — get notified when price crosses a level\n' +
    '/ask <question> — general financial Q&A\n\n' +
    "This is informational only, not licensed financial advice."
  );
});

// ---------- /addcrypto ----------
bot.command('addcrypto', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  if (parts.length < 2) return ctx.reply('Usage: /addcrypto <symbol> <quantity>');
  const [symbol, qty] = parts;
  await db.ensureUser(ctx.chat.id, ctx.from.username);
  await db.addHolding(ctx.chat.id, 'crypto', symbol, parseFloat(qty));
  ctx.reply(`Added ${qty} ${symbol.toUpperCase()} to your crypto holdings.`);
});

// ---------- /addstock ----------
bot.command('addstock', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  if (parts.length < 3) return ctx.reply('Usage: /addstock <symbol> <quantity> <price>');
  const [symbol, qty, price] = parts;
  await db.ensureUser(ctx.chat.id, ctx.from.username);
  await db.addHolding(ctx.chat.id, 'stock', symbol, parseFloat(qty), parseFloat(price));
  ctx.reply(
    `Added ${qty} shares of ${symbol.toUpperCase()} at KES ${price}.\n` +
    `NSE has no reliable free live-price API, so update the price yourself with ` +
    `/addstock again (it adds a new row — we can switch this to an update-in-place ` +
    `command once you're ready).`
  );
});

// ---------- /portfolio ----------
bot.command('portfolio', async (ctx) => {
  const holdings = await db.getHoldings(ctx.chat.id);
  if (!holdings.length) return ctx.reply('No holdings yet. Add some with /addcrypto or /addstock.');

  const cryptoHoldings = holdings.filter(h => h.asset_type === 'crypto');
  const stockHoldings = holdings.filter(h => h.asset_type === 'stock');

  let total = 0;
  let lines = [];

  if (cryptoHoldings.length) {
    const prices = await getPrices(cryptoHoldings.map(h => h.symbol));
    lines.push('Crypto:');
    for (const h of cryptoHoldings) {
      const price = prices[h.symbol];
      const value = price ? price * h.quantity : null;
      if (value) total += value;
      lines.push(
        `  ${h.symbol.toUpperCase()}: ${h.quantity} × $${price ?? '?'} = $${value ? value.toFixed(2) : 'n/a'}`
      );
    }
  }

  if (stockHoldings.length) {
    lines.push('NSE Stocks (manual prices):');
    for (const h of stockHoldings) {
      const value = h.manual_price ? h.manual_price * h.quantity : null;
      if (value) total += value;
      lines.push(
        `  ${h.symbol.toUpperCase()}: ${h.quantity} × KES ${h.manual_price ?? '?'} = KES ${value ? value.toFixed(2) : 'n/a'}`
      );
    }
  }

  lines.push(`\nApprox total (mixed currencies, treat as rough): ${total.toFixed(2)}`);
  ctx.reply(lines.join('\n'));
});

// ---------- /price ----------
bot.command('price', async (ctx) => {
  const symbol = ctx.message.text.split(' ')[1];
  if (!symbol) return ctx.reply('Usage: /price <symbol>');
  try {
    const price = await getPrice(symbol);
    ctx.reply(`${symbol.toUpperCase()}: $${price}`);
  } catch (e) {
    ctx.reply(`Couldn't find a price for "${symbol}". Try a well-known ticker like celo, btc, eth.`);
  }
});

// ---------- /signal ----------
bot.command('signal', async (ctx) => {
  const symbol = ctx.message.text.split(' ')[1];
  if (!symbol) return ctx.reply('Usage: /signal <symbol>');
  try {
    const history = await getHistory(symbol, 90);
    const result = summarize(history);
    ctx.reply(`${symbol.toUpperCase()} signal:\n${result.text}\n\n(Educational only — not a trade recommendation.)`);
  } catch (e) {
    ctx.reply(`Couldn't fetch history for "${symbol}".`);
  }
});

// ---------- /alert ----------
bot.command('alert', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  if (parts.length < 3) return ctx.reply('Usage: /alert <symbol> <above|below> <price>');
  const [symbol, direction, price] = parts;
  if (!['above', 'below'].includes(direction)) return ctx.reply('Direction must be "above" or "below".');
  await db.ensureUser(ctx.chat.id, ctx.from.username);
  await db.addAlert(ctx.chat.id, symbol, 'crypto', direction, parseFloat(price));
  ctx.reply(`Alert set: notify me when ${symbol.toUpperCase()} goes ${direction} $${price}.`);
});

// ---------- /ask ----------
bot.command('ask', async (ctx) => {
  const question = ctx.message.text.split(' ').slice(1).join(' ');
  if (!question) return ctx.reply('Usage: /ask <your question>');
  if (!process.env.ANTHROPIC_API_KEY) return ctx.reply('Q&A is not configured yet (missing ANTHROPIC_API_KEY).');
  await ctx.sendChatAction('typing');
  try {
    const answer = await askClaude(question);
    ctx.reply(answer);
  } catch (e) {
    ctx.reply('Sorry, something went wrong answering that.');
  }
});

// ---------- Alert checker (every 5 minutes) ----------
cron.schedule('*/5 * * * *', async () => {
  try {
    const alerts = await db.getActiveAlerts();
    if (!alerts.length) return;
    const symbols = [...new Set(alerts.map(a => a.symbol))];
    const prices = await getPrices(symbols);

    for (const alert of alerts) {
      const price = prices[alert.symbol];
      if (price == null) continue;
      const hit =
        (alert.direction === 'above' && price >= alert.target_price) ||
        (alert.direction === 'below' && price <= alert.target_price);
      if (hit) {
        await bot.telegram.sendMessage(
          alert.chat_id,
          `🔔 ${alert.symbol.toUpperCase()} is now $${price}, crossing your ${alert.direction} ${alert.target_price} alert.`
        );
        await db.markAlertTriggered(alert.id);
      }
    }
  } catch (e) {
    console.error('Alert check failed:', e.message);
  }
});

bot.launch();
console.log('Bot running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
