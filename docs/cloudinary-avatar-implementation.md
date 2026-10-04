# Hướng dẫn triển khai ảnh đại diện bằng Cloudinary

Tài liệu này mô tả toàn bộ luồng upload avatar Cloudinary đang được dùng trong Green Bowl: tạo tài khoản và preset, cấu hình backend, chọn ảnh trên trang hồ sơ, upload có chữ ký, xác minh asset, lưu URL vào PostgreSQL, thay/gỡ ảnh, kiểm thử và xử lý sự cố.

> Phạm vi: ảnh đại diện tài khoản trong Sprint 2. Không áp dụng tài liệu này cho ảnh Dish, bài viết, công thức hoặc ảnh nhiều tệp.

## 1. Kết quả và kiến trúc

Ứng dụng dùng **signed direct upload**:

1. Trình duyệt yêu cầu backend cấp tham số upload có chữ ký.
2. Backend ký các tham số cố định bằng Cloudinary API Secret.
3. Trình duyệt gửi ảnh trực tiếp lên Cloudinary; API Secret không rời server.
4. Trình duyệt gửi `secure_url` nhận được cho backend.
5. Backend truy vấn Cloudinary Admin API để xác nhận asset, tài khoản sở hữu namespace, định dạng, dung lượng và kích thước.
6. Backend lưu URL đã xác thực vào `account.avatar_url`.
7. Khi thay ảnh, backend lưu ảnh mới trước rồi mới xóa ảnh Cloudinary cũ nếu ảnh cũ thuộc namespace avatar mà ứng dụng quản lý.

```text
UserProfilePage
  └─ ImageUpload
      └─ user.service.uploadAvatar(file)
          ├─ POST /api/users/me/avatar-upload-signature
          │    └─ Express auth → user.controller → cloudinary.js
          ├─ POST https://api.cloudinary.com/v1_1/{cloud}/image/upload
          └─ PUT /api/users/me/avatar { avatarUrl }
               └─ Express auth → user.controller
                   ├─ Cloudinary Admin API: xác minh asset
                   ├─ PostgreSQL: account.avatar_url = secure_url
                   └─ Cloudinary destroy: dọn avatar Cloudinary cũ
```

### Các thành phần trong repository

| Thành phần | Vị trí | Vai trò |
|---|---|---|
| Trang hồ sơ | [`client/src/pages/UserProfilePage.jsx`](../client/src/pages/UserProfilePage.jsx) | Truyền URL hiện tại, `onUpload` và `onChange` cho UI upload; cập nhật state hồ sơ sau khi service thành công. |
| UI upload dùng chung | [`client/src/components/ImageUpload/ImageUpload.jsx`](../client/src/components/ImageUpload/ImageUpload.jsx) | Chọn/kéo-thả, preview, kiểm tra MIME/size ở client, hiển thị tiến độ, thử lại, hủy và gỡ ảnh. Component không phụ thuộc Cloudinary. |
| Client service | [`client/src/services/user.service.js`](../client/src/services/user.service.js) | Xin chữ ký, upload bằng `XMLHttpRequest`, rồi gửi URL tới API backend. |
| API routes | [`server/src/routes/user.routes.js`](../server/src/routes/user.routes.js) | Khai báo các endpoint avatar và áp dụng xác thực. |
| Controller | [`server/src/controllers/user.controller.js`](../server/src/controllers/user.controller.js) | Cấp chữ ký, xác minh ảnh, cập nhật hồ sơ và xử lý thay/gỡ ảnh. |
| Model | [`server/src/models/user.model.js`](../server/src/models/user.model.js) | Đọc và cập nhật trường `account.avatar_url`. |
| Cloudinary helper | [`server/src/utils/cloudinary.js`](../server/src/utils/cloudinary.js) | Tạo chữ ký, parse URL/public ID, kiểm tra asset Admin API và xóa ảnh. |
| Kiểm thử helper | [`server/src/utils/cloudinary.test.js`](../server/src/utils/cloudinary.test.js) | Kiểm tra folder, public ID, chữ ký, transformation, định dạng và giới hạn upload. |
| Hướng dẫn cấu hình ngắn | [`docs/cloudinary-avatar-setup.md`](./cloudinary-avatar-setup.md) | Checklist cấu hình preset và biến môi trường. |

Server được khởi tạo dotenv trước khi nạp Express app trong [`server/server.js`](../server/server.js). Client gọi API qua wrapper [`client/src/services/api.js`](../client/src/services/api.js), wrapper tự thêm Bearer token từ phiên đăng nhập.

## 2. Giới hạn và chính sách hiện hành

| Thuộc tính | Giá trị / hành vi |
|---|---|
| Các định dạng chấp nhận | JPG/JPEG, PNG, WebP |
| Giới hạn dung lượng | 5 MiB = `5 * 1024 * 1024` byte |
| Kích thước tối đa sau xử lý | 2048 × 2048 px |
| Transformation được ký | `c_limit,w_2048,h_2048` |
| Không phóng to ảnh nhỏ | `c_limit` chỉ giới hạn ảnh vượt ngưỡng |
| Thư mục asset | `greenbowl/{development|production}/avatars/{accountId}` |
| Public ID | UUID ngẫu nhiên cho mỗi lần upload |
| Ghi đè asset | Không cho phép (`overwrite=false`) |
| URL lưu DB | `secure_url` do Cloudinary trả về sau khi backend xác minh |
| Thay ảnh | Cập nhật DB trước, sau đó mới xóa ảnh Cloudinary cũ thuộc namespace quản lý |
| Gỡ ảnh | Xóa URL trong DB trước, sau đó thử xóa asset Cloudinary |

Dung lượng 5 MiB được kiểm tra ở giao diện và được backend đối chiếu lại qua metadata asset. Backend cũng kiểm tra kích thước sau transformation. Kiểm tra backend xảy ra **sau khi file đã đến Cloudinary**, vì vậy giới hạn phía client giúp UX nhưng không phải cơ chế chặn băng thông trước khi upload. Preset Cloudinary phải giới hạn định dạng; nếu tài khoản có thiết lập giới hạn dung lượng riêng, có thể đặt thêm tại đó.

Ảnh được tải lên với delivery type `Upload`, do đó URL là URL ảnh có thể phân phối công khai. Không dùng chức năng này cho ảnh riêng tư hoặc tài liệu nhạy cảm.

## 3. Tạo Cloudinary account và lấy thông tin cần thiết

1. Tạo/đăng nhập tài khoản tại [Cloudinary](https://cloudinary.com/users/register/free).
2. Mở **Dashboard** của product environment cần dùng.
3. Lấy:
   - **Cloud name**
   - **API Key**
   - **API Secret**
4. Giữ cả ba giá trị trong cùng một product environment. API key/secret của môi trường khác sẽ không xác thực được với cloud name hiện tại.
5. `API Secret` là bí mật server-side. Không ghi vào:
   - `client/.env`, biến `VITE_*`, mã frontend hoặc request từ browser;
   - Git, issue, ảnh chụp màn hình, tài liệu chia sẻ hoặc chat;
   - log server.

Cloud name và API key được gửi tới browser vì cần gọi endpoint upload Cloudinary; chúng không thay thế API Secret và chữ ký.

## 4. Tạo upload preset có chữ ký

Mở **Cloudinary Console → Settings → Upload → Upload presets**, chọn **Add Upload Preset**. Tên mục có thể khác đôi chút theo giao diện console.

Thiết lập preset:

| Mục trong Console | Giá trị / hành động |
|---|---|
| Upload preset name | `greenbowl_avatar_signed` |
| Signing mode | `Signed` |
| Asset folder | Để trống; backend ký folder riêng cho từng account/environment. |
| Overwrite assets with the same public ID | Tắt |
| Generated public ID | Có thể để mặc định; yêu cầu upload của ứng dụng truyền UUID cụ thể. |
| Transform → Incoming transformation | Để trống. Transformation giới hạn kích thước do backend đưa vào tham số có chữ ký. |
| Optimize and Deliver → Allowed formats | `jpg,jpeg,png,webp` |
| Optimize and Deliver → Format | Để trống, không ép chuyển định dạng. |
| Delivery type | `Upload` |
| Tags/context/moderation/add-ons | Để mặc định; avatar không cần các tính năng này. |
| Notification URL | Để trống. |

Lưu preset trong đúng product environment có Cloud name/API credentials mà backend dùng. Preset cần tồn tại và ở chế độ signed; nếu preset bị xóa, đổi tên hoặc chuyển sang unsigned, upload có thể lỗi.

> Preset ảnh của mốc đã được xác minh trên Cloudinary: preset tồn tại, tên khớp, `unsigned=false`, và định dạng cho phép gồm JPG/JPEG/PNG/WebP. Incoming transformation của preset để trống theo thiết kế; transformation được ký từ backend.

Tài liệu Cloudinary: [Managing upload presets](https://cloudinary.com/documentation/upload_presets), [Upload API](https://cloudinary.com/documentation/image_upload_api_reference_upload).

## 5. Cấu hình môi trường backend

Thêm các biến sau vào **`server/.env`** trên máy chạy backend:

```dotenv
CLOUDINARY_CLOUD_NAME=<Cloud name trong Dashboard>
CLOUDINARY_API_KEY=<API Key trong Dashboard>
CLOUDINARY_API_SECRET=<API Secret trong Dashboard>
CLOUDINARY_AVATAR_UPLOAD_PRESET=greenbowl_avatar_signed
```

Không thêm secret vào `client/.env`. Không đưa giá trị thật của `.env` vào tài liệu hoặc Git. Trong dự án hiện tại `server/server.js` gọi `require('dotenv').config()` trước khi load app; nếu thay đổi `.env`, phải restart server để tiến trình nạp lại cấu hình.

Khi deploy production, khai báo cùng tên biến trong secret store/environment variables của nền tảng deploy; không copy file `.env` vào image hoặc repository. `NODE_ENV=production` làm folder chuyển từ `development` sang `production`.

### Kiểm tra cấu hình mà không in secret

Có thể kiểm tra sự hiện diện các biến bằng PowerShell mà chỉ in tên và trạng thái, không in giá trị:

```powershell
$envFile = 'server\.env'
$keys = @(
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_AVATAR_UPLOAD_PRESET'
)
$lines = Get-Content $envFile
foreach ($key in $keys) {
  $line = $lines | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -Last 1
  $present = $false
  if ($line) {
    $value = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
    $present = $value.Length -gt 0
  }
  "$key configured: $present"
}
```

Nếu `CLOUDINARY_AVATAR_UPLOAD_PRESET` bị bỏ trống hoặc không khai báo, code có tên mặc định `greenbowl_avatar_signed`; vẫn nên khai báo rõ trong môi trường để dễ kiểm tra.

## 6. Luồng upload từng bước

### 6.1 Người dùng chọn ảnh

Trên trang **User Profile → Thông tin tài khoản**, người dùng chọn hoặc kéo-thả một ảnh:

- `ImageUpload` giới hạn ảnh đơn (`multiple=false`, mặc định tối đa một ảnh);
- `accept` trên Profile là `image/jpeg,image/png,image/webp`;
- `maxSizeMB={5}`;
- component kiểm tra MIME type và dung lượng ở browser;
- component hiện preview cục bộ tạm thời, tiến độ upload, nút hủy và thử lại.

Profile truyền `handleAvatarUpload` vào prop `onUpload`. Vì prop này luôn được truyền cho trang Profile, thao tác Profile gọi Cloudinary thật. `ImageUpload` dùng `URL.createObjectURL` chỉ khi một trang khác không truyền `onUpload`; đó là fallback demo chung của component, không phải đường upload của Profile.

### 6.2 Browser xin chữ ký từ backend

Client gọi:

```http
POST /api/users/me/avatar-upload-signature
Authorization: Bearer <access-token>
```

Route áp dụng `requireAuth`. Backend lấy account ID từ `req.account.id`, không nhận account ID do browser tự chọn.

Backend tạo các tham số:

- `folder`: `greenbowl/{environment}/avatars/{accountId}`;
- `public_id`: UUID mới;
- `overwrite`: `false`;
- `timestamp`: thời điểm hiện tại theo giây;
- `transformation`: `c_limit,w_2048,h_2048`;
- `upload_preset`: preset đã cấu hình;
- `signature`: chữ ký Cloudinary tạo ở server;
- `apiKey`, `cloudName`, `resourceType=image`;
- metadata client-side: `maxFileSize=5242880`, `allowedFormats=jpg,jpeg,png,webp`.

Các tham số upload có ảnh hưởng tới Cloudinary được ký cùng API Secret theo helper trong `server/src/utils/cloudinary.js`. API Secret không được đưa vào phản hồi.

Nếu cấu hình bắt buộc thiếu, endpoint trả `503` với thông báo cấu hình chưa sẵn sàng. Không có access token hợp lệ thì middleware trả `401`.

### 6.3 Browser upload trực tiếp lên Cloudinary

`user.service.js` tạo `FormData` chứa file và tham số được backend ký rồi gửi:

```http
POST https://api.cloudinary.com/v1_1/{cloudName}/image/upload
```

Upload dùng `XMLHttpRequest` thay vì `fetch` để đọc `request.upload` progress event. Thời hạn client hiện là 60 giây; khi người dùng hủy, `AbortController` làm XHR bị hủy.

Khi thành công, client nhận `secure_url` từ phản hồi Cloudinary. Nếu Cloudinary từ chối upload, service chuyển thông báo lỗi về `ImageUpload` để hiển thị và cho thử lại.

### 6.4 Backend xác minh URL/asset

Client gửi URL nhận được tới:

```http
PUT /api/users/me/avatar
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "avatarUrl": "https://res.cloudinary.com/..."
}
```

Backend không tin URL do client gửi. Trước khi cập nhật DB, backend kiểm tra:

1. URL parse được, sử dụng HTTPS và host là `res.cloudinary.com`.
2. Cloud name trong đường dẫn trùng cấu hình hiện tại.
3. Resource path là `image/upload`.
4. Folder trùng chính xác namespace của account và môi trường đang đăng nhập.
5. Public ID là UUID và extension là JPG/JPEG/PNG/WebP.
6. Cloudinary Admin API xác nhận asset tồn tại và `public_id` trùng khớp.
7. Metadata Cloudinary cho biết format hợp lệ, file lớn hơn 0 và không vượt 5 MiB.
8. Chiều rộng và chiều cao đều là số nguyên dương, không vượt 2048 px.
9. Asset có `secure_url`.

Nếu asset không tồn tại hoặc không đạt điều kiện, endpoint trả lỗi client; nếu Cloudinary Admin API gặp lỗi mạng/dịch vụ, lỗi được chuyển tiếp qua cơ chế lỗi Express hiện có.

### 6.5 Lưu URL vào PostgreSQL

Khi xác minh thành công, model chạy `UPDATE public.account` cho đúng `account_id`, đặt:

```text
account.avatar_url = asset.secure_url
account.updated_at = NOW()
```

URL không nằm ở `profile.avatar` của bảng health profile; ảnh đại diện tài khoản được lưu trong cột `account.avatar_url` đã có trong schema baseline. Vì vậy luồng avatar không cần thêm cột `public_id` hoặc migration riêng.

Client cập nhật `form.avatar` và `savedProfile.avatar` bằng kết quả backend ngay khi service thành công; không phải đợi người dùng bấm nút lưu thông tin hồ sơ.

### 6.6 Thay ảnh cũ

Thứ tự thao tác được chủ ý sắp xếp để không làm mất avatar đang hoạt động nếu upload ảnh mới lỗi:

1. Upload ảnh mới lên Cloudinary.
2. Backend xác minh ảnh mới.
3. Lưu URL mới vào database.
4. Tìm public ID avatar cũ.
5. Chỉ xóa ảnh cũ nếu ảnh đó nằm đúng folder avatar của chính account.

Nếu xóa ảnh cũ lỗi, URL mới vẫn được lưu và API trả `cleanupWarning` để giao diện thông báo. Ảnh cũ ngoài namespace ứng dụng (ví dụ URL cũ không thuộc folder mới) không bị xóa tự động vì không thể xác minh quyền sở hữu an toàn.

### 6.7 Gỡ avatar

Người dùng bấm nút xóa trên `ImageUpload`:

1. Component gọi `onChange('')`.
2. `UserProfilePage` gọi `DELETE /api/users/me/avatar`.
3. Backend ghi `NULL` vào `account.avatar_url` trước.
4. Backend phân tích URL cũ; nếu URL thuộc folder avatar được quản lý, backend gọi Cloudinary destroy API có chữ ký.
5. Nếu dọn Cloudinary thất bại, hồ sơ vẫn không còn avatar nhưng API trả cảnh báo để có thể dọn asset thủ công.

### 6.8 Các điều kiện lỗi chính của API hồ sơ

| HTTP status | Tình huống |
|---|---|
| `401` | Thiếu/sai/hết hạn Bearer token. |
| `400` | URL gửi lên không phải asset Cloudinary hợp lệ, sai account folder, sai định dạng hoặc vượt giới hạn metadata. |
| `404` | Không tìm thấy hồ sơ tài khoản hoặc tài khoản không còn cập nhật được. |
| `503` | Backend chưa có các thông tin cấu hình Cloudinary bắt buộc khi xin chữ ký. |
| `2xx` có `cleanupWarning` | URL ảnh mới đã lưu/gỡ khỏi DB nhưng thao tác xóa asset cũ trên Cloudinary chưa hoàn tất. |

## 7. Chạy ứng dụng để kiểm thử thủ công

Mở hai terminal tại repository:

**Backend**

```powershell
Set-Location .\server
npm run dev
```

Mặc định API chạy tại `http://localhost:5000`; kiểm tra readiness:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

**Frontend**

```powershell
Set-Location .\client
npm run dev
```

Mặc định Vite chạy tại `http://localhost:5173`. Client cần cấu hình `VITE_API_BASE_URL` trỏ tới backend (ví dụ `http://localhost:5000/api`) trong `client/.env`.

### Checklist nghiệm thu trên UI

1. Đăng nhập tài khoản Member.
2. Mở `/profile`.
3. Chọn tab **Thông tin tài khoản**.
4. Chọn ảnh JPG/PNG/WebP nhỏ hơn hoặc bằng 5 MiB.
5. Quan sát preview và tiến độ upload.
6. Khi upload xong, xác nhận avatar mới hiển thị trên Profile.
7. Reload trang; avatar vẫn hiển thị từ URL được backend đọc lại.
8. Trong PostgreSQL, kiểm tra `account.avatar_url` của đúng account chứa `https://res.cloudinary.com/...`.
9. Trong Cloudinary Media Library, kiểm tra asset nằm dưới `greenbowl/development/avatars/{accountId}` khi chạy development.
10. Thử đổi sang ảnh thứ hai; URL trong DB phải đổi, asset avatar cũ thuộc namespace được quản lý phải được dọn.
11. Thử gỡ ảnh; `account.avatar_url` phải thành `NULL`, asset cũ thuộc namespace được quản lý phải bị xóa.
12. Không có token thì gọi endpoint cấp chữ ký phải nhận `401`.

Không đưa access token, Cloudinary API Secret hoặc toàn bộ nội dung `.env` vào log hay ảnh chụp khi báo lỗi.

## 8. Kiểm thử tự động và bằng chứng đã chạy

Kiểm thử helper Cloudinary:

```powershell
Set-Location .\server
node --test src/utils/cloudinary.test.js
```

Các kiểm thử hiện có kiểm tra:

- chữ ký được tạo nhất quán với thứ tự tham số;
- thư mục theo account/environment;
- public ID UUID và không cho overwrite;
- transformation và các giới hạn được trả cho client;
- chỉ parse URL đúng Cloudinary/account folder;
- từ chối URL ngoài Cloudinary hoặc thuộc account khác.

Các lệnh kiểm tra client:

```powershell
Set-Location .\client
npm run build
npm run lint
```

Trong lần tích hợp thật đã xác minh:

- Cloudinary API authentication hoạt động và preset được đọc thành công;
- preset `greenbowl_avatar_signed` tồn tại, có `unsigned=false` và allowed formats JPG/JPEG/PNG/WebP;
- signed upload ảnh thử thành công, backend Admin API xác minh được và asset thử đã được xóa;
- upload ảnh thử 2400 × 1200 được transformation xử lý thành 2048 × 1024; backend xác minh kích thước và asset thử đã được xóa;
- backend health endpoint trả HTTP 200; endpoint xin chữ ký không có xác thực trả HTTP 401;
- chủ dự án đã nghiệm thu upload avatar thật qua giao diện và xác nhận database được cập nhật bằng URL Cloudinary.

Các asset thử nghiệm nói trên được tạo riêng và đã xóa. Bằng chứng nghiệm thu UI/DB là xác nhận của người dùng; không có thông tin đăng nhập hoặc dữ liệu tài khoản được ghi trong tài liệu này.

## 9. Khắc phục sự cố

### Cloudinary API trả HTTP 401 khi kiểm tra preset hoặc metadata

- Kiểm tra Cloud name, API Key và API Secret có cùng product environment.
- Kiểm tra không có khoảng trắng thừa hoặc dấu quote bị copy sai trong `.env`.
- Kiểm tra server đã được restart sau khi sửa `.env`.
- Kiểm tra API key còn hiệu lực và tài khoản có quyền dùng Admin API.
- Không gửi secret để nhờ người khác kiểm tra; nhập lại trực tiếp vào secret store/server `.env`.

### Xin chữ ký trả `503`

- Xác nhận ba biến bắt buộc `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` tồn tại và không rỗng trong `server/.env`.
- Restart backend.
- Preset có fallback tên `greenbowl_avatar_signed`; khai báo biến `CLOUDINARY_AVATAR_UPLOAD_PRESET` rõ ràng giúp phát hiện lệch tên.

### Cloudinary upload trả lỗi / preset không hợp lệ

- Xác nhận preset tồn tại đúng product environment và tên chính xác `greenbowl_avatar_signed`.
- Chọn **Signed**, không chọn **Unsigned**.
- Đảm bảo allowed formats gồm `jpg,jpeg,png,webp`.
- Kiểm tra đồng hồ máy/server không lệch đáng kể; upload signature chứa timestamp.
- Kiểm tra DevTools Network response từ Cloudinary để đọc thông báo lỗi. Không chụp/chia sẻ request chứa chữ ký hoặc token.

### Backend báo URL không thuộc folder tài khoản

- Không tự sửa URL hoặc gửi URL ảnh từ nguồn khác tới `PUT /users/me/avatar`.
- Kiểm tra upload đang dùng đúng token Member hiện tại và backend tạo folder account ID theo token.
- Kiểm tra URL cùng cloud name, account folder và môi trường backend.
- URL test/dev không thể lưu như URL production vì folder namespace khác nhau.

### Upload thành công nhưng URL không lưu được

- Kiểm tra log backend và phản hồi `PUT /api/users/me/avatar`.
- Admin API cần xác minh asset trước khi DB được cập nhật; kiểm tra credentials, asset ID và metadata.
- Kiểm tra kết nối PostgreSQL, trạng thái account và quyền update bảng account.
- Nếu upload đã thành công trên Cloudinary nhưng bước lưu DB lỗi, asset vừa upload có thể còn dư trên Cloudinary. Tìm theo folder/account và dọn thủ công sau khi xác nhận không có hồ sơ nào trỏ tới asset đó.

### Avatar mới lưu nhưng ảnh cũ còn trên Cloudinary

- Nếu response có `cleanupWarning`, URL mới vẫn hoạt động; chỉ phần dọn ảnh cũ lỗi.
- Kiểm tra API key/secret và Cloudinary destroy API.
- Chỉ xóa asset cũ sau khi xác nhận public ID thuộc đúng tài khoản và không còn được DB tham chiếu.
- Ảnh cũ nằm ngoài namespace `greenbowl/{environment}/avatars/{accountId}` không bị code tự động xóa.

### Client báo upload timeout hoặc kết nối lỗi

- Kiểm tra internet, Cloudinary availability và CORS/kết nối HTTPS.
- Xem tiến độ upload; giới hạn client timeout hiện là 60 giây.
- Dùng **Thử lại** nếu component còn giữ file. Nếu trình duyệt đã reload, chọn lại file.
- Hủy upload giữa chừng có thể khiến trạng thái client không nhận được response dù Cloudinary đã xử lý; nếu thấy asset mồ côi, kiểm tra Media Library trước khi xóa.

## 10. Bảo mật và giới hạn hiện tại

- Mọi endpoint avatar đều yêu cầu Bearer authentication.
- Account ID lấy từ token đã xác thực, không tin account ID trong request body.
- API Secret chỉ được dùng backend để ký upload, xác minh và xóa asset.
- Chữ ký ràng buộc folder, UUID, timestamp, preset, overwrite và transformation.
- Backend xác minh asset qua Admin API; không cho client lưu URL tùy ý vào DB.
- Xóa asset bị giới hạn trong folder avatar của đúng account.
- `secure_url` là URL phân phối ảnh công khai; không dùng cho ảnh cần kiểm soát truy cập.
- UI giới hạn file 5 MiB; backend xác minh metadata sau upload. Nếu cần Cloudinary từ chối file vượt 5 MiB **trước khi nhận**, cần cấu hình thêm giới hạn cứng phía Cloudinary/upload pipeline và kiểm thử đúng trên account đang dùng; không coi kiểm tra giao diện là ranh giới bảo mật.
- Upload có thể tạo asset mồ côi nếu Cloudinary nhận file nhưng request lưu DB thất bại hoặc client mất kết nối sau khi upload. Hiện chưa có job tự động đối soát/dọn asset mồ côi.
- Asset cũ không thuộc namespace mới không bị xóa tự động; cần rà soát và dọn thủ công nếu chính sách yêu cầu.

## 11. Kết quả bàn giao

Chức năng được xem là hoàn tất khi:

- signed preset và backend credentials cùng product environment;
- Member đăng nhập có thể upload JPG/PNG/WebP và thấy tiến độ;
- backend chỉ lưu URL asset được xác minh;
- URL nằm trong `account.avatar_url` và còn sau khi tải lại trang;
- thay/gỡ ảnh cập nhật DB chính xác và dọn asset cũ thuộc namespace quản lý;
- trường hợp dọn ảnh thất bại có cảnh báo thay vì báo thành công im lặng;
- unit tests, build và lint liên quan pass;
- `.env` và API Secret không bị commit hoặc đưa vào tài liệu/log.
