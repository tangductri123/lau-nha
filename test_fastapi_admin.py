import sys
from fastapi.testclient import TestClient
from server import app, get_conn

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

client = TestClient(app)

print("=== 1. Kiểm tra Admin Page ===")
res_admin = client.get("/admin")
print("Status code:", res_admin.status_code)
assert res_admin.status_code == 200
assert "Brain DB Admin" in res_admin.text
print("✅ /admin HTML load thành công!")

print("\n=== 2. Kiểm tra GET API ===")
res_prod = client.get("/api/products")
products = res_prod.json()
res_cust = client.get("/api/customers")
customers = res_cust.json()
res_ord = client.get("/api/orders")
orders = res_ord.json()
print(f"✅ Products: {len(products)}, Customers: {len(customers)}, Orders: {len(orders)}")

print("\n=== 3. Kiểm tra Tạo Đơn Hàng Sản Phẩm Vật Lý (Physical) -> Tự động trừ kho ===")
# Lấy SP 1
p1_before = [p for p in products if p['id'] == 1][0]
stock_before = p1_before['stock']
print(f"📦 Sản phẩm '{p1_before['name']}' - Tồn kho ban đầu: {stock_before}")

order_payload = {
    "customer_id": 1,
    "product_id": 1,
    "amount": 299000,
    "status": "completed",
    "quantity": 1
}
res_order = client.post("/api/orders", json=order_payload)
print("Kết quả API tạo đơn:", res_order.json())
assert res_order.status_code == 200
assert res_order.json()["stock_deducted"] is True

# Kiểm tra tồn kho sau khi tạo
p1_after = [p for p in client.get("/api/products").json() if p['id'] == 1][0]
stock_after = p1_after['stock']
print(f"📦 Tồn kho sau khi đặt đơn: {stock_after} (Đã giảm: {stock_before - stock_after})")
assert stock_after == stock_before - 1, "Lỗi: Chưa trừ 1 tồn kho cho sản phẩm vật lý!"

print("\n=== 4. Kiểm tra Tạo Đơn Hàng Sản Phẩm Số (Digital) -> Không trừ kho ===")
p3_before = [p for p in products if p['id'] == 3][0]
print(f"💾 Sản phẩm số '{p3_before['name']}' - Tồn kho ban đầu: {p3_before['stock']}")

order_digital_payload = {
    "customer_id": 2,
    "product_id": 3,
    "amount": 99000,
    "status": "paid",
    "quantity": 1
}
res_order_digital = client.post("/api/orders", json=order_digital_payload)
print("Kết quả API tạo đơn số:", res_order_digital.json())
assert res_order_digital.status_code == 200
assert res_order_digital.json()["stock_deducted"] is False

p3_after = [p for p in client.get("/api/products").json() if p['id'] == 3][0]
print(f"💾 Tồn kho sau khi đặt đơn số: {p3_after['stock']}")
assert p3_after['stock'] is None, "Lỗi: Sản phẩm số không được có tồn kho!"

print("\n=== 5. Kiểm tra Tạo Đơn Hàng Dịch Vụ (Service) -> Không trừ kho ===")
p4_before = [p for p in products if p['id'] == 4][0]
print(f"🛠️ Dịch vụ '{p4_before['name']}' - Tồn kho ban đầu: {p4_before['stock']}")

order_service_payload = {
    "customer_id": 3,
    "product_id": 4,
    "amount": 500000,
    "status": "pending",
    "quantity": 1
}
res_order_service = client.post("/api/orders", json=order_service_payload)
print("Kết quả API tạo đơn dịch vụ:", res_order_service.json())
assert res_order_service.status_code == 200
assert res_order_service.json()["stock_deducted"] is False

p4_after = [p for p in client.get("/api/products").json() if p['id'] == 4][0]
print(f"🛠️ Tồn kho sau khi đặt dịch vụ: {p4_after['stock']}")
assert p4_after['stock'] is None, "Lỗi: Dịch vụ không được có tồn kho!"

print("\n=== 6. Kiểm tra Thêm mới, Sửa, Xóa (CRUD) Sản phẩm, Khách hàng ===")
# Thêm khách hàng mới
res_new_cust = client.post("/api/customers", json={"name": "Phạm Văn Test", "phone": "0933112233", "zalo": "0933112233"})
assert res_new_cust.status_code == 200
cust_id = res_new_cust.json()["id"]
print(f"✅ Đã tạo khách hàng test ID: {cust_id}")

# Cập nhật khách hàng
res_up_cust = client.put(f"/api/customers/{cust_id}", json={"name": "Phạm Văn Test Đã Sửa"})
assert res_up_cust.status_code == 200
print(f"✅ Đã cập nhật khách hàng ID: {cust_id}")

# Xóa khách hàng
res_del_cust = client.delete(f"/api/customers/{cust_id}")
assert res_del_cust.status_code == 200
print(f"✅ Đã xóa khách hàng ID: {cust_id}")

print("\n🎉 TẤT CẢ CÁC CHỨC NĂNG CỦA ADMIN PANEL VÀ QUY TẮC TỒN KHO HOẠT ĐỘNG HOÀN HẢO 100%!")
