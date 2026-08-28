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
function asBoolean(value) { return value === true || value === 1 || ['true','1','yes','y','có','co','có mượn bếp','có mượn bếp cồn'].includes(String(value ?? '').trim().toLowerCase()); }
function isStoveRequested(stove, muonBep) { return stove === true || stove === 'true' || stove === 'Có mượn bếp' || muonBep === true || muonBep === 'true' || muonBep === 'Có mượn bếp'; }
function calc(raw, stove) { let items = Array.isArray(raw) ? raw : []; if (typeof raw === 'string') { try { items = JSON.parse(raw); } catch {} } if (!Array.isArray(items) || !items.length) throw Error('Items are required'); let subtotal = 0; const normalized = items.slice(0, 50).map(i => { const name = str(i?.name, 120), qty = Number(i?.qty), price = Number(i?.price); if (!name || !Number.isSafeInteger(qty) || qty < 1 || !Number.isSafeInteger(price) || price < 0) throw Error('Invalid item'); subtotal += qty * price; return { name, qty, price }; }); const stoveFee = stove && subtotal < FREE_THRESHOLD ? STOVE_FEE : 0; return { items: normalized, subtotal, discount: DISCOUNT, stoveIncluded: Boolean(stove), stoveFee, total: Math.max(0, subtotal + stoveFee - DISCOUNT) }; }
function telegram(o) { return [`<b>🔥 ĐƠN HÀNG MỚI #${esc(o.orderCode)}</b>`, `<b>Khách hàng:</b> ${esc(o.name)}`, `<b>Điện thoại:</b> <code>${esc(o.phone)}</code>`, `<b>Địa chỉ:</b> ${esc(o.address)}`, '', '<b>Chi tiết món:</b>', ...o.items.map(i => `• ${esc(i.name)} — ${i.qty} × ${vnd(i.price)}`), '', `TỔNG CỘNG: ${vnd(o.total)}`].join('\n'); }
async function notifyTelegram(o) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) throw Error('Telegram is not configured');
  const text = [
    `🔥 ĐƠN HÀNG MỚI #${esc(o.orderCode)}`,
    `Khách: ${esc(o.name)}`,
    `SĐT: ${esc(o.phone)}`,
    `Địa chỉ: ${esc(o.address)}`,
    '',
    ...o.items.map(i => `• ${esc(i.name)} x${i.qty}: ${vnd(i.price * i.qty)}`),
    '',
    `TỔNG CỘNG: ${vnd(o.total)}`
  ].join('\n');
  const r = await withTimeout(fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
  }), 4000);
  if (!r.ok) throw Error(`Telegram HTTP ${r.status}`);
}
async function notifyEmail(o) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw Error('Email is not configured');
  const nodemailer = require('nodemailer');
  const rows = o.items.map(i => '<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;line-height:1.5">' + esc(i.name) + '</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:14px">' + i.qty + '</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">' + vnd(i.price * i.qty) + '</td></tr>').join('');
  const html = '<div style="box-sizing:border-box;background:#f7f4ef;padding:24px 12px;font-family:Arial,sans-serif;color:#29251f"><div style="box-sizing:border-box;max-width:640px;margin:0 auto;background:#fff;border:1px dashed #c8b9a5;padding:32px 28px"><h1 style="margin:0 0 6px;font-size:24px;line-height:1.25">Đơn hàng mới #' + esc(o.orderCode) + '</h1><p style="margin:0 0 24px;color:#756b60;font-size:14px;line-height:1.5">Thông tin đơn hàng từ ' + esc(o.name) + '</p><h2 style="font-size:16px;margin:0 0 10px">Thông tin khách hàng</h2><div style="padding:16px;background:#faf8f5;border-radius:8px;font-size:14px;line-height:1.6">' + esc(o.name) + '<br>' + esc(o.phone) + '<br>' + esc(o.address) + (o.email ? '<br>' + esc(o.email) : '') + '</div><h2 style="font-size:16px;margin:24px 0 10px">Chi tiết món</h2><table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr><th style="padding:10px 12px;text-align:left;font-size:13px">Món</th><th style="padding:10px 12px;font-size:13px">SL</th><th style="padding:10px 12px;text-align:right;font-size:13px">Thành tiền</th></tr></thead><tbody>' + rows + '</tbody></table><p style="margin:18px 0 0;text-align:right;font-size:16px;font-weight:bold">Tổng cộng: ' + vnd(o.total) + '</p><p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#756b60">Bếp: ' + (o.stoveIncluded ? 'Có mượn bếp' : 'Không mượn bếp') + '</p></div></div>';
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await withTimeout(t.sendMail({ from: process.env.SMTP_USER, to: process.env.STORE_EMAIL || process.env.SMTP_USER, subject: 'Đơn hàng mới #' + o.orderCode + ' - ' + o.name, text: telegram(o), html }), 4000);
}
async function notifySheet(o) {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.GOOGLE_SHEET_URL || GOOGLE_APPS_SCRIPT_URL;
  const stoveText = o.stoveIncluded ? 'Có mượn bếp' : 'Không mượn bếp';
  const payload = { timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), order_code: o.orderCode, cust_order_code: o.orderCode, name: o.name, customer_name: o.name, cust_name: o.name, phone: o.phone, customer_phone: o.phone, cust_phone: o.phone, email: o.email || '', cust_email: o.email || '', address: o.address, customer_address: o.address, cust_address: o.address, items: o.items.map(i => `${i.qty}x ${i.name} (${vnd(i.price * i.qty)})`).join('; '), items_json: JSON.stringify(o.items), stove_included: stoveText, stove: stoveText, muon_bep: stoveText, bep_con: stoveText, stove_text: stoveText, total: o.total, total_price: vnd(o.total), status: 'Chờ xác nhận' };
  const body = JSON.stringify(payload);
  const request = (target, options) => withTimeout(fetch(target, { ...options, redirect: 'follow' }), 10000);
  let r = await request(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
  if (r.status === 405 || r.status === 400) r = await request(`${url}?data=${encodeURIComponent(body)}`, { method: 'GET' });
  const responseText = await r.text();
  let responseBody;
  try { responseBody = JSON.parse(responseText); } catch { responseBody = { success: false, error: responseText || `Sheet HTTP ${r.status}` }; }
  if (!r.ok) throw Object.assign(new Error(`Sheet HTTP ${r.status}`), { responseBody });
  return responseBody;
}
module.exports = async (req, res) => { res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); if (req.method === 'OPTIONS') return res.status(204).end(); if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' }); let o; try { const b = req.body || {}; o = { ...calc(b.items, isStoveRequested(b.stove_included ?? b.stove ?? b.stove_rental, b.muon_bep) || asBoolean(b.bep_con)), name: str(b.name || b.customerName || b.cust_name || b.customer_name, 100), phone: str(b.phone || b.cust_phone, 30), email: str(b.email || b.customer_email || b.cust_email, 254), address: str(b.address || b.customer_address || b.cust_address, 300), orderCode: `LN-${str(b.order_code || b.orderId || b.order_id || b.code, 30).replace(/^#?(?:LN-)+/i, "") || String(Date.now()).slice(-8)}` }; if (!o.name || !o.phone || !o.address) throw Error('Customer information is required'); } catch (e) { return json(res, 400, { success: false, error: e.message }); }
  const results = await Promise.allSettled([notifyTelegram(o), notifyEmail(o), notifySheet(o)]);
  results.forEach((r, i) => { if (r.status === 'rejected') console.error(['Telegram', 'Email', 'Google Sheets'][i] + ' notification failed:', r.reason?.message || r.reason); });
  const sheet = results[2];
  if (sheet.status === 'fulfilled') return json(res, 200, sheet.value);
  if (sheet.reason?.responseBody) return json(res, 200, sheet.reason.responseBody);
  return json(res, 502, { success: false, error: sheet.reason?.message || 'Google Sheets notification failed' });
};
