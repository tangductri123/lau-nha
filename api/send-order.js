'use strict';

const DISCOUNT = 50000;
const STOVE_FEE = 50000;
const FREE_THRESHOLD = 399000;
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbySw5rlJ_JjIKahh6XFjSLn8-WhEzpbXZBnuMvpfbPBWSckmVzBVbaztiHrieIdfakm/exec';
const json = (res, status, body) => res.status(status).json(body);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const vnd = v => new Intl.NumberFormat('vi-VN').format(Math.max(0, Number(v) || 0)) + 'đ';
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
function calc(raw, stove) { let items = Array.isArray(raw) ? raw : []; if (typeof raw === 'string') { try { items = JSON.parse(raw); } catch {} } if (!Array.isArray(items) || !items.length) throw Error('Items are required'); let subtotal = 0; const normalized = items.slice(0, 50).map(i => { const name = str(i?.name, 120), qty = Number(i?.qty), price = Number(i?.price); if (!name || !Number.isSafeInteger(qty) || qty < 1 || !Number.isSafeInteger(price) || price < 0) throw Error('Invalid item'); subtotal += qty * price; return { name, qty, price }; }); const stoveFee = stove && subtotal < FREE_THRESHOLD ? STOVE_FEE : 0; return { items: normalized, subtotal, discount: DISCOUNT, stoveFee, total: Math.max(0, subtotal + stoveFee - DISCOUNT) }; }
function telegram(o) { return [`<b>🔥 ĐƠN HÀNG MỚI #${esc(o.orderCode)}</b>`, `<b>Khách hàng:</b> ${esc(o.name)}`, `<b>Điện thoại:</b> <code>${esc(o.phone)}</code>`, `<b>Địa chỉ:</b> ${esc(o.address)}`, '', '<b>Chi tiết món:</b>', ...o.items.map(i => `• ${esc(i.name)} — ${i.qty} × ${vnd(i.price)}`), '', `TỔNG CỘNG: ${vnd(o.total)}`].join('\n'); }
async function notifyTelegram(o) { if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) throw Error('Telegram is not configured'); const r = await withTimeout(fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: telegram(o), parse_mode: 'HTML' }) }), 4000); if (!r.ok) throw Error(`Telegram HTTP ${r.status}`); }
async function notifyEmail(o) { if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw Error('Email is not configured'); const nodemailer = require('nodemailer'); const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }); await withTimeout(t.sendMail({ from: process.env.SMTP_USER, to: process.env.STORE_EMAIL || process.env.SMTP_USER, subject: `Đơn hàng mới #${o.orderCode} - ${o.name}`, text: telegram(o) }), 4000); }
async function notifySheet(o) {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.GOOGLE_SHEET_URL || GOOGLE_APPS_SCRIPT_URL;
  const payload = { timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' }), order_code: o.orderCode, cust_order_code: o.orderCode, name: o.name, customer_name: o.name, cust_name: o.name, phone: o.phone, customer_phone: o.phone, cust_phone: o.phone, email: o.email || '', cust_email: o.email || '', address: o.address, customer_address: o.address, cust_address: o.address, items: o.items.map(i => `${i.qty}x ${i.name} (${vnd(i.price * i.qty)})`).join('; '), items_json: JSON.stringify(o.items), stove_included: o.stoveFee > 0 ? 'Có mượn bếp' : 'Không mượn bếp', total: o.total, total_price: vnd(o.total), status: 'Chờ xác nhận' };
  const body = JSON.stringify(payload);
  const request = (target, options) => withTimeout(fetch(target, { ...options, redirect: 'follow' }), 10000);
  let r = await request(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
  if (r.status === 405 || r.status === 400) r = await request(`${url}?data=${encodeURIComponent(body)}`, { method: 'GET' });
  if (!r.ok) throw Error(`Sheet HTTP ${r.status}`);
}
module.exports = async (req, res) => { res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); if (req.method === 'OPTIONS') return res.status(204).end(); if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' }); let o; try { const b = req.body || {}; o = { ...calc(b.items, b.stove_included === true), name: str(b.name || b.customerName || b.cust_name || b.customer_name, 100), phone: str(b.phone || b.cust_phone, 30), email: str(b.cust_email, 254), address: str(b.cust_address, 300), orderCode: str(b.order_code, 30) || String(Date.now()).slice(-8) }; if (!o.name || !o.phone || !o.address) throw Error('Customer information is required'); } catch (e) { return json(res, 400, { success: false, error: e.message }); }
  void Promise.allSettled([notifyTelegram(o), notifyEmail(o), notifySheet(o)]).then(results => results.forEach((r, i) => { if (r.status === 'rejected') console.error(['Telegram', 'Email', 'Google Sheets'][i] + ' notification failed:', r.reason?.message || r.reason); })).catch(e => console.error('Notification dispatch failed:', e));
  return json(res, 200, { success: true, orderId: o.orderCode });
};