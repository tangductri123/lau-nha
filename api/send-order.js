'use strict';

const DISCOUNT = 50000;
const STOVE_FEE = 50000;
const FREE_THRESHOLD = 399000;
const MAX_MS = 2500;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5566848105';
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbySw5rlJ_JjIKahh6XFjSLn8-WhEzpbXZBnuMvpfbPBWSckmVzBVbaztiHrieIdfakm/exec';
const SMTP_USER = process.env.SMTP_USER || 'tangductri15@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'jjrpeibdlkdkmfsg';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const ORDER_EMAIL_TO = process.env.ORDER_EMAIL_TO || 'tangductri15@gmail.com';

const str = (value, max) => String(value ?? '').trim().slice(0, max);
const json = (res, status, body) => res.status(status).json(body);
const money = value => new Intl.NumberFormat('vi-VN').format(Math.max(0, Number(value) || 0)) + 'đ';
const timed = promise => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Error('notification timeout')), MAX_MS))]);

function parseItems(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return [{ name: value.trim(), qty: 1, price: 0 }];
  }
  if (value && typeof value === 'object') return [value];
  return [];
}

function normalize(body) {
  const source = body.items ?? body.cart ?? body.order_items ?? body.products ?? body.selectedItems;
  const raw = parseItems(source);
  const items = raw.slice(0, 50).map(item => ({
    name: str(item?.name || item?.title || item?.product_name || item?.description || item, 120) || 'Đơn hàng của khách',
    qty: Math.max(1, Number.isSafeInteger(Number(item?.qty)) ? Number(item.qty) : Number(item?.quantity) || 1),
    price: Math.max(0, Number.isFinite(Number(item?.price)) ? Number(item.price) : Number(item?.amount) || 0)
  }));
  if (!items.length) items.push({ name: 'Đơn hàng (chưa có chi tiết món)', qty: 1, price: 0 });
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const stoveFee = (body.stove_included === true || body.stove === true) && subtotal < FREE_THRESHOLD ? STOVE_FEE : 0;
  return { items, stoveFee, total: Math.max(0, subtotal + stoveFee - DISCOUNT) };
}

function telegram(order) {
  const text = [`Đơn hàng #${order.orderCode}`, `Khách: ${order.name}`, `SĐT: ${order.phone}`, `Địa chỉ: ${order.address}`, ...order.items.map(item => `• ${item.qty}x ${item.name}`), `Tổng: ${money(order.total)}`].join('\n');
  return timed(fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }) }));
}

function sheet(order) {
  return timed(fetch(GOOGLE_APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ timestamp: new Date().toISOString(), order_code: order.orderCode, name: order.name, phone: order.phone, email: order.email, address: order.address, items: order.items.map(item => `${item.qty}x ${item.name} (${money(item.price * item.qty)})`).join('; '), stove_included: order.stoveFee > 0 ? 'Có mượn bếp' : 'Không mượn bếp', total: order.total, total_price: money(order.total), status: 'Chờ xác nhận' }), redirect: 'follow' }));
}

function email(order) {
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true, auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: MAX_MS, greetingTimeout: MAX_MS, socketTimeout: MAX_MS });
  return timed(transport.sendMail({ from: SMTP_USER, to: ORDER_EMAIL_TO, subject: `Đơn hàng mới #${order.orderCode}`, text: `${order.name} ${order.phone} ${order.address}` }));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const order = { ...normalize(body), name: str(body.name || body.customer_name || body.cust_name || body.ten_khach_hang, 100), phone: str(body.phone || body.customer_phone || body.cust_phone || body.so_dien_thoai, 30), email: str(body.email || body.customer_email || body.cust_email, 254), address: str(body.address || body.customer_address || body.cust_address || body.dia_chi, 300), orderCode: str(body.order_code || body.orderId || body.order_id || body.code, 30) || String(Date.now()).slice(-8) };
    const results = await Promise.allSettled([sheet(order), telegram(order), email(order)]);
    console.error('order notification results', results.map(result => result.status));
    return json(res, 200, { success: true, orderId: order.orderCode, order_code: order.orderCode, notifications: results.map(result => result.status === 'fulfilled' ? 'ok' : 'failed') });
  } catch (error) {
    console.error('order handler error', error);
    return json(res, 200, { success: true, orderId: String(Date.now()).slice(-8), notifications: ['failed'], warning: error.message });
  }
};
