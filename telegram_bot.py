"""Telegram notifications and callbacks for finalized orders."""
import html
import json
import os
from typing import Any, Dict
from urllib.request import Request as UrlRequest, urlopen

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')


def _telegram_post(method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    if not TELEGRAM_BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
    request = UrlRequest(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}",
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


def send_telegram_card(order: Dict[str, Any]) -> Dict[str, Any]:
    """Send a finalized order card with confirm/edit buttons."""
    chat_id = TELEGRAM_CHAT_ID
    if not chat_id:
        raise RuntimeError("TELEGRAM_CHAT_ID is not configured")

    code = str(order.get("order_code") or order.get("orderCode") or order.get("id") or "").strip()
    if not code:
        raise ValueError("order_code is required")

    lines = []
    for item in order.get("items") or order.get("orders") or []:
        name = html.escape(str(item.get("name") or item.get("title") or "Sản phẩm"))
        quantity = int(item.get("qty") or item.get("quantity") or 1)
        price = float(item.get("price") or item.get("unit_price") or 0)
        lines.append(f"• {name} x{quantity}: {_vnd(price * quantity)}")

    text = (
        f"<b>ĐƠN HÀNG FINAL {html.escape(code)}</b>\n\n"
        f"<b>Khách:</b> {html.escape(str(order.get('name') or ''))}\n"
        f"<b>SĐT:</b> {html.escape(str(order.get('phone') or ''))}\n"
        f"<b>Địa chỉ:</b> {html.escape(str(order.get('address') or ''))}\n"
        f"<b>Mượn bếp:</b> {'Có' if order.get('stove_included') else 'Không'}\n\n"
        f"<b>Món hàng:</b>\n{chr(10).join(lines) or '• Chưa có thông tin'}\n\n"
        f"<b>TỔNG CỘNG: {_vnd(order.get('total'))}</b>"
    )
    return _telegram_post("sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": [
            [{"text": "✅ Xác nhận & Trừ kho", "callback_data": f"final_confirm:{code}"}],
            [{"text": "✏️ Sửa lại", "callback_data": f"final_edit:{code}"}],
        ]},
    })


def answer_callback_query(callback_id: str, text: str, show_alert: bool = False) -> Dict[str, Any]:
    return _telegram_post("answerCallbackQuery", {
        "callback_query_id": callback_id, "text": text, "show_alert": show_alert,
    })


def edit_telegram_message(chat_id: Any, message_id: Any, text: str) -> Dict[str, Any]:
    return _telegram_post("editMessageText", {
        "chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML",
    })
