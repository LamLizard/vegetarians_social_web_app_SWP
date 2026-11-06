// Tùng: chỉ mô tả route và màn hình đã đối chiếu source, tránh chatbot bịa hướng dẫn.
// Khoi's code (05/11/2026): bổ sung trang còn thiếu và đổi Bảng tin về '/' (App.jsx coi '/' và '/feed' là feed).
module.exports = [
  { path: '/', role: 'guest/member', description: 'Bảng tin bài viết: tìm bài, lọc theo chủ đề, sắp xếp Mới nhất hoặc Nhiều tim. Thành viên đăng bài bằng nút “+ Đăng bài” ở thanh bên.', source: 'client/src/App.jsx; client/src/pages/PostFeedPage.jsx; client/src/components/FeedFilter/FeedFilter.jsx' },
  { path: '/chatbot', role: 'guest/member', description: 'Trò chuyện với trợ lý ăn chay.', source: 'client/src/App.jsx; client/src/pages/ChatbotPage.jsx' },
  { path: '/recipes', role: 'guest/member', description: 'Xem danh sách công thức.', source: 'client/src/App.jsx; client/src/pages/RecipeListPage.jsx' },
  { path: '/recipes/new', role: 'member', description: 'Tạo công thức: nhập Calo, Đạm, Tinh bột, Chất béo và Chất xơ (bắt buộc) rồi gửi để Admin duyệt. Tab “Công thức đã gửi” hiện trạng thái Chờ duyệt/Đã duyệt/Bị từ chối và cho sửa để gửi lại.', source: 'client/src/App.jsx; client/src/pages/RecipeCreatePage.jsx' },
  { path: '/recipes?liked=1', role: 'member', description: 'Công thức đã thích: mở trang Công thức rồi bật nút “Đã thích” để chỉ xem công thức mình đã thả tim; vẫn kết hợp được với tìm kiếm và danh mục.', source: 'client/src/App.jsx; client/src/pages/RecipeListPage.jsx' },
  { path: '/profile', role: 'member', description: 'Mở trang hồ sơ cá nhân.', source: 'client/src/App.jsx; client/src/pages/UserProfilePage.jsx' },
  { path: '/meal-plan', role: 'member', description: 'Mở trang thực đơn của thành viên.', source: 'client/src/App.jsx; client/src/pages/MealPlanPage.jsx' },
  { path: '/shops', role: 'member', description: 'Khám phá quán chay.', source: 'client/src/App.jsx; client/src/pages/ShopExplorePage.jsx' },
  { path: '/shops/register', role: 'member', description: 'Đăng ký quán chay: gửi thông tin quán để quản trị viên xác minh.', source: 'client/src/App.jsx; client/src/pages/ShopRegisterPage.jsx' },
  { path: '/me/posts', role: 'member', description: 'Quản lý bài viết của chính mình.', source: 'client/src/App.jsx; client/src/pages/UserPostManagementPage.jsx' },
];
