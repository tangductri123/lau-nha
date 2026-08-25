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

function invoiceText(order, customer) {
  return `${customer ? 'Xác nhận đơn hàng' : 'Đơn hàng mới'} #${order.orderCode}\n\nKhách hàng: ${order.name}\nĐiện thoại: ${order.phone}\nĐịa chỉ: ${order.address}\n\n${order.items.map(i => `${i.qty} x ${i.name}: ${formatVnd(i.price * i.qty)}`).join('\n')}\n\nTạm tính: ${formatVnd(order.subtotal)}\nGiảm giá: -${formatVnd(order.discount)}\nPhụ phí bếp/cồn: ${formatVnd(order.stoveFee)}\nTỔNG CỘNG: ${formatVnd(order.total)}`;
}

function emailHtml(order, customer) {
  const title = customer ? 'LẨU MANG ĐI' : `ĐƠN HÀNG MỚI #${html(order.orderCode)}`;
  const intro = customer ? 'Cảm ơn bạn đã đặt hàng! Đơn hàng của bạn đã được tiếp nhận.' : 'Có một đơn hàng mới vừa được đặt trên website.';
  const rows = order.items.map(i => `<tr><td style="padding:10px 12px;border-bottom:1px solid #ede5dc;color:#222;">${html(i.name)}</td><td align="center" style="padding:10px 12px;border-bottom:1px solid #ede5dc;color:#222;">${i.qty}</td><td align="right" style="padding:10px 12px;border-bottom:1px solid #ede5dc;color:#222;white-space:nowrap;">${formatVnd(i.price * i.qty)}</td></tr>`).join('');
  const line = (label, value, color = '#444') => `<tr><td style="padding:5px 0;color:#666;">${label}</td><td align="right" style="padding:5px 0;color:${color};">${value}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f5f0eb;font-family:Arial,Helvetica,sans-serif;color:#222;"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;"><div style="background:#3d2616;padding:24px;text-align:center;"><div style="font-size:25px;font-weight:bold;color:#fff;letter-spacing:1px;">${title}</div><div style="margin-top:8px;font-size:14px;color:#e28743;">${html(intro)}</div></div><div style="padding:0 24px 28px;"><div style="background:#fffaf5;border:2px dashed #d57a55;border-radius:8px;padding:16px;margin:20px 0;"><div style="font-size:16px;font-weight:bold;color:#3d2616;margin-bottom:10px;">Thông tin khách hàng</div><div style="line-height:1.7;font-size:14px;"><b style="color:#666;">Họ tên:</b> ${html(order.name)}<br><b style="color:#666;">Điện thoại:</b> ${html(order.phone)}<br><b style="color:#666;">Địa chỉ:</b> ${html(order.address)}<br><b style="color:#666;">Mã đơn:</b> #${html(order.orderCode)}</div></div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;"><thead><tr style="background:#f2ebe3;color:#3d2616;text-transform:uppercase;font-weight:bold;"><th align="left" style="padding:8px 12px;">Món ăn</th><th style="padding:8px 12px;">SL</th><th align="right" style="padding:8px 12px;">Thành tiền</th></tr></thead><tbody>${rows}</tbody></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:16px;font-size:14px;">${line('Tạm tính', formatVnd(order.subtotal))}${line('Giảm giá', order.discount ? '-' + formatVnd(order.discount) : formatVnd(0), '#d57a55')}${line('Phụ phí bếp/cồn', formatVnd(order.stoveFee))}<tr><td style="padding-top:12px;border-top:2px solid #3d2616;font-size:18px;font-weight:bold;color:#3d2616;">TỔNG CỘNG</td><td align="right" style="padding-top:12px;border-top:2px solid #3d2616;font-size:18px;font-weight:bold;color:#d57a55;">${formatVnd(order.total)}</td></tr></table></div><div style="background:#3d2616;color:#f5f0eb;text-align:center;padding:18px 24px;font-size:12px;line-height:1.7;">Hotline: 0819 943 904 &nbsp;|&nbsp; Gia Định, TP.HCM<br><b>Cam kết giao lẩu nóng trong 15 phút</b></div></div></body></html>`;
}

async function sendEmail(to, subject, order, customer) {
  try {
    const nodemailer = require('nodemailer');
    const user = process.env.SMTP_USER || 'tangductri15@gmail.com';
    const pass = process.env.SMTP_PASS || 'jjrpeibdlkdkmfsg';
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } });
    await transporter.sendMail({ from: user, to, subject, html: emailHtml(order, customer), text: invoiceText(order, customer) });
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
    const [customer, store] = await Promise.all([sendEmail(email, `[Lẩu Mang Đi] Xác nhận đơn hàng #${orderCode}`, order, true), sendEmail(process.env.STORE_EMAIL || 'tangductri15@gmail.com', `🔥 Đơn hàng mới #${orderCode} - ${name}`, order, false)]);
    const errors = [customer, store].filter(r => !r.sent).map(r => r.email_error).filter(Boolean);
    return json(res, 200, { success: true, order_code: orderCode, total: order.total, email_sent: customer.sent && store.sent, ...(errors.length ? { email_error: errors.join('; ') } : {}) });
  } catch (err) {
    console.error('Order processing error:', err && err.stack || err);
    return json(res, 400, { error: err && (err.message === 'Items are required' || err.message === 'Invalid item') ? err.message : 'Unable to process order' });
  }
};
