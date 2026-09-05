const fs = require('fs');
const path = require('path');

const _DEFAULT_BOT_TOKEN = Buffer.from('ODgxNDM2NDE2NDpBQUU1cTQ4UG5Ob0xNVllKR2pxZEd5RlpydzBMV0tiVlBpOA==', 'base64').toString('utf8');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || _DEFAULT_BOT_TOKEN;

async function tgPost(method, payload) {
  const res = await fetch(https://api.telegram.org/bot/, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json().catch(() => ({}));
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Telegram Webhook Endpoint' });
  }

  const update = req.body || {};
  const callback = update.callback_query;

  if (!callback) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const callbackId = callback.id;
  const callbackData = String(callback.data || '');
  const fromUser = callback.from?.first_name || callback.from?.username || 'Admin';
  const message = callback.message || {};
  const chatId = message.chat?.id;
  const msgId = message.message_id;
  const originalText = String(message.text || '');

  let action = '';
  let code = '';

  if (callbackData.startsWith('confirm_') || callbackData.startsWith('final_confirm:')) {
    action = 'confirm';
    code = callbackData.replace('final_confirm:', '').replace('confirm_', '').trim().toUpperCase();
  } else if (callbackData.startsWith('qr_')) {
    action = 'qr';
    code = callbackData.replace('qr_', '').trim().toUpperCase();
  } else if (callbackData.startsWith('cancel_')) {
    action = 'cancel';
    code = callbackData.replace('cancel_', '').trim().toUpperCase();
  }

  if (!code) {
    if (callbackId) {
      await tgPost('answerCallbackQuery', { callback_query_id: callbackId, text: 'Yêu cầu không hợp lệ' });
    }
    return res.status(200).json({ ok: true });
  }

  const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  try {
    if (action === 'confirm') {
      await tgPost('answerCallbackQuery', { callback_query_id: callbackId, text: ✅ Đã xác nhận đơn #! });

      fetch(http://103.97.127.184:3000/api/telegram/webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query: callback })
      }).catch(() => {});

      if (chatId && msgId) {
        const cleanOrig = esc(originalText);
        const newText = cleanOrig + \n\n━━━━━━━━━━━━━━━━━━\n✅ <b>ĐÃ XÁC NHẬN ĐƠN HÀNG</b> bởi  lúc \n📌 Trạng thái: <b>Đã xác nhận (confirmed)</b>;
        
        await tgPost('editMessageText', {
          chat_id: chatId,
          message_id: msgId,
          text: newText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💳 Lấy mã QR', callback_data: qr_ },
                { text: '❌ Hủy đơn', callback_data: cancel_ }
              ]
            ]
          }
        });
      }

    } else if (action === 'qr') {
      await tgPost('answerCallbackQuery', { callback_query_id: callbackId, text: 💳 Đang gửi mã QR #... });

      const qrUrl = https://qr.sepay.vn/img?acc=22678555999&bank=TPBank&amount=453000&des=&template=compact;
      const caption = 💳 <b>MÃ VIETQR THANH TOÁN CHO ĐƠN #</b>\n• Ngân hàng: <b>TPBank (Tiên Phong)</b>\n• Số tài khoản: <code>22678555999</code>\n• Nội dung CK: <code></code>\n\n<i>Khách chuyển khoản đúng nội dung trên hệ thống sẽ tự động xác nhận thanh toán.</i>;

      await tgPost('sendPhoto', {
        chat_id: chatId,
        photo: qrUrl,
        caption: caption,
        parse_mode: 'HTML'
      });

    } else if (action === 'cancel') {
      await tgPost('answerCallbackQuery', { callback_query_id: callbackId, text: ❌ Đã hủy đơn #! });

      fetch(http://103.97.127.184:3000/api/telegram/webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query: callback })
      }).catch(() => {});

      if (chatId && msgId) {
        const cleanOrig = esc(originalText);
        const newText = cleanOrig + \n\n━━━━━━━━━━━━━━━━━━\n❌ <b>ĐÃ HỦY ĐƠN HÀNG</b> bởi  lúc \n📌 Trạng thái: <b>Đã hủy (cancelled)</b>;

        await tgPost('editMessageText', {
          chat_id: chatId,
          message_id: msgId,
          text: newText,
          parse_mode: 'HTML'
        });
      }
    }
  } catch (err) {
    console.error('Telegram Webhook error:', err);
  }

  return res.status(200).json({ ok: true });
};
