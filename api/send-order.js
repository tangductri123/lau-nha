'use strict';

const DISCOUNT_VND = 50000;
const STOVE_FEE_VND = 50000;
const STOVE_FREE_THRESHOLD_VND = 399000;
const MAX_BODY_BYTES = 100000;
const DEFAULT_TELEGRAM_BOT_TOKEN = '8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8';
const DEFAULT_TELEGRAM_CHAT_ID = '-5566848105';

function json(res, status, body) { return res.status(status).json(body); }
function cleanText(value, maxLength) { return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''; }
function parsePrice(value) { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 && n <= 100000000 ? n : null; }
function parseQty(value) { const n = Number(value); return Number.isSafeInteger(n) && n >= 1 && n <= 99 ? n : null; }
function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function formatVnd(value) { return new Intl.NumberFormat('vi-VN').format(value) + 'đ'; }
function calculateOrder(items, stoveIncluded) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw new Error('Items are required');
  const normalizedItems = []; let subtotal = 0;
  for (const item of items) {
    const name = cleanText(item && item.name, 120); const qty = parseQty(item && item.qty); const price = parsePrice(item && item.price);
    if (!name || qty === null || price === null) throw new Error('Invalid item');
    subtotal += price * qty; if (!Number.isSafeInteger(subtotal)) throw new Error('Order total is too large');
    normalizedItems.push({ name, qty, price });
  }
  const stoveFee = stoveIncluded && subtotal < STOVE_FREE_THRESHOLD_VND ? STOVE_FEE_VND : 0;
  const discount = subtotal > 0 ? DISCOUNT_VND : 0;
  return { items: normalizedItems, subtotal, stoveFee, discount, total: Math.max(0, subtotal + stoveFee - discount) };
}
function buildTelegramMessage(order) {
  const lines = order.items.map(item => `• ${item.qty}x ${escapeHtml(item.name)} — ${formatVnd(item.price * item.qty)}`);
  return ['🍲 ĐƠN HÀNG MỚI — LẨU NHÀ', `Mã đơn: #LN-${escapeHtml(order.orderCode)}`, `Khách hàng: ${escapeHtml(order.name)}`, `Điện thoại: ${escapeHtml(order.phone)}`, `Email: ${escapeHtml(order.email)}`, `Địa chỉ: ${escapeHtml(order.address)}`, '', 'Chi tiết:', ...lines, `Tạm tính: ${formatVnd(order.subtotal)}`, `Bếp cồn: ${order.stoveFee ? formatVnd(order.stoveFee) : 'Miễn phí/Không mượn'}`, `Giảm giá: -${formatVnd(order.discount)}`, `TỔNG: ${formatVnd(order.total)}`].join('\n');
}
async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }) });
  if (!response.ok) throw new Error(`Telegram returned HTTP ${response.status}: ${(await response.text().catch(() => '')).slice(0, 500)}`);
}
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' });
  try {
    const length = Number(req.headers && req.headers['content-length']); if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(res, 413, { error: 'Request too large' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (cleanText(body.website || body.company || body.honeypot, 200)) return json(res, 400, { error: 'Invalid request' });
    const name = cleanText(body.cust_name, 100); const phone = cleanText(body.cust_phone, 30); const email = cleanText(body.cust_email, 254).toLowerCase(); const address = cleanText(body.cust_address, 300); const orderCode = cleanText(body.order_code, 30) || String(Date.now()).slice(-8);
    if (!name || !/^\+?[0-9 .()\-]{8,30}$/.test(phone) || !/^\S+@\S+\.\S+$/.test(email) || !address) return json(res, 400, { error: 'Invalid customer information' });
    const calculated = calculateOrder(body.items, body.stove_included === true); const order = { ...calculated, name, phone, email, address, orderCode };
    let telegramSent = true; try { await sendTelegramMessage(buildTelegramMessage(order)); } catch (error) { telegramSent = false; console.error('Telegram notification failed:', error.message); }
    return json(res, 200, { success: true, order_code: orderCode, total: order.total, notification_sent: telegramSent });
  } catch (error) { console.error('Order processing error:', error.message); return json(res, 400, { error: error.message === 'Items are required' || error.message === 'Invalid item' ? error.message : 'Unable to process order' }); }
};
