function ema(values, period) {
  const k = 2 / (period + 1);
  let emaPrev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [emaPrev];
  for (let i = period; i < values.length; i++) {
    emaPrev = values[i] * k + emaPrev * (1 - k);
    out.push(emaPrev);
  }
  return out;
}

function rsi(values, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Returns a simple human-readable signal summary for a price series
function summarize(prices) {
  if (prices.length < 55) {
    return { text: 'Not enough price history yet for a reliable signal.' };
  }
  const ema20 = ema(prices, 20);
  const ema50 = ema(prices, 50);
  const latestEma20 = ema20[ema20.length - 1];
  const latestEma50 = ema50[ema50.length - 1];
  const latestRsi = rsi(prices, 14);
  const trend = latestEma20 > latestEma50 ? 'bullish (EMA20 above EMA50)' : 'bearish (EMA20 below EMA50)';

  let rsiNote = 'neutral';
  if (latestRsi >= 70) rsiNote = 'overbought (>=70)';
  else if (latestRsi <= 30) rsiNote = 'oversold (<=30)';

  return {
    ema20: latestEma20,
    ema50: latestEma50,
    rsi: latestRsi,
    text: `Trend: ${trend}\nRSI(14): ${latestRsi.toFixed(1)} — ${rsiNote}`
  };
}

module.exports = { ema, rsi, summarize };
