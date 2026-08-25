'use strict';

const json = (res, status, body) => res.status(status).json(body);
const text = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
const normalizePhone = v => text(v, 30).replace(/[\s().-]/g, '');
const validPhone = v => /^(?:0(?:3|5|7|8|9)\d{8}|\+84(?:3|5|7|8|9)\d{8})$/.test(normalizePhone(v));
const validAddress = v => text(v, 300).length >= 8 && /\p{L}/u.test(v) && /\d/.test(v);
const money = v => Number.isSafeInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100000000 ? Number(v) : null;
const quantity = v => Number.isSafeInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 99 ? Number(v) : null;
const html = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
const formatVnd = v => new Intl.NumberFormat('vi-VN').format(v) + 'đ';

function calculate(items, stoveIncluded) {
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new Error('Items are required');
  let subtotal = 0;
  const normalized = items.map(item => {
    const name = text(item && item.name, 120), qty = quantity(item && item.qty), price = money(item && item.price);
    if (!name || qty === null || price === null) throw new Error('Invalid item');
    subtotal += qty * price;
    return { name, qty, price };
  });
  const stoveFee = stoveIncluded && subtotal < 399000 ? 50000 : 0;
  const discount = subtotal ? 50000 : 0;
  return { items: normalized, subtotal, stoveFee, discount, total: Math.max(0, subtotal + stoveFee - discount) };
}

function emailHtml(order, customer) {
  const items = order.items.map(i => `<li>${html(i.name)} × ${i.qty}: ${formatVnd(i.price * i.qty)}</li>`).join('');
  return `<h2>${customer ? 'Xác nhận đơn hàng' : 'Đơn hàng mới'} #${html(order.orderCode)}</h2><p>Khách hàng: ${html(order.name)}<br>Điện thoại: ${html(order.phone)}<br>Địa chỉ: ${html(order.address)}</p><ul>${items}</ul><p>Tổng thanh toán: <strong>${formatVnd(order.total)}</strong></p>`;
}

async function sendEmail(to, subject, body) {
  try {
    const nodemailer = require('nodemailer');
    const user = process.env.SMTP_USER || 'tangductri15@gmail.com';
    const pass = process.env.SMTP_PASS || 'jjrpeibdlkdkmfsg';
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } });
    await transporter.sendMail({ from: user, to, subject, html: body });
    return { sent: true };
  } catch (err) {
    console.error('Email failed:', err && err.message);
    return { sent: false, email_error: err && err.message };
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' });
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (text(body.website || body.company || body.honeypot, 200)) return json(res, 400, { error: 'Invalid request' });
    const name = text(body.cust_name, 100), phone = text(body.cust_phone, 30), email = text(body.cust_email, 254).toLowerCase(), address = text(body.cust_address, 300), orderCode = text(body.order_code, 30) || String(Date.now()).slice(-8);
    if (!name || !validPhone(phone) || !validEmail(email) || !validAddress(address)) return json(res, 400, { error: 'Invalid customer information' });
    const order = { ...calculate(body.items, body.stove_included === true), name, phone, email, address, orderCode };
    const [customer, store] = await Promise.all([sendEmail(email, `[Lẩu Mang Đi] Xác nhận đơn hàng #${orderCode}`, emailHtml(order, true)), sendEmail(process.env.STORE_EMAIL || 'tangductri15@gmail.com', `🔥 Đơn hàng mới #${orderCode} - ${name}`, emailHtml(order, false))]);
    const errors = [customer, store].filter(r => !r.sent).map(r => r.email_error).filter(Boolean);
    return json(res, 200, { success: true, order_code: orderCode, total: order.total, email_sent: customer.sent && store.sent, ...(errors.length ? { email_error: errors.join('; ') } : {}) });
  } catch (err) {
    console.error('Order processing error:', err && err.stack || err);
    return json(res, 400, { error: err && (err.message === 'Items are required' || err.message === 'Invalid item') ? err.message : 'Unable to process order' });
  }
};
