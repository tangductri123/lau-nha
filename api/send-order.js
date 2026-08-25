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
function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\"/g, '&quot;').replace(/'/g, '&#039;'); }
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
function itemRows(order) { return order.items.map((item, index) => `<tr style="background:${index % 2 ? '#fff' : '#fafafa'}"><td style="padding:9px 10px;border:1px solid #e5e7eb;color:#222;font-weight:600">${escapeHtml(item.name)}</td><td style="padding:9px 10px;border:1px solid #e5e7eb;text-align:center;color:#555">${item.qty}</td><td style="padding:9px 10px;border:1px solid #e5e7eb;text-align:right;color:#555;white-space:nowrap">${formatVnd(item.price)}</td><td style="padding:9px 10px;border:1px solid #e5e7eb;text-align:right;color:#222;font-weight:600;white-space:nowrap">${formatVnd(item.price * item.qty)}</td></tr>`).join(''); }
function detailRows(order, customer) { const rows = [['Khách hàng', order.name], ['SĐT', order.phone], ['Địa chỉ nhận hàng', order.address], ['Thời gian đặt', formatDate(order.createdAt)], ['Hình thức thanh toán / Mượn bếp', order.stoveFee ? `Thanh toán khi nhận hàng / Có tính phí: ${formatVnd(order.stoveFee)}` : 'Thanh toán khi nhận hàng / Miễn phí']]; return rows.map(([label, value]) => `<tr><td style="width:34%;padding:9px 10px;border:1px solid #e5e7eb;background:#f3f4f6;color:#4b5563;font-weight:600">${label}</td><td style="padding:9px 10px;border:1px solid #e5e7eb;color:#222">${escapeHtml(value)}</td></tr>`).join(''); }
function summaryRows(order) { return `<tr><td style="padding:9px 10px;border:1px solid #e5e7eb;color:#4b5563">Tạm tính</td><td style="padding:9px 10px;border:1px solid #e5e7eb;text-align:right">${formatVnd(order.subtotal)}</td></tr><tr><td style="padding:9px 10px;border:1px solid #e5e7eb;color:#4b5563">Giảm giá khai trương</td><td style="padding:9px 10px;border:1px solid #e5e7eb;text-align:right;color:#26834a">-${formatVnd(order.discount)}${order.discount ? '' : ' (không áp dụng)'}</td></tr><tr><td style="padding:9px 10px;border:1px solid #e5e7eb;color:#4b5563">Mượn bếp cồn / khay nhôm</td><td style="padding:9px 10px;border:1px solid #e5e7eb;text-align:right">${order.stoveFee ? `Có tính phí: ${formatVnd(order.stoveFee)}` : 'Miễn phí'}</td></tr><tr><td style="padding:11px 10px;border:1px solid #e5e7eb;background:#f7eee8;font-size:17px;font-weight:700;color:#8d1f1f">TỔNG THANH TOÁN</td><td style="padding:11px 10px;border:1px solid #e5e7eb;background:#f7eee8;text-align:right;font-size:19px;font-weight:700;color:#8d1f1f">${formatVnd(order.total)}</td></tr>`; }
function emailHtml(order, customer) {
  const title = customer ? 'Xác nhận đơn hàng' : 'Thông báo đơn hàng mới';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f5f3;font-family:Arial,Helvetica,sans-serif;color:#292929"><div style="display:none;max-height:0;overflow:hidden">${title} #${escapeHtml(order.orderCode)} từ LẨU MANG ĐI</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f3;padding:24px 10px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border:1px solid #e7e2dd;border-radius:10px;overflow:hidden"><tr><td style="background:#8d1f1f;padding:28px 30px;color:#fff"><div style="font-size:25px;font-weight:700;letter-spacing:.3px">LẨU MANG ĐI</div><div style="font-size:13px;margin-top:5px;opacity:.9">laumangdi.com</div></td></tr><tr><td style="padding:28px 30px 12px"><h1 style="font-size:22px;margin:0 0 8px;color:#8d1f1f">${title}</h1><p style="margin:0;color:#666;font-size:14px">Cảm ơn bạn đã đặt món tại LẨU MANG ĐI.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;font-size:14px"><tr><td style="padding:5px 0;color:#777">Mã đơn hàng</td><td align="right" style="padding:5px 0;font-weight:700">#${escapeHtml(order.orderCode)}</td></tr><tr><td style="padding:5px 0;color:#777">Ngày đặt</td><td align="right" style="padding:5px 0">${formatDate(order.createdAt)}</td></tr></table></td></tr><tr><td style="padding:8px 30px 18px"><div style="font-size:16px;font-weight:700;color:#8d1f1f;border-bottom:2px solid #f0e2d9;padding-bottom:9px;margin-bottom:10px">THÔNG TIN GIAO HÀNG</div><table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb"><tbody>${detailRows(order, customer)}</tbody></table></td></tr><tr><td style="padding:8px 30px 22px"><div style="font-size:16px;font-weight:700;color:#8d1f1f;border-bottom:2px solid #f0e2d9;padding-bottom:9px;margin-bottom:10px">CHI TIẾT ĐƠN HÀNG</div><table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb"><thead><tr style="background:#f3f4f6;color:#374151"><th align="left" style="padding:9px 10px;border:1px solid #e5e7eb">Món / Quy cách</th><th style="padding:9px 10px;border:1px solid #e5e7eb">Số lượng</th><th style="padding:9px 10px;border:1px solid #e5e7eb;text-align:right">Đơn giá</th><th style="padding:9px 10px;border:1px solid #e5e7eb;text-align:right">Thành tiền</th></tr></thead><tbody>${itemRows(order)}</tbody></table><div style="font-size:16px;font-weight:700;color:#8d1f1f;border-bottom:2px solid #f0e2d9;padding-bottom:9px;margin:20px 0 10px">TỔNG KẾT THANH TOÁN</div><table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb"><tbody>${summaryRows(order)}</tbody></table></td></tr><tr><td style="background:#faf7f4;padding:22px 30px;text-align:center;color:#666;font-size:13px;line-height:1.6">Hotline: <strong style="color:#8d1f1f">038 688 6868</strong> · laumangdi.com<br>Thời gian giao hàng dự kiến khoảng 15–30 phút tùy khu vực.<br>Chúc bạn ngon miệng! Cảm ơn bạn đã ủng hộ LẨU MANG ĐI.</td></tr></table></td></tr></table></body></html>`;
}
async function sendSmtpEmail(to, subject, html) { const nodemailer = require('nodemailer'); const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER || DEFAULT_SMTP_USER, pass: process.env.SMTP_PASS || DEFAULT_SMTP_PASS } }); await transporter.sendMail({ from: process.env.FROM_EMAIL || DEFAULT_FROM_EMAIL, to, subject, html }); }
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
    const results = await Promise.allSettled([sendSmtpEmail(order.email, `[Lẩu Mang Đi] Xác nhận đơn hàng #${order.orderCode}`, emailHtml(order, true)), sendSmtpEmail(process.env.STORE_EMAIL || DEFAULT_STORE_EMAIL, `🔥 Đơn hàng mới #${order.orderCode} - ${order.name}`, emailHtml(order, false))]);
    results.forEach(result => { if (result.status === 'rejected') console.error('Email failed:', result.reason && result.reason.message); });
    return json(res, 200, { success: true, order_code: orderCode, total: order.total, email_sent: results.every(result => result.status === 'fulfilled') });
  } catch (error) { console.error('Order processing error:', error.message); return json(res, 400, { error: error.message === 'Items are required' || error.message === 'Invalid item' ? error.message : 'Unable to process order' }); }
};
