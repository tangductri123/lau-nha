import html
import json
import os
from typing import Any, Dict
from urllib.request import Request as UrlRequest, urlopen

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '-5566848105')

def _telegram_post(method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    token = os.getenv('TELEGRAM_BOT_TOKEN') or TELEGRAM_BOT_TOKEN
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
    request = UrlRequest(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=15) as response:
        result = json.loads(response.read().decode("utf-8"))
    if not result.get("ok"):
        raise RuntimeError(result.get("description", "Telegram API error"))
    return result

def send_interactive_order_card(order: Dict[str, Any]) -> Dict[str, Any]:
    """Gửi Card đơn hàng Interactive kèm nút bấm Inline Keyboard [Chốt đơn] [QR] [Hủy]"""
    chat_id = os.getenv('TELEGRAM_CHAT_ID') or TELEGRAM_CHAT_ID
    if not chat_id:
        raise RuntimeError("TELEGRAM_CHAT_ID is not configured")

    code = str(order.get("order_code") or order.get("orderCode") or order.get("id") or "").strip().upper()
    cust_name = html.escape(str(order.get("customer_name") or order.get("name") or "Khách lẻ"))
    phone = html.escape(str(order.get("phone") or "Chưa có"))
    address = html.escape(str(order.get("address") or "Giao tận nơi"))
    prod_name = html.escape(str(order.get("product_name") or "Set Lẩu Cặp Đôi"))
    is_stove = bool(order.get("is_stove") or order.get("stove_included"))
    total_amt = int(float(order.get("total_amount") or order.get("amount") or 299000))
    note = html.escape(str(order.get("note") or "Không có"))
    confidence = float(order.get("confidence_score") or 0.95) * 100

    text = (
        "📦 <b>ĐƠN HÀNG CẦN XÁC NHẬN (AI MCP)</b>\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"📋 Mã đơn: <code>{code}</code>\n"
        f"👤 Khách: <b>{cust_name}</b>\n"
        f"📞 SĐT: <code>{phone}</code>\n"
        f"📍 Địa chỉ: {address}\n"
        f"🍲 Món: <b>{prod_name}</b>\n"
        f"🔥 Mượn bếp cồn: {'CÓ (Miễn phí)' if is_stove else 'Không'}\n"
        f"💰 Tổng tiền: <b>{total_amt:,} đ</b>\n"
        f"📝 Ghi chú: {note}\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"🎯 <i>Độ tin cậy AI: {confidence:.0f}%</i>"
    )

    keyboard = {
        "inline_keyboard": [
            [
                {"text": "✅ Chốt đơn & Trừ kho", "callback_data": f"confirm_{code}"},
                {"text": "💳 Lấy mã QR", "callback_data": f"qr_{code}"}
            ],
            [
                {"text": "❌ Hủy đơn", "callback_data": f"cancel_{code}"}
            ]
        ]
    }

    return _telegram_post("sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": keyboard
    })

def answer_callback_query(callback_id: str, text: str, show_alert: bool = False) -> Dict[str, Any]:
    return _telegram_post("answerCallbackQuery", {
        "callback_query_id": callback_id, "text": text, "show_alert": show_alert,
    })

def edit_telegram_message(chat_id: Any, message_id: Any, text: str) -> Dict[str, Any]:
    return _telegram_post("editMessageText", {
        "chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML",
    })
