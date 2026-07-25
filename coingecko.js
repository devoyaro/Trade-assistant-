const axios = require('axios');

const BASE = 'https://api.coingecko.com/api/v3';

// Map common tickers to CoinGecko ids. Extend this as needed.
const SYMBOL_TO_ID = {
  celo: 'celo',
  stcelo: 'stcelo',
  usdt: 'tether',
  wbtc: 'wrapped-bitcoin',
  weth: 'weth',
  btc: 'bitcoin',
  eth: 'ethereum',
  gooddollar: 'gooddollar'
};

function toId(symbol) {
  const s = symbol.toLowerCase();
  return SYMBOL_TO_ID[s] || s;
}

async function getPrice(symbol) {
  const id = toId(symbol);
  const { data } = await axios.get(`${BASE}/simple/price`, {
    params: { ids: id, vs_currencies: 'usd' }
  });
  const entry = data[id];
  if (!entry) throw new Error(`No price found for "${symbol}"`);
  return entry.usd;
}

async function getPrices(symbols) {
  const ids = [...new Set(symbols.map(toId))].join(',');
  const { data } = await axios.get(`${BASE}/simple/price`, {
    params: { ids, vs_currencies: 'usd' }
  });
  const out = {};
  for (const s of symbols) {
    const id = toId(s);
    out[s] = data[id] ? data[id].usd : null;
  }
  return out;
}

// Daily closing prices for the last `days` days, used for EMA/RSI signals
async function getHistory(symbol, days = 60) {
  const id = toId(symbol);
  const { data } = await axios.get(`${BASE}/coins/${id}/market_chart`, {
    params: { vs_currency: 'usd', days }
  });
  // data.prices = [[timestamp, price], ...]
  return data.prices.map(p => p[1]);
}

module.exports = { getPrice, getPrices, getHistory, toId };
