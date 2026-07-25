const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function ensureUser(chatId, username) {
  await supabase.from('users').upsert({ chat_id: chatId, username }, { onConflict: 'chat_id' });
}

async function addHolding(chatId, assetType, symbol, quantity, manualPrice = null) {
  return supabase.from('holdings').insert({
    chat_id: chatId,
    asset_type: assetType,
    symbol: symbol.toLowerCase(),
    quantity,
    manual_price: manualPrice
  });
}

async function getHoldings(chatId) {
  const { data, error } = await supabase.from('holdings').select('*').eq('chat_id', chatId);
  if (error) throw error;
  return data;
}

async function addAlert(chatId, symbol, assetType, direction, targetPrice) {
  return supabase.from('alerts').insert({
    chat_id: chatId,
    symbol: symbol.toLowerCase(),
    asset_type: assetType,
    direction,
    target_price: targetPrice
  });
}

async function getActiveAlerts() {
  const { data, error } = await supabase.from('alerts').select('*').eq('triggered', false);
  if (error) throw error;
  return data;
}

async function markAlertTriggered(id) {
  return supabase.from('alerts').update({ triggered: true }).eq('id', id);
}

module.exports = {
  supabase,
  ensureUser,
  addHolding,
  getHoldings,
  addAlert,
  getActiveAlerts,
  markAlertTriggered
};
