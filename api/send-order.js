'use strict';

const DISCOUNT = 50000;
const STOVE_FEE = 50000;
const FREE_THRESHOLD = 399000;
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbySw5rlJ_JjIKahh6XFjSLn8-WhEzpbXZBnuMvpfbPBWSckmVzBVbaztiHrieIdfakm/exec';
const json = (res, status, body) => res.status(status).json(body);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const vnd = v => new Intl.NumberFormat('vi-VN').format(Math.max(0, Number(v) || 0)) + 'đ';
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms))]);

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (error) { throw Error(`Invalid JSON body: ${error.message}`); }
  }
  return {};
}

function calc(raw, stove) {
  let items = Array.isArray(raw) ? raw : [];
  if (typeof raw === 'string') { try { items = JSON.parse(raw); } catch {} }
  if (!Array.isArray(items) || !items.length) throw Error('Items are required');
  let subtotal = 0;
  const normalized = items.slice(0, 50).map(i => {
    const name = str(i?.name, 120), qty = Number(i?.qty), price = Number(i?.price);
    if (!name || !Number.isSafeInteger(qty) || qty < 1 || !Number.isSafeInteger(price) || price < 0) throw Error('Invalid item');
    subtotal += qty * price;
    return { name, qty, price };
  });
  const stoveFee = stove && subtotal < FREE_THRESHOLD ? STOVE_FEE : 0;
  return { items: normalized, subtotal, discount: DISCOUNT, stoveFee, total: Math.max(0, subtotal + stoveFee - DISCOUNT) };
}

function telegram(o) {
  return [`<b>🔥 ĐƠN HÀNG MỚI #${esc(o.orderCode)}</b>`, `<b>Khách hàng:</b> ${esc(o.name)}`, `<b>Điện thoại:</b> <code>${esc(o.phone)}</code>`, `<b>Địa chỉ:</b> ${esc(o.address)}`, '', '<b>Chi tiết món:</b>', ...o.items.map(i => `• ${esc(i.name)} — ${i.qty} × ${vnd(i.price)}`), '', `<b>TỔNG CỘNG: ${vnd(o.total)}</b>`].join('\n');
}

async function notifyTelegram(o) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw Error('Telegram is not configured (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing)');
  const r = await withTimeout(fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: telegram(o), parse_mode: 'HTML' }) }), 10000);
  const responseText = await r.text();
  console.log('[Telegram] HTTP', r.status, responseText.slice(0, 500));
  if (!r.ok) throw Error(`Telegram HTTP ${r.status}: ${responseText.slice(0, 300)}`);
}

async function notifyEmail(o) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw Error('Email is not configured (SMTP_USER or SMTP_PASS missing)');
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const info = await withTimeout(transport.sendMail({ from: process.env.SMTP_USER, to: process.env.STORE_EMAIL || process.env.SMTP_USER, subject: `Đơn hàng mới #${o.orderCode} - ${o.name}`, text: telegram(o) }), 10000);
  console.log('[Email] accepted', info.accepted, 'messageId', info.messageId);
}

async function notifySheet(o) {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.GOOGLE_SHEET_URL || GOOGLE_APPS_SCRIPT_URL;
  const payload = { timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' }), order_code: o.orderCode, cust_order_code: o.orderCode, name: o.name, customer_name: o.name, cust_name: o.name, phone: o.phone, customer_phone: o.phone, cust_phone: o.phone, email: o.email || '', cust_email: o.email || '', address: o.address, customer_address: o.address, cust_address: o.address, items: o.items.map(i => `${i.qty}x ${i.name} (${vnd(i.price * i.qty)})`).join('; '), items_json: JSON.stringify(o.items), stove_included: o.stoveFee > 0 ? 'Có mượn bếp' : 'Không mượn bếp', total: o.total, total_price: vnd(o.total), status: 'Chờ xác nhận' };
  const body = JSON.stringify(payload);
  const r = await withTimeout(fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' }, body, redirect: 'follow' }), 15000);
  const responseText = await r.text();
  console.log('[Google Sheets] HTTP', r.status, responseText.slice(0, 500));
  if (!r.ok) throw Error(`Google Sheets HTTP ${r.status}: ${responseText.slice(0, 300)}`);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' });

  let o;
  try {
    const b = parseBody(req);
    console.log('[Order] received body type:', typeof req.body, 'keys:', Object.keys(b));
    o = { ...calc(b.items, b.stove_included === true), name: str(b.name || b.customerName || b.cust_name || b.customer_name, 100), phone: str(b.phone || b.cust_phone || b.customer_phone, 30), email: str(b.email || b.cust_email || b.customer_email, 254), address: str(b.address || b.cust_address || b.customer_address, 300), orderCode: str(b.order_code || b.orderCode, 30) || String(Date.now()).slice(-8) };
    if (!o.name || !o.phone || !o.address) throw Error('Customer information is required');
    console.log('[Order] validated', { orderCode: o.orderCode, itemCount: o.items.length, total: o.total });
  } catch (e) {
    console.error('[Order] validation failed:', e);
    return json(res, 400, { success: false, error: e.message });
  }

  const jobs = [notifyTelegram(o), notifyEmail(o), notifySheet(o)];
  const results = await Promise.allSettled(jobs);
  results.forEach((result, i) => console.log(`[${['Telegram', 'Email', 'Google Sheets'][i]}]`, result.status === 'fulfilled' ? 'completed' : `failed: ${result.reason?.message || result.reason}`));
  const failed = results.filter(r => r.status === 'rejected').length;
  return json(res, 200, { success: true, orderId: o.orderCode, notifications: { attempted: results.length, failed } });
};