'use strict';

const DISCOUNT = 50000;
const STOVE_FEE = 50000;
const FREE_THRESHOLD = 399000;
const NOTIFY_TIMEOUT_MS = 4000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5566848105';
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbySw5rlJ_JjIKahh6XFjSLn8-WhEzpbXZBnuMvpfbPBWSckmVzBVbaztiHrieIdfakm/exec';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_USER = process.env.SMTP_USER || 'tangductri15@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'jjrpeibdlkdkmfsg';
const ORDER_EMAIL_TO = process.env.ORDER_EMAIL_TO || 'tangductri15@gmail.com';
const json = (res, status, body) => res.status(status).json(body);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
const vnd = v => new Intl.NumberFormat('vi-VN').format(Math.max(0, Number(v) || 0)) + 'đ';
const withTimeout = (promise, ms = NOTIFY_TIMEOUT_MS) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms))]);

function calc(raw, stove) {
  const items = Array.isArray(raw) ? raw : [];
  if (!items.length) throw Error('Items are required');
  let subtotal = 0;
  const normalized = items.slice(0, 50).map(i => {
    const name = str(i?.name, 120), qty = Number(i?.qty), price = Number(i?.price);
    if (!name || !Number.isSafeInteger(qty) || qty < 1 || !Number.isSafeInteger(price) || price < 0) throw Error('Invalid item');
    subtotal += qty * price;
    return { name, qty, price };
  });
  const stoveFee = stove && subtotal < FREE_THRESHOLD ? STOVE_FEE : 0;
  return { items: normalized, stoveFee, total: Math.max(0, subtotal + stoveFee - DISCOUNT) };
}

function telegram(o) {
  return [`<b>🔥 ĐƠN HÀNG MỚI #${esc(o.orderCode)}</b>`, `<b>Khách hàng:</b> ${esc(o.name)}`, `<b>Điện thoại:</b> <code>${esc(o.phone)}</code>`, `<b>Địa chỉ:</b> ${esc(o.address)}`, '', '<b>Chi tiết món:</b>', ...o.items.map(i => `• ${esc(i.name)} — ${i.qty} × ${vnd(i.price)}`), '', `<b>TỔNG CỘNG: ${vnd(o.total)}</b>`].join('\n');
}

function parchmentEmail(o) {
  const rows = o.items.map(i => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#333">${esc(i.name)}</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;color:#333">${i.qty}</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;color:#333">${vnd(i.price * i.qty)}</td></tr>`).join('');
  return `<div style="background:#f4efe5;padding:24px;font-family:Georgia,serif;color:#2d241c"><div style="max-width:620px;margin:auto;background:#fffdf7;padding:28px;border:1px solid #d8c8ad;box-shadow:0 2px 8px #c8b99d"><h1 style="margin:0 0 6px;color:#6b4226;font-size:25px">🔥 Đơn hàng mới #${esc(o.orderCode)}</h1><p style="margin:0 0 22px;color:#806b55">Lẩu Nhà · Xác nhận đơn hàng</p><p><b>Khách hàng:</b> ${esc(o.name)}<br><b>Điện thoại:</b> ${esc(o.phone)}<br><b>Địa chỉ:</b> ${esc(o.address)}${o.email ? `<br><b>Email:</b> ${esc(o.email)}` : ''}</p><table style="width:100%;border-collapse:collapse;margin-top:20px"><thead><tr><th style="text-align:left;border-bottom:2px solid #8b6a47;padding:8px 0">Món</th><th style="border-bottom:2px solid #8b6a47;padding:8px 0">SL</th><th style="text-align:right;border-bottom:2px solid #8b6a47;padding:8px 0">Thành tiền</th></tr></thead><tbody>${rows}</tbody></table><p style="text-align:right;font-size:20px;color:#6b4226"><b>TỔNG CỘNG: ${vnd(o.total)}</b></p></div></div>`;
}

async function notifyTelegram(o) {
  return withTimeout(fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: telegram(o), parse_mode: 'HTML' }) }));
}
async function notifySheet(o) {
  return withTimeout(fetch(GOOGLE_APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' }, body: JSON.stringify({ timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' }), order_code: o.orderCode, name: o.name, phone: o.phone, email: o.email || '', address: o.address, items: o.items.map(i => `${i.qty}x ${i.name} (${vnd(i.price * i.qty)})`).join('; '), stove_included: o.stoveFee > 0 ? 'Có mượn bếp' : 'Không mượn bếp', total: o.total, total_price: vnd(o.total), status: 'Chờ xác nhận' }), redirect: 'follow' }));
}
async function notifyEmail(o) {
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: NOTIFY_TIMEOUT_MS, greetingTimeout: NOTIFY_TIMEOUT_MS, socketTimeout: NOTIFY_TIMEOUT_MS });
  return withTimeout(transport.sendMail({ from: SMTP_USER, to: ORDER_EMAIL_TO, subject: `Đơn hàng mới #${o.orderCode} - ${o.name}`, text: telegram(o), html: parchmentEmail(o) }));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const o = { ...calc(b.items, b.stove_included === true || b.stove === true), name: str(b.name || b.customer_name || b.customerName, 100), phone: str(b.phone || b.customer_phone || b.cust_phone, 30), email: str(b.email || b.customer_email || b.cust_email, 254), address: str(b.address || b.customer_address || b.cust_address, 300), orderCode: str(b.order_code || b.orderId || b.orderCode, 30) || String(Date.now()).slice(-8) };
    if (!o.name || !o.phone || !o.address) throw Error('Customer information is required');
    o.createdAt = new Date().toISOString();
    const results = await Promise.allSettled([notifyTelegram(o), notifyEmail(o), notifySheet(o)]);
    return json(res, 200, { success: true, orderId: o.orderCode, notifications: results.map(r => r.status === 'fulfilled' ? 'ok' : 'failed') });
  } catch (e) { return json(res, 400, { success: false, error: e.message }); }
};