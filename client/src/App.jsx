import AdminVerificationPage from './pages/AdminVerificationPage';
import ReviewKit from './kit/ReviewKit';

// Router chung chưa có. Chọn trang theo URL, không cần thêm dependency.
export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/kit') return <ReviewKit />;
  if (pathname === '/' || pathname === '/admin/verification') return <AdminVerificationPage />;
  return (
    <main className="container py-5">
      <h1>Không tìm thấy trang</h1>
      <a href="/admin/verification">Về trang xác minh quán</a>
    </main>
  );
}
