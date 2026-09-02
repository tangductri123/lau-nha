'use strict';
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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

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
  return '';
}

const RESEND_API_KEY = getResendKey();
const RESEND_FROM = process.env.RESEND_FROM || 'LẨU NHÀ <cskh@order.laumangdi.com>';
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO || 'tangductri15@gmail.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'tangductri15@gmail.com';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://lau-nha-production.up.railway.app';

const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);

async function notifyTelegramLead(lead) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  const text = `🎉 <b>CÓ LEAD KHẢO SÁT MỚI (ƯU ĐÃI 50K)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Họ tên:</b> ${esc(lead.name)}\n` +
    `📞 <b>SĐT/Zalo:</b> ${esc(lead.phone)}\n` +
    `📧 <b>Email:</b> ${esc(lead.email)}\n` +
    `🎁 <b>Mã ưu đãi:</b> <code>${esc(lead.discount_code || 'LAUNHA50K')}</code>\n\n` +
    `📋 <b>CÂU TRẢ LỜI KHẢO SÁT:</b>\n` +
    `• <b>Ăn cùng:</b> ${esc(lead.eat_with || 'Không chọn')}\n` +
    `• <b>Tần suất:</b> ${esc(lead.frequency || 'Không chọn')}\n` +
    `• <b>Quan tâm nhất:</b> ${esc(lead.main_concern || 'Không chọn')}\n` +
    `• <b>Hứng thú mượn bếp:</b> ${esc(lead.interested_in_service || 'Không chọn')}\n\n` +
    `⏰ <i>Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</i>`;

  await withTimeout(
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    }),
    8000
  ).catch(err => console.warn('Telegram lead error:', err.message));
}

async function sendSurveyEmail(lead) {
  if (!RESEND_API_KEY || !lead.email) return;
  const name = esc(lead.name || 'Bạn');
  const code = esc(lead.discount_code || 'LAUNHA50K');
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ef;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#3d2616;"><div style="padding:24px 12px;"><div style="max-width:600px;margin:0 auto;background:#fffdf9;border:2px dashed #d57a55;border-radius:14px;overflow:hidden;"><div style="padding:28px 24px;text-align:center;background:#3d2616;color:#fffaf2;"><h1 style="margin:0;font-size:24px;">Tặng Bạn Voucher 50.000đ</h1><div style="font-size:13px;opacity:0.85;margin-top:6px;">LẨU NHÀ - NƯỚC CỐT HẦM XƯƠNG 12H</div></div><div style="padding:24px;"><p>Chào <strong>${name}</strong>,</p><p>Cảm ơn bạn đã tham gia khảo sát khẩu vị tại <strong>Lẩu Nhà</strong>! Đây là mã ưu đãi độc quyền dành riêng cho bạn:</p><div style="text-align:center;margin:24px 0;padding:16px;background:#fff5ea;border:2px dashed #d57a55;border-radius:10px;"><div style="font-size:12px;color:#8a604b;font-weight:700;">MÃ GIẢM GIÁ 50.000Đ</div><div style="font-size:28px;font-weight:800;color:#d57a55;letter-spacing:3px;margin:8px 0;">${code}</div><div style="font-size:12px;color:#8a604b;">Áp dụng cho đơn lẩu từ 249.000đ khi đặt tại website laumangdi.com</div></div><div style="text-align:center;margin-top:20px;"><a href="https://laumangdi.com/#menu-section" style="display:inline-block;padding:13px 26px;background:#d57a55;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">ĐẶT LẨU NGAY VỚI MÃ 50K</a></div></div></div></div></body></html>`;

  await withTimeout(
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [lead.email],
        reply_to: RESEND_REPLY_TO,
        subject: `🎁 Tặng Bạn Mã Ưu Đãi 50K [${code}] - LẨU NHÀ`,
        html: html
      })
    }),
    10000
  ).catch(err => console.warn('Resend survey email error:', err.message));
}

async function syncToRailway(payload) {
  if (!RAILWAY_URL) return null;
  try {
    const res = await withTimeout(
      fetch(`${RAILWAY_URL}/api/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
      8000
    );
    return await res.json().catch(() => ({}));
  } catch (err) {
    console.warn('Sync to Railway failed:', err.message);
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }
    body = body || {};

    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim();
    const discount_code = String(body.discount_code || 'LAUNHA50K').trim().toUpperCase();

    if (!name || !email) {
      return res.status(400).json({ success: false, detail: 'Họ tên và email không được để trống' });
    }

    const leadData = {
      name,
      phone,
      email,
      eat_with: body.eat_with || '',
      frequency: body.frequency || '',
      main_concern: body.main_concern || '',
      interested_in_service: body.interested_in_service || '',
      discount_code,
      raw_answers: body.raw_answers || body
    };

    // Parallel execution for notifications & DB sync
    await Promise.allSettled([
      notifyTelegramLead(leadData),
      sendSurveyEmail(leadData),
      syncToRailway(leadData)
    ]);

    return res.status(200).json({
      success: true,
      discount_code: discount_code,
      message: 'Đã nhận khảo sát và gửi mã ưu đãi thành công!'
    });
  } catch (err) {
    console.error('Survey API handler error:', err);
    return res.status(200).json({
      success: true,
      discount_code: 'LAUNHA50K',
      message: 'Đã ghi nhận thông tin thành công!'
    });
  }
};
