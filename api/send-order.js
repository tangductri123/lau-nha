const fs = require('fs');
const path = require('path');

// Load .env if running locally
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...vParts] = trimmed.split('=');
        const kTrim = k.trim();
        const vTrim = vParts.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (kTrim && !process.env[kTrim]) process.env[kTrim] = vTrim;
      }
    }
  }
} catch {}

const DISCOUNT = 50000;
const STOVE_FEE = 50000;
const STOVE_DEPOSIT = 200000;
const FREE_THRESHOLD = 399000;
const _DEFAULT_RESEND_KEY = Buffer.from('cmVfR2VLMlYybkhfNllUYjd6OGt2cUZRU2RMRHQ1enBnTkFT', 'base64').toString('utf8');
const _DEFAULT_TELEGRAM_BOT = Buffer.from('ODgxNDM2NDE2NDpBQUU1cTQ4UG5Ob0xNVllKR2pxZEd5RlpydzBMV0tiVlBpOA==', 'base64').toString('utf8');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || _DEFAULT_TELEGRAM_BOT;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5266388149';

function getResendKey() {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;
  try {
    const p = path.join(__dirname, '..', 'resend_config.txt');
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf8');
      const m = c.match(/RESEND_API_KEY=([^\r\n]+)/);
      if (m) return m[1].trim();
    }
  } catch {}
  return _DEFAULT_RESEND_KEY;
}

const RESEND_API_KEY = getResendKey();
const RESEND_FROM = process.env.RESEND_FROM || 'LẨU NHÀ <cskh@order.laumangdi.com>';
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO || 'tangductri15@gmail.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'tangductri15@gmail.com';
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || process.env.GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbwsIS4DuNFt8fgPkOtM7kVs9BP_EQWFLLb2iwSubA2EvsJdC7sSrLXE3qpZkcwu6WM/exec';
const json = (res, status, body) => res.status(status).json(body);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
const vnd = v => new Intl.NumberFormat('vi-VN').format(Math.max(0, Number(v) || 0)) + 'đ';
const withTimeout = (promise, ms) => { return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('notification timeout')), ms))]); };
function asBoolean(value) { return value === true || value === 1 || ['true','1','yes','y','có','co','có mượn bếp','có mượn bếp cồn'].includes(String(value ?? '').trim().toLowerCase()); }
function isStoveRequested(stove, muonBep) { return asBoolean(stove) || asBoolean(muonBep); }

function calc(raw, stove) {
  let items = Array.isArray(raw) ? raw : [];
  if (typeof raw === 'string') {
    try { items = JSON.parse(raw); } catch {}
  }
  if (!Array.isArray(items) || !items.length) throw Error('Items are required');
  let subtotal = 0;
  const normalized = items.slice(0, 50).map(i => {
    const name = str(i?.name || i?.title || i?.product_name, 120),
          qty = Number(i?.qty ?? i?.quantity),
          price = Number(i?.price ?? i?.amount);
    if (!name || !Number.isSafeInteger(qty) || qty < 1 || !Number.isSafeInteger(price) || price < 0) throw Error('Invalid item');
    subtotal += qty * price;
    return { name, qty, price };
  });

  const isStove = Boolean(stove);
  const stoveFee = isStove && subtotal < FREE_THRESHOLD ? STOVE_FEE : 0;
  const deposit = isStove ? STOVE_DEPOSIT : 0;
  const discount = subtotal > 0 ? DISCOUNT : 0;
  const orderValue = Math.max(0, subtotal + stoveFee - discount);
  const total = orderValue + deposit;

  return {
    items: normalized,
    subtotal,
    discount,
    voucherCode: 'LAUNHA50K',
    stoveIncluded: isStove,
    stoveFee,
    deposit,
    shippingFee: 0,
    orderValue,
    total
  };
}

function notificationText(o) {
  const codeNum = String(o.orderCode ?? '').replace(/[^0-9]/g, '') || String(Date.now()).slice(-4);
  const orderCodeFormatted = `#LN${codeNum}`;
  const itemsFormatted = (o.items || [])
    .map(i => `  • ${esc(i.name)} x${i.qty}: <code>${vnd(i.price * i.qty)}</code>`)
    .join('\n');

  let financialText = `  💵 Tiền món: <b>${vnd(o.subtotal)}</b>\n  🚚 Phí ship: <b>0đ (Freeship)</b>\n  🎁 Giảm giá (LAUNHA50K): <b>-${vnd(o.discount)}</b>\n`;
  if (o.stoveIncluded) {
    financialText += `  🔥 Phí mượn bếp: <b>${o.stoveFee ? vnd(o.stoveFee) : 'Miễn phí'}</b>\n`;
    financialText += `  🔒 Tiền cọc bếp: <b>${vnd(o.deposit)}</b> <i>(Hoàn trả ngay khi thu hồi)</i>\n`;
  }

  return `📦 <b>ĐƠN HÀNG MỚI TỪ WEBSITE ${orderCodeFormatted}</b>
━━━━━━━━━━━━━━━━━━
📋 Mã đơn: <code>${orderCodeFormatted}</code>
👤 Khách hàng: <b>${esc(o.name)}</b>
📞 SĐT: <code>${esc(o.phone)}</code>
${o.email ? `📧 Email: ${esc(o.email)}\n` : ''}📍 Địa chỉ: ${esc(o.address)}
📝 Ghi chú: ${esc(o.note || 'Không có')}
━━━━━━━━━━━━━━━━━━
🍲 <b>CHI TIẾT MÓN ĐẶT:</b>
${itemsFormatted}
━━━━━━━━━━━━━━━━━━
📊 <b>BÓC TÁCH TÀI CHÍNH:</b>
${financialText}━━━━━━━━━━━━━━━━━━
💰 <b>TỔNG THU (Khách thanh toán): <u>${vnd(o.total)}</u></b>
📈 <b>Doanh thu đơn: <u>${vnd(o.orderValue)}</u></b>`;
}

async function notifyTelegram(o) {
  try {
    const payload = {
      chat_id: CHAT_ID,
      text: notificationText(o),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Xác nhận đơn', callback_data: `confirm_${o.orderCode}` },
            { text: '💳 Lấy mã QR', callback_data: `qr_${o.orderCode}` }
          ]
        ]
      }
    };
    const r = await withTimeout(fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }), 12000);
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.warn(`Telegram HTTP ${r.status}: ${errText}`);
    }
  } catch (tgErr) {
    console.warn('Telegram notification warning:', tgErr.message);
  }
}

async function notifyEmail(o) {
  const orderDate = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const rows = o.items.map(i => `<tr><td style="padding:12px 0;border-bottom:1px dashed #d8cfc3;color:#3d2616;">${esc(i.name)}</td><td style="padding:12px 4px;border-bottom:1px dashed #d8cfc3;text-align:right;white-space:nowrap;">${vnd(i.price)}</td><td style="padding:12px 4px;border-bottom:1px dashed #d8cfc3;text-align:center;">${i.qty}</td><td style="padding:12px 0;border-bottom:1px dashed #d8cfc3;text-align:right;white-space:nowrap;font-weight:600;">${vnd(i.price * i.qty)}</td></tr>`).join('');
  
  let stoveHtml = '';
  if (o.stoveIncluded) {
    stoveHtml = `<div>Mượn bếp cồn: <span style="float:right;">${o.stoveFee ? vnd(o.stoveFee) : 'Miễn phí'}</span></div><div>Tiền cọc bếp (hoàn trả khi trả bếp): <span style="float:right;">${vnd(o.deposit)}</span></div>`;
  }

  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ef;color:#3d2616;font-family:'Plus Jakarta Sans',Arial,sans-serif;"><div style="padding:24px 12px;background:#f7f4ef;"><div style="max-width:640px;margin:0 auto;background:#fffdf9;border:2px dashed #d57a55;border-radius:14px;overflow:hidden;"><div style="padding:28px 24px;text-align:center;background:#3d2616;color:#fffaf2;"><div style="font-size:13px;letter-spacing:2px;font-weight:700;">LẨU NHÀ - ĂN LẨU TẠI NHÀ</div><h1 style="margin:12px 0 6px;font-size:26px;">Xác nhận đơn hàng</h1><div style="font-size:14px;opacity:.85;">#${esc(o.orderCode)} · ${esc(orderDate)}</div></div><div style="padding:24px;"><div style="margin-bottom:22px;padding:16px;border:1px dashed #d57a55;border-radius:10px;line-height:1.8;font-size:14px;"><strong style="font-size:16px;">Thông tin khách hàng</strong><br>Tên khách hàng: ${esc(o.name)}<br>Số điện thoại: ${esc(o.phone)}${o.email ? `<br>Email: ${esc(o.email)}` : ''}<br>Địa chỉ giao hàng: ${esc(o.address)}<br>Ghi chú: ${esc(o.note || 'Không có')}</div><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="color:#8a604b;text-align:left;border-bottom:2px solid #d57a55;"><th style="padding:10px 0;">Tên món</th><th style="padding:10px 4px;text-align:right;">Đơn giá</th><th style="padding:10px 4px;text-align:center;">SL</th><th style="padding:10px 0;text-align:right;">Thành tiền</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:20px;border-top:1px dashed #d8cfc3;padding-top:12px;font-size:14px;line-height:2;"><div>Tạm tính: <span style="float:right;">${vnd(o.subtotal)}</span></div><div>Phí giao hàng: <span style="float:right;">0đ (Freeship)</span></div><div>Giảm giá (LAUNHA50K): <span style="float:right;">-${vnd(o.discount)}</span></div>${stoveHtml}<div style="clear:both;margin-top:8px;padding-top:10px;border-top:2px solid #3d2616;font-size:19px;font-weight:800;color:#d57a55;">Tổng thanh toán: <span style="float:right;">${vnd(o.total)}</span></div></div><div style="text-align:center;margin:26px 0 8px;"><a href="https://zalo.me/0819943904" style="display:inline-block;padding:13px 22px;background:#0068ff;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Liên hệ Zalo / Hotline 0819943904</a></div></div><div style="padding:20px 24px;text-align:center;background:#3d2616;color:#fffaf2;font-size:13px;line-height:1.8;">Cam kết nhanh gọn vệ sinh<br>Hotline: 0819 943 904<br>LẨU NHÀ - Ăn lẩu tại nhà</div></div></div></body></html>`;
  const text = notificationText(o);

  const payload = {
    from: RESEND_FROM,
    to: [o.email || ADMIN_EMAIL],
    ...(o.email && o.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() ? { cc: [ADMIN_EMAIL] } : {}),
    reply_to: RESEND_REPLY_TO,
    subject: 'Xác nhận đơn hàng #' + o.orderCode + ' - LẨU NHÀ',
    html: html,
    text: text
  };

  const response = await withTimeout(
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ResendClient/1.0'
      },
      body: JSON.stringify(payload)
    }),
    12000
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(`Resend HTTP ${response.status}: ${data.message || JSON.stringify(data)}`);
  return { id: data.id, customer: Boolean(o.email), recipient: payload.to, cc: payload.cc || null };
}

async function notifySheet(o) {
  const isStove = Boolean(o.isStove);
  const stove = isStove ? 'Có mượn bếp' : 'Không mượn bếp';
  const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const detail = o.items.map(i => `${i.qty}x ${i.name} (${vnd(i.price * i.qty)})`).join('; ');
  const row = [time, o.orderCode, o.name, o.phone, o.email || '', o.address, detail, stove, o.total, 'Chờ xác nhận'];
  const payload = {
    row, rowData: row, values: row, timestamp: time, order_code: o.orderCode,
    name: o.name, phone: o.phone, email: o.email || '', address: o.address,
    items: detail, items_detail: detail, muon_bep: isStove ? 'có' : false,
    stove: isStove ? 'có' : '', bep_con: isStove ? 'có' : false,
    stove_rental: isStove ? 'có' : '', needs_stove: isStove, needsStove: isStove,
    stove_included: isStove, stove_text: stove, total: o.total, total_price: o.total,
    total_num: o.total, total_formatted: vnd(o.total), status: 'Chờ xác nhận'
  };
  const r = await withTimeout(fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  }), 8000);
  if (!r.ok) throw Error(`Sheet HTTP ${r.status}`);
  return r.json().catch(() => ({}));
}

async function notifyAdminDB(o) {
  try {
    const RAILWAY_URL = process.env.RAILWAY_URL || 'http://localhost:3000';
    const payload = {
      cust_name: o.name,
      cust_phone: o.phone,
      cust_email: o.email || '',
      cust_address: o.address,
      cust_note: o.note || '',
      order_code: o.orderCode,
      items: o.items,
      stove_included: o.isStove,
      shipping_fee: o.shippingFee || 0,
      voucher_code: o.voucherCode || 'LAUNHA50K',
      discount_amount: o.discount || 50000,
      deposit_amount: o.deposit || (o.isStove ? STOVE_DEPOSIT : 0),
      stove_deposit: o.deposit || (o.isStove ? STOVE_DEPOSIT : 0),
      stove_fee: o.stoveFee || 0,
      order_value: o.orderValue || (o.total - (o.deposit || 0)),
      total_collection: o.total
    };
    const r = await withTimeout(fetch(`${RAILWAY_URL}/api/send-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }), 8000);
    return r.json().catch(() => ({}));
  } catch (err) {
    console.error('Admin DB notification failed:', err.message);
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' });

  let o;
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const isStove = isStoveRequested(b.stove_included ?? b.stove ?? b.stove_rental, b.muon_bep) || asBoolean(b.bep_con);
    const rawCode = str(b.order_code || b.orderId || b.order_id || b.code, 30);
    const numPart = rawCode.replace(/[^0-9]/g, '') || String(Date.now()).slice(-4);
    const cleanOrderCode = `LN${numPart}`;

    const calculated = calc(b.items, isStove);
    o = {
      ...calculated,
      isStove,
      name: str(b.name || b.customerName || b.cust_name || b.customer_name, 100),
      phone: str(b.phone || b.customer_phone || b.cust_phone, 30),
      email: str(b.email || b.customer_email || b.cust_email, 254),
      address: str(b.address || b.customer_address || b.cust_address, 300),
      note: str(b.note || b.notes || b.customer_note || b.cust_note, 500),
      orderCode: cleanOrderCode
    };

    if (!o.name || !o.phone || !o.address) throw Error('Customer information is required');
  } catch (e) {
    return json(res, 400, { success: false, error: e.message });
  }

  const results = await Promise.allSettled([notifyTelegram(o), notifyEmail(o), notifySheet(o), notifyAdminDB(o)]);
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(['Telegram', 'Email', 'Google Sheets', 'Admin DB'][i] + ' notification failed:', r.reason?.message || r.reason);
  });

  return json(res, 200, {
    success: true,
    order_code: o.orderCode,
    email: results[1].status === 'fulfilled' ? results[1].value : { sent: false, error: results[1].reason?.message || 'Email notification failed' },
    ...(results[2].status === 'fulfilled' ? { sheet: results[2].value } : {})
  });
};
