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

const _DEFAULT_RESEND_KEY = Buffer.from('cmVfR2VLMlYybkhfNllUYjd6OGt2cUZRU2RMRHQ1enBnTkFT', 'base64').toString('utf8');
const _DEFAULT_TELEGRAM_BOT = Buffer.from('ODgxNDM2NDE2NDpBQUU1cTQ4UG5Ob0xNVllKR2pxZEd5RlpydzBMV0tiVlBpOA==', 'base64').toString('utf8');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || _DEFAULT_TELEGRAM_BOT;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5566848105';

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
  const name = esc(lead.name || 'bạn');
  const code = esc(lead.discount_code || 'LAUNHA50K');
  const website_url = 'https://laumangdi.com';
  const chatbot_url = `${website_url}/?open_chat=1#chatbot`;
  const zalo_url = 'https://zalo.me/0819943904';

  const subject = `🎁 Món quà chào mừng & Mã ưu đãi 50.000đ từ LẨU NHÀ 🍲`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:20px 10px;background-color:#f7f4ef;color:#3d2616;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;line-height:1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <div style="max-width:600px;width:100%;margin:0 auto;background-color:#fffdf9;border:2px dashed #d57a55;border-radius:14px;padding:28px 20px;text-align:left;box-sizing:border-box;">
          
          <!-- HEADER -->
          <div style="text-align:center;border-bottom:2px solid #d57a55;padding-bottom:16px;margin-bottom:20px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:#d57a55;text-transform:uppercase;">LẨU NHÀ - ĂN LẨU TẠI NHÀ</div>
            <h1 style="color:#3d2616;margin:8px 0 4px;font-size:23px;font-weight:800;">Chào mừng bạn gia nhập Lẩu Nhà! 🎉</h1>
            <p style="margin:0;font-size:14px;color:#8a604b;">Món quà cảm ơn bạn đã tham gia khảo sát đóng góp ý kiến</p>
          </div>

          <!-- GREETING -->
          <p style="font-size:15px;margin:0 0 14px;color:#3d2616;">Chào <strong>${name}</strong>,</p>
          <p style="font-size:14px;margin:0 0 18px;color:#3d2616;line-height:1.7;">
            Cảm ơn bạn đã dành thời gian quý báu tham gia bảng khảo sát nhu cầu của <strong>Lẩu Nhà</strong>. Mọi ý kiến phản hồi của bạn là động lực rất lớn để tụi mình hoàn thiện những set lẩu tiện lợi, thơm ngon chuẩn vị nhất.
          </p>

          <!-- VOUCHER BOX -->
          <div style="background-color:#fff7ed;border:2px dashed #ea580c;border-radius:12px;padding:20px 16px;margin:22px 0;text-align:center;">
            <div style="font-size:13px;font-weight:700;color:#9a3412;letter-spacing:1px;text-transform:uppercase;">🎁 MÃ ƯU ĐÃI KHAI TRƯƠNG DÀNH CHO BẠN</div>
            <div style="font-size:28px;font-weight:800;color:#ea580c;letter-spacing:3px;margin:10px auto;padding:8px 18px;background-color:#ffffff;display:inline-block;border-radius:8px;border:1px solid #fdba74;">
              ${code}
            </div>
            <div style="font-size:15px;font-weight:700;color:#c2410c;margin-bottom:6px;">Giảm ngay 50.000đ trực tiếp vào đơn hàng</div>
            <p style="margin:6px 0 0;font-size:13px;color:#78350f;font-style:italic;line-height:1.5;">
              📌 <strong>Cách dùng:</strong> Sử dụng mã này khi thanh toán với nhân viên xác nhận đơn (hoặc nhắn mã qua Zalo / Chatbot) để được trừ tiền ngay!
            </p>
          </div>

          <!-- VALUE PROPOSITIONS -->
          <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:10px;margin:20px 0;font-size:14px;color:#1e293b;">
            <div style="font-weight:bold;color:#15803d;margin-bottom:8px;font-size:15px;">🍲 Đặc quyền tiện lợi trong mọi set Lẩu Nhà:</div>
            <p style="margin:5px 0;">• <strong>Không cần sắm nồi:</strong> Tặng khay nhôm chuyên dụng chịu nhiệt đun sôi trực tiếp trên bếp.</p>
            <p style="margin:5px 0;">• <strong>Ăn xong dọn 30s:</strong> Tặng trọn bộ Kit dọn dẹp (túm khăn trải nilon bỏ rác là sạch bàn ăn).</p>
            <p style="margin:5px 0;">• <strong>Free mượn bếp cồn:</strong> Tặng mượn bếp cồn giao tận nhà cho đơn từ 399k (hoàn cọc 100% khi nhận lại bếp).</p>
            <p style="margin:5px 0;">• <strong>Nước cốt hầm 12h:</strong> 100% từ xương tủy và củ quả tươi ngọt thanh nhẹ bụng, không khát nước.</p>
          </div>

          <!-- 2 CTA BUTTONS -->
          <div style="margin:26px 0 16px;text-align:center;">
            <p style="font-weight:bold;font-size:15px;color:#3d2616;margin:0 0 14px;">Bạn cần hỗ trợ tư vấn chọn món hay muốn đặt hàng ngay?</p>
            
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;">
              <tr>
                <td align="center" style="padding:6px;width:50%;">
                  <!-- BUTTON 1: ZALO -->
                  <a href="${zalo_url}" target="_blank" style="display:block;background-color:#0068ff;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 10px;border-radius:10px;font-size:14px;text-align:center;">
                    💬 (1) Nhắn Qua Zalo
                  </a>
                </td>
                <td align="center" style="padding:6px;width:50%;">
                  <!-- BUTTON 2: WEB CHATBOT -->
                  <a href="${chatbot_url}" target="_blank" style="display:block;background-color:#ea580c;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 10px;border-radius:10px;font-size:14px;text-align:center;">
                    🤖 (2) Tư Vấn Nhanh (Bot Web)
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin-top:12px;font-size:12px;color:#78716c;line-height:1.5;">
              *Bấm nút "Tư vấn nhanh" để mở Chatbot tự động hướng dẫn bạn chọn set lẩu và đặt hàng trong 1 phút!
            </div>
          </div>

          <!-- FOOTER -->
          <div style="margin-top:26px;padding-top:16px;border-top:1px dashed #d8cfc3;font-size:14px;color:#6b4d3c;line-height:1.7;">
            Thân mến,<br>
            <strong>Đội ngũ Lẩu Nhà</strong><br>
            📞 Hotline / Zalo: 0819 943 904<br>
            🌐 Website: <a href="${website_url}" style="color:#d57a55;text-decoration:none;font-weight:bold;">laumangdi.com</a>
          </div>

        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const payload = {
    from: RESEND_FROM,
    to: [lead.email],
    ...(ADMIN_EMAIL && lead.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() ? { cc: [ADMIN_EMAIL] } : {}),
    reply_to: RESEND_REPLY_TO,
    subject: subject,
    html: html
  };

  await withTimeout(
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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
