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
function validEmail(value) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(value) && value.length <= 254; }
function normalizePhone(value) { return cleanText(value, 30).replace(/[\\s().-]/g, ''); }
function validVnPhone(value) { const phone = normalizePhone(value); return /^(?:0(?:3|5|7|8|9)\\d{8}|\\+84(?:3|5|7|8|9)\\d{8})$/.test(phone); }
function validAddress(value) { const address = cleanText(value, 300); return address.length >= 8 && /\\p{L}/u.test(address) && /\\d/.test(address); }
function formatVnd(price) { return new Intl.NumberFormat('vi-VN').format(price) + 'đ'; }
function calculateOrder(items, stoveIncluded) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw new Error('Items are required');
  const normalizedItems = []; let subtotal = 0;
  for (const item of items) {
    const name = cleanText(item && item.name, 120); const qty = parseQty(item && item.qty); const price = parsePrice(item && item.price);
    if (!name || qty === null || price === null) throw new Error('Invalid item');
    subtotal += price * qty;
    if (!Number.isSafeInteger(subtotal)) throw new Error('Order total is too large');
    normalizedItems.push({ name, qty, price });
  }
  const stoveFee = stoveIncluded && subtotal < STOVE_FREE_THRESHOLD_VND ? STOVE_FEE_VND : 0;
  const discount = subtotal > 0 ? DISCOUNT_VND : 0;
  return { items: normalizedItems, subtotal, stoveFee, discount, total: Math.max(0, subtotal + stoveFee - discount) };
}
function infoRow(label, value) { return `<tr><td style="padding:4px 0;color:#765f51;width:38%;vertical-align:top;">${label}</td><td style="padding:4px 0;color:#2b1b11;font-weight:600;">${value}</td></tr>`; }
function emailHtml(order, customer) {
  const heading = customer ? 'Xác Nhận Đơn Hàng Thành Công' : 'Đơn Hàng Mới';
  const intro = customer ? 'Cảm ơn bạn đã đặt món tại Lẩu Mang Đi.' : 'Có một đơn hàng mới vừa được đặt trên hệ thống.';
  const service = order.stoveIncluded ? 'Có mượn bếp cồn' : 'Khay nhôm ăn liền';
  const rows = order.items.map(item => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee7e2;color:#34251c;">${escapeHtml(item.name)}${item.qty > 1 ? ` <span style="color:#90796b;">× ${item.qty}</span>` : ''}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eee7e2;color:#34251c;font-weight:600;white-space:nowrap;">${formatVnd(item.price * item.qty)}</td></tr>`).join('');
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#f5f1ee;font-family:Arial,Helvetica,sans-serif;color:#34251c;"><div style="max-width:620px;margin:0 auto;padding:22px 12px;"><div style="background:#3d2616;border-radius:14px 14px 0 0;padding:30px 22px;text-align:center;color:#fffaf5;"><div style="font-size:14px;letter-spacing:1.8px;font-weight:bold;">LẨU NHÀ - ĂN LẨU TẠI NHÀ</div><div style="margin-top:12px;font-size:24px;line-height:1.3;font-weight:700;">${heading}</div></div><div style="background:#fff;padding:26px 24px 30px;border-radius:0 0 14px 14px;"><p style="margin:0 0 8px;font-size:16px;">Xin chào <strong>${escapeHtml(order.name)}</strong>,</p><p style="margin:0 0 22px;color:#765f51;line-height:1.6;">${intro}<br>Đơn hàng của bạn đang được chuẩn bị và sẽ được giao sớm nhất.</p><div style="background:#faf6f3;border:1.5px dashed #d57a55;border-radius:12px;padding:14px 16px;margin-bottom:26px;"><table width="100%" cellpadding="0" cellspacing="0">${infoRow('Mã đơn hàng', `<strong>#${escapeHtml(order.orderCode)}</strong>`)}${infoRow('Người nhận', escapeHtml(order.name))}${infoRow('Số điện thoại', escapeHtml(order.phone))}${infoRow('Địa chỉ giao', escapeHtml(order.address))}${infoRow('Dịch vụ kèm', service)}${infoRow('Thời gian đặt', now)}</table></div><div style="font-size:15px;font-weight:bold;letter-spacing:.8px;color:#3d2616;">CHI TIẾT ĐƠN HÀNG</div><hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;"><table width="100%" cellpadding="0" cellspacing="0">${rows}</table><div style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:12px;color:#765f51;font-size:14px;">${infoRow('Tạm tính', formatVnd(order.subtotal))}${infoRow('Giảm giá khai trương', order.discount ? `-${formatVnd(order.discount)}` : '0đ')}${infoRow('Phí mượn bếp', order.stoveFee ? formatVnd(order.stoveFee) : 'Miễn phí')}</div><div style="margin-top:14px;padding:15px 16px;background:#fff2ec;border-radius:10px;display:flex;justify-content:space-between;align-items:center;font-size:18px;font-weight:700;color:#8e4025;"><span>TỔNG THANH TOÁN</span><span>${formatVnd(order.total)}</span></div><p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #eee7e2;color:#765f51;font-size:13px;line-height:1.7;">Cam kết món ngon, đóng gói kỹ và bảo quản an toàn.<br>Hướng dẫn nhanh: chỉ 15 phút là có nồi lẩu nóng hổi tại nhà!<br><strong>Hotline hỗ trợ: 0819.943.904</strong> · laumangdi.com</p></div></div></body></html>`;
}
async function sendSmtpEmail(to, subject, html) { const nodemailer = require('nodemailer'); const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER || DEFAULT_SMTP_USER, pass: process.env.SMTP_PASS || DEFAULT_SMTP_PASS } }); await transporter.sendMail({ from: process.env.FROM_EMAIL || DEFAULT_FROM_EMAIL, to, subject, html }); }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end(); if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' });
  try {
    const length = Number(req.headers && req.headers['content-length']); if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(res, 413, { error: 'Request too large' });
    const body = req.body && typeof req.body === 'object' ? req.body : {}; if (cleanText(body.website || body.company || body.honeypot, 200)) return json(res, 400, { error: 'Invalid request' });
    const name = cleanText(body.cust_name, 100); const phone = cleanText(body.cust_phone, 30); const email = cleanText(body.cust_email, 254).toLowerCase(); const address = cleanText(body.cust_address, 300); const orderCode = cleanText(body.order_code, 30) || String(Date.now()).slice(-8);
    if (!name || !validVnPhone(phone) || !validEmail(email) || !validAddress(address)) return json(res, 400, { error: 'Invalid customer information' });
    const calculated = calculateOrder(body.items, body.stove_included === true); const order = { ...calculated, name, phone, email, address, orderCode, stoveIncluded: body.stove_included === true };
    const results = await Promise.allSettled([sendSmtpEmail(order.email, `[Lẩu Mang Đi] Xác nhận đơn hàng #${order.orderCode}`, emailHtml(order, true)), sendSmtpEmail(process.env.STORE_EMAIL || DEFAULT_STORE_EMAIL, `🔥 Đơn hàng mới #${order.orderCode} - ${order.name}`, emailHtml(order, false))]);
    results.forEach(result => { if (result.status === 'rejected') console.error('Email failed:', result.reason && result.reason.message); });
    return json(res, 200, { success: true, order_code: orderCode, total: order.total, email_sent: results.every(result => result.status === 'fulfilled') });
  } catch (error) { console.error('Order processing error:', error && error.message); return json(res, 400, { error: error && (error.message === 'Items are required' || error.message === 'Invalid item') ? error.message : 'Unable to process order' }); }
};
