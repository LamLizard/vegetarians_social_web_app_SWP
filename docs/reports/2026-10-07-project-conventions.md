# Báo cáo tinh gọn quy ước chung — Vegetarian Social

**Ngày thực hiện:** 07/10/2026. **Nhánh:** `dev/sprint2/Tung/feat`. **HEAD trước thay đổi:** `6633c8b`.
**Trạng thái:** đã áp dụng vào working tree trên nhánh hiện tại; chưa commit, push hoặc merge.

## 1. Mục tiêu và phạm vi

Hợp nhất quy ước phát triển chung thành một guide, giữ catalog UI riêng và rút entry Copilot về tham chiếu. Bản hoàn thiện dùng trực tiếp trong project, thay cho bản demo.

Phạm vi là naming, vị trí file, trách nhiệm frontend/backend, cách dùng UI Kit và đường đọc hướng dẫn chung. Tài liệu nghiệp vụ theo chức năng, nội dung sprint, quy tắc làm việc cá nhân, cấu hình kết nối và source ứng dụng không được chỉnh trong đợt này.

Trước khi làm, working tree đã có các thay đổi/xóa/tệp mới. Chúng được giữ nguyên; báo cáo này không coi chúng là kết quả của đợt tinh gọn.

## 2. Cấu trúc sau chỉnh sửa

| Vai trò | File hiện hành |
|---|---|
| Quy ước code đầy đủ | [development-guide.md](../development-guide.md) |
| Quy tắc sử dụng và catalog UI | [skill-ui-kit.md](../skill-ui-kit.md) |
| Entry cho Copilot | [copilot-instructions.md](../../.github/copilot-instructions.md) |
| Điểm bắt đầu của repo | [README.md](../../README.md) |
| Đường dẫn tương thích | [code](../skill-ai-gen-code.md), [naming](../quy-uoc-dat-ten.md), [folder](../huong-dan-folder.md) |
| Giới hạn tìm kiếm tài liệu phụ | [.rgignore](../../.rgignore) |

Hai tài liệu đầu chứa quy định và catalog; Copilot/README chỉ dẫn tới chúng. Ba đường dẫn tương thích không còn chứa bộ luật độc lập.

## 3. Đã làm những gì

| File/khu vực | Trước | Thay đổi thực hiện |
|---|---|---|
| `docs/skill-ai-gen-code.md` | Naming, folder, component, format AI và nhiều ví dụ | Hợp nhất nội dung kỹ thuật vào guide; bản cũ còn 3 dòng chuyển hướng |
| `docs/quy-uoc-dat-ten.md` | Naming, thuật ngữ và checklist lặp | Một bảng naming/thuật ngữ trong guide; bản cũ còn 3 dòng chuyển hướng tới mục naming |
| `docs/huong-dan-folder.md` | Giải thích từng thư mục, ví dụ lặp và dấu trang | Một bảng trách nhiệm trong guide; bản cũ còn 3 dòng chuyển hướng tới mục folder |
| `docs/development-guide.md` | Chưa có | Tạo nguồn chung gồm 6 mục: phạm vi, naming, vị trí, frontend/UI, backend/dữ liệu, checklist |
| `docs/skill-ui-kit.md` | Danh sách chọn nhanh lặp catalog; mô tả/props dài, ghi nhận nghiệp vụ/schema | Giữ quy tắc dùng kit và một catalog có link source; chữ ký props tra trong implementation |
| `.github/copilot-instructions.md` | Chép lại quy tắc và yêu cầu đọc nguồn đang thiếu | Còn 5 dòng: theo guide, tra UI Kit/source, phân biệt ứng dụng chính với template |
| `README.md` | Chỉ có tên repo | Thêm đường đọc quy ước, bản đồ source và link báo cáo |
| `.rgignore` | Chưa có | Loại report và ba redirect khỏi tìm kiếm mặc định; Git vẫn theo dõi bình thường |
| `docs/conventions-demo/` | 4 file bản thử | Xóa toàn bộ folder demo sau khi chuyển nội dung sang vị trí thực tế |
| Báo cáo này | Chưa có | Ghi riêng phạm vi, thay đổi, số liệu, bằng chứng và kết luận |

### Vì sao giữ ba đường dẫn cũ

Các tài liệu ngoài phạm vi vẫn tham chiếu các tên cũ. Xóa hẳn chúng sẽ làm hỏng đường đọc hoặc buộc sửa nội dung mà người dùng đã loại khỏi đợt này.

Vì vậy, nội dung quy tắc cũ đã được bỏ hoàn toàn, nhưng mỗi file còn 3 dòng chuyển hướng. Tổng ba redirect chỉ 622 byte; chúng không phải ba nguồn quy định mới. Chỉ có thể bỏ hẳn khi các nguồn tham chiếu được cập nhật trong đợt phù hợp.

Không tạo archive chứa thêm bản luật cũ. Với các nguồn đã track, lịch sử trước đợt này có thể xem qua HEAD `6633c8b` và các path tương ứng; không cần giữ thêm bản đầy đủ trong checkout.

## 4. Tinh gọn như thế nào

### Nội dung được bảo toàn

- Convention tên file, hoa/thường, tên export theo loại file, CSS/asset/docs và commit/branch.
- Ranh giới page/component/service/context/hook/util và route/controller/model/middleware/config.
- Ưu tiên thư mục có sẵn; thống nhất với nhóm khi mở rộng cấu trúc ứng dụng hoặc thư viện dùng chung.
- Component có trách nhiệm rõ, props/callback rõ nghĩa; dữ liệu nghiệp vụ đi qua page/service.
- SQL nằm ở model; xác thực/phân quyền thực hiện tại server.
- Dùng UI Kit thay vì dựng lại component đã có; source là nơi tra props/callback.
- Tách cấu hình bí mật khỏi Git, chia sẻ cấu hình mẫu và dùng cơ chế upload hiện có.

### Nội dung trùng hoặc không thuộc chuẩn kỹ thuật đã được rút bỏ

- Ba bản naming/folder/checklist lặp được thay bằng một bảng và một checklist.
- Ví dụ dài về cùng một luồng thao tác được bỏ khi bảng trách nhiệm đã đủ.
- Hướng dẫn dán/copy prompt, format trả lời bắt buộc, bắt in đường dẫn/vẽ cây trong câu trả lời và giới hạn số câu hỏi không nằm trong guide chung.
- Danh sách “chọn nhanh” UI được gộp vào catalog; không chép lại toàn bộ props đã có trong source.
- Ghi nhận quota, enum và chính sách duyệt của module không được dùng làm quy định UI chung.

### Các điểm lệch được làm rõ theo source

| Điểm | Cách xử lý | Bằng chứng |
|---|---|---|
| Cấm dùng account dù backend có domain Account | Giữ account ở domain/backend, user ở payload khi contract sử dụng | [account model](../../server/src/models/account.model.js), [auth controller](../../server/src/controllers/auth.controller.js) |
| Ví dụ gán `req.user` | Guide ghi đúng `req.account` hiện tại | [auth middleware](../../server/src/middlewares/auth.js) |
| Ví dụ import `@/components` | Dùng ví dụ import tương đối; chưa thêm alias | [Vite config](../../client/vite.config.js) |
| Nhận định thiếu Post reported trong constants đã cũ | Catalog không lặp nhận định đó; phân biệt map hiển thị với schema | [status constants](../../client/src/constants/status.js) |
| Trỏ nguồn schema không có trong checkout | Bỏ tham chiếu lỗi; không tự suy ra schema đang triển khai | Quy tắc đối chiếu source/schema trong development guide |
| Luật mọi file phải có một export trùng tên | Làm rõ component/hook/util có export chính; service/model có nhiều hàm liên quan | Cấu trúc export đang dùng trong repo |
| Suy ra vị trí entry từ template | Dẫn tới entry ứng dụng chính | [frontend entry](../../client/src/main.jsx), [backend entry](../../server/server.js) |

Không sửa code để ép implementation theo ví dụ tài liệu. Không đổi contract API, enum, database hoặc hành vi nghiệp vụ.

## 5. Kết quả định lượng

Số đo UTF-8 lấy trực tiếp từ file trước và sau. Bản demo cũ, README, redirect, cấu hình tìm kiếm và báo cáo được tách khỏi bộ hướng dẫn chính để so sánh cùng mục đích.

| Phần | Trước | Sau |
|---|---|---|
| Code + naming + folder | 3 bản đầy đủ; 266 dòng; 15.324 byte | 1 guide; 76 dòng; 6.483 byte |
| UI Kit | 121 dòng; 22.513 byte | 109 dòng; 9.707 byte |
| Copilot | 34 dòng; 2.635 byte | 5 dòng; 398 byte |
| **Bộ hướng dẫn chính** | **5 file; 421 dòng; 40.472 byte** | **3 file; 190 dòng; 16.588 byte** |
| Redirect tương thích | Không tách riêng | 3 file; 9 dòng; 622 byte |

- Dung lượng bộ hướng dẫn chính giảm **59,0%**, tương đương 23.884 byte.
- Nếu tính cả ba redirect, dung lượng là **17.210 byte**, giảm **57,5%** so với năm nguồn ban đầu.
- Số nguồn chứa quy định/catalog đầy đủ giảm từ **4 xuống 2**; entry Copilot không duy trì bản luật riêng.
- Số file vật lý của riêng bộ chuyển đổi tăng từ 5 lên 6 do cần redirect. Không dùng con số “3 file hướng dẫn chính” để tuyên bố chỉ còn 3 file trên ổ đĩa.
- Catalog giữ **67 export UI** trong **64 file source** theo barrel hiện tại; helper/hằng số đi kèm tiếp tục tra source.
- Bốn file demo, tổng **23.641 byte**, đã được xóa để không giữ hai bộ hướng dẫn cạnh tranh.

README mới, `.rgignore` và báo cáo này có chi phí dung lượng riêng. Khi cộng cả ba phần đó với hướng dẫn và redirect, tổng trong phạm vi chỉnh sửa vẫn thấp hơn **40.504 byte** của năm nguồn chung và README ban đầu, ngay cả khi chưa tính lợi ích xóa demo. Báo cáo phục vụ review/bảo trì, được tách khỏi scan quy định mặc định.

Số byte/dòng chỉ đo kích thước văn bản. Không có benchmark tốc độ model, token hoặc thời gian tìm kiếm; không kết luận tốc độ tăng theo phần trăm dung lượng giảm.

## 6. Kiểm tra và bảo toàn

| Kiểm tra | Kết quả |
|---|---|
| Nội dung và đường dẫn của 8 Markdown mới/chỉnh sửa | Đạt: UTF-8 hợp lệ, không có khoảng trắng cuối dòng hoặc dòng trống dư ở cuối file; 102 link nội bộ và 3 anchor hợp lệ |
| Catalog so với barrel và source UI | Đạt: 67 export UI được dẫn tới 64 file source; không bỏ component khỏi catalog |
| Phạm vi tài liệu chính | Đạt: guide, UI Kit và Copilot không chứa bản demo hoặc context cá nhân/sprint |
| Bảo toàn file ngoài phạm vi | Đạt: SHA-256 của 403 file được bảo vệ không đổi, gồm source ứng dụng và tài liệu cá nhân/sprint |
| Scan mặc định bằng ripgrep | Đạt: guide/UI Kit/Copilot còn xuất hiện; ba redirect và report không nằm trong kết quả scan mặc định |
| Đọc lịch sử theo yêu cầu | Đạt: report vẫn tìm thấy bằng `rg --files --no-ignore docs/reports -g '*.md'` và mở được qua link README |
| Loại bản demo | Đạt: folder chứa 4 file demo đã được xóa |
| Kiểm tra diff | `git diff --check` đạt; Git có cảnh báo chuẩn hóa LF/CRLF ở README, không có lỗi whitespace |
| Nhánh, commit và staging | Vẫn ở `dev/sprint2/Tung/feat`, HEAD `6633c8b`; không có thay đổi staged, không commit/push/merge |

Các file đã bị xóa hoặc tạo mới trước đợt này vẫn giữ trạng thái ban đầu. Số file được bảo vệ chỉ tính các file đang tồn tại ở snapshot đầu; không lấy những file đã mất trước đó làm bằng chứng bảo toàn nội dung.

Giới hạn kiểm tra: tập trung vào những file được thay đổi, nguồn tra cứu của chúng, catalog và phạm vi tìm kiếm. Không tuyên bố đã sửa toàn bộ liên kết của mọi tài liệu trong repo. Không chạy build/test ứng dụng vì không thay đổi source/config runtime; việc kiểm tra nội dung và đường dẫn phù hợp với đợt tài liệu này.

## 7. Cách đọc và bảo trì sau đợt này

1. Bắt đầu từ README → development guide; mở UI Kit khi task có UI.
2. Tra props/hàm/contract trong source được liên kết, thay vì sao chép chữ ký sang nhiều tài liệu.
3. Khi thêm component hoặc thay đổi export, cập nhật barrel và hàng catalog tương ứng.
4. Chỉnh quy tắc chung tại guide; Copilot/README/redirect chỉ giữ tham chiếu.
5. Báo cáo bảo trì không phải nguồn quy định; mở trực tiếp khi cần, hoặc dùng `rg --no-ignore` để tìm phần đã loại khỏi scan mặc định.
6. Chỉ bỏ redirect sau khi kiểm tra và cập nhật mọi consumer trong phạm vi được giao.

`.rgignore` chỉ điều khiển các công cụ có hỗ trợ ignore này. Phép kiểm tra scan mặc định dùng `rg --files --hidden docs .github`; `--no-ignore` hoặc glob chọn file bằng `-g` có thể ghi đè quy tắc ignore. Nó không ngăn đọc trực tiếp, không đổi Git tracking và không bảo đảm mọi công cụ/model sẽ tự loại các file phụ.

## 8. Kết luận

Nguồn gây nhiễu chính là cùng một quy tắc được duy trì ở nhiều nơi, kết hợp ví dụ lỗi thời và nội dung chỉ đạo công cụ AI lẫn với chuẩn kỹ thuật. Hợp nhất nguồn và liên kết tới implementation giải quyết vấn đề này tốt hơn chỉ rút câu chữ từng file.

Bản trên nhánh hiện tại có hai nguồn nội dung rõ vai trò, một entry Copilot ngắn và đường đọc từ README. Những tên cũ không còn luật riêng; bộ demo đã được bỏ. Redirect giúp giữ tương thích mà không sửa tài liệu ngoài phạm vi.

Tài liệu cần được bảo trì cùng source, nhất là naming theo loại file, callback form, alias, enum/map hiển thị và export UI. Giảm kích thước không thay thế việc kiểm tra đúng nguồn. Báo cáo này ghi nhận thay đổi trong working tree, không xác nhận đã merge hay được áp dụng trên nhánh chung của nhóm.
