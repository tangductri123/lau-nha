import os
import json
import time
import asyncio
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime, timedelta

# Config from file or env
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_dotenv(env_path=None):
    if not env_path:
        env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

load_dotenv()

CONFIG_FILE = os.path.join(BASE_DIR, "resend_config.txt")
if os.path.exists(CONFIG_FILE):
    load_dotenv(CONFIG_FILE)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "LẨU NHÀ <cskh@order.laumangdi.com>")
RESEND_REPLY_TO = os.environ.get("RESEND_REPLY_TO", "tangductri15@gmail.com")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "tangductri15@gmail.com")

DB_PATHS = [
    os.path.join(BASE_DIR, "My-Brain", "brain.db"),
    r"d:\BO\My-Brain\brain.db",
]

def get_db_path():
    for p in DB_PATHS:
        if os.path.exists(p):
            return p
    return DB_PATHS[0]

def init_email_tables():
    for path in DB_PATHS:
        try:
            if not os.path.exists(os.path.dirname(path)):
                continue
            conn = sqlite3.connect(path, timeout=1)
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS email_sequences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    step INTEGER NOT NULL,
                    subject TEXT NOT NULL,
                    scheduled_at TEXT NOT NULL,
                    sent_at TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    resend_id TEXT,
                    error TEXT,
                    created_at TEXT DEFAULT (datetime('now', 'localtime'))
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_seq_status ON email_sequences(status, scheduled_at)")
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[Email Tables Init Path Warning] {path}: {e}")

# Auto-init tables
try:
    init_email_tables()
except Exception as err:
    print(f"[Email Tables Init Warning]: {err}")


# ==================== EMAIL TEMPLATES (FROM email_sequence.md) ====================

def get_email_template(step: int, name: str, email: str):
    display_name = name or "bạn"
    if step == 1:
        subject = "Chào bạn, mình là người mê lẩu giống bạn đây! 🍲"
        text = f"""Chào {display_name},

Cảm ơn bạn đã ghé thăm và gửi thông tin cho Lẩu Nhà.

Thật ra, Lẩu Nhà bắt đầu từ chính sự ức chế của tụi mình. Tụi mình cực kỳ mê ăn lẩu. Nhưng mỗi lần thèm là y như rằng phải đối mặt với hai cảnh: một là cuối tuần ra quán chen chúc, đợi bàn 45 phút trong tiếng ồn ào; hai là tự nấu ở nhà thì mất cả buổi đi chợ, sơ chế, ninh xương, ăn xong lại đánh vật với đống nồi chảo dính đầy mỡ.

"Sao ăn lẩu ngon tại nhà lại phải cực khổ đến vậy?"

Thế là Lẩu Nhà ra đời. Mục tiêu đơn giản thôi: mang đến cho bạn bữa lẩu chuẩn vị nhà hàng ngay tại phòng khách. Mở hộp, đổ nước cốt vào khay nhôm, bật bếp đun sôi là ăn. Ăn xong túm khăn trải bàn bỏ rác trong 30 giây là sạch bóng, không dính một giọt dầu mỡ.

Trong 2 ngày tới, mình sẽ gửi bạn một chia sẻ nhỏ: Cách phân biệt nước lẩu ninh xương thật và nước lẩu pha bột ngọt công nghiệp để bạn luôn chọn được bữa ăn an lành cho cả nhà.

Hẹn gặp lại bạn ở email tới nhé!

Thân mến,
Đội ngũ Lẩu Nhà
Hotline/Zalo hỗ trợ: 0819 943 904"""

        html = f"""<!doctype html>
<html>
<body style="margin:0;padding:20px;background:#f7f4ef;color:#3d2616;font-family:'Plus Jakarta Sans',Arial,sans-serif;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background:#fffdf9;border:2px dashed #d57a55;border-radius:14px;padding:28px 24px;">
    <div style="text-align:center;border-bottom:2px solid #d57a55;padding-bottom:16px;margin-bottom:20px;">
      <h1 style="color:#d57a55;margin:0;font-size:24px;">LẨU NHÀ - Ăn Lẩu Tại Nhà</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#8a604b;">Món quà chào mừng bạn gia nhập cộng đồng mê lẩu</p>
    </div>
    <p>Chào <strong>{display_name}</strong>,</p>
    <p>Cảm ơn bạn đã ghé thăm và gửi thông tin cho Lẩu Nhà.</p>
    <p>Thật ra, Lẩu Nhà bắt đầu từ chính sự ức chế của tụi mình. Tụi mình cực kỳ mê ăn lẩu. Nhưng mỗi lần thèm là y như rằng phải đối mặt với hai cảnh: một là cuối tuần ra quán chen chúc, đợi bàn 45 phút trong tiếng ồn ào; hai là tự nấu ở nhà thì mất cả buổi đi chợ, sơ chế, ninh xương, ăn xong lại đánh vật với đống nồi chảo dính đầy mỡ.</p>
    <p style="font-style:italic;background:#fff4eb;padding:12px;border-left:4px solid #d57a55;border-radius:4px;">"Sao ăn lẩu ngon tại nhà lại phải cực khổ đến vậy?"</p>
    <p>Thế là Lẩu Nhà ra đời. Mục tiêu đơn giản thôi: mang đến cho bạn bữa lẩu chuẩn vị nhà hàng ngay tại phòng khách. Mở hộp, đổ nước cốt vào khay nhôm, bật bếp đun sôi là ăn. Ăn xong túm khăn trải bàn bỏ rác trong 30 giây là sạch bóng, không dính một giọt dầu mỡ.</p>
    <p>Trong 2 ngày tới, mình sẽ gửi bạn một chia sẻ nhỏ: <strong>Cách phân biệt nước lẩu ninh xương thật và nước lẩu pha bột ngọt công nghiệp</strong> để bạn luôn chọn được bữa ăn an lành cho cả nhà.</p>
    <p>Hẹn gặp lại bạn ở email tới nhé!</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px dashed #d8cfc3;font-size:14px;color:#6b4d3c;">
      Thân mến,<br>
      <strong>Đội ngũ Lẩu Nhà</strong><br>
      📞 Hotline / Zalo: 0819 943 904
    </div>
  </div>
</body>
</html>"""
        return subject, text, html

    elif step == 2:
        subject = "Vì sao ăn lẩu xong bạn thường bị khát khô cổ? 🥤"
        text = f"""Chào {display_name},

Bạn đã từng gặp cảm giác này chưa: Vừa ăn lẩu ngoài quán về, người thì lừ đừ, cổ họng khát khô, uống liền hai ly nước lọc lớn vẫn thấy háo nước?

Dân sành ăn hay gọi vui đó là bị "say bột ngọt". 

Thật ra, nguyên nhân rất đơn giản:
Nhiều quán lẩu vì muốn tiết kiệm chi phí và thời gian ninh xương 5-6 tiếng, họ dùng bột gia vị cô đặc kết hợp hương liệu công nghiệp. Loại nước này đánh lừa vị giác bằng vị ngọt gắt ở đầu lưỡi ngay ngụm đầu tiên, nhưng lượng natri và chất điều vị quá cao khiến cơ thể bạn rút nước liên tục để giải tỏa.

Nước dùng ninh từ xương tủy và củ quả tươi thật thì khác hoàn toàn:
1. Vị ngọt hậu: Vị ngọt thanh nhẹ, thấm dần ở cuống họng chứ không ngọt xộc lên mũi.
2. Nhẹ bụng: Ăn xong người khoan khoái, không đầy hơi, không khát nước.
3. Mùi hương tự nhiên: Hương thơm dịu của sả, ớt xiêm, quế hồi hoặc nấm tươi, không nồng mùi hương liệu hóa học.

Lần tới khi đi ăn lẩu ở bất kỳ đâu, bạn thử quan sát xem nhé. Ăn một bữa lẩu ngon là để nạp năng lượng và vui vẻ bên người thân, đừng để cơ thể phải mệt mỏi vì phụ gia công nghiệp.

Chúc bạn và gia đình luôn có những bữa ăn nhẹ bụng và ngon miệng!

Thân mến,
Đội ngũ Lẩu Nhà"""

        html = f"""<!doctype html>
<html>
<body style="margin:0;padding:20px;background:#f7f4ef;color:#3d2616;font-family:'Plus Jakarta Sans',Arial,sans-serif;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background:#fffdf9;border:2px dashed #d57a55;border-radius:14px;padding:28px 24px;">
    <div style="text-align:center;border-bottom:2px solid #d57a55;padding-bottom:16px;margin-bottom:20px;">
      <h1 style="color:#d57a55;margin:0;font-size:24px;">LẨU NHÀ - Góc Insight Ẩm Thực</h1>
    </div>
    <p>Chào <strong>{display_name}</strong>,</p>
    <p>Bạn đã từng gặp cảm giác này chưa: Vừa ăn lẩu ngoài quán về, người thì lừ đừ, cổ họng khát khô, uống liền hai ly nước lọc lớn vẫn thấy háo nước?</p>
    <p>Dân sành ăn hay gọi vui đó là bị "say bột ngọt".</p>
    <p>Thật ra, nguyên nhân rất đơn giản:</p>
    <p>Nhiều quán lẩu vì muốn tiết kiệm chi phí và thời gian ninh xương 5-6 tiếng, họ dùng bột gia vị cô đặc kết hợp hương liệu công nghiệp. Loại nước này đánh lừa vị giác bằng vị ngọt gắt ở đầu lưỡi ngay ngụm đầu tiên, nhưng lượng natri và chất điều vị quá cao khiến cơ thể bạn rút nước liên tục để giải tỏa.</p>
    <p><strong>Nước dùng ninh từ xương tủy và củ quả tươi thật thì khác hoàn toàn:</strong></p>
    <ul style="padding-left:20px;">
      <li style="margin-bottom:8px;"><strong>Vị ngọt hậu:</strong> Vị ngọt thanh nhẹ, thấm dần ở cuống họng chứ không ngọt xộc lên mũi.</li>
      <li style="margin-bottom:8px;"><strong>Nhẹ bụng:</strong> Ăn xong người khoan khoái, không đầy hơi, không khát nước.</li>
      <li style="margin-bottom:8px;"><strong>Mùi hương tự nhiên:</strong> Hương thơm dịu của sả, ớt xiêm, quế hồi hoặc nấm tươi, không nồng mùi hương liệu hóa học.</li>
    </ul>
    <p>Lần tới khi đi ăn lẩu ở bất kỳ đâu, bạn thử quan sát xem nhé. Ăn một bữa lẩu ngon là để nạp năng lượng và vui vẻ bên người thân, đừng để cơ thể phải mệt mỏi vì phụ gia công nghiệp.</p>
    <p>Chúc bạn và gia đình luôn có những bữa ăn nhẹ bụng và ngon miệng!</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px dashed #d8cfc3;font-size:14px;color:#6b4d3c;">
      Thân mến,<br>
      <strong>Đội ngũ Lẩu Nhà</strong>
    </div>
  </div>
</body>
</html>"""
        return subject, text, html

    else:  # step 3
        subject = "Bữa lẩu chuẩn vị tại gia cuối tuần này: Không cần nồi, không phải rửa bát 🥘"
        text = f"""Chào {display_name},

Cuối tuần này, bạn đã có kế hoạch ăn gì chưa?

Thay vì phải tất bật đi chợ nhặt rau, ninh xương cả buổi hay dắt xe ra đường hít khói bụi, bạn hoàn toàn có thể ngồi thảnh thơi tại nhà và thưởng thức tiệc lẩu nóng hổi:

🍲 4 Vị nước cốt hầm tươi 100% tự nhiên:
- Lẩu Thái Tomyum: Chua cay đậm đà từ chanh sả tươi và ớt xiêm.
- Lẩu Riêu Cua Đồng: Thơm béo ngậy riêu cua thật, chua thanh giấm bỗng truyền thống.
- Lẩu Nấm Thảo Mộc: Ngọt thanh từ đông trùng hạ thảo, nấm tùng nhung và kỷ tử.
- Lẩu Tứ Xuyên: Vị tiêu tê nồng ấm chuẩn vị Trung Hoa.

🥩 Set Topping tươi sạch chuẩn bị sẵn:
- Set Đôi Lứa (2-3 người - 249.000đ): Ba chỉ bò Mỹ, bắp bò Úc, tôm tươi, viên thả lẩu, rau nấm sạch.
- Set Gia Đình (4-5 người - 399.000đ): Ba chỉ bò Mỹ, lõi vai Úc, tôm nhảy, mực trứng, combo viên nhúng và mì tươi.

🎁 Đặc quyền dành riêng cho bạn:
- Đun sôi trực tiếp trên Khay Nhôm Cao Cấp (không cần chuẩn bị nồi).
- Tặng kèm trọn bộ Kit Dọn Dẹp 30s (ăn xong gói khăn trải bàn bỏ rác là xong).
- Miễn phí mượn trọn bộ bếp cồn cho đơn từ 399k.
- Tặng mã ưu đãi khai trương: GIAM50K (trừ thẳng 50.000đ vào đơn hàng).

👉 ĐẶT SET LẨU TẠI: https://laumangdi.com/#builder

Chỉ 30 phút sau khi đặt, shipper sẽ giao set lẩu tươi lạnh tận cửa nhà bạn. Bạn chỉ việc bật bếp và thưởng thức cùng người thân thôi!

Thân mến,
Đội ngũ Lẩu Nhà
Hotline đặt gấp: 0819 943 904"""

        html = f"""<!doctype html>
<html>
<body style="margin:0;padding:20px;background:#f7f4ef;color:#3d2616;font-family:'Plus Jakarta Sans',Arial,sans-serif;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background:#fffdf9;border:2px dashed #d57a55;border-radius:14px;padding:28px 24px;">
    <div style="text-align:center;border-bottom:2px solid #d57a55;padding-bottom:16px;margin-bottom:20px;">
      <h1 style="color:#d57a55;margin:0;font-size:24px;">Tiệc Lẩu Tại Gia Đích Thực</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#8a604b;">Ăn ngon chuẩn vị • Tiện lợi dọn 30s • Free mượn bếp cồn</p>
    </div>
    <p>Chào <strong>{display_name}</strong>,</p>
    <p>Cuối tuần này, bạn đã có kế hoạch ăn gì chưa?</p>
    <p>Thay vì phải tất bật đi chợ nhặt rau, ninh xương cả buổi hay dắt xe ra đường hít khói bụi, bạn hoàn toàn có thể ngồi thảnh thơi tại nhà và thưởng thức tiệc lẩu nóng hổi:</p>
    <div style="background:#fff7ed;padding:16px;border-radius:10px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:bold;color:#c2410c;">🍲 4 Vị nước cốt hầm tươi 100% tự nhiên:</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;">
        <li><strong>Lẩu Thái Tomyum:</strong> Chua cay đậm đà từ chanh sả tươi và ớt xiêm.</li>
        <li><strong>Lẩu Riêu Cua Đồng:</strong> Thơm béo ngậy riêu cua thật, chua thanh giấm bỗng.</li>
        <li><strong>Lẩu Nấm Thảo Mộc:</strong> Ngọt thanh đông trùng hạ thảo, nấm tùng nhung, kỷ tử.</li>
        <li><strong>Lẩu Tứ Xuyên:</strong> Vị tiêu tê nồng ấm chuẩn vị Trung Hoa.</li>
      </ul>
      <p style="margin:12px 0 8px;font-weight:bold;color:#c2410c;">🥩 Set Topping tươi sạch chuẩn bị sẵn:</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;">
        <li><strong>Set Đôi Lứa (2-3 người - 249.000đ):</strong> Ba chỉ bò Mỹ, bắp bò Úc, tôm tươi, viên thả lẩu, rau nấm.</li>
        <li><strong>Set Gia Đình (4-5 người - 399.000đ):</strong> Ba chỉ bò Mỹ, lõi vai Úc, tôm nhảy, mực trứng, combo viên nhúng và mì tươi.</li>
      </ul>
    </div>
    <div style="background:#ecfdf5;border:1px dashed #059669;padding:14px;border-radius:10px;margin:16px 0;font-size:14px;">
      🎁 <strong>Ưu đãi đặc quyền của bạn:</strong><br>
      • Đun sôi trực tiếp trên <strong>Khay Nhôm Cao Cấp</strong> (không cần sắm nồi lẩu).<br>
      • Tặng trọn bộ <strong>Kit Dọn Dẹp 30s</strong> (ăn xong túm khăn trải bỏ rác).<br>
      • <strong>Miễn phí mượn bếp cồn</strong> tận nhà cho đơn từ 399k.<br>
      • Tặng mã giảm giá: <strong style="color:#d97706;font-size:16px;">GIAM50K</strong> (trừ thẳng 50.000đ vào đơn hàng).
    </div>
    <div style="text-align:center;margin:28px 0 16px;">
      <a href="https://laumangdi.com/#builder" style="background:#ea580c;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:10px;font-size:16px;display:inline-block;box-shadow:0 4px 12px rgba(234,88,12,0.3);">
        👉 ĐẶT SET LẨU GIAO TẬN NHÀ NGAY
      </a>
    </div>
    <p style="text-align:center;font-size:13px;color:#78716c;">Chỉ 30-45 phút sau khi đặt, shipper giao set lẩu tươi lạnh tận cửa nhà bạn.</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px dashed #d8cfc3;font-size:14px;color:#6b4d3c;">
      Thân mến,<br>
      <strong>Đội ngũ Lẩu Nhà</strong><br>
      📞 Hotline đặt gấp: 0819 943 904
    </div>
  </div>
</body>
</html>"""
        return subject, text, html


# ==================== ORDER CONFIRMATION TEMPLATE ====================

def get_order_confirmation_template(name: str, email: str, items: list, total_amount: float, order_code: str = None):
    display_name = name or "bạn"
    code_display = f"#{order_code}" if order_code else "mới"
    subject = f"Xác nhận đơn hàng {code_display} - LẨU NHÀ 🍲"
    
    # Generate items rows
    items_html_list = []
    items_text_list = []
    for it in items:
        pname = it.get("product_name") or it.get("name") or "Món lẩu"
        pqty = it.get("quantity") or it.get("qty") or 1
        pamt = float(it.get("amount") or (it.get("price", 0) * pqty))
        items_html_list.append(f"""
          <tr>
            <td style="padding:10px 0;border-bottom:1px dashed #d8cfc3;color:#3d2616;"><strong>{pname}</strong></td>
            <td style="padding:10px 8px;border-bottom:1px dashed #d8cfc3;text-align:center;">x{pqty}</td>
            <td style="padding:10px 0;border-bottom:1px dashed #d8cfc3;text-align:right;font-weight:bold;color:#d57a55;">{pamt:,.0f}đ</td>
          </tr>
        """)
        items_text_list.append(f"• {pname} x{pqty}: {pamt:,.0f}đ")
    
    items_html_str = "".join(items_html_list)
    items_text_str = "\n".join(items_text_list)
    
    text = f"""Chào {display_name},

Cảm ơn bạn đã tin tưởng và đặt món tại Lẩu Nhà! Tụi mình đã tiếp nhận đơn hàng {code_display} của bạn và đang chuẩn bị những phần nguyên liệu tươi ngon nhất.

📋 CHI TIẾT ĐƠN HÀNG:
{items_text_str}
----------------------------------------
👉 TỔNG THANH TOÁN: {total_amount:,.0f}đ

🚚 HƯỚNG DẪN NHẬN HÀNG & THƯỞNG THỨC:
1. Nhận hàng: Shipper sẽ liên hệ bạn trước khi giao 10-15 phút. Hãy để ý điện thoại nhé.
2. Bảo quản: Toàn bộ thịt và rau nấm được sơ chế sạch đóng khay kín. Nếu chưa ăn ngay, bạn vui lòng để khay topping vào ngăn mát tủ lạnh.
3. Đun & Thưởng thức: Đổ túi nước cốt tươi vào khay nhôm, bật bếp đun sôi bùng lên là có thể nhúng thịt, rau và thưởng thức ngay. Không cần mất công chuẩn bị nồi nấu lỉnh kỉnh.
4. Dọn dẹp 30s: Ăn xong, bạn chỉ cần túm 4 góc khăn trải bàn nilon tặng kèm và bỏ vào túi rác là bàn ăn sạch bóng.

Nếu cần thay đổi giờ giao hoặc có bất kỳ câu hỏi nào, bạn cứ bấm "Trả lời" (Reply) email này hoặc nhắn Zalo/Hotline: 0819 943 904 nhé.

Chúc bạn và gia đình có một bữa lẩu thật ngon miệng và ấm cúng!

Thân mến,
Đội ngũ Lẩu Nhà
Hotline: 0819 943 904"""

    html = f"""<!doctype html>
<html>
<body style="margin:0;padding:20px;background:#f7f4ef;color:#3d2616;font-family:'Plus Jakarta Sans',Arial,sans-serif;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background:#fffdf9;border:2px dashed #d57a55;border-radius:14px;padding:28px 24px;">
    <div style="text-align:center;border-bottom:2px solid #d57a55;padding-bottom:16px;margin-bottom:20px;">
      <h1 style="color:#d57a55;margin:0;font-size:24px;">LẨU NHÀ - ĂN LẨU TẠI NHÀ</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#8a604b;">Xác nhận đơn hàng {code_display}</p>
    </div>
    
    <p>Chào <strong>{display_name}</strong>,</p>
    <p>Cảm ơn bạn đã tin tưởng và đặt món tại Lẩu Nhà! Tụi mình đã tiếp nhận đơn hàng của bạn và đang chuẩn bị những phần nguyên liệu tươi ngon nhất.</p>
    
    <div style="background:#fff7ed;padding:16px;border-radius:10px;margin:18px 0;border:1px solid #fed7aa;">
      <div style="font-weight:bold;color:#c2410c;margin-bottom:10px;font-size:15px;">📋 Chi tiết đơn hàng:</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tbody>
          {items_html_str}
        </tbody>
      </table>
      <div style="margin-top:12px;padding-top:10px;border-top:2px solid #ea580c;display:flex;justify-content:space-between;font-size:17px;font-weight:bold;color:#c2410c;">
        <span>Tổng thanh toán:</span>
        <span>{total_amount:,.0f}đ</span>
      </div>
    </div>

    <div style="background:#f0fdf4;border:1px dashed #16a34a;padding:16px;border-radius:10px;margin:20px 0;font-size:14px;">
      <div style="font-weight:bold;color:#15803d;margin-bottom:8px;font-size:15px;">🚚 Hướng dẫn nhận hàng & thưởng thức nhanh:</div>
      <p style="margin:4px 0;">• <strong>Nhận hàng:</strong> Shipper sẽ gọi trước khi giao 10-15 phút, bạn chú ý điện thoại nhé.</p>
      <p style="margin:4px 0;">• <strong>Bảo quản:</strong> Toàn bộ thịt, hải sản và rau nấm đã được sơ chế sạch đóng hộp. Nếu chưa dùng ngay, hãy cất vào ngăn mát tủ lạnh.</p>
      <p style="margin:4px 0;">• <strong>Đun trực tiếp:</strong> Đổ túi nước cốt tươi vào khay nhôm, đun sôi bùng là nhúng lẩu ăn được ngay (không cần tìm mượn nồi).</p>
      <p style="margin:4px 0;">• <strong>Dọn dẹp 30s:</strong> Dùng khăn trải bàn tặng kèm lót dưới mâm tiệc. Ăn xong túm 4 góc bỏ rác là xong, không dính một giọt dầu mỡ.</p>
    </div>

    <p style="font-size:14px;color:#57534e;">Nếu cần hỗ trợ gấp hoặc thay đổi giờ giao, bạn chỉ việc bấm <strong>"Trả lời" (Reply)</strong> email này hoặc nhắn Zalo/Hotline <strong>0819 943 904</strong> nhé.</p>
    <p>Chúc bạn và người thân có một bữa lẩu thật ấm cúng và ngon miệng!</p>

    <div style="margin-top:24px;padding-top:16px;border-top:1px dashed #d8cfc3;font-size:14px;color:#6b4d3c;">
      Thân mến,<br>
      <strong>Đội ngũ Lẩu Nhà</strong><br>
      📞 Hotline / Zalo: 0819 943 904
    </div>
  </div>
</body>
</html>"""
    return subject, text, html

def send_order_confirmation_email(customer_name: str, customer_email: str, items: list, total_amount: float, order_code: str = None):
    target_email = (customer_email or "").strip()
    if not target_email or "@" not in target_email:
        target_email = ADMIN_EMAIL

    if not target_email or "@" not in target_email:
        return False, "Không có email người nhận"

    subject, text, html = get_order_confirmation_template(customer_name, target_email, items, total_amount, order_code)
    is_cust = bool(customer_email and "@" in customer_email and customer_email.lower() != ADMIN_EMAIL.lower())
    ok, resend_id, err = send_resend_email(target_email, subject, html, text, cc_admin=is_cust)
    return ok, resend_id or err


# ==================== SURVEY WELCOME EMAIL TEMPLATE WITH 2 CTA BUTTONS ====================

def get_survey_welcome_template(name: str, email: str, discount_code: str = "LAUNHA50K", website_url: str = "https://laumangdi.com"):
    display_name = name or "bạn"
    code = discount_code or "LAUNHA50K"
    chatbot_url = f"{website_url.rstrip('/')}/?open_chat=1#chatbot"
    zalo_url = "https://zalo.me/0819943904"

    subject = f"🎁 Món quà chào mừng & Mã ưu đãi 50.000đ từ LẨU NHÀ 🍲"
    
    text = f"""Chào {display_name},

Cảm ơn bạn đã dành thời gian quý báu tham gia khảo sát và quan tâm đến dịch vụ của Lẩu Nhà!

Mỗi ý kiến đóng góp của bạn giúp tụi mình hoàn thiện hơn từng set lẩu tươi, nước cốt hầm xương 12h và dịch vụ mượn bếp cồn tiện lợi tận nhà.

🎁 MÓN QUÀ CHÀO MỪNG DÀNH RIÊNG CHO BẠN:
Mã giảm giá: {code} (Giảm ngay 50.000đ cho đơn hàng)

* Cách sử dụng: Bạn chỉ cần cung cấp mã {code} khi nhân viên gọi xác nhận đơn hàng hoặc nhắn mã qua Zalo/Website để được trừ trực tiếp 50.000đ vào tổng thanh toán.

ĐẶC QUYỀN ĐI KÈM TRONG MỌI ĐƠN HÀNG:
• Tặng kèm Khay Nhôm Chịu Nhiệt đun trực tiếp (không cần chuẩn bị nồi nấu lỉnh kỉnh).
• Tặng bộ Kit Dọn Dẹp 30s (khăn trải bàn nilon, túi gom rác - ăn xong túm lại là sạch bóng).
• Miễn phí mượn trọn bộ bếp cồn mang tận nhà cho đơn từ 399.000đ.
• Giao hàng hỏa tốc trong 30-45 phút sau khi xác nhận đơn.

BẠN CẦN TƯ VẤN HOẶC ĐẶT LẨU NGAY?
1. Nhắn Zalo hỗ trợ trực tiếp: {zalo_url}
2. Chatbot tư vấn nhanh trên Web: {chatbot_url}

Thân mến,
Đội ngũ Lẩu Nhà
Hotline / Zalo: 0819 943 904
Website: {website_url}"""

    html = f"""<!doctype html>
<html>
<body style="margin:0;padding:20px;background:#f7f4ef;color:#3d2616;font-family:'Plus Jakarta Sans',Arial,sans-serif;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background:#fffdf9;border:2px dashed #d57a55;border-radius:14px;padding:28px 24px;box-shadow:0 4px 15px rgba(0,0,0,0.05);">
    
    <!-- HEADER -->
    <div style="text-align:center;border-bottom:2px solid #d57a55;padding-bottom:16px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:#d57a55;text-transform:uppercase;">LẨU NHÀ - ĂN LẨU TẠI NHÀ</div>
      <h1 style="color:#3d2616;margin:8px 0 4px;font-size:23px;">Chào mừng bạn gia nhập Lẩu Nhà! 🎉</h1>
      <p style="margin:0;font-size:14px;color:#8a604b;">Món quà cảm ơn bạn đã tham gia khảo sát đóng góp ý kiến</p>
    </div>

    <!-- GREETING -->
    <p>Chào <strong>{display_name}</strong>,</p>
    <p>Cảm ơn bạn đã dành thời gian quý báu tham gia bảng khảo sát nhu cầu của <strong>Lẩu Nhà</strong>. Mọi ý kiến phản hồi của bạn là động lực rất lớn để tụi mình hoàn thiện những set lẩu tiện lợi, thơm ngon chuẩn vị nhất.</p>

    <!-- VOUCHER BOX -->
    <div style="background:linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);border:2px dashed #ea580c;border-radius:12px;padding:20px;margin:22px 0;text-align:center;">
      <div style="font-size:13px;font-weight:700;color:#9a3412;letter-spacing:1px;text-transform:uppercase;">🎁 MÃ ƯU ĐÃI KHAI TRƯƠNG DÀNH CHO BẠN</div>
      <div style="font-size:28px;font-weight:800;color:#ea580c;letter-spacing:3px;margin:8px 0;padding:6px 14px;background:#ffffff;display:inline-block;border-radius:8px;border:1px solid #fdba74;box-shadow:0 2px 6px rgba(234,88,12,0.15);">
        {code}
      </div>
      <div style="font-size:15px;font-weight:700;color:#c2410c;margin-bottom:6px;">Giảm ngay 50.000đ trực tiếp vào đơn hàng</div>
      <p style="margin:0;font-size:13px;color:#78350f;font-style:italic;">
        📌 <strong>Cách dùng:</strong> Sử dụng mã này khi thanh toán với nhân viên xác nhận đơn (hoặc nhắn mã qua Zalo / Chatbot) để được trừ tiền ngay!
      </p>
    </div>

    <!-- VALUE PROPOSITIONS -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:10px;margin:20px 0;font-size:14px;">
      <div style="font-weight:bold;color:#15803d;margin-bottom:8px;font-size:15px;">🍲 Đặc quyền tiện lợi trong mọi set Lẩu Nhà:</div>
      <p style="margin:4px 0;">• <strong>Không cần sắm nồi:</strong> Tặng khay nhôm chuyên dụng chịu nhiệt đun sôi trực tiếp trên bếp.</p>
      <p style="margin:4px 0;">• <strong>Ăn xong dọn 30s:</strong> Tặng trọn bộ Kit dọn dẹp (túm khăn trải nilon bỏ rác là sạch bàn ăn).</p>
      <p style="margin:4px 0;">• <strong>Free mượn bếp cồn:</strong> Tặng mượn bếp cồn giao tận nhà cho đơn từ 399k (hoàn cọc 100% khi nhận lại bếp).</p>
      <p style="margin:4px 0;">• <strong>Nước cốt hầm 12h:</strong> 100% từ xương tủy và củ quả tươi ngọt thanh nhẹ bụng, không khát nước.</p>
    </div>

    <!-- 2 CTA BUTTONS -->
    <div style="margin:26px 0 20px;text-align:center;">
      <p style="font-weight:bold;font-size:15px;color:#3d2616;margin-bottom:14px;">Bạn cần hỗ trợ tư vấn chọn món hay muốn đặt hàng ngay?</p>
      
      <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 auto;max-width:520px;">
        <tr>
          <td style="width:50%;text-align:center;">
            <!-- BUTTON 1: ZALO -->
            <a href="{zalo_url}" target="_blank" style="display:block;background:#0068ff;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 12px;border-radius:10px;font-size:14px;box-shadow:0 4px 10px rgba(0,104,255,0.25);">
              💬 (1) Nhắn Qua Zalo
            </a>
          </td>
          <td style="width:50%;text-align:center;">
            <!-- BUTTON 2: WEB CHATBOT -->
            <a href="{chatbot_url}" target="_blank" style="display:block;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 12px;border-radius:10px;font-size:14px;box-shadow:0 4px 10px rgba(234,88,12,0.25);">
              🤖 (2) Tư Vấn Nhanh (Bot Web)
            </a>
          </td>
        </tr>
      </table>
      <div style="margin-top:10px;font-size:12px;color:#78716c;">
        *Bấm nút "Tư vấn nhanh" để mở Chatbot tự động hướng dẫn bạn chọn set lẩu và đặt hàng trong 1 phút!
      </div>
    </div>

    <!-- FOOTER -->
    <div style="margin-top:26px;padding-top:16px;border-top:1px dashed #d8cfc3;font-size:14px;color:#6b4d3c;">
      Thân mến,<br>
      <strong>Đội ngũ Lẩu Nhà</strong><br>
      📞 Hotline / Zalo: 0819 943 904<br>
      🌐 Website: <a href="{website_url}" style="color:#d57a55;text-decoration:none;">laumangdi.com</a>
    </div>

  </div>
</body>
</html>"""
    return subject, text, html

def send_survey_welcome_email(name: str, email: str, discount_code: str = "LAUNHA50K", website_url: str = "https://laumangdi.com"):
    if not email or "@" not in email:
        return False, "Email không hợp lệ"
    subject, text, html = get_survey_welcome_template(name, email, discount_code, website_url)
    ok, resend_id, err = send_resend_email(email, subject, html, text, cc_admin=True)
    return ok, resend_id or err

# ==================== TELEGRAM NOTIFICATION HELPER ====================

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

def notify_telegram_lead(lead_info: dict):
    """Gửi thông báo Lead khảo sát mới về nhóm Telegram."""
    try:
        name = lead_info.get("name", "Khách hàng")
        phone = lead_info.get("phone", "Chưa có")
        email = lead_info.get("email", "Chưa có")
        code = lead_info.get("discount_code", "LAUNHA50K")
        eat_with = lead_info.get("eat_with", "Không chọn")
        frequency = lead_info.get("frequency", "Không chọn")
        main_concern = lead_info.get("main_concern", "Không chọn")
        interested = lead_info.get("interested_in_service", "Không chọn")
        now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

        msg = (
            f"🎉 <b>CÓ LEAD KHẢO SÁT MỚI (ƯU ĐÃI 50K)</b>\n"
            f"━━━━━━━━━━━━━━━━━━━\n"
            f"👤 <b>Họ tên:</b> {name}\n"
            f"📞 <b>SĐT/Zalo:</b> {phone}\n"
            f"📧 <b>Email:</b> {email}\n"
            f"🎁 <b>Mã ưu đãi gửi:</b> <code>{code}</code>\n\n"
            f"📋 <b>CÂU TRẢ LỜI KHẢO SÁT:</b>\n"
            f"• <b>Ăn cùng:</b> {eat_with}\n"
            f"• <b>Tần suất:</b> {frequency}\n"
            f"• <b>Quan tâm nhất:</b> {main_concern}\n"
            f"• <b>Hứng thú mượn bếp:</b> {interested}\n"
            f"━━━━━━━━━━━━━━━━━━━\n"
            f"⏰ <i>Thời gian: {now_str}</i>"
        )

        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": msg,
            "parse_mode": "HTML"
        }

        req = urllib.request.Request(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            return True, "Telegram notification sent"
    except Exception as e:
        print(f"[Telegram Lead Notification Error]: {e}")
        return False, str(e)


# ==================== SEND VIA RESEND API ====================

def send_resend_email(to_email: str, subject: str, html: str, text: str, cc_admin: bool = False):
    payload = {
        "from": RESEND_FROM,
        "to": [to_email],
        "reply_to": RESEND_REPLY_TO,
        "subject": subject,
        "html": html,
        "text": text,
    }
    if cc_admin and ADMIN_EMAIL and to_email.lower() != ADMIN_EMAIL.lower():
        payload["cc"] = [ADMIN_EMAIL]

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "ResendClient/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            return True, res_data.get("id", ""), None
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"[Resend HTTP Error]: {e.code} - {err_msg}")
        return False, "", f"HTTP {e.code}: {err_msg}"
    except Exception as e:
        print(f"[Resend Error]: {e}")
        return False, "", str(e)


# ==================== PROCESS SEQUENCE ENROLLMENT ====================

def enroll_email_sequence(customer_id: int, name: str, email: str):
    """
    Enrolls a customer into the 3-email sequence.
    If email contains '+test' (e.g. name+test@gmail.com):
      -> Sends Email 1, Email 2, and Email 3 immediately!
    Else:
      -> Sends Email 1 immediately.
      -> Schedules Email 2 for 2 days later.
      -> Schedules Email 3 for 3 days later (2d + 1d).
    """
    email_clean = (email or "").strip()
    if not email_clean or "@" not in email_clean:
        return {"success": False, "message": "Email không hợp lệ"}

    is_test_mode = "+test" in email_clean.lower()
    now_dt = datetime.now()
    now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

    path = get_db_path()
    conn = sqlite3.connect(path)
    cursor = conn.cursor()

    results = []

    if is_test_mode:
        print(f"\n🧪 [TEST MODE DETECTED] Gửi cả 3 email ngay lập tức cho: {email_clean}")
        for step in [1, 2, 3]:
            subject, text, html = get_email_template(step, name, email_clean)
            test_subject = f"[TEST MODE - Email {step}/3] {subject}"
            ok, resend_id, err = send_resend_email(email_clean, test_subject, html, text, cc_admin=False)
            status = "sent" if ok else "failed"
            cursor.execute("""
                INSERT INTO email_sequences 
                (customer_id, name, email, step, subject, scheduled_at, sent_at, status, resend_id, error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (customer_id, name, email_clean, step, test_subject, now_str, now_str if ok else None, status, resend_id, err))
            results.append({"step": step, "status": status, "resend_id": resend_id, "error": err})
            time.sleep(1.5)  # slight spacing between test emails

        conn.commit()
        conn.close()
        return {
            "success": True,
            "mode": "test_immediate",
            "message": f"Đã gửi thành công cả 3 email thử nghiệm ngay lập tức cho {email_clean}",
            "emails": results
        }

    else:
        # Standard Production Mode
        # 1. Email 1: Send immediately
        subject1, text1, html1 = get_email_template(1, name, email_clean)
        ok1, resend_id1, err1 = send_resend_email(email_clean, subject1, html1, text1, cc_admin=False)
        status1 = "sent" if ok1 else "failed"
        cursor.execute("""
            INSERT INTO email_sequences 
            (customer_id, name, email, step, subject, scheduled_at, sent_at, status, resend_id, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (customer_id, name, email_clean, 1, subject1, now_str, now_str if ok1 else None, status1, resend_id1, err1))
        results.append({"step": 1, "status": status1, "resend_id": resend_id1, "error": err1})

        # 2. Email 2: Schedule for 2 days later
        dt_email2 = (now_dt + timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")
        subject2, _, _ = get_email_template(2, name, email_clean)
        cursor.execute("""
            INSERT INTO email_sequences 
            (customer_id, name, email, step, subject, scheduled_at, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        """, (customer_id, name, email_clean, 2, subject2, dt_email2))
        results.append({"step": 2, "status": "scheduled", "scheduled_at": dt_email2})

        # 3. Email 3: Schedule for 3 days later (2 days + 1 day)
        dt_email3 = (now_dt + timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")
        subject3, _, _ = get_email_template(3, name, email_clean)
        cursor.execute("""
            INSERT INTO email_sequences 
            (customer_id, name, email, step, subject, scheduled_at, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        """, (customer_id, name, email_clean, 3, subject3, dt_email3))
        results.append({"step": 3, "status": "scheduled", "scheduled_at": dt_email3})

        conn.commit()
        conn.close()

        return {
            "success": True,
            "mode": "standard_scheduled",
            "message": f"Đã gửi Email 1 ngay lập tức và lên lịch Email 2 (sau 2 ngày), Email 3 (sau 3 ngày) cho {email_clean}",
            "emails": results
        }


def enroll_lead_email_sequence(customer_id: int, name: str, email: str, discount_code: str = "LAUNHA50K"):
    """
    Tự động đưa Lead từ bảng Khảo sát vào Chuỗi 3 Email Tự Động (Resend):
    - Email 1 (Ngay lập tức): Email chào mừng khảo sát + Mã ưu đãi (LAUNHA50K) + 2 nút CTA (Zalo & Chatbot).
    - Email 2 (Sau 2 ngày): Vì sao ăn lẩu xong bạn thường bị khát khô cổ? (So sánh nước cốt 12h vs bột nêm).
    - Email 3 (Sau 3 ngày): Tiệc Lẩu Tại Gia Đích Thực (Ưu đãi chốt đơn & gọi món).
    Nếu email chứa '+test', hệ thống sẽ gửi cả 3 email ngay lập tức.
    """
    email_clean = (email or "").strip()
    if not email_clean or "@" not in email_clean:
        return {"success": False, "message": "Email không hợp lệ"}

    is_test_mode = "+test" in email_clean.lower()
    now_dt = datetime.now()
    now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

    path = get_db_path()
    conn = sqlite3.connect(path, timeout=3)
    cursor = conn.cursor()

    results = []

    if is_test_mode:
        print(f"\n🧪 [TEST MODE LEAD] Gửi cả 3 email khảo sát ngay lập tức cho: {email_clean}")
        # 1. Email 1: Khảo sát chào mừng kèm voucher
        sub1, txt1, html1 = get_survey_welcome_template(name, email_clean, discount_code)
        t_sub1 = f"[TEST MODE - Lead Email 1/3] {sub1}"
        ok1, res1, err1 = send_resend_email(email_clean, t_sub1, html1, txt1, cc_admin=False)
        st1 = "sent" if ok1 else "failed"
        cursor.execute("""
            INSERT INTO email_sequences 
            (customer_id, name, email, step, subject, scheduled_at, sent_at, status, resend_id, error)
            VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        """, (customer_id, name, email_clean, t_sub1, now_str, now_str if ok1 else None, st1, res1, err1))
        results.append({"step": 1, "status": st1, "resend_id": res1, "error": err1})
        time.sleep(1.5)

        # 2. Email 2: Insight
        sub2, txt2, html2 = get_email_template(2, name, email_clean)
        t_sub2 = f"[TEST MODE - Lead Email 2/3] {sub2}"
        ok2, res2, err2 = send_resend_email(email_clean, t_sub2, html2, txt2, cc_admin=False)
        st2 = "sent" if ok2 else "failed"
        cursor.execute("""
            INSERT INTO email_sequences 
            (customer_id, name, email, step, subject, scheduled_at, sent_at, status, resend_id, error)
            VALUES (?, ?, ?, 2, ?, ?, ?, ?, ?, ?)
        """, (customer_id, name, email_clean, t_sub2, now_str, now_str if ok2 else None, st2, res2, err2))
        results.append({"step": 2, "status": st2, "resend_id": res2, "error": err2})
        time.sleep(1.5)

        # 3. Email 3: Chốt sale
        sub3, txt3, html3 = get_email_template(3, name, email_clean)
        t_sub3 = f"[TEST MODE - Lead Email 3/3] {sub3}"
        ok3, res3, err3 = send_resend_email(email_clean, t_sub3, html3, txt3, cc_admin=False)
        st3 = "sent" if ok3 else "failed"
        cursor.execute("""
            INSERT INTO email_sequences 
            (customer_id, name, email, step, subject, scheduled_at, sent_at, status, resend_id, error)
            VALUES (?, ?, ?, 3, ?, ?, ?, ?, ?, ?)
        """, (customer_id, name, email_clean, t_sub3, now_str, now_str if ok3 else None, st3, res3, err3))
        results.append({"step": 3, "status": st3, "resend_id": res3, "error": err3})

        conn.commit()
        conn.close()
        return {
            "success": True,
            "mode": "test_immediate",
            "message": f"Đã gửi 3 email chuỗi khảo sát cho {email_clean}",
            "emails": results
        }

    else:
        # Standard Production Mode
        # 1. Email 1: Send Survey Welcome immediately
        sub1, txt1, html1 = get_survey_welcome_template(name, email_clean, discount_code)
        ok1, res1, err1 = send_resend_email(email_clean, sub1, html1, txt1, cc_admin=False)
        st1 = "sent" if ok1 else "failed"
        cursor.execute("""
            INSERT INTO email_sequences 
            (customer_id, name, email, step, subject, scheduled_at, sent_at, status, resend_id, error)
            VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        """, (customer_id, name, email_clean, sub1, now_str, now_str if ok1 else None, st1, res1, err1))
        results.append({"step": 1, "status": st1, "resend_id": res1, "error": err1})

        # 2. Email 2: Schedule for 2 days later
        dt_email2 = (now_dt + timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")
        sub2, _, _ = get_email_template(2, name, email_clean)
        cursor.execute("""
            INSERT INTO email_sequences 
            (customer_id, name, email, step, subject, scheduled_at, status)
            VALUES (?, ?, ?, 2, ?, ?, 'pending')
        """, (customer_id, name, email_clean, sub2, dt_email2))
        results.append({"step": 2, "status": "scheduled", "scheduled_at": dt_email2})

        # 3. Email 3: Schedule for 3 days later
        dt_email3 = (now_dt + timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")
        sub3, _, _ = get_email_template(3, name, email_clean)
        cursor.execute("""
            INSERT INTO email_sequences 
            (customer_id, name, email, step, subject, scheduled_at, status)
            VALUES (?, ?, ?, 3, ?, ?, 'pending')
        """, (customer_id, name, email_clean, sub3, dt_email3))
        results.append({"step": 3, "status": "scheduled", "scheduled_at": dt_email3})

        conn.commit()
        conn.close()

        return {
            "success": True,
            "mode": "standard_scheduled",
            "message": f"Đã gửi Email 1 (Chào mừng & Voucher) và lên lịch Email 2, Email 3 cho Lead {email_clean}",
            "emails": results
        }



# ==================== BACKGROUND CRON WORKER FOR SCHEDULED EMAILS ====================

async def email_sequence_cron_worker():
    """Background task running continuously to send scheduled emails."""
    print("🚀 [Email Sequence Worker] Đã khởi động bộ đếm gửi email tự động...")
    while True:
        try:
            path = get_db_path()
            conn = sqlite3.connect(path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Find pending emails whose scheduled_at has arrived
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
                SELECT id, customer_id, name, email, step 
                FROM email_sequences 
                WHERE status = 'pending' AND scheduled_at <= ? 
                LIMIT 20
            """, (now_str,))
            pending_emails = cursor.fetchall()

            for item in pending_emails:
                seq_id = item["id"]
                step = item["step"]
                name = item["name"]
                email = item["email"]

                subject, text, html = get_email_template(step, name, email)
                ok, resend_id, err = send_resend_email(email, subject, html, text, cc_admin=False)
                status = "sent" if ok else "failed"
                sent_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                cursor.execute("""
                    UPDATE email_sequences 
                    SET status = ?, sent_at = ?, resend_id = ?, error = ? 
                    WHERE id = ?
                """, (status, sent_time if ok else None, resend_id, err, seq_id))
                conn.commit()
                print(f"[Email Sequence] Step {step} sent to {email} (Status: {status}, Resend ID: {resend_id})")

            conn.close()
        except Exception as e:
            print(f"[Email Worker Error]: {e}")

        await asyncio.sleep(60)  # Check every 60 seconds
