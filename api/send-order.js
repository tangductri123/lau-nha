'use strict';

const DISCOUNT_VND = 50000;
const STOVE_FEE_VND = 50000;
const STOVE_FREE_THRESHOLD_VND = 399000;
const MAX_BODY_BYTES = 100000;
const DEFAULT_TELEGRAM_BOT_TOKEN = '8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8';
const DEFAULT_TELEGRAM_CHAT_ID = '-5566848105';
const DEFAULT_STORE_EMAIL = 'tangductri15@gmail.com';
const DEFAULT_FROM_EMAIL = 'Lẩu Mang Đi <donhang@laumangdi.com>';

function json(res, status, body) { return res.status(status).json(body); }
function cleanText(value, maxLength) { return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''; }
function parsePrice(value) { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 && n <= 100000000 ? n : null; }
function parseQty(value) { const n = Number(value); return Number.isSafeInteger(n) && n >= 1 && n <= 99 ? n : null; }
function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
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
function itemRows(order) {
  return order.items.map(item => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">${escapeHtml(item.name)}</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center">${item.qty}</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${formatVnd(item.price * item.qty)}</td></tr>`).join('');
}
function emailShell(title, content) {
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#fff8f0;font-family:Arial,sans-serif;color:#30251f"><div style="max-width:640px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px #43210d18"><div style="background:#a52a16;padding:26px 28px;color:#fff"><div style="font-size:25px;font-weight:700">🍲 Lẩu Mang Đi</div><div style="margin-top:8px;opacity:.9">${title}</div></div><div style="padding:28px">${content}</div><div style="padding:18px 28px;background:#fff3e5;color:#795548;font-size:13px">Cảm ơn bạn đã đặt hàng tại Lẩu Mang Đi.</div></div></body></html>`;
}
function buildCustomerEmail(order) {
  const stove = order.stoveFee ? `Bếp cồn: ${formatVnd(order.stoveFee)}` : 'Bếp cồn: Miễn phí';
  return emailShell(`Xác nhận đơn hàng #${escapeHtml(order.orderCode)}`, `<p>Xin chào <strong>${escapeHtml(order.name)}</strong>,</p><p>Lẩu Mang Đi đã nhận được đơn hàng của bạn.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding-bottom:8px">Món</th><th style="padding-bottom:8px">SL</th><th style="text-align:right;padding-bottom:8px">Thành tiền</th></tr></thead><tbody>${itemRows(order)}</tbody></table><p style="line-height:1.8"><strong>Tạm tính:</strong> ${formatVnd(order.subtotal)}<br><strong>Giảm giá:</strong> -${formatVnd(order.discount)}<br><strong>${stove}</strong><br><span style="font-size:20px;color:#a52a16"><strong>Tổng cộng: ${formatVnd(order.total)}</strong></span></p><div style="background:#fff8f0;padding:16px;border-radius:10px;line-height:1.8"><strong>Giao đến:</strong> ${escapeHtml(order.address)}<br><strong>Số điện thoại:</strong> ${escapeHtml(order.phone)}${order.notes ? `<br><strong>Ghi chú:</strong> ${escapeHtml(order.notes)}` : ''}</div><p>Nhân viên sẽ liên hệ để xác nhận. Nếu có bếp, vui lòng chuẩn bị mặt bằng; thời gian setup dự kiến khoảng 15 phút.</p>`);
}
function buildStoreEmail(order) {
  return emailShell(`🔥 Đơn hàng mới #${escapeHtml(order.orderCode)} - ${escapeHtml(order.name)} (${formatVnd(order.total)})`, `<h2 style="margin-top:0;color:#a52a16">🔥 Đơn hàng mới</h2><div style="line-height:1.9"><strong>Khách hàng:</strong> ${escapeHtml(order.name)}<br><strong>Điện thoại:</strong> ${escapeHtml(order.phone)}<br><strong>Địa chỉ:</strong> ${escapeHtml(order.address)}<br><strong>Email:</strong> ${escapeHtml(order.email)}<br><strong>Bếp cồn:</strong> ${order.stoveFee ? `Có - ${formatVnd(order.stoveFee)}` : 'Không/miễn phí'}${order.notes ? `<br><strong>Ghi chú:</strong> ${escapeHtml(order.notes)}` : ''}<br><strong>Thời gian:</strong> ${escapeHtml(order.createdAt)}</div><hr style="border:0;border-top:1px solid #eee;margin:20px 0"><table style="width:100%;border-collapse:collapse"><tbody>${itemRows(order)}</tbody></table><p style="text-align:right;font-size:20px;color:#a52a16"><strong>Tổng: ${formatVnd(order.total)}</strong></p>`);
}
async function sendResendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.FROM_EMAIL || DEFAULT_FROM_EMAIL, to: [to], subject, html }) });
  if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}: ${(await response.text().catch(() => '')).slice(0, 500)}`);
}
function buildTelegramMessage(order) {
  const lines = order.items.map(item => `• ${item.qty}x ${escapeHtml(item.name)} — ${formatVnd(item.price * item.qty)}`);
  return ['🍲 ĐƠN HÀNG MỚI — LẨU NHÀ', `Mã đơn: #LN-${escapeHtml(order.orderCode)}`, `Khách hàng: ${escapeHtml(order.name)}`, `Điện thoại: ${escapeHtml(order.phone)}`, `Email: ${escapeHtml(order.email)}`, `Địa chỉ: ${escapeHtml(order.address)}`, '', 'Chi tiết:', ...lines, `Tạm tính: ${formatVnd(order.subtotal)}`, `Bếp cồn: ${order.stoveFee ? formatVnd(order.stoveFee) : 'Miễn phí/Không mượn'}`, `Giảm giá: -${formatVnd(order.discount)}`, `TỔNG: ${formatVnd(order.total)}`].join('\\n');
}
async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }) });
  if (!response.ok) throw new Error(`Telegram returned HTTP ${response.status}: ${(await response.text().catch(() => '')).slice(0, 500)}`);
}
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end(); if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' });
  try {
    const length = Number(req.headers && req.headers['content-length']); if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(res, 413, { error: 'Request too large' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (cleanText(body.website || body.company || body.honeypot, 200)) return json(res, 400, { error: 'Invalid request' });
    const name = cleanText(body.cust_name, 100); const phone = cleanText(body.cust_phone, 30); const email = cleanText(body.cust_email, 254).toLowerCase(); const address = cleanText(body.cust_address, 300); const notes = cleanText(body.notes || body.cust_notes, 500); const orderCode = cleanText(body.order_code, 30) || String(Date.now()).slice(-8);
    if (!name || !/^\\+?[0-9 .()\\-]{8,30}$/.test(phone) || !/^\\S+@\\S+\\.\\S+$/.test(email) || !address) return json(res, 400, { error: 'Invalid customer information' });
    const calculated = calculateOrder(body.items, body.stove_included === true); const order = { ...calculated, name, phone, email, address, notes, orderCode, createdAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) };
    const telegramPromise = sendTelegramMessage(buildTelegramMessage(order));
    const customerEmailPromise = sendResendEmail(order.email, `[Lẩu Mang Đi] Xác nhận đơn hàng #${order.orderCode}`, buildCustomerEmail(order));
    const storeEmailPromise = sendResendEmail(process.env.STORE_EMAIL || DEFAULT_STORE_EMAIL, `🔥 Đơn hàng mới #${order.orderCode} - ${order.name} (${order.total.toLocaleString('vi-VN')}đ)`, buildStoreEmail(order));
    const [telegramResult, customerResult, storeResult] = await Promise.allSettled([telegramPromise, customerEmailPromise, storeEmailPromise]);
    if (telegramResult.status === 'rejected') console.error('Telegram notification failed:', telegramResult.reason.message);
    if (customerResult.status === 'rejected') console.error('Customer email failed:', customerResult.reason.message);
    if (storeResult.status === 'rejected') console.error('Store email failed:', storeResult.reason.message);
    return json(res, 200, { success: true, order_code: orderCode, total: order.total, notification_sent: telegramResult.status === 'fulfilled', email_sent: customerResult.status === 'fulfilled' && storeResult.status === 'fulfilled' });
  } catch (error) { console.error('Order processing error:', error.message); return json(res, 400, { error: error.message === 'Items are required' || error.message === 'Invalid item' ? error.message : 'Unable to process order' }); }
};
