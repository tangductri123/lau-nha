'use strict';

const DISCOUNT_VND = 50000;
const STOVE_FEE_VND = 50000;
const STOVE_FREE_THRESHOLD_VND = 399000;
const MAX_BODY_BYTES = 100000;
const DEFAULT_STORE_EMAIL = 'tangductri15@gmail.com';
const DEFAULT_SMTP_USER = 'tangductri15@gmail.com';
const DEFAULT_SMTP_PASS = 'jjrpeibdlkdkmfsg';
const DEFAULT_FROM_EMAIL = 'Lẩu Mang Đi <donhang@laumangdi.com>';

function json(res, status, body) { return res.status(status).json(body); }
function cleanText(value, maxLength) { return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''; }
function parsePrice(value) { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 && n <= 100000000 ? n : null; }
function parseQty(value) { const n = Number(value); return Number.isSafeInteger(n) && n >= 1 && n <= 99 ? n : null; }
function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function formatVnd(value) { return new Intl.NumberFormat('vi-VN').format(value) + 'đ'; }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254; }
function normalizePhone(value) { return cleanText(value, 30).replace(/[\s().-]/g, ''); }
function validVnPhone(value) { const phone = normalizePhone(value); return /^(?:0(?:3|5|7|8|9)\d{8}|\+84(?:3|5|7|8|9)\d{8})$/.test(phone); }
function validAddress(value) { const address = cleanText(value, 300); return address.length >= 8 && /\p{L}/u.test(address) && /\d/.test(address); }
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
function itemRows(order) { return order.items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${item.qty}</td><td>${formatVnd(item.price * item.qty)}</td></tr>`).join(''); }
function emailHtml(order, customer) { return `<!doctype html><html lang="vi"><body><h2>${customer ? 'Xác nhận đơn hàng' : 'Đơn hàng mới'} #${escapeHtml(order.orderCode)}</h2><p><strong>Khách hàng:</strong> ${escapeHtml(order.name)}<br><strong>Điện thoại:</strong> ${escapeHtml(order.phone)}<br><strong>Địa chỉ:</strong> ${escapeHtml(order.address)}<br><strong>Email:</strong> ${escapeHtml(order.email)}</p><table><tr><th>Món</th><th>SL</th><th>Thành tiền</th></tr>${itemRows(order)}</table><p>Tạm tính: ${formatVnd(order.subtotal)}<br>Giảm giá: -${formatVnd(order.discount)}<br>Bếp cồn: ${order.stoveFee ? formatVnd(order.stoveFee) : 'Miễn phí'}<br><strong>Tổng: ${formatVnd(order.total)}</strong></p></body></html>`; }
async function sendSmtpEmail(to, subject, html) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER || DEFAULT_SMTP_USER, pass: process.env.SMTP_PASS || DEFAULT_SMTP_PASS } });
  await transporter.sendMail({ from: process.env.FROM_EMAIL || DEFAULT_FROM_EMAIL, to, subject, html });
}
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end(); if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' });
  try {
    const length = Number(req.headers && req.headers['content-length']); if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(res, 413, { error: 'Request too large' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (cleanText(body.website || body.company || body.honeypot, 200)) return json(res, 400, { error: 'Invalid request' });
    const name = cleanText(body.cust_name, 100); const phone = cleanText(body.cust_phone, 30); const email = cleanText(body.cust_email, 254).toLowerCase(); const address = cleanText(body.cust_address, 300); const orderCode = cleanText(body.order_code, 30) || String(Date.now()).slice(-8);
    if (!name || !validVnPhone(phone) || !validEmail(email) || !validAddress(address)) return json(res, 400, { error: 'Invalid customer information' });
    const calculated = calculateOrder(body.items, body.stove_included === true); const order = { ...calculated, name, phone, email, address, orderCode, createdAt: new Date().toISOString() };
    const results = await Promise.allSettled([
      sendSmtpEmail(order.email, `[Lẩu Mang Đi] Xác nhận đơn hàng #${order.orderCode}`, emailHtml(order, true)),
      sendSmtpEmail(process.env.STORE_EMAIL || DEFAULT_STORE_EMAIL, `🔥 Đơn hàng mới #${order.orderCode} - ${order.name}`, emailHtml(order, false))
    ]);
    results.forEach(result => { if (result.status === 'rejected') console.error('Email failed:', result.reason && result.reason.message); });
    return json(res, 200, { success: true, order_code: orderCode, total: order.total, email_sent: results.every(result => result.status === 'fulfilled') });
  } catch (error) { console.error('Order processing error:', error.message); return json(res, 400, { error: error.message === 'Items are required' || error.message === 'Invalid item' ? error.message : 'Unable to process order' }); }
};
