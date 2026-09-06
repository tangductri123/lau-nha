import html
import json
import os
import re
from typing import Any, Dict, Optional
from urllib.request import Request as UrlRequest, urlopen

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '-5266388149')


def _telegram_post(method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    token = TELEGRAM_BOT_TOKEN or os.getenv('TELEGRAM_BOT_TOKEN', '8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8')
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


def _vnd(value: Any) -> str:
    try:
        return f"{int(float(value or 0)):,}".replace(",", ".") + "đ"
    except (TypeError, ValueError):
        return "0đ"


def send_interactive_order_card(order: Dict[str, Any], chat_id: Optional[str] = None) -> Dict[str, Any]:
    """Send an interactive order notification card to Telegram with confirm/QR/cancel buttons."""
    target_chat_id = chat_id or order.get('chat_id') or TELEGRAM_CHAT_ID or os.getenv('TELEGRAM_CHAT_ID', '-5266388149')
    if not target_chat_id:
        raise RuntimeError("TELEGRAM_CHAT_ID is not configured")

    code = str(order.get("order_code") or order.get("orderCode") or order.get("id") or "").strip().upper()
    if not code:
        code = "LN_UNKNOWN"

    name = str(order.get("name") or order.get("customer_name") or "Khách hàng").strip()
    phone = str(order.get("phone") or order.get("customer_phone") or "").strip()
    address = str(order.get("address") or order.get("customer_address") or "Chưa có").strip()
    note = str(order.get("note") or order.get("cust_note") or "").strip()
    
    items = order.get("items") or order.get("orders") or []
    item_lines = []
    subtotal = 0.0
    for it in items:
        it_name = html.escape(str(it.get("name") or it.get("title") or "Sản phẩm"))
        it_qty = max(1, int(it.get("qty") or it.get("quantity") or 1))
        it_price = float(it.get("price") or it.get("unit_price") or 0)
        subtotal += it_price * it_qty
        item_lines.append(f"  • {it_name} x{it_qty} (<i>{_vnd(it_price * it_qty)}</i>)")

    is_stove = bool(order.get("is_stove") or order.get("stove_included"))
    shipping_fee = float(order.get("shipping_fee") or 0)
    discount_amount = float(order.get("discount_amount") or 0)
    voucher_code = str(order.get("voucher_code") or "").strip()
    deposit_amount = float(order.get("deposit_amount") or (200000 if is_stove else 0))
    total_collection = float(order.get("total_collection") or (subtotal + shipping_fee + deposit_amount - discount_amount))

    items_text = "\n".join(item_lines) if item_lines else "  • Không có chi tiết món"
    
    financial_lines = [f"• Tiền món: <b>{_vnd(subtotal)}</b>"]
    if shipping_fee > 0:
        financial_lines.append(f"• Phí ship: <b>{_vnd(shipping_fee)}</b>")
    if discount_amount > 0:
        v_str = f" ({voucher_code})" if voucher_code else ""
        financial_lines.append(f"• Giảm giá{v_str}: <b>-{_vnd(discount_amount)}</b>")
    if deposit_amount > 0 or is_stove:
        financial_lines.append(f"• Cọc bếp (hoàn lại): <b>+{_vnd(deposit_amount)}</b>")
    financial_lines.append(f"👉 <b>TỔNG THU: {_vnd(total_collection)}</b>")

    email = str(order.get("email") or order.get("customer_email") or "").strip()
    delivery_time = str(order.get("delivery_time") or order.get("time") or "").strip()
    
    note_block = f"\n📝 <b>Ghi chú:</b> {html.escape(note)}" if note else ""
    email_block = f"\n✉️ <b>Email:</b> {html.escape(email)}" if email else ""
    time_block = f"\n⏰ <b>Giờ giao:</b> <b>{html.escape(delivery_time)}</b>" if delivery_time else ""

    is_chatbot = bool(order.get("is_chatbot") or "chatbot" in note.lower())
    title = f"🔥 <b>ĐƠN HÀNG MỚI TỪ CHATBOT #{html.escape(code)}</b>" if is_chatbot else f"🔥 <b>ĐƠN HÀNG MỚI WEBSITE #{html.escape(code)}</b>"

    text = (
        f"{title}\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"👤 <b>Khách hàng:</b> {html.escape(name)}\n"
        f"📞 <b>SĐT:</b> <code>{html.escape(phone)}</code>\n"
        f"📍 <b>Địa chỉ:</b> {html.escape(address)}"
        f"{time_block}"
        f"{email_block}"
        f"{note_block}\n\n"
        f"🛒 <b>Chi tiết món:</b>\n"
        f"{items_text}\n\n"
        f"💰 <b>Chi phí:</b>\n"
        f"{chr(10).join(financial_lines)}\n"
        f"━━━━━━━━━━━━━━━━━━"
    )

    keyboard = [
        [
            {"text": "✅ Chốt đơn", "callback_data": f"confirm_{code}"},
            {"text": "💳 VietQR", "callback_data": f"qr_{code}"},
            {"text": "❌ Hủy", "callback_data": f"cancel_{code}"}
        ]
    ]

    return _telegram_post("sendMessage", {
        "chat_id": target_chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": keyboard},
    })


def send_kitchen_order_card(order: Dict[str, Any], chat_id: Optional[str] = "-5566848105") -> Dict[str, Any]:
    """Send order card to Kitchen group."""
    target_chat_id = chat_id or os.getenv('KITCHEN_CHAT_ID', '-5566848105')
    code = str(order.get("order_code") or order.get("orderCode") or "").strip().upper()
    name = str(order.get("name") or order.get("customer_name") or "Khách hàng").strip()
    phone = str(order.get("phone") or order.get("customer_phone") or "").strip()
    address = str(order.get("address") or order.get("customer_address") or "Chưa có").strip()
    note = str(order.get("note") or order.get("cust_note") or "").strip()
    
    items = order.get("items") or order.get("orders") or []
    item_lines = []
    for it in items:
        it_name = html.escape(str(it.get("name") or it.get("title") or "Món"))
        it_qty = max(1, int(it.get("qty") or it.get("quantity") or 1))
        item_lines.append(f"  🍲 <b>{it_name}</b> x{it_qty}")

    items_text = "\n".join(item_lines) if item_lines else "  🍲 Không có chi tiết món"
    
    is_paid = bool(order.get("is_paid") or order.get("payment_status") == "paid" or order.get("status") == "paid")
    payment_str = "✅ ĐÃ THANH TOÁN (Chuyển khoản SePay)" if is_paid else f"💵 THU HỘ COD: {_vnd(order.get('total_collection', 0))}"
    
    delivery_time = str(order.get("delivery_time") or order.get("time") or "").strip()
    time_block = f"\n⏰ <b>Giờ giao mong muốn:</b> <b>{html.escape(delivery_time)}</b>" if delivery_time else ""
    note_block = f"\n📝 <b>Ghi chú:</b> {html.escape(note)}" if note else ""

    text = (
        f"👨‍🍳 <b>BẾP NHẬN ĐƠN HÀNG #{html.escape(code)}</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"👤 <b>Khách hàng:</b> {html.escape(name)}\n"
        f"📞 <b>SĐT:</b> <code>{html.escape(phone)}</code>\n"
        f"📍 <b>Địa chỉ:</b> {html.escape(address)}"
        f"{time_block}"
        f"{note_block}\n\n"
        f"🥘 <b>DANH SÁCH MÓN CẦN CHUẨN BỊ:</b>\n"
        f"{items_text}\n\n"
        f"💰 <b>Thanh toán:</b> <b>{payment_str}</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"⏰ <i>Chốt đơn lúc {order.get('confirmed_time', '')}</i>"
    )

    return _telegram_post("sendMessage", {
        "chat_id": target_chat_id,
        "text": text,
        "parse_mode": "HTML",
    })


def send_telegram_card(order: Dict[str, Any]) -> Dict[str, Any]:
    """Alias for backwards compatibility."""
    return send_interactive_order_card(order)


def answer_callback_query(callback_id: str, text: str, show_alert: bool = False) -> Dict[str, Any]:
    return _telegram_post("answerCallbackQuery", {
        "callback_query_id": callback_id, "text": text, "show_alert": show_alert,
    })


def edit_telegram_message(chat_id: Any, message_id: Any, text: str, reply_markup: Dict[str, Any] = None) -> Dict[str, Any]:
    payload = {
        "chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML",
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    return _telegram_post("editMessageText", payload)
