import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

# 1. Tìm hoặc tạo khách hàng có email
req_cust = urllib.request.Request(
    'http://localhost:8080/api/customers',
    data=json.dumps({
        'name': 'Anh Hoàng Admin Test',
        'phone': '0933557799',
        'email': 'tangductri15@gmail.com'
    }).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
res_cust = urllib.request.urlopen(req_cust)
cust_data = json.loads(res_cust.read().decode('utf-8'))
cust_id = cust_data['id']
print(f'✅ Tạo/Tìm khách hàng ID: {cust_id} (tangductri15@gmail.com)')

# 2. Tạo đơn hàng mới từ Admin (Set Đôi Lứa + Lẩu Thái Tomyum + Viên Phô Mai)
order_payload = {
    'customer_id': cust_id,
    'items': [
        {'product_id': 20, 'quantity': 1}, # Lẩu Thái Tom Yum 89k
        {'product_id': 24, 'quantity': 1}, # Set Đôi Lứa 249k
        {'product_id': 28, 'quantity': 1}  # Viên Nhúng Phô Mai 45k
    ],
    'status': 'pending'
}

req_order = urllib.request.Request(
    'http://localhost:8080/api/orders',
    data=json.dumps(order_payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
res_order = urllib.request.urlopen(req_order)
order_data = json.loads(res_order.read().decode('utf-8'))
print('✅ KẾT QUẢ TẠO ĐƠN HÀNG TRÊN /ADMIN:\n', json.dumps(order_data, indent=2, ensure_ascii=False))

assert order_data['success'] is True
assert order_data['email_status']['sent'] is True
print('\n🎉 EMAIL XÁC NHẬN ĐƠN HÀNG ĐÃ ĐƯỢC TỰ ĐỘNG GỬI THÀNH CÔNG QUA RESEND!')
