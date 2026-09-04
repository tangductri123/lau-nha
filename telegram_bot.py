import html
import json
import os
from typing import Any, Dict, List
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
    """
    Gửi Card đơn hàng Interactive chuẩn F&B:
    - Danh sách chi tiết từng món + số lượng + đơn giá
    - Bóc tách tài chính: Tổng thu (khách chuyển) vs Doanh thu thực vs Tiền cọc bếp
    - Cảnh báo sai lệch giá (nếu có)
    - Inline Keyboard [ ✅ Chốt đơn & Trừ kho ] [ 💳 Lấy mã QR ] [ ❌ Hủy đơn ]
    """
    chat_id = os.getenv('TELEGRAM_CHAT_ID') or TELEGRAM_CHAT_ID
    if not chat_id:
        raise RuntimeError("TELEGRAM_CHAT_ID is not configured")

    code = str(order.get("order_code") or order.get("orderCode") or order.get("id") or "").strip().upper()
    cust_name = html.escape(str(order.get("customer_name") or order.get("name") or "Khách lẻ"))
    phone = html.escape(str(order.get("phone") or "Chưa có"))
    address = html.escape(str(order.get("address") or "Giao tận nơi"))
    note = html.escape(str(order.get("note") or "Không có"))
    confidence = float(order.get("confidence_score") or 0.95) * 100

    # Items breakdown
    raw_items = order.get("items") or []
    items_lines = []
    items_subtotal = 0
    if isinstance(raw_items, list) and len(raw_items) > 0:
        for it in raw_items:
            p_name = html.escape(str(it.get("matched_db_name") or it.get("name") or it.get("product_name") or "Món"))
            qty = max(1, int(it.get("qty") or it.get("quantity") or 1))
            u_price = int(float(it.get("unit_price") or it.get("price") or 0))
            stotal = int(float(it.get("subtotal") or (qty * u_price) or 0))
            items_subtotal += stotal
            if u_price > 0:
                items_lines.append(f"  • {qty}x <b>{p_name}</b>: <code>{stotal:,} đ</code> ({u_price:,} đ/phần)")
            else:
                items_lines.append(f"  • {qty}x <b>{p_name}</b>: <code>{stotal:,} đ</code>")
    else:
        prod_name = html.escape(str(order.get("product_name") or "Set Lẩu Cặp Đôi (2-3 người)"))
        total_p = int(float(order.get("amount") or order.get("total_amount") or 299000))
        items_subtotal = total_p
        items_lines.append(f"  • 1x <b>{prod_name}</b>: <code>{total_p:,} đ</code>")

    items_text = "\n".join(items_lines)

    # Financial separation
    deposit = int(float(order.get("deposit_amount") or (200000 if order.get("is_stove") else 0)))
    shipping = int(float(order.get("shipping_fee") or 0))
    discount = int(float(order.get("discount_amount") or 0))
    voucher = html.escape(str(order.get("voucher_code") or ""))

    order_value = int(float(order.get("order_value") or max(0, items_subtotal + shipping - discount)))
    total_collection = int(float(order.get("total_collection") or (order_value + deposit)))

    # Warnings
    warnings = order.get("warnings") or []
    warning_text = ""
    if warnings:
        warn_lines = [f"⚠️ <i>{html.escape(str(w))}</i>" for w in warnings]
        warning_text = "\n" + "\n".join(warn_lines) + "\n"

    text = (
        "📦 <b>ĐƠN HÀNG CẦN XÁC NHẬN (AI PARSER)</b>\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"📋 Mã đơn: <code>{code}</code>\n"
        f"👤 Khách: <b>{cust_name}</b>\n"
        f"📞 SĐT: <code>{phone}</code>\n"
        f"📍 Địa chỉ: {address}\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "🍲 <b>CHI TIẾT MÓN ĐẶT:</b>\n"
        f"{items_text}\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "📊 <b>BÓC TÁCH TÀI CHÍNH:</b>\n"
        f"  💵 Tiền món: <b>{items_subtotal:,} đ</b>\n"
    )

    if shipping > 0:
        text += f"  🚚 Phí ship: <b>{shipping:,} đ</b>\n"
    if discount > 0:
        voucher_str = f" ({voucher})" if voucher else ""
        text += f"  🎁 Giảm giá{voucher_str}: <b>-{discount:,} đ</b>\n"
    if deposit > 0:
        text += f"  🔥 Tiền cọc mượn bếp: <b>{deposit:,} đ</b> <i>(Khoản nợ trả lại khách)</i>\n"

    text += (
        "━━━━━━━━━━━━━━━━━━\n"
        f"💰 <b>TỔNG THU (Khách chuyển): <u>{total_collection:,} đ</u></b>\n"
        f"📈 <b>DOANH THU ĐƠN: <u>{order_value:,} đ</u></b>\n"
        f"📝 Ghi chú: {note}\n"
        f"{warning_text}"
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
