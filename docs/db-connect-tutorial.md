# Hướng dẫn kết nối PostgreSQL vào dự án local

## Chuẩn bị

Trong project có thể có **2 file `.env.example`**, ví dụ:

```text
vegetarians_social_web_app_SWP/
├── client/
│   └── .env.example
│
└── server/
    ├── src/
    ├── .env.example   ← DÙNG FILE NÀY
    ├── package.json
    └── package-lock.json
```

Để kết nối PostgreSQL, **chỉ sử dụng file `.env.example` nằm trong folder `server`**.

Ngoài ra, đảm bảo project có file `.gitignore` để tránh push các file như:

```text
.env
node_modules/
```

lên GitHub.

---

## Bước 1: Tạo file `.env` cho server

Đi vào folder:

```text
server/
```

Copy file:

```text
server/.env.example
```

Sau đó đổi tên **bản copy** thành:

```text
server/.env
```

Sau bước này cấu trúc sẽ như sau:

```text
server/
├── src/
├── .env
├── .env.example
├── package.json
└── package-lock.json
```

> **Lưu ý:** Không sử dụng file `.env.example` bên `client` cho việc kết nối database.

---

## Bước 2: Cài dependency

Mở Terminal / CMD tại folder:

```text
server/
```

Chạy:

```bash
npm install
```

Lệnh này sẽ đọc các dependency trong `package.json` và cài chúng vào:

```text
server/node_modules/
```

Sau khi cài xong:

```text
server/
├── node_modules/
├── src/
├── .env
├── .env.example
├── package.json
└── package-lock.json
```

---

## Bước 3: Lấy PostgreSQL Connection String từ Neon

1. Truy cập **Neon**.
2. Chọn đúng project/database.
3. Chọn **Connect**.
4. Copy **Connection String**.
5. Mở file:

```text
server/.env
```

6. Dán Connection String vào biến `DB_URL`.

Ví dụ:

```env
DB_URL=postgresql://username:password@host/database
```

---

## Bước 4: Test kết nối database

Đảm bảo Terminal đang đứng tại folder:

```text
server/
```

Sau đó chạy:

```bash
npm run db:test
```

Nếu không xuất hiện lỗi kết nối thì PostgreSQL đã được kết nối thành công với project local.

---

## Flow ngắn gọn

```text
server/.env.example
        ↓
Copy thành server/.env
        ↓
npm install
        ↓
Neon → Connect
        ↓
Copy Connection String
        ↓
Dán vào DB_URL trong server/.env
        ↓
npm run db:test
```

## Lưu ý

- Chỉ dùng `.env.example` trong folder `server` để cấu hình database.
- Không push file `.env` lên GitHub.
- Không push folder `node_modules` lên GitHub.
- Nếu gặp lỗi `Cannot find module 'dotenv'`, hãy chạy lại:

```bash
npm install
```