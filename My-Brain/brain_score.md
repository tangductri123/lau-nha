# 🧠 BẢNG THEO DÕI ĐÁNH GIÁ BRAND VOICE TRONG 7 NGÀY
*(brain_score.md)*

> **Mục đích:** Theo dõi độ chuẩn xác của giọng văn AI so với phong cách cá nhân, ghi nhận phản hồi từ người xem thực tế, và liên tục tinh chỉnh/nạp thêm dữ liệu vào `brain.db` sau mỗi ngày đăng bài.

---

## 📊 BẢNG THEO DÕI HÀNG NGÀY

| Ngày | (1) Điểm giống giọng tôi (1-10) | (2) Người xem phản hồi thế nào? | (3) Đã nạp/thêm gì vào Brand Voice hôm nay? | (4) Nhận xét ngắn / Rút kinh nghiệm |
| :---: | :---: | :--- | :--- | :--- |
| **Ngày 1** | `7/10` | - Lượng tương tác: Đã có các lượt tương tác like, chưa có phản hồi comment.<br>- Số lượt điền form: Đang theo dõi. | - Bổ sung vào database `brand_voice` các từ hạn chế/tránh lặp lại: những từ chỉ định/tu từ thừa thãi như *"hay", "những chiếc", "cái", "con", "những..."*.<br>- Hạn chế lối liệt kê bullet point khô khan, chuyển thành storytelling mượt mà. | Nội dung đúng trọng tâm nỗi đau khách hàng nhưng nghe vẫn chưa đã, giọng văn còn kiểu cứng và dạng liệt kê chưa hoàn hảo, cần khắc phục để biến dạng markdown thành storytelling ngắn tự nhiên hơn. |
| **Ngày 2** | `.../10` | - Lượng tương tác:<br>- Bình luận nổi bật:<br>- Số lượt điền form: | - Cách dùng số liệu thực tế:<br>- Độ dài câu phù hợp: |  |
| **Ngày 3** | `.../10` | - Lượng tương tác:<br>- Bình luận nổi bật:<br>- Số lượt điền form: | - Cách giới thiệu sản phẩm tự nhiên:<br>- Giọng điệu khi nói về giá trị/USP: |  |
| **Ngày 4** | `.../10` | - Lượng tương tác:<br>- Bình luận nổi bật:<br>- Số lượt điền form: | - Cách kể chuyện hậu trường (Behind the scenes):<br>- Cách trích dẫn feedback khách hàng: |  |
| **Ngày 5** | `.../10` | - Lượng tương tác:<br>- Bình luận nổi bật:<br>- Số lượt điền form: | - Tone kêu gọi hành động (CTA) không bị "quảng cáo quá đà":<br>- Cách tạo cảm giác khan hiếm/FOMO: |  |
| **Ngày 6** | `.../10` | - Lượng tương tác:<br>- Bình luận nổi bật:<br>- Số lượt điền form: | - Cách xử lý từ chối/so sánh với đối thủ:<br>- Cam kết chất lượng tự nhiên: |  |
| **Ngày 7** | `.../10` | - Lượng tương tác:<br>- Bình luận nổi bật:<br>- Số lượt điền form: | - Giọng văn tri ân & đếm ngược chốt sổ: |  |

---

## 📈 TỔNG KẾT & SO SÁNH (NGÀY 1 VS NGÀY 7)

| Tiêu chí | Ngày 1 (Bắt đầu) | Ngày 7 (Sau 1 tuần tinh chỉnh) | Mức độ tiến bộ / Đánh giá |
| :--- | :--- | :--- | :--- |
| **Điểm tương đồng giọng văn (1-10)** | `7/10` | `.../10` | Tăng `+...` điểm (Văn phong mượt hơn, ít phải sửa tay). |
| **Phản hồi của người xem** | Chưa có comment, có các lượt tương tác like. | *(Ví dụ: Nhiều comment khen tự nhiên, tỷ lệ điền form tăng rõ rệt)* | *(Ghi nhận sự thay đổi về độ gắn kết của độc giả)* |
| **Sự hoàn thiện của `brain.db`** | Dữ liệu ban đầu còn cơ bản (vài quy tắc chung). | Đã bổ sung bộ từ khóa cấm, câu cửa miệng, cấu trúc hook và ví dụ mẫu chuẩn xác. | Brain database đã "học" được sâu sắc giọng văn thật của bạn. |
| **Thời gian chỉnh sửa bài viết** | Mất ... phút để sửa lại bài AI viết. | Chỉ mất ... phút (gần như dùng được ngay). | Tiết kiệm được ...% thời gian sản xuất content. |

---

## 💡 HƯỚNG DẪN CẬP NHẬT NHANH VÀO DATABASE

Khi bạn phát hiện một từ/cụm từ hay hoặc cần cấm, hãy ghi chú lại vào cột **(3)** và cập nhật vào `brain.db`:
- **Thêm quy tắc mới:** Thêm vào bảng `brand_voice` trong `brain.db` với title tương ứng (ví dụ: *'Cách mở bài hook ngắn'*, *'Từ ngữ địa phương nên dùng'*).
- **Nguyên tắc lặp lại:** Cứ sau mỗi ngày đăng bài, chỉ cần dành 3 phút điền bảng này để "huấn luyện" AI ngày càng viết giống bạn hơn.
