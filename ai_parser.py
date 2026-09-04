import os
import sys
import json
import hashlib
import re
import difflib
import sqlite3
from typing import Dict, Any, List, Tuple, Optional
import requests

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

SYSTEM_PROMPT = """
Bạn là chuyên gia kế toán và vận hành cho Lẩu Nhà (website: laumangdi.com).
Nhiệm vụ: Chuyển tin nhắn chat chốt đơn của khách hoặc nhân viên thành JSON chuẩn xác tuyệt đối về số liệu và danh mục món.

SCHEMA YÊU CẦU:
{
    "customer_name": "Tên khách hàng",
    "phone": "Số điện thoại nhận hàng (chỉ lấy số)",
    "address": "Địa chỉ giao hàng",
    "items": [
        {
            "name": "Tên món chính xác (ví dụ: Set Lẩu Gia Đình, Lẩu Thái Tom Yum, Thêm Ba Chỉ Bò Mỹ)",
            "qty": 1,
            "unit_price": 0,
            "subtotal": 0
        }
    ],
    "financials": {
        "deposit_amount": 0,   // Tiền cọc mượn bếp cồn (ví dụ: 200000 nếu có mượn bếp, không mượn = 0)
        "shipping_fee": 0,     // Phí ship (ví dụ: 20000, 30000, nếu freeship = 0)
        "discount_amount": 0,  // Số tiền giảm giá voucher (số dương, ví dụ: 50000)
        "voucher_code": "Mã giảm giá nếu có (ví dụ: LAUNHA50K)",
        "total_collection": 0, // TỔNG THU: (Tổng tiền món + Phí ship + Tiền cọc) - Giảm giá
        "order_value": 0       // TỔNG ĐƠN (Doanh thu thực): (Tổng tiền món + Phí ship) - Giảm giá
    },
    "is_stove": false,        // Khách có mượn bếp cồn/nồi không
    "note": "Ghi chú khẩu vị, thời gian giao",
    "confidence_score": 0.0 to 1.0,
    "is_final_order": true/false
}

QUY TẮC VÀNG VỀ DỮ LIỆU:
1. Tên món: Trích xuất sát nhất với tin nhắn (không tự bịa món không có).
2. Tính toán tài chính:
   - subtotal của từng món = qty * unit_price.
   - items_total = sum(subtotal).
   - total_collection = (items_total + shipping_fee + deposit_amount) - discount_amount.
   - order_value = (items_total + shipping_fee) - discount_amount.
3. Chuyển đổi số tiền: Mọi định dạng 712k, 712.000, 712000đ đều chuyển về số nguyên (712000).
4. Tiền cọc bếp: Mượn bếp cồn thường có cọc 200.000đ (được hoàn lại khi trả bếp, là tiền cọc chứ không phải doanh thu).
5. Confidence Score:
   - 1.0: Đầy đủ tên, SĐT, địa chỉ, món, và khớp toàn bộ phép tính.
   - 0.8: Đầy đủ thông tin nhưng có số tiền chưa khớp hoặc cần đối soát.
   - 0.5: Thiếu SĐT hoặc địa chỉ nhận hàng.
"""

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def get_all_db_products(conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
    should_close = False
    if not conn:
        db_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "My-Brain", "brain.db"),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "brain.db"),
            "/opt/my-website/My-Brain/brain.db",
            "/app/My-Brain/brain.db"
        ]
        target = None
        for p in db_paths:
            if os.path.exists(p):
                target = p
                break
        if not target:
            return []
        conn = sqlite3.connect(target, timeout=10.0)
        conn.row_factory = sqlite3.Row
        should_close = True

    try:
        rows = conn.execute("SELECT id, name, type, price, stock FROM products").fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[get_all_db_products Error]: {e}")
        return []
    finally:
        if should_close:
            conn.close()

def match_product(item_name: str, db_products: List[Dict[str, Any]]) -> Tuple[Optional[Dict[str, Any]], float, Optional[str]]:
    """
    Fuzzy matching tên món với danh mục sản phẩm trong DB.
    Trả về (product_dict, score, warning_message).
    """
    if not item_name or not db_products:
        return (None, 0.0, "Không có tên món hoặc DB trống")

    norm_query = normalize_text(item_name)

    # 1. Exact match
    for p in db_products:
        norm_p = normalize_text(p["name"])
        if norm_query == norm_p:
            return (p, 1.0, None)

    # 2. Substring match
    for p in db_products:
        norm_p = normalize_text(p["name"])
        if norm_query in norm_p or norm_p in norm_query:
            return (p, 0.92, None)

    # 3. Fuzzy similarity
    best_prod = None
    best_score = 0.0
    for p in db_products:
        norm_p = normalize_text(p["name"])
        ratio = difflib.SequenceMatcher(None, norm_query, norm_p).ratio()
        if ratio > best_score:
            best_score = ratio
            best_prod = p

    if best_score >= 0.55:
        return (best_prod, round(best_score, 2), None)

    return (best_prod or db_products[0], round(best_score, 2), f"Món '{item_name}' không tìm thấy trong DB (gợi ý: {best_prod['name'] if best_prod else 'N/A'})")

def validate_and_recalculate_order(parsed: Dict[str, Any], db_conn: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
    """
    Đối soát giá và tính toán lại toàn bộ cấu trúc tài chính của đơn hàng.
    """
    db_products = get_all_db_products(db_conn)
    warnings = []

    raw_items = parsed.get("items") or []
    validated_items = []
    items_subtotal = 0.0

    for it in raw_items:
        it_name = str(it.get("name") or "Món").strip()
        qty = max(1, int(it.get("qty") or 1))
        unit_price = float(it.get("unit_price") or it.get("price") or 0)

        matched_p, score, warn = match_product(it_name, db_products)
        if warn:
            warnings.append(warn)

        db_price = float(matched_p["price"]) if matched_p else unit_price
        db_prod_id = matched_p["id"] if matched_p else None
        db_name = matched_p["name"] if matched_p else it_name

        # Nếu AI không có giá hoặc giá khác giá niêm yết DB
        if unit_price <= 0:
            unit_price = db_price
        elif db_price > 0 and abs(unit_price - db_price) > 1000:
            warnings.append(f"⚠️ Giá món '{it_name}' ({int(unit_price):,}đ) lệch so với giá niêm yết DB '{db_name}' ({int(db_price):,}đ)")

        subtotal = qty * unit_price
        items_subtotal += subtotal

        validated_items.append({
            "name": it_name,
            "matched_db_name": db_name,
            "product_id": db_prod_id,
            "product_type": matched_p.get("type", "physical") if matched_p else "physical",
            "qty": qty,
            "unit_price": int(unit_price),
            "db_price": int(db_price),
            "subtotal": int(subtotal),
            "match_confidence": score
        })

    # Financials
    fin = parsed.get("financials") or {}
    deposit = float(fin.get("deposit_amount") or parsed.get("deposit_stove") or (200000 if parsed.get("is_stove") else 0))
    shipping = float(fin.get("shipping_fee") or 0)
    discount = float(fin.get("discount_amount") or parsed.get("discount") or 0)
    voucher = str(fin.get("voucher_code") or parsed.get("voucher_code") or "")

    order_value = max(0, items_subtotal + shipping - discount)
    total_collection = max(0, items_subtotal + shipping + deposit - discount)

    # Check total mismatch
    ai_total = float(fin.get("total_collection") or parsed.get("total_amount") or 0)
    if ai_total > 0 and abs(ai_total - total_collection) > 1000:
        warnings.append(f"⚠️ Tổng tiền tin nhắn ({int(ai_total):,}đ) lệch so với hệ thống tính ({int(total_collection):,}đ)")

    confidence = float(parsed.get("confidence_score") or 0.9)
    if warnings:
        confidence = min(confidence, 0.75)

    return {
        "customer_name": parsed.get("customer_name") or "Khách hàng",
        "phone": parsed.get("phone") or "",
        "address": parsed.get("address") or "",
        "items": validated_items,
        "items_subtotal": int(items_subtotal),
        "deposit_amount": int(deposit),
        "shipping_fee": int(shipping),
        "discount_amount": int(discount),
        "voucher_code": voucher,
        "order_value": int(order_value),
        "total_collection": int(total_collection),
        "is_stove": bool(deposit > 0 or parsed.get("is_stove")),
        "note": parsed.get("note") or "",
        "confidence_score": confidence,
        "is_final_order": parsed.get("is_final_order", True),
        "warnings": warnings
    }

class AIParser:
    def __init__(self):
        self.model = "gemini-1.5-flash"

    def parse_order(self, text: str) -> Dict[str, Any]:
        """Bóc tách tin nhắn text sang JSON và tự động đối soát DB"""
        if not GEMINI_API_KEY:
            # Simple regex fallback if no Gemini key
            return self._fallback_parse(text)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": f"{SYSTEM_PROMPT}\n\nTin nhắn đơn hàng cần bóc tách:\n{text}"}]}],
            "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
        }

        try:
            res = requests.post(url, json=payload, timeout=15)
            res.raise_for_status()
            res_json = res.json()
            content_str = res_json['candidates'][0]['content']['parts'][0]['text']
            parsed_raw = json.loads(content_str)
            return validate_and_recalculate_order(parsed_raw)
        except Exception as e:
            print(f"[AI Parser Gemini Error]: {e}")
            return self._fallback_parse(text)

    def _fallback_parse(self, text: str) -> Dict[str, Any]:
        phone_match = re.search(r"(0|\+84)(3|5|7|8|9)\d{8}", text)
        phone = phone_match.group(0) if phone_match else ""
        
        parsed_raw = {
            "customer_name": "Khách Đặt Lẩu",
            "phone": phone,
            "address": "Giao tận nơi",
            "items": [{"name": "Set Lẩu Cặp Đôi (2-3 người)", "qty": 1, "unit_price": 299000, "subtotal": 299000}],
            "financials": {
                "deposit_amount": 200000 if "bếp" in text.lower() else 0,
                "shipping_fee": 0,
                "discount_amount": 0,
                "voucher_code": "",
                "total_collection": 299000,
                "order_value": 299000
            },
            "is_stove": "bếp" in text.lower(),
            "note": text[:100],
            "confidence_score": 0.6,
            "is_final_order": True
        }
        return validate_and_recalculate_order(parsed_raw)

parser = AIParser()
