import sys
from fastapi.testclient import TestClient
from server import app, get_conn

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

client = TestClient(app)

print("==================================================")
print(" KIỂM TRA TÍCH HỢP TRƯỜNG EMAIL VÀO HỆ THỐNG")
print("==================================================")

# 1. Test /admin HTML includes Email
print("\n[1] Kiểm tra trang /admin có hiển thị cột Email và Form nhập:")
res_admin = client.get("/admin")
assert res_admin.status_code == 200
assert ">Email</th>" in res_admin.text, "Thiếu cột Email trong bảng Customers"
assert 'id="cust-email"' in res_admin.text, "Thiếu input #cust-email trong modal Customer"
print("✅ Trang /admin đã có cột Email và ô nhập Email!")

# 2. Test Customer CRUD with Email
print("\n[2] Kiểm tra tạo khách hàng mới kèm Email:")
cust_payload = {
    "name": "Đặng Hoàng Yến",
    "phone": "0988776655",
    "zalo": "0988776655",
    "email": "hoangyen@gmail.com"
}
res_cust = client.post("/api/customers", json=cust_payload)
assert res_cust.status_code == 200, f"Error: {res_cust.text}"
cust_id = res_cust.json()["id"]
print(f"✅ Đã tạo khách hàng #{cust_id} thành công!")

# Verify from list API
customers = client.get("/api/customers").json()
saved_cust = [c for c in customers if c["id"] == cust_id][0]
assert saved_cust["email"] == "hoangyen@gmail.com", f"Email mismatch: {saved_cust['email']}"
print(f"✅ API /api/customers trả về đúng Email: {saved_cust['email']}")

# 3. Test Update Customer Email
print("\n[3] Kiểm tra cập nhật Email khách hàng:")
update_payload = {
    "email": "hoangyen_updated@gmail.com"
}
res_update = client.put(f"/api/customers/{cust_id}", json=update_payload)
assert res_update.status_code == 200
customers = client.get("/api/customers").json()
updated_cust = [c for c in customers if c["id"] == cust_id][0]
assert updated_cust["email"] == "hoangyen_updated@gmail.com"
print(f"✅ Đã cập nhật Email thành: {updated_cust['email']}")

# 4. Test Website Landing Page Order Submission with Email
print("\n[4] Kiểm tra đặt hàng từ Website Landing Page có lưu Email vào Database:")
order_code = "LN9988"
web_order = {
    "cust_name": "Lê Văn Thắng",
    "cust_phone": "0912998877",
    "cust_email": "lethang.dev@gmail.com",
    "cust_address": "123 Đường 3/2, Quận 10, TP.HCM",
    "order_code": order_code,
    "items": [
        {"name": "Set Lẩu Thái Tomyum Mang Đi (2-3 người)", "qty": 1, "price": 299000}
    ],
    "stove_included": False
}
res_send = client.post("/api/send-order", json=web_order)
assert res_send.status_code == 200, f"Error: {res_send.text}"
print("✅ Gửi đơn hàng từ website thành công!")

# Check customer created from web order
customers = client.get("/api/customers").json()
web_cust = [c for c in customers if c["phone"] == "0912998877"][0]
assert web_cust["email"] == "lethang.dev@gmail.com", f"Customer email from web order is wrong: {web_cust['email']}"
print(f"✅ Khách hàng từ web order đã được lưu vào DB với Email: {web_cust['email']}")

# Check orders API returns customer_email
orders = client.get("/api/orders").json()
latest_order = [o for o in orders if o["order_code"] == order_code][0]
assert latest_order["customer_email"] == "lethang.dev@gmail.com", f"Order customer_email mismatch: {latest_order.get('customer_email')}"
print(f"✅ API /api/orders trả về thông tin customer_email: {latest_order['customer_email']}")

# Cleanup test customer
client.delete(f"/api/customers/{cust_id}")

print("\n🎉 TẤT CẢ CÁC BƯỚC KIỂM TRA ĐỀU THÀNH CÔNG 100%!")
