import json
import hashlib
import re
from typing import Dict, Any, Tuple, Optional
import requests
import os

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

class AIParser:
    def __init__(self):
        self.model = "gemini-1.5-flash"
        self.system_prompt = """
        Bạn là chuyên gia bóc tách đơn hàng lẩu mang đi. 
        Nhiệm vụ: Chuyển tin nhắn chat (có thể là đơn nháp hoặc đơn chốt) thành JSON chuẩn.
        
        SCHEMA YÊU CẦU:
        {
            "customer_name": "Tên khách",
            "phone": "Số điện thoại (chỉ lấy số)",
            "address": "Địa chỉ giao hàng",
            "items": [
                {"name": "Tên món", "qty": 1, "price": 0, "subtotal": 0}
            ],
            "deposit_stove": 0, // Tiền cọc mượn bếp (ví dụ: 200000)
            "shipping_fee": 0,  // Phí ship
            "discount": 0,      // Số tiền giảm giá
            "voucher_code": "Mã giảm giá nếu có",
            "total_amount": 0,  // Tổng cuối cùng khách phải trả
            "note": "Ghi chú",
            "confidence_score": 0.0 đến 1.0,
            "is_final_order": true/false, // true nếu là tin nhắn chốt đơn (có đầy đủ giá, phí ship, cọc)
            "missing_fields": ["danh sách các trường bị thiếu"]
        }
        
        QUY TẮC BÓC TÁCH:
        1. Tên/SĐT/Địa chỉ: Trích xuất chính xác.
        2. Items: Tách rõ tên món, số lượng và đơn giá. 
        3. Tiền bạc: Chuyển mọi định dạng (ví dụ: 712.000 hoặc 712k) thành số nguyên (712000).
        4. Cọc bếp & Ship: Nhận diện các từ khóa 'Cọc mượn bếp', 'Phí ship'.
        5. Voucher: Nhận diện mã trong ngoặc hoặc sau chữ 'Giảm giá'.
        6. confidence_score: 
           - 1.0: Đơn chốt đầy đủ, khớp tổng tiền.
           - 0.8: Đầy đủ thông tin nhưng cần kiểm tra lại giá.
           - 0.4: Thiếu SĐT hoặc Địa chỉ.
        7. is_final_order: Đánh dấu true nếu tin nhắn có cấu trúc liệt kê chi tiết tiền bạc như một hóa đơn.
        
        Trả về DUY NHẤT định dạng JSON.
        """

    def generate_idempotency_key(self, text: str, source: str) -> str:
        clean_text = re.sub(r'\s+', '', text).lower()
        return hashlib.sha256(f"{source}:{clean_text}".encode()).hexdigest()

    def parse_order(self, text: str) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": f"{self.system_prompt}\n\nTin nhắn khách: {text}"}]}],
            "generationConfig": {"response_mime_type": "application/json"}
        }
        
        try:
            response = requests.post(url, json=payload, timeout=15)
            response.raise_for_status()
            res_json = response.json()
            content = res_json['candidates'][0]['content']['parts'][0]['text']
            return json.loads(content)
        except Exception as e:
            print(f"AI Parser Error: {e}")
            return {"error": str(e), "confidence_score": 0}

parser = AIParser()
