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
function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
function formatVnd(value) { return new Intl.NumberFormat('vi-VN').format(value) + 'đ'; }
function validEmail(value) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(value) && value.length <= 254; }
function normalizePhone(value) { return cleanText(value, 30).replace(/[\\s().-]/g, ''); }
function validVnPhone(value) { const phone = normalizePhone(value); return /^(?:0(?:3|5|7|8|9)\\d{8}|\\+84(?:3|5|7|8|9)\\d{8})$/.test(phone); }
function validAddress(value) { const address = cleanText(value, 300); return address.length >= 8 && /\\p{L}/u.test(address) && /\\d/.test(address); }
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
function formatDate(value) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)); }
function itemRows(order) {
  return order.items.map((item, index) => `<tr style="background:${index % 2 ? '#fffaf5' : '#ffffff'}"><td style="padding:13px 10px;border-bottom:1px solid #eee;color:#222;font-weight:600">${escapeHtml(item.name)}</td><td style="padding:13px 10px;border-bottom:1px solid #eee;text-align:center;color:#555">${item.qty}</td><td style="padding:13px 10px;border-bottom:1px solid #eee;text-align:right;color:#555;white-space:nowrap">${formatVnd(item.price)}</td><td style="padding:13px 10px;border-bottom:1px solid #eee;text-align:right;color:#222;font-weight:600;white-space:nowrap">${formatVnd(item.price * item.qty)}</td></tr>`).join('');
}
function emailHtml(order, customer) {
  const title = customer ? 'Xác nhận đơn hàng' : 'Thông báo đơn hàng mới';
  const stoveText = order.stoveFee ? `Có tính phí: ${formatVnd(order.stoveFee)}` : 'Miễn phí';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f5f3;font-family:Arial,Helvetica,sans-serif;color:#292929"><div style="display:none;max-height:0;overflow:hidden">${title} #${escapeHtml(order.orderCode)} từ LẨU MANG ĐI</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f3;padding:24px 10px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border:1px solid #e7e2dd;border-radius:10px;overflow:hidden"><tr><td style="background:#8d1f1f;padding:28px 30px;color:#fff"><div style="font-size:25px;font-weight:700;letter-spacing:.3px">LẨU MANG ĐI</div><div style="font-size:13px;margin-top:5px;opacity:.9">laumangdi.com</div></td></tr><tr><td style="padding:28px 30px 12px"><h1 style="font-size:22px;margin:0 0 8px;color:#8d1f1f">${title}</h1><p style="margin:0;color:#666;font-size:14px">Cảm ơn bạn đã đặt món tại LẨU MANG ĐI.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;font-size:14px"><tr><td style="padding:5px 0;color:#777">Mã đơn hàng</td><td align="right" style="padding:5px 0;font-weight:700">#${escapeHtml(order.orderCode)}</td></tr><tr><td style="padding:5px 0;color:#777">Ngày đặt</td><td align="right" style="padding:5px 0">${formatDate(order.createdAt)}</td></tr></table></td></tr><tr><td style="padding:8px 30px 18px"><div style="font-size:16px;font-weight:700;color:#8d1f1f;border-bottom:2px solid #f0e2d9;padding-bottom:9px;margin-bottom:8px">Thông tin khách hàng</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px"><tr><td style="padding:6px 0;color:#777;width:145px">Họ tên</td><td style="padding:6px 0">${escapeHtml(order.name)}</td></tr><tr><td style="padding:6px 0;color:#777">Số điện thoại</td><td style="padding:6px 0">${escapeHtml(order.phone)}</td></tr><tr><td style="padding:6px 0;color:#777;vertical-align:top">Địa chỉ giao hàng</td><td style="padding:6px 0">${escapeHtml(order.address)}</td></tr></table></td></tr><tr><td style="padding:8px 30px 22px"><div style="font-size:16px;font-weight:700;color:#8d1f1f;border-bottom:2px solid #f0e2d9;padding-bottom:9px;margin-bottom:10px">Chi tiết đơn hàng</div><table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px"><thead><tr style="background:#f7eee8;color:#6d2820"><th align="left" style="padding:11px 10px;text-align:left">Món / Quy cách</th><th style="padding:11px 10px">Số lượng</th><th style="padding:11px 10px;text-align:right">Đơn giá</th><th style="padding:11px 10px;text-align:right">Thành tiền</th></tr></thead><tbody>${itemRows(order)}</tbody></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;font-size:14px"><tr><td style="padding:5px 0;color:#666">Tạm tính</td><td align="right" style="padding:5px 0">${formatVnd(order.subtotal)}</td></tr><tr><td style="padding:5px 0;color:#666">Giảm giá khai trương</td><td align="right" style="padding:5px 0;color:#26834a">-${formatVnd(order.discount)}${order.discount ? '' : ' (không áp dụng)'}</td></tr><tr><td style="padding:5px 0;color:#666">Mượn bếp cồn / khay nhôm</td><td align="right" style="padding:5px 0">${stoveText}</td></tr><tr><td colspan="2" style="padding-top:14px;border-top:2px solid #eadbd2"></td></tr><tr><td style="padding:8px 0;font-size:18px;font-weight:700;color:#8d1f1f">TỔNG THANH TOÁN</td><td align="right" style="padding:8px 0;font-size:20px;font-weight:700;color:#8d1f1f">${formatVnd(order.total)}</td></tr></table></td></tr><tr><td style="background:#faf7f4;padding:22px 30px;text-align:center;color:#666;font-size:13px;line-height:1.6">Hotline: <strong style="color:#8d1f1f">038 688 6868</strong> · laumangdi.com<br>Thời gian giao hàng dự kiến khoảng 15–30 phút tùy khu vực.<br>Chúc bạn ngon miệng! Cảm ơn bạn đã ủng hộ LẨU MANG ĐI.</td></tr></table></td></tr></table></body></html>`;
}
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
