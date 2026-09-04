# Huong Dan Trien Khai Website Lau Nha (launha.com) Tren VPS Ubuntu

## 1. Tong Quan Kien Truc
- **Ngon ngu & Framework:** Python 3.11+ / FastAPI / Uvicorn / Pydantic.
- **Frontend & Giao dien:** HTML5, CSS3, Vanilla JavaScript (server.py phuc vu truc tiep tai root / va /admin).
- **Co so du lieu:** SQLite (My-Brain/brain.db).
- **Cong lang nghe (Port):** Doc tu bien moi truong PORT (Mac dinh: 8080).

---

## 2. Danh Sach Bien Moi Truong (.env) Tren VPS

Tao file .env tai thu muc goc du an tren VPS dua theo file .env.example:

```env
PORT=8080
GEMINI_API_KEY=your_gemini_api_key_here
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM=LẨU NHÀ <cskh@order.laumangdi.com>
RESEND_REPLY_TO=tangductri15@gmail.com
ADMIN_EMAIL=tangductri15@gmail.com
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_or_group_id_here
SEPAY_API_TOKEN=your_sepay_api_token_here
SEPAY_ACCOUNT_NUMBER=your_bank_account_number_here
GOOGLE_APPS_SCRIPT_URL=your_google_apps_script_url_here
RAILWAY_URL=http://localhost:8080
```

---

## 3. Lenh Khoi Chay Server Tren VPS

### Cach 1: Chay bang Docker Compose (Khuyen dung)
```bash
docker compose up -d --build
docker compose logs -f
```

### Cach 2: Chay truc tiep bang Python
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 server.py
```

---

## 4. Cau Hinh Nginx Reverse Proxy & SSL (launha.com)

File cau hinh Nginx: `/etc/nginx/sites-available/launha.com`

```nginx
server {
    server_name launha.com www.launha.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Kich hoat va bat SSL:
```bash
sudo ln -s /etc/nginx/sites-available/launha.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d launha.com -d www.launha.com
```
