// Gốc app: chọn màn hình theo trạng thái đăng nhập + vai trò (account.role).
// Chưa có react-router nên điều hướng bằng render theo điều kiện;
// khi nhóm thêm react-router thì thay đúng chỗ này bằng <Routes>.
import { Spinner } from './components';
import useAuth from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminMemberManagementPage from './pages/AdminMemberManagementPage';
import AdminDishCreatePage from './pages/AdminDishCreatePage';
import AdminDishManagementPage from './pages/AdminDishManagementPage';
import AdminRecipeVerifyPage from './pages/AdminRecipeVerifyPage';
// Duy's Code : Đăng ký màn hình Admin duyệt nguyên liệu được đề cử từ hồ sơ dị ứng.
import AdminIngredientVerifyPage from './pages/AdminIngredientVerifyPage';
import UserProfilePage from './pages/UserProfilePage'; /* Duy's code: Import trang hồ sơ cá nhân của thành viên. */
import ShopExplorePage from './pages/ShopExplorePage'; /* Lam's code: Trang Khám phá quán chay (M-08). */
import ShopDetailPage from './pages/ShopDetailPage'; /* Lam's code: Trang chi tiết quán chay (M-09). */

// Tùng — Sprint 2: BRIDGE-01 import ba trang Shop, dùng phiên đăng nhập hiện có.
import ShopRegisterPage from './pages/ShopRegisterPage';
import ShopManagementPage from './pages/ShopManagementPage';
import ShopVerifyPage from './pages/ShopVerifyPage';
// Tùng — Sprint 2: BRIDGE-02A navbar Member dùng chung Shop state và khung navigation.
import { ShopNavigationProvider, useShopNavigation } from './context/ShopNavigationContext';
import MemberNavigationLayout from './components/MemberNavigationLayout';

// Tung's code: Trang duyệt bài viết và xử lý báo cáo, dùng chung phiên đăng nhập Admin.
import AdminModerationPage from './pages/AdminModerationPage';

// Khoi's code: Trang Bảng tin (ID01) — trang chủ của khách và thành viên.
import PostFeedPage from './pages/PostFeedPage';
// Khoi's code: Trang Tạo công thức (Sprint 2, dữ liệu giả tới khi nhóm sửa DB).
import RecipeCreatePage from './pages/RecipeCreatePage';
import RecipeDetailPage from './pages/RecipeDetailPage'; // Khoi's code: xem công thức đã duyệt


// Tùng — Sprint 2: provider nằm ngoài mọi nhánh page để trạng thái Shop không tách theo navbar.
export default function App() {
  return <ShopNavigationProvider><AppContent /></ShopNavigationProvider>;
}

// Tùng — Sprint 2: giữ điều hướng/session hiện có bên trong provider navigation.
function AppContent() {
  const { user, isAuthenticated, isCheckingSession } = useAuth();
  const { shopAction, accountMenu } = useShopNavigation();

  // 'admin' là key trong ROLE (constants/domain.js) — DB: role 2 = admin
  const isAdmin = user?.role === 'admin';

  // Đang gọi /auth/me để khôi phục phiên từ token trong localStorage
  if (isCheckingSession) {
    return (
      <main className="d-flex justify-content-center align-items-center min-vh-100">
        <Spinner label="Đang kiểm tra phiên đăng nhập..." showLabel />
      </main>
    );
  }

  // Khoi's code: điều hướng tạm bằng URL (chưa có react-router)
  //   /  hoặc /feed          → Bảng tin (khách: 3 bài cố định · thành viên: lướt vô hạn)
  //   /login · /register     → trang Đăng nhập / Đăng ký
  //   URL khác khi chưa đăng nhập (vd /admin/...) → trang Đăng nhập như cũ
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const isFeedPath = path === '/' || path === '/feed';
  const goTo = (url) => window.location.assign(url);
  // Khoi's code: /recipes/123 → xem công thức đã duyệt (khách cũng xem được). /recipes/new KHÔNG khớp vì chỉ nhận số.
  const recipeViewId = /^\/recipes\/(\d+)$/.exec(path)?.[1];

  if (!isAuthenticated) {
    if (isFeedPath) return <PostFeedPage user={null} onLogin={() => goTo('/login')} onRegister={() => goTo('/register')} />;
    if (recipeViewId) return <RecipeDetailPage recipeId={recipeViewId} user={null} onLogin={() => goTo('/login')} onRegister={() => goTo('/register')} />;
    const isAuthPath = path === '/login' || path === '/register';
    return (
      <AuthPage
        initialMode={path === '/register' ? 'register' : 'login'}
        // Đăng nhập xong ở /login → đổi URL về trang chủ (không tải lại trang)
        onAuthenticated={() => { if (isAuthPath) window.history.replaceState(null, '', '/'); }}
      />
    );
  }

  // Tùng — Sprint 2: chỉ mở trang Shop đúng role sau khi khôi phục phiên/đăng nhập.
  if (user?.role === 'member' && path === '/shops/register') return <ShopRegisterPage />;
  if (user?.role === 'member' && path === '/shops/manage') return <ShopManagementPage />;
  if (isAdmin && path === '/admin/shops/verify') return <ShopVerifyPage />;
  // Tùng — Sprint 2: kết thúc nhánh Shop; các URL khác giữ luồng hiện có.

  const feed = (
    <PostFeedPage
      user={user}
      // Tùng — BRIDGE-16: Shop/profile/logout nằm trong cùng menu tài khoản dùng chung.
      accountMenu={accountMenu}
      shopAction={shopAction}
    />
  );
  // Tùng — Sprint 2: đồng bộ sidebar cho Profile, không sửa form hoặc API hồ sơ của Duy.
  if (!isAdmin && path === '/profile') return <MemberNavigationLayout activeKey="profile"><UserProfilePage /></MemberNavigationLayout>; /* Duy's code: Chỉ User thường được mở trang hồ sơ tại /profile. */
  // Khoi's code: Tạo công thức + Công thức đã gửi — chỉ thành viên (Admin vào sẽ về dashboard như cũ)
  if (!isAdmin && path === '/recipes/new') return <RecipeCreatePage user={user} accountMenu={accountMenu} />;
  // Khoi's code: xem công thức đã duyệt — thành viên và Admin
  if (recipeViewId) return <RecipeDetailPage recipeId={recipeViewId} user={user} accountMenu={accountMenu} />;
  /* Lam's code: Trang Khám phá quán chay (M-08) — thành viên đã đăng nhập. */
  if (!isAdmin && path === '/shops') return (
    <ShopExplorePage
      user={user}
      accountMenu={accountMenu}
    />
  );
  /* Lam's code: Trang Chi tiết quán (M-09) — thành viên đã đăng nhập. */
  if (!isAdmin && path.startsWith('/shops/')) {
    const shopId = path.split('/')[2];
    return <ShopDetailPage shopId={shopId} user={user} accountMenu={accountMenu} />;
  }
  // Khoi's code: Admin vẫn vào dashboard như cũ; muốn xem Bảng tin thì mở /feed
  if (isAdmin && path === '/feed') return feed;
  // Khoi's code: Kết thúc điểm nối điều hướng.

  // Tung's code: Sau khi khôi phục phiên và kiểm tra đăng nhập, chỉ Admin được mở
  // trang kiểm duyệt tại /admin/moderation (chấp nhận cả dấu / ở cuối URL).
  // Trang mới tự đọc query type=post/report và stale=1 từ các link trên dashboard.
  // Các URL Admin khác tiếp tục đi vào nhánh dashboard hiện có bên dưới.
  if (isAdmin && window.location.pathname.replace(/\/$/, '') === '/admin/moderation') {
    return <AdminModerationPage />;
  }
  // Duy's code: Nối hai trang quản lý Dish tới các URL Admin tương ứng.
  if (isAdmin && path === '/admin/dishes/create') return <AdminDishCreatePage />;
  if (isAdmin && path === '/admin/dishes') return <AdminDishManagementPage />;
  if (isAdmin && path === '/admin/recipes/verify') return <AdminRecipeVerifyPage />;
  // Duy's Code : Giới hạn route duyệt nguyên liệu cho tài khoản Admin.
  if (isAdmin && path === '/admin/ingredients/verify') return <AdminIngredientVerifyPage />;
  if (isAdmin && path === '/admin/accounts') return <AdminMemberManagementPage />;
  // Tung's code: Kết thúc điểm nối trang kiểm duyệt.

  // Quản trị viên → khu quản trị
  if (isAdmin) return <AdminDashboardPage />;

  // Khoi's code: Thành viên → Bảng tin (thay cho "Khu thành viên chưa làm")
  return feed;
}
