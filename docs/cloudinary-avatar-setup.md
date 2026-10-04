# Thiết lập Cloudinary cho ảnh đại diện

Ảnh được upload trực tiếp từ trình duyệt bằng chữ ký do backend cấp. `CLOUDINARY_API_SECRET` chỉ đặt ở môi trường chạy server; không thêm secret vào biến `VITE_*` hoặc mã frontend.

## Cấu hình Cloudinary

1. Tạo upload preset `greenbowl_avatar_signed` ở chế độ **Signed**.
2. Giới hạn preset chỉ nhận `jpg`, `jpeg`, `png`, `webp`; dung lượng tối đa `5 MB`.
3. Để trống mục incoming transformation trong preset. Backend ký trực tiếp transformation `c_limit,w_2048,h_2048` cho mỗi yêu cầu upload, giới hạn cạnh ảnh ở 2048 px mà không phóng to ảnh nhỏ.
4. Không cho phép ghi đè asset đã có. Thư mục upload do backend ký, theo dạng `greenbowl/{development|production}/avatars/{accountId}`.
5. Bật quyền Admin API cho API key mà backend dùng để xác minh asset và xóa ảnh cũ.

Preset phải được tạo trong cùng Cloudinary account với `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` và `CLOUDINARY_API_SECRET`.

## Biến môi trường server

Thiết lập các biến sau trong `server/.env` (local) hoặc secret store của môi trường deploy:

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_AVATAR_UPLOAD_PRESET=greenbowl_avatar_signed
```

Không commit `server/.env`. Chỉ commit tên biến rỗng trong `.env.example`.

## Thay hoặc gỡ ảnh

Server chỉ xóa asset cũ sau khi URL ảnh mới đã được xác minh với Cloudinary và lưu vào `account.avatar_url`. Khi gỡ ảnh, server xóa URL trong DB trước rồi mới xóa asset. Nếu bước xóa Cloudinary thất bại, API trả cảnh báo rõ để có thể dọn thủ công; không xóa asset ngoài thư mục avatar của chính tài khoản.
