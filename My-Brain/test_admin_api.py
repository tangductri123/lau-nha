import urllib.request
import json
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def test(url, data=None, method='GET'):
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8') if data else None, 
        headers={'Content-Type': 'application/json'} if data else {}, 
        method=method
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

print("=== 1. Kiểm tra Admin Page HTML ===")
req_admin = urllib.request.Request("http://localhost:8000/admin")
with urllib.request.urlopen(req_admin) as resp:
    html = resp.read().decode('utf-8')
    print("Admin HTML loaded, length:", len(html), "Status:", resp.status)

print("\n=== 2. Kiểm tra API GET ===")
products = test("http://localhost:8000/api/products")
customers = test("http://localhost:8000/api/customers")
orders = test("http://localhost:8000/api/orders")
print(f"Tổng SP: {len(products)}, Khách hàng: {len(customers)}, Đơn hàng: {len(orders)}")

print("\n=== 3. Kiểm tra Mua Sản Phẩm Vật Lý (Physical) -> Trừ kho ===")
p1 = next(p for p in products if p['id'] == 1)
stock_before = p1['stock']
print(f"Sản phẩm: '{p1['name']}', Tồn kho trước: {stock_before}")

res_physical = test(
    "http://localhost:8000/api/orders", 
    {"customer_id": 1, "product_id": 1, "amount": 299000, "status": "completed"}, 
    method="POST"
)
print("Kết quả tạo đơn:", res_physical)

products_updated = test("http://localhost:8000/api/products")
p1_updated = next(p for p in products_updated if p['id'] == 1)
stock_after = p1_updated['stock']
print(f"Tồn kho sau khi đặt: {stock_after} (Giảm: {stock_before - stock_after})")
assert stock_after == stock_before - 1, "Lỗi: Kho không giảm 1 đơn vị!"

print("\n=== 4. Kiểm tra Mua Sản Phẩm Số / Dịch vụ (Digital/Service) -> Không trừ kho ===")
p3 = next(p for p in products if p['id'] == 3)
print(f"Sản phẩm số: '{p3['name']}', Tồn kho: {p3['stock']}")

res_digital = test(
    "http://localhost:8000/api/orders", 
    {"customer_id": 2, "product_id": 3, "amount": 99000, "status": "paid"}, 
    method="POST"
)
print("Kết quả tạo đơn:", res_digital)

products_updated2 = test("http://localhost:8000/api/products")
p3_updated = next(p for p in products_updated2 if p['id'] == 3)
print(f"Tồn kho sau khi đặt: {p3_updated['stock']}")
assert p3_updated['stock'] is None, "Lỗi: Sản phẩm số không được có stock!"

print("\n🎉 Tất cả bài kiểm tra hoàn thành xuất sắc và chính xác 100%!")
