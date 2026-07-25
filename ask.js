const axios = require('axios');

const SYSTEM_PROMPT = `You are a financial information assistant inside a Telegram bot.
Give clear, factual, educational answers about investing, crypto, and personal
finance concepts. You are not a licensed financial advisor: never present a
specific buy/sell/allocation call as certain advice — lay out relevant factors
and let the user decide. Keep answers concise (Telegram messages, not essays).`;

async function askClaude(question) {
  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: question }]
    },
    {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );
  const textBlock = data.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : "Sorry, I couldn't generate a response.";
}

module.exports = { askClaude };
