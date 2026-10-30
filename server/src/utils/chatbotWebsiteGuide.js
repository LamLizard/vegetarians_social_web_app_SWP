// Tùng: chỉ mô tả route và màn hình đã đối chiếu source, tránh chatbot bịa hướng dẫn.
module.exports = [
  { path: '/feed', role: 'guest/member', description: 'Bảng tin bài viết.', source: 'client/src/App.jsx; client/src/pages/PostFeedPage.jsx' },
  { path: '/chatbot', role: 'guest/member', description: 'Trò chuyện với trợ lý ăn chay.', source: 'client/src/App.jsx; client/src/pages/ChatbotPage.jsx' },
  { path: '/recipes', role: 'guest/member', description: 'Xem danh sách công thức.', source: 'client/src/App.jsx; client/src/pages/RecipeListPage.jsx' },
  { path: '/profile', role: 'member', description: 'Mở trang hồ sơ cá nhân.', source: 'client/src/App.jsx; client/src/pages/UserProfilePage.jsx' },
  { path: '/meal-plan', role: 'member', description: 'Mở trang thực đơn của thành viên.', source: 'client/src/App.jsx; client/src/pages/MealPlanPage.jsx' },
  { path: '/shops', role: 'member', description: 'Khám phá quán chay.', source: 'client/src/App.jsx; client/src/pages/ShopExplorePage.jsx' },
  { path: '/me/posts', role: 'member', description: 'Quản lý bài viết của chính mình.', source: 'client/src/App.jsx; client/src/pages/UserPostManagementPage.jsx' },
];
