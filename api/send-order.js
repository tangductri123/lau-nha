'use strict';

const DISCOUNT = 50000;
const STOVE_FEE = 50000;
const FREE_THRESHOLD = 399000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5566848105';
const SMTP_USER = process.env.SMTP_USER || 'tangductri15@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'jjrpeibdlkdkmfsg';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'tangductri15@gmail.com';
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbwQpyu6mhMjm4i9Dvg0ao2G8Zzc8RwA5Z_24lxcdqGMaBXlNOD9x7HXjMIWo5QOKAU/exec';
const json = (res, status, body) => res.status(status).json(body);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\"/g, '&quot;').replace(/'/g, '&#039;');
const vnd = v => new Intl.NumberFormat('vi-VN').format(Math.max(0, Number(v) || 0)) + 'đ';
const withTimeout = (promise, ms = 8000) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('notification timeout')), ms))]);
function parseStoveIncluded(body) {
  if (body.stove_included !== undefined) return body.stove_included === true || body.stove_included === 'true';
  if (body.muon_bep !== undefined) return body.muon_bep === true || body.muon_bep === 'true' || body.muon_bep === 'Có mượn bếp';
  if (body.stove !== undefined) return body.stove === true || body.stove === 'true';
  return false;
}
function calc(raw, stove) { let items = Array.isArray(raw) ? raw : []; if (typeof raw === 'string') { try { items = JSON.parse(raw); } catch {} } if (!Array.isArray(items) || !items.length) throw Error('Items are required'); let subtotal = 0; const normalized = items.slice(0, 50).map(i => { const name = str(i?.name || i?.title || i?.product_name, 120), qty = Number(i?.qty ?? i?.quantity), price = Number(i?.price ?? i?.amount); if (!name || !Number.isSafeInteger(qty) || qty < 1 || !Number.isSafeInteger(price) || price < 0) throw Error('Invalid item'); subtotal += qty * price; return { name, qty, price }; }); const stoveFee = stove ? (subtotal < FREE_THRESHOLD ? STOVE_FEE : 0) : 0; return { items: normalized, subtotal, discount: DISCOUNT, stoveIncluded: Boolean(stove), stoveFee, stove_text: stove ? (stoveFee ? vnd(stoveFee) : 'Miễn phí') : 'Không', total: Math.max(0, subtotal + stoveFee - DISCOUNT) }; }
function notificationText(o) { return [`ĐƠN HÀNG MỚI #${o.orderCode}`, `Khách: ${o.name}`, `SĐT: ${o.phone}`, `Địa chỉ: ${o.address}`, `Mượn bếp: ${o.stoveIncluded ? 'Có mượn bếp' : 'Không'}`, '', ...o.items.map(i => `• ${i.name} x${i.qty}: ${vnd(i.price * i.qty)}`), '', `TỔNG CỘNG: ${vnd(o.total)}`].join('\\n'); }
async function notifyTelegram(o) { const r = await withTimeout(fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: notificationText(o) }) })); if (!r.ok) throw Error(`Telegram HTTP ${r.status}`); }
async function notifyEmail(o) { const nodemailer = require('nodemailer'); const text = notificationText(o); const t = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), secure: String(process.env.SMTP_SECURE || 'true') !== 'false', auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000 }); await withTimeout(t.verify(), 12000); const mail = { from: `LẨU NHÀ <${SMTP_USER}>`, to: o.email || ADMIN_EMAIL, ...(o.email && o.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() ? { cc: ADMIN_EMAIL } : {}), subject: 'Xác nhận đơn hàng #' + o.orderCode + ' - LẨU NHÀ', text }; const info = await withTimeout(t.sendMail(mail), 12000); if (!info?.messageId) throw Error('SMTP accepted no message id'); return { messageId: info.messageId, customer: Boolean(o.email), recipient: mail.to, cc: mail.cc || null }; }
function vietnamTimestamp(date = new Date()) { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).reduce((a, p) => (a[p.type] = p.value, a), {}); return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`; }
async function notifySheet(o) {
  const isStove = Boolean(o.isStove);
  const stoveText = isStove ? 'Có mượn bếp' : 'Không';
  const time = vietnamTimestamp();
  const detail = o.items.map(i => `${i.qty}x ${i.name} (${vnd(i.price * i.qty)})`).join('; ');
  const falseValue = false;
  const falseText = '';
  const row = [time, `#${o.orderCode}`, o.name, o.phone, o.email || '', o.address, detail, stoveText, o.total, 'Chờ xác nhận'];
  const payload = {
    values: [row], row, rowData: row, timestamp: time, order_code: `#${o.orderCode}, name: o.name, phone: o.phone, email: o.email || '', address: o.address, items: detail, items_detail: detail,
    muon_bep: isStove ? 'có' : falseValue, stove: isStove ? 'có' : falseText, stove_text: stoveText,
    bep_con: isStove ? 'có' : falseValue, stove_rental: isStove ? 'có' : falseText, stove_included: isStove,
    total: o.total, total_price: o.total, status: 'Chờ xác nhận'
  };
  const r = await withTimeout(fetch(GOOGLE_APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), redirect: 'follow' }));
  if (!r.ok) throw Error(`Sheet HTTP ${r.status}`);
  return r.json().catch(() => ({}));
}
module.exports = async (req, res) => { res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); if (req.method === 'OPTIONS') return res.status(204).end(); if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' }); let o; try { const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; const isStove = parseStoveIncluded(b); o = { ...calc(b.items, isStove), isStove, name: str(b.name || b.customerName || b.cust_name || b.customer_name, 100), phone: str(b.phone || b.customer_phone || b.cust_phone, 30), email: str(b.email || b.customer_email || b.cust_email, 254), address: str(b.address || b.customer_address || b.cust_address, 300), note: str(b.note || b.notes || b.customer_note, 500), orderCode: `LN-${str(b.order_code || b.orderId || b.order_id || b.code, 30).replace(/^#?(?:LN-)+/i, '') || String(Date.now()).slice(-8)}` }; if (!o.name || !o.phone || !o.address) throw Error('Customer information is required'); } catch (e) { return json(res, 400, { success: false, error: e.message }); } const results = await Promise.allSettled([notifyTelegram(o), notifyEmail(o), notifySheet(o)]); results.forEach((r, i) => { if (r.status === 'rejected') console.error(['Telegram', 'Email', 'Google Sheets'][i] + ' notification failed:', r.reason?.message || r.reason); }); return json(res, 200, { success: true, order_code: o.orderCode, email: results[1].status === 'fulfilled' ? results[1].value : { sent: false, error: results[1].reason?.message || 'Email notification failed' }, ...(results[2].status === 'fulfilled' ? { sheet: results[2].value } : {}) }); };