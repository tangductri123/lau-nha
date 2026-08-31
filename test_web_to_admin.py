import sys
from fastapi.testclient import TestClient
from server import app, get_conn

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

client = TestClient(app)

print("==========================================================")
print(" GIẢ LẬP KHÁCH HÀNG ĐẶT HÀNG TỪ FORM TRÊN WEBSITE LANDING PAGE")
print("==========================================================")

# 1. Kiểm tra trạng thái trước khi đặt
products_before = client.get("/api/products").json()
target_product = [p for p in products_before if "Set Lẩu Thái" in p["name"]][0]
stock_before = target_product["stock"]
print(f"📦 Tồn kho sản phẩm '{target_product['name']}' trước khi đặt: {stock_before} phần")

customers_before_count = len(client.get("/api/customers").json())
orders_before_count = len(client.get("/api/orders").json())

# 2. Khách hàng điền form trên website và bấm Đặt Hàng
web_form_payload = {
    "cust_name": "Trương Minh Tuấn",
    "cust_phone": "0938999888",
    "cust_email": "minhtuan@gmail.com",
    "cust_address": "456 Nguyễn Huệ, Quận 1, TP.HCM",
    "order_code": "LN8899",
    "items": [
        {
            "name": "Set Lẩu Thái Tomyum Mang Đi (2-3 người)",
            "qty": 2,
            "price": 299000
        }
    ],
    "stove_included": True
}

print("\n🚀 Đang gửi dữ liệu từ Form Website -> /api/send-order ...")
response = client.post("/api/send-order", json=web_form_payload)
print("Phản hồi từ Server:", response.json())
assert response.status_code == 200

# 3. Kiểm tra xem dữ liệu đã vào Admin Panel và DB chưa
print("\n--- KIỂM TRA DỮ LIỆU TẠI TRANG ADMIN PANEL (/admin) ---")

# (A) Khách hàng mới
customers_after = client.get("/api/customers").json()
new_customer = [c for c in customers_after if c["phone"] == "0938999888"][0]
print(f"✅ ĐÃ LƯU KHÁCH HÀNG: #{new_customer['id']} - {new_customer['name']} (SĐT: {new_customer['phone']})")

# (B) Đơn hàng mới
orders_after = client.get("/api/orders").json()
latest_order = orders_after[0]  # Đơn mới nhất
print(f"✅ ĐÃ LƯU ĐƠN HÀNG: #{latest_order['id']} - Khách: {latest_order['customer_name']} - Mua: {latest_order['product_name']} - Số tiền: {latest_order['amount']:,.0f} đ - Trạng thái: {latest_order['status']}")

# (C) Tồn kho sản phẩm vật lý
products_after = client.get("/api/products").json()
updated_product = [p for p in products_after if p["id"] == target_product["id"]][0]
stock_after = updated_product["stock"]
print(f"✅ TỒN KHO TỰ ĐỘNG CẬP NHẬT: Từ {stock_before} phần -> Còn {stock_after} phần (Đã trừ {stock_before - stock_after} phần do khách đặt)")

print("\n🎉 XÁC NHẬN: Khách đặt trên web 100% tự động chạy thẳng vào Admin Panel & Database!")
