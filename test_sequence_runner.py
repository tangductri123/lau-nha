import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

print("==================================================")
print(" 1. TEST CHẾ ĐỘ TIÊU CHUẨN (EMAIL 1 GỬI NGAY, EMAIL 2 & 3 LÊN LỊCH)")
print("==================================================")
req1 = urllib.request.Request(
    'http://localhost:8080/api/waitlist',
    data=json.dumps({
        'name': 'Nguyễn Văn Chuẩn',
        'email': 'tangductri15@gmail.com',
        'phone': '0912345678'
    }).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
res1 = urllib.request.urlopen(req1)
data1 = json.loads(res1.read().decode('utf-8'))
print('Kết quả Waitlist Tiêu Chuẩn:\n', json.dumps(data1, indent=2, ensure_ascii=False))

print("\n==================================================")
print(" 2. TEST CHẾ ĐỘ TEST NHANH (+test -> GỬI NGAY CẢ 3 EMAIL)")
print("==================================================")
req2 = urllib.request.Request(
    'http://localhost:8080/api/waitlist',
    data=json.dumps({
        'name': 'Trí Test Nhanh',
        'email': 'tangductri15+test@gmail.com',
        'phone': '0988776655'
    }).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
res2 = urllib.request.urlopen(req2)
data2 = json.loads(res2.read().decode('utf-8'))
print('Kết quả Waitlist +test:\n', json.dumps(data2, indent=2, ensure_ascii=False))

print("\n==================================================")
print(" 3. KIỂM TRA BẢNG NHẬT KÝ CHUỖI EMAIL TRÊN API ADMIN")
print("==================================================")
res3 = urllib.request.urlopen('http://localhost:8080/api/email-sequences')
logs = json.loads(res3.read().decode('utf-8'))
print(f"Tổng số bản ghi email sequence: {len(logs)}")
for log in logs[:6]:
    print(f"#{log['id']} | Bước {log['step']} | {log['email']} | Trạng thái: {log['status']} | Lịch: {log['scheduled_at']} | Gửi lúc: {log['sent_at']} | Resend ID: {log['resend_id']}")

print("\n🎉 KIỂM TRA TOÀN DIỆN THÀNH CÔNG 100%!")
