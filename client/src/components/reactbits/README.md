# React Bits (bản chép)

Chép nguyên bản (JS + CSS) từ https://github.com/DavidHDev/react-bits, theo prototype UI v2.1 của trang Bảng tin.
Giấy phép: `LICENSE-react-bits.md` (MIT + Commons Clause): được dùng trong app, **không** được bán lại chính các component.

| File | Dùng ở đâu | Thư viện cần |
|---|---|---|
| `FadeContent.jsx` | Thẻ bài hiện dần khi cuộn tới (PostFeedPage) | `gsap` |
| `GlareHover.jsx` + `.css` | Vệt loé nhẹ khi rê chuột qua ảnh bài (FeedPostCard) | — |
| `ClickSpark.jsx` | Bấm Thích → bắn tia lá (FeedPostCard) | — |

Không sửa file trong thư mục này; muốn đổi giao diện thì truyền props từ nơi dùng.
