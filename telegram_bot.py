"""
Telegram Notification Engine for Lẩu Nhà (SPEC-23).
Enforces strict event-type routing, mandatory 5-tuple dispatch validation,
idempotency, and structured logging.
"""

import html
import json
import os
import re
import subprocess
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set
from urllib.request import Request as UrlRequest, urlopen

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '8814364164:AAE5q48PnNoLMVYJGjqdGyFZrw0LWKbVPi8')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_SALE_GROUP_ID') or os.getenv('TELEGRAM_CHAT_ID', '-5266388149')

# In-memory deduplication cache for dispatched events
_DISPATCHED_KEYS: Set[str] = set()


def _resolve_git_sha() -> str:
    env_sha = os.getenv("GIT_SHA")
    if env_sha and env_sha.strip() and env_sha.strip() != "lau-nha-main":
        return env_sha.strip()
    try:
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2,
            cwd=os.path.dirname(__file__),
        )
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip()
    except Exception:
        pass
    # Fallback to deployed immutable commit SHA on production host
    return "be1655a0d54a40bf0301befb44e14844c6c990dd"


_RUNTIME_GIT_SHA = _resolve_git_sha()
_RUNTIME_INSTANCE_ID = os.getenv("INSTANCE_ID") or f"inst_{os.getpid()}_{uuid.uuid4().hex[:8]}"


def get_runtime_identity() -> Dict[str, Any]:
    container_id = os.getenv("CONTAINER_ID") or os.getenv("HOSTNAME") or "host"
    return {
        "process_id": os.getpid(),
        "container_id": container_id,
        "git_sha": _RUNTIME_GIT_SHA,
        "instance_id": _RUNTIME_INSTANCE_ID,
        "timestamp_tz": datetime.now(timezone.utc).isoformat(),
        "environment": os.getenv("ENVIRONMENT", "production"),
    }


def _format_dispatch_log(event_name: str, **kwargs: Any) -> str:
    ident = get_runtime_identity()
    ordered_keys = [
        "event_type",
        "event_id",
        "target_chat_id",
        "module_name",
        "reason",
        "telegram_message_id",
        "process_id",
        "container_id",
        "git_sha",
        "instance_id",
        "timestamp_tz",
        "webhook_request_id",
        "sepay_transaction_id",
        "notification_key",
        "environment",
    ]
    parts = [event_name]
    combined = {**ident, **kwargs}
    for k in ordered_keys:
        if k in combined and combined[k] is not None:
            parts.append(f"{k}={combined[k]}")
    for k, v in combined.items():
        if k not in ordered_keys and v is not None:
            parts.append(f"{k}={v}")
    return " ".join(parts)


def get_telegram_bot_token() -> str:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    return token


def get_sale_group_id() -> str:
    return os.getenv("TELEGRAM_SALE_GROUP_ID", "").strip()


def get_payment_group_id() -> str:
    return os.getenv("TELEGRAM_PAYMENT_GROUP_ID", "").strip()


def get_kitchen_chat_id() -> str:
    return os.getenv("KITCHEN_CHAT_ID", "").strip()


def send_telegram(
    event_type: str,
    event_id: str,
    chat_id: str,
    payload: Dict[str, Any],
    module_name: str,
    webhook_request_id: Optional[str] = None,
    sepay_transaction_id: Optional[str] = None,
    notification_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Mandatory dispatch validation & execution interface (SPEC-23 & SPEC-23.1).
    Required parameters: event_type, event_id, chat_id, payload, module_name.
    """
    # 1. Validation check for required fields
    if not event_type or not event_id or not chat_id or not payload or not module_name:
        reason = "missing_required_fields"
        print(
            _format_dispatch_log(
                "TELEGRAM_DISPATCH_REJECTED",
                event_type=event_type,
                event_id=event_id,
                target_chat_id=chat_id,
                module_name=module_name,
                reason=reason,
                webhook_request_id=webhook_request_id,
                sepay_transaction_id=sepay_transaction_id,
                notification_key=notification_key,
            )
        )
        return {"ok": False, "rejected": True, "reason": reason}

    sale_group = get_sale_group_id()
    payment_group = get_payment_group_id()

    # 2. Strict routing matrix enforcement
    # SPEC-23: PAYMENT_SUCCESS targeted at -5266388149 (Sale group) is strictly rejected
    if event_type == "PAYMENT_SUCCESS":
        if sale_group and str(chat_id) == str(sale_group):
            reason = "PAYMENT_SUCCESS_TARGETED_AT_SALE_GROUP_REJECTED"
            print(
                _format_dispatch_log(
                    "TELEGRAM_DISPATCH_REJECTED",
                    event_type=event_type,
                    event_id=event_id,
                    target_chat_id=chat_id,
                    module_name=module_name,
                    reason=reason,
                    webhook_request_id=webhook_request_id,
                    sepay_transaction_id=sepay_transaction_id,
                    notification_key=notification_key,
                )
            )
            return {"ok": False, "rejected": True, "reason": reason}
        if payment_group and str(chat_id) != str(payment_group):
            reason = "PAYMENT_SUCCESS_MUST_TARGET_PAYMENT_GROUP_ONLY"
            print(
                _format_dispatch_log(
                    "TELEGRAM_DISPATCH_REJECTED",
                    event_type=event_type,
                    event_id=event_id,
                    target_chat_id=chat_id,
                    module_name=module_name,
                    reason=reason,
                    webhook_request_id=webhook_request_id,
                    sepay_transaction_id=sepay_transaction_id,
                    notification_key=notification_key,
                )
            )
            return {"ok": False, "rejected": True, "reason": reason}

    elif event_type == "NEW_ORDER":
        if sale_group and str(chat_id) != str(sale_group):
            reason = "NEW_ORDER_MUST_TARGET_SALE_GROUP_ONLY"
            print(
                _format_dispatch_log(
                    "TELEGRAM_DISPATCH_REJECTED",
                    event_type=event_type,
                    event_id=event_id,
                    target_chat_id=chat_id,
                    module_name=module_name,
                    reason=reason,
                    webhook_request_id=webhook_request_id,
                    sepay_transaction_id=sepay_transaction_id,
                    notification_key=notification_key,
                )
            )
            return {"ok": False, "rejected": True, "reason": reason}

    elif event_type == "STOVE_RETRIEVAL_REQUIRED":
        if sale_group and str(chat_id) != str(sale_group):
            reason = "STOVE_RETRIEVAL_REQUIRED_MUST_TARGET_SALE_GROUP_ONLY"
            print(
                _format_dispatch_log(
                    "TELEGRAM_DISPATCH_REJECTED",
                    event_type=event_type,
                    event_id=event_id,
                    target_chat_id=chat_id,
                    module_name=module_name,
                    reason=reason,
                    webhook_request_id=webhook_request_id,
                    sepay_transaction_id=sepay_transaction_id,
                    notification_key=notification_key,
                )
            )
            return {"ok": False, "rejected": True, "reason": reason}

    elif event_type in ("KITCHEN_ORDER", "CALLBACK_ANSWER", "MESSAGE_EDIT"):
        # Allowed auxiliary internal event types
        pass
    else:
        reason = f"unregistered_event_type_{event_type}"
        print(
            _format_dispatch_log(
                "TELEGRAM_DISPATCH_REJECTED",
                event_type=event_type,
                event_id=event_id,
                target_chat_id=chat_id,
                module_name=module_name,
                reason=reason,
                webhook_request_id=webhook_request_id,
                sepay_transaction_id=sepay_transaction_id,
                notification_key=notification_key,
            )
        )
        return {"ok": False, "rejected": True, "reason": reason}

    # 3. Idempotency duplicate prevention (SPEC-23 Section 7)
    dedup_key = notification_key or f"{event_type}:{event_id}"
    if dedup_key in _DISPATCHED_KEYS:
        print(
            _format_dispatch_log(
                "TELEGRAM_DISPATCH_DUPLICATE_SUPPRESSED",
                event_type=event_type,
                event_id=event_id,
                target_chat_id=chat_id,
                module_name=module_name,
                notification_key=dedup_key,
                webhook_request_id=webhook_request_id,
                sepay_transaction_id=sepay_transaction_id,
            )
        )
        return {"ok": True, "duplicate": True, "suppressed": True}

    token = get_telegram_bot_token()
    if not token:
        reason = "TELEGRAM_BOT_TOKEN_NOT_CONFIGURED"
        print(
            _format_dispatch_log(
                "TELEGRAM_DISPATCH_REJECTED",
                event_type=event_type,
                event_id=event_id,
                target_chat_id=chat_id,
                module_name=module_name,
                reason=reason,
                webhook_request_id=webhook_request_id,
                sepay_transaction_id=sepay_transaction_id,
                notification_key=dedup_key,
            )
        )
        return {"ok": False, "rejected": True, "reason": reason}

    # 4. Pre-dispatch structured log
    print(
        _format_dispatch_log(
            "TELEGRAM_DISPATCH_ATTEMPT",
            event_type=event_type,
            event_id=event_id,
            target_chat_id=chat_id,
            module_name=module_name,
            notification_key=dedup_key,
            webhook_request_id=webhook_request_id,
            sepay_transaction_id=sepay_transaction_id,
        )
    )

    method = payload.get("method", "sendMessage")
    send_data = {k: v for k, v in payload.items() if k != "method"}
    send_data["chat_id"] = chat_id

    try:
        request = UrlRequest(
            f"https://api.telegram.org/bot{token}/{method}",
            data=json.dumps(send_data, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=15) as response:
            result = json.loads(response.read().decode("utf-8"))

        if result.get("ok"):
            _DISPATCHED_KEYS.add(dedup_key)
            msg_id = result.get("result", {}).get("message_id")
            print(
                _format_dispatch_log(
                    "TELEGRAM_DISPATCH_SENT",
                    event_type=event_type,
                    event_id=event_id,
                    target_chat_id=chat_id,
                    module_name=module_name,
                    telegram_message_id=str(msg_id),
                    notification_key=dedup_key,
                    webhook_request_id=webhook_request_id,
                    sepay_transaction_id=sepay_transaction_id,
                )
            )
        else:
            print(f"[Telegram API Warning] {method}: {result.get('description')}")
        return result

    except Exception as e:
        print(f"[Telegram Error] {method}: {e}")
        return {"ok": False, "description": str(e)}


def _vnd(value: Any) -> str:
    try:
        return f"{int(float(value or 0)):,}".replace(",", ".") + "đ"
    except (TypeError, ValueError):
        return "0đ"


def send_interactive_order_card(order: Dict[str, Any], chat_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Send an interactive order notification card to Telegram (SPEC-23: NEW_ORDER only).
    """
    # Reject if someone passes PAYMENT_SUCCESS to this builder
    if order.get("event_type") == "PAYMENT_SUCCESS":
        raise ValueError("PAYMENT_SUCCESS cannot use send_interactive_order_card")

    target_chat_id = chat_id or order.get("chat_id") or get_sale_group_id()
    if not target_chat_id:
        target_chat_id = os.getenv("TELEGRAM_SALE_GROUP_ID", "-5266388149")

    code = str(order.get("order_code") or order.get("orderCode") or order.get("code") or order.get("id") or "").strip().upper()
    if not code or code == "LN_UNKNOWN":
        code = f"LN{int(time.time()) % 10000:04d}"

    event_id = str(order.get("event_id") or f"new_order_{code}")

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

    source_type = str(order.get("source") or ("chatbot" if order.get("is_chatbot") else "website")).lower()
    if "grab" in source_type:
        title = f"🟢 <b>[GRABFOOD] ĐƠN HÀNG #{html.escape(code)}</b>"
    elif "shopee" in source_type:
        title = f"🟠 <b>[SHOPEEFOOD] ĐƠN HÀNG #{html.escape(code)}</b>"
    elif "screenshot" in source_type or "image" in source_type or "photo" in source_type:
        title = f"📸 <b>[ẢNH CHỤP APP] ĐƠN HÀNG #{html.escape(code)}</b>"
    elif "chatbot" in source_type:
        title = f"💬 <b>[CHATBOT AI] ĐƠN HÀNG #{html.escape(code)}</b>"
    else:
        title = f"🌐 <b>[WEBSITE] ĐƠN HÀNG #{html.escape(code)}</b>"

    warn_block = ""
    warnings = order.get("warnings") or []
    if warnings and isinstance(warnings, list):
        warn_block = "\n⚠️ <b>Cảnh báo cần duyệt:</b>\n" + "\n".join([f"  • {html.escape(str(w))}" for w in warnings]) + "\n"

    review_state = order.get("review_state") or ("NEEDS_REVIEW" if warnings else "APPROVED")
    state_badge = f"\n🏷️ <b>Trạng thái duyệt:</b> <code>{review_state}</code>"

    text = (
        f"{title}\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"👤 <b>Khách hàng:</b> {html.escape(name)}\n"
        f"📞 <b>SĐT:</b> <code>{html.escape(phone)}</code>\n"
        f"📍 <b>Địa chỉ:</b> {html.escape(address)}"
        f"{time_block}"
        f"{email_block}"
        f"{note_block}"
        f"{state_badge}"
        f"{warn_block}\n\n"
        f"🛒 <b>Chi tiết món:</b>\n"
        f"{items_text}\n\n"
        f"💰 <b>Chi phí:</b>\n"
        f"{chr(10).join(financial_lines)}\n"
        f"━━━━━━━━━━━━━━━━━━"
    )

    admin_hub_url = os.getenv("ADMIN_HUB_URL", "https://laumangdi.com/admin/")
    sepay_acc = os.getenv("SEPAY_ACCOUNT_NUMBER", "22678555999")
    sepay_bank = os.getenv("SEPAY_BANK", "MBBank")
    total_coll = int(float(order.get("total_collection") or (subtotal + shipping_fee + deposit_amount - discount_amount)))
    qr_payment_url = order.get("qr_payment_url") or f"https://qr.sepay.vn/img?acc={sepay_acc}&bank={sepay_bank}&amount={total_coll}&des={code}"

    btn_confirm = f"confirm|{code}|PENDING"
    btn_cancel = f"cancel|{code}|PENDING"
    for cb_candidate in (btn_confirm, btn_cancel):
        if len(cb_candidate.encode("utf-8")) > 64:
            raise ValueError(f"callback_data exceeds 64-byte limit: {cb_candidate}")

    keyboard = [
        [
            {"text": "✅ XÁC NHẬN", "callback_data": btn_confirm},
            {"text": "💳 QR PAY", "url": qr_payment_url},
        ],
        [
            {"text": "🌐 HUB", "url": admin_hub_url},
            {"text": "❌ HỦY ĐƠN", "callback_data": btn_cancel},
        ],
    ]

    payload = {
        "method": "sendMessage",
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": keyboard},
    }

    return send_telegram(
        event_type="NEW_ORDER",
        event_id=event_id,
        chat_id=target_chat_id,
        payload=payload,
        module_name="lau_nha.telegram_bot",
    )


def send_kitchen_order_card(order: Dict[str, Any], chat_id: Optional[str] = None) -> Dict[str, Any]:
    """Send order card to Kitchen group."""
    target_chat_id = chat_id or get_kitchen_chat_id()
    if not target_chat_id:
        target_chat_id = os.getenv("KITCHEN_CHAT_ID", "-5566848105")

    code = str(order.get("order_code") or order.get("orderCode") or "").strip().upper()
    event_id = str(order.get("event_id") or f"kitchen_order_{code}")

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

    admin_hub_url = os.getenv("ADMIN_HUB_URL", "https://laumangdi.com/admin/")
    btn_cook = f"cook|{code}|CONFIRMED"
    btn_ready = f"ready|{code}|COOKING"
    btn_kcancel = f"cancel|{code}|COOKING"
    for cb_candidate in (btn_cook, btn_ready, btn_kcancel):
        if len(cb_candidate.encode("utf-8")) > 64:
            raise ValueError(f"callback_data exceeds 64-byte limit: {cb_candidate}")

    keyboard = [
        [
            {"text": "🍳 Bếp Nhận Nấu", "callback_data": btn_cook},
            {"text": "✅ Đã Nấu Xong", "callback_data": btn_ready},
        ],
        [
            {"text": "🌐 HUB", "url": admin_hub_url},
            {"text": "❌ HỦY ĐƠN (Hết món)", "callback_data": btn_kcancel},
        ],
    ]

    payload = {
        "method": "sendMessage",
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": keyboard},
    }

    return send_telegram(
        event_type="KITCHEN_ORDER",
        event_id=event_id,
        chat_id=target_chat_id,
        payload=payload,
        module_name="lau_nha.telegram_bot",
    )


def send_telegram_card(order: Dict[str, Any]) -> Dict[str, Any]:
    """Alias for backwards compatibility."""
    return send_interactive_order_card(order)


def answer_callback_query(callback_id: str, text: str, show_alert: bool = False) -> Dict[str, Any]:
    token = get_telegram_bot_token()
    if not token:
        return {"ok": False, "description": "TELEGRAM_BOT_TOKEN is not configured"}
    payload = {"callback_query_id": callback_id, "text": text, "show_alert": show_alert}
    try:
        request = UrlRequest(
            f"https://api.telegram.org/bot{token}/answerCallbackQuery",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {"ok": False, "description": str(e)}


def edit_telegram_message(chat_id: Any, message_id: Any, text: str, reply_markup: Dict[str, Any] = None) -> Dict[str, Any]:
    token = get_telegram_bot_token()
    if not token:
        return {"ok": False, "description": "TELEGRAM_BOT_TOKEN is not configured"}
    payload = {"chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML"}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        request = UrlRequest(
            f"https://api.telegram.org/bot{token}/editMessageText",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {"ok": False, "description": str(e)}


def _telegram_post(method: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Internal helper for auxiliary operations."""
    token = get_telegram_bot_token()
    if not token:
        return {"ok": False, "description": "TELEGRAM_BOT_TOKEN is not configured"}
    try:
        request = UrlRequest(
            f"https://api.telegram.org/bot{token}/{method}",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {"ok": False, "description": str(e)}
