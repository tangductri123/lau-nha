import sys
sys.stdout.reconfigure(encoding='utf-8')
import sqlite3
import json
import urllib.request

products = [
    # 1. Nước cốt lẩu
    {
        "name": "Lẩu Thái Tom Yum (Túi 1L)",
        "type": "physical",
        "price": 89000,
        "description": "Vị chua thanh từ chanh sả, cay nồng ớt Xiêm, béo nhẹ cốt dừa.",
        "stock": 50
    },
    {
        "name": "Lẩu Tứ Xuyên Tiêu Tê (Túi 1L)",
        "type": "physical",
        "price": 99000,
        "description": "Vị đậm đà chuẩn Trung Hoa, thơm hoa hồi, thảo quả & hoa tiêu.",
        "stock": 50
    },
    {
        "name": "Lẩu Nấm Thượng Hạng (Túi 1L)",
        "type": "physical",
        "price": 89000,
        "description": "Ninh từ đông trùng hạ thảo, nấm tùng nhung & kỷ tử ngọt thanh.",
        "stock": 50
    },
    {
        "name": "Lẩu Riêu Cua Đồng (Túi 1L)",
        "type": "physical",
        "price": 99000,
        "description": "Riêu cua đồng béo ngậy, chua thanh giấm bỗng truyền thống.",
        "stock": 50
    },

    # 2. Set Combo
    {
        "name": "Set Đôi Lứa (2-3 người)",
        "type": "physical",
        "price": 249000,
        "description": "Ba chỉ bò Mỹ (200g), Bắp bò Úc (150g), Tôm thẻ tươi (4 con), Viên tổng hợp, Khay rau nấm tổng hợp & khay nhôm đun 30s.",
        "stock": 30
    },
    {
        "name": "Set Gia Đình (4-5 người)",
        "type": "physical",
        "price": 399000,
        "description": "Ba chỉ bò Mỹ (350g), Lõi vai bò Úc (250g), Tôm nhảy + Mực trứng (300g), Combo viên nhúng, 2 khay rau nấm & mì nhúng lẩu.",
        "stock": 30
    },
    {
        "name": "Set Đại Tiệc (6-8 người)",
        "type": "physical",
        "price": 599000,
        "description": "Bò Mỹ & Bò Úc Premium (800g), Tôm, Mực, Cá hồi phi lê (500g), Chả giò, Viên phô mai, 3 khay rau nấm, mì Udon & 2 khay nhôm.",
        "stock": 20
    },

    # 3. Món thêm & Phụ kiện
    {
        "name": "Thêm Ba Chỉ Bò Mỹ (200g)",
        "type": "physical",
        "price": 65000,
        "description": "Khay 200g thịt ba chỉ bò Mỹ thái lát cuộn tươi ngon.",
        "stock": 100
    },
    {
        "name": "Viên Nhúng Phô Mai (6 viên)",
        "type": "physical",
        "price": 45000,
        "description": "Khay 6 viên hải sản nhân phô mai tan chảy béo ngậy.",
        "stock": 100
    },
    {
        "name": "Tép Cồn Khô/Gel Nấu Lẩu",
        "type": "physical",
        "price": 15000,
        "description": "Cồn khô/gel nhiệt lượng cao, cháy lâu không cay mắt.",
        "stock": 200
    },
    {
        "name": "Bộ Bát Đũa Dùng 1 Lần",
        "type": "physical",
        "price": 15000,
        "description": "Set bát, đũa, thìa giấy thân thiện môi trường dùng tiện lợi.",
        "stock": 200
    },
    {
        "name": "Dịch Vụ Mượn Bếp Cồn Kèm Khay Đun",
        "type": "service",
        "price": 50000,
        "description": "Mượn bếp cồn đun lẩu tiện lợi (Miễn phí cho đơn từ 399k).",
        "stock": None
    },

    # 4. Sản phẩm số & Dịch vụ
    {
        "name": "Ebook: 100 Công Thức Nước Cốt Lẩu Chuẩn Vị",
        "type": "digital",
        "price": 99000,
        "description": "Ebook PDF hướng dẫn chi tiết bí quyết ninh cốt và canh chỉnh gia vị tự nhiên.",
        "stock": None
    },
    {
        "name": "Dịch Vụ Setup Tiệc Lẩu Tại Gia (Full Gói)",
        "type": "service",
        "price": 500000,
        "description": "Nhân viên đến tận nơi chuẩn bị bàn tiệc, cho mượn bếp nồi và dọn dẹp sạch sẽ sau tiệc.",
        "stock": None
    }
]

# 1. Update local database
conn = sqlite3.connect("My-Brain/brain.db")
cursor = conn.cursor()
cursor.execute("DELETE FROM products")
for p in products:
    cursor.execute(
        "INSERT INTO products (name, type, price, description, stock) VALUES (?, ?, ?, ?, ?)",
        (p["name"], p["type"], p["price"], p["description"], p["stock"])
    )
conn.commit()
conn.close()
print("✅ Local DB: Saved", len(products), "products to brain.db!")

# 2. Update remote Railway database via HTTP API
url = "https://lau-nha-production.up.railway.app"
try:
    req = urllib.request.Request(f"{url}/api/products")
    with urllib.request.urlopen(req) as response:
        existing = json.loads(response.read().decode())
        for old in existing:
            del_req = urllib.request.Request(f"{url}/api/products/{old['id']}", method="DELETE")
            try:
                urllib.request.urlopen(del_req)
            except Exception:
                pass

    for p in products:
        data = json.dumps(p).encode("utf-8")
        post_req = urllib.request.Request(
            f"{url}/api/products",
            data=data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(post_req) as resp:
            res_data = json.loads(resp.read().decode())
            print(f"✅ Railway Live DB: Added #{res_data.get('id')} - {p['name']}")
    print("\n🎉 All products synced to Railway Production DB successfully!")
except Exception as e:
    print("Railway sync notice:", e)

