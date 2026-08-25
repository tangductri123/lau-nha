'use strict';

const DISCOUNT_VND = 50000;
const STOVE_FEE_VND = 50000;
const STOVE_FREE_THRESHOLD_VND = 399000;
const MAX_BODY_BYTES = 100000;

const json = (res, status, body) => res.status(status).json(body);
const text = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const money = v => Number.isSafeInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100000000 ? Number(v) : null;
const quantity = v => Number.isSafeInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 99 ? Number(v) : null;
const html = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const formatVnd = v => new Intl.NumberFormat('vi-VN').format(v) + 'đ';
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
const normalizePhone = v => text(v, 30).replace(/[\s().-]/g, '');
const validPhone = v => /^(?:0(?:3|5|7|8|9)\d{8}|\+84(?:3|5|7|8|9)\d{8})$/.test(normalizePhone(v));
const validAddress = v => text(v, 300).length >= 8 && /\p{L}/u.test(v) && /\d/.test(v);

function calculate(items, stoveIncluded) {
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new Error('Items are required');
  let subtotal = 0;
  const normalized = items.map(item => {
    const name = text(item && item.name, 120), qty = quantity(item && item.qty), price = money(item && item.price);
    if (!name || qty === null || price === null) throw new Error('Invalid item');
    subtotal += qty * price;
    if (!Number.isSafeInteger(subtotal)) throw new Error('Order total is too large');
    return { name, qty, price };
  });
  const stoveFee = stoveIncluded && subtotal < STOVE_FREE_THRESHOLD_VND ? STOVE_FEE_VND : 0;
  const discount = subtotal ? DISCOUNT_VND : 0;
  return { items: normalized, subtotal, stoveFee, discount, total: Math.max(0, subtotal + stoveFee - discount) };
}

function row(label, value) { return `<tr><td style="padding:4px 0;color:#765f51;width:38%;vertical-align:top">${label}</td><td style="padding:4px 0;color:#2b1b11;font-weight:600">${value}</td></tr>`; }
function emailHtml(order, customer) {
  const itemRows = order.items.map(i => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee7e2;color:#34251c">${html(i.name)}${i.qty > 1 ? ` <span style="color:#90796b">× ${i.qty}</span>` : ''}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eee7e2;color:#34251c;font-weight:600;white-space:nowrap">${formatVnd(i.price * i.qty)}</td></tr>`).join('');
  const service = order.stoveIncluded ? 'Có mượn bếp cồn' : 'Khay nhôm ăn liền';
  const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#f5f1ee;font-family:Arial,Helvetica,sans-serif;color:#34251c"><div style="max-width:620px;margin:auto;padding:22px 12px"><header style="background:#3d2616;border-radius:14px 14px 0 0;padding:30px 22px;text-align:center;color:#fffaf5"><div style="font-size:14px;letter-spacing:1.8px;font-weight:bold">LẨU NHÀ - ĂN LẨU TẠI NHÀ</div><h1 style="margin:12px 0 0;font-size:24px;line-height:1.3">${customer ? 'Xác Nhận Đơn Hàng Thành Công' : 'Đơn Hàng Mới'}</h1></header><main style="background:#fff;padding:26px 24px 30px;border-radius:0 0 14px 14px"><p style="margin:0 0 8px;font-size:16px">Xin chào <strong>${html(order.name)}</strong>,</p><p style="margin:0 0 22px;color:#765f51;line-height:1.6">${customer ? 'Cảm ơn bạn đã đặt món tại Lẩu Mang Đi.' : 'Có một đơn hàng mới vừa được đặt trên hệ thống.'}<br>Đơn hàng của bạn đang được chuẩn bị và sẽ được giao sớm nhất.</p><section style="background:#faf6f3;border:1.5px dashed #d57a55;border-radius:12px;padding:14px 16px;margin-bottom:26px"><table width="100%" cellpadding="0" cellspacing="0">${row('Mã đơn hàng', `<strong>#${html(order.orderCode)}</strong>`)}${row('Người nhận', html(order.name))}${row('Số điện thoại', html(order.phone))}${row('Địa chỉ giao', html(order.address))}${row('Dịch vụ kèm', service)}${row('Thời gian đặt', time)}</table></section><div style="font-size:15px;font-weight:bold;letter-spacing:.8px;color:#3d2616">CHI TIẾT ĐƠN HÀNG</div><hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"><table width="100%" cellpadding="0" cellspacing="0">${itemRows}</table><div style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:12px;font-size:14px">${row('Tạm tính', formatVnd(order.subtotal))}${row('Giảm giá khai trương', order.discount ? '-' + formatVnd(order.discount) : '0đ')}${row('Phí mượn bếp', order.stoveFee ? formatVnd(order.stoveFee) : 'Miễn phí')}</div><div style="margin-top:14px;padding:15px 16px;background:#fff2ec;border-radius:10px;display:flex;justify-content:space-between;font-size:18px;font-weight:700;color:#8e4025"><span>TỔNG THANH TOÁN</span><span>${formatVnd(order.total)}</span></div><footer style="margin-top:26px;padding-top:18px;border-top:1px solid #eee7e2;color:#765f51;font-size:13px;line-height:1.7">Cam kết món ngon, đóng gói kỹ và bảo quản an toàn.<br>Hướng dẫn nhanh: chỉ 15 phút là có nồi lẩu nóng hổi tại nhà!<br><strong>Hotline hỗ trợ: 0819.943.904</strong> · laumangdi.com</footer></main></div></body></html>`;
}

async function sendEmail(to, subject, body) {
  try {
    const nodemailer = require('nodemailer');
    const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
    if (!user || !pass) throw new Error('SMTP_USER/SMTP_PASS is not configured');
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), secure: process.env.SMTP_SECURE !== 'false', auth: { user, pass } });
    await transporter.sendMail({ from: process.env.FROM_EMAIL || user, to, subject, html: body });
    return true;
  } catch (error) { console.error('Email failed:', error && error.message); return false; }
}
async function sendTelegram(order) {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return false;
    const message = `Đơn hàng mới #${order.orderCode}\n${order.name} - ${order.phone}\n${order.address}\nTổng: ${formatVnd(order.total)}`;
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: message }) });
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
    return true;
  } catch (error) { console.error('Telegram failed:', error && error.message); return false; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' });
  try {
    const length = Number(req.headers && req.headers['content-length']);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(res, 413, { error: 'Request too large' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (text(body.website || body.company || body.honeypot, 200)) return json(res, 400, { error: 'Invalid request' });
    const name = text(body.cust_name, 100), phone = text(body.cust_phone, 30), email = text(body.cust_email, 254).toLowerCase(), address = text(body.cust_address, 300), orderCode = text(body.order_code, 30) || String(Date.now()).slice(-8);
    if (!name || !validPhone(phone) || !validEmail(email) || !validAddress(address)) return json(res, 400, { error: 'Invalid customer information' });
    const calculated = calculate(body.items, body.stove_included === true);
    const order = { ...calculated, name, phone, email, address, orderCode, stoveIncluded: body.stove_included === true };
    const [customerSent, storeSent] = await Promise.all([sendEmail(email, `[Lẩu Mang Đi] Xác nhận đơn hàng #${orderCode}`, emailHtml(order, true)), sendEmail(process.env.STORE_EMAIL || process.env.SMTP_USER, `🔥 Đơn hàng mới #${orderCode} - ${name}`, emailHtml(order, false))]);
    await sendTelegram(order);
    return json(res, 200, { success: true, order_code: orderCode, total: order.total, email_sent: customerSent && storeSent });
  } catch (error) { console.error('Order processing error:', error && error.stack || error); return json(res, 400, { error: error && error.message === 'Items are required' || error && error.message === 'Invalid item' ? error.message : 'Unable to process order' }); }
};
