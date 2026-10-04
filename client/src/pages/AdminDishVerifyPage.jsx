import { useEffect, useState } from 'react';
import {
  AdminLayout, Button, ConfirmDialog, DishCard, EmptyState, Notice, PageHeader, Spinner,
} from '../components';
import useAuth from '../hooks/useAuth';
import { decideDish, getPendingDishes } from '../services/dish.service';

// Duy's code: Màn hình Admin quản lý hàng chờ và gửi quyết định kiểm duyệt Dish.
export default function AdminDishVerifyPage() {
  const { user, logout } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);

  // Duy's code: Cho phép Admin tải lại danh sách pending sau lỗi hoặc thay đổi.
  const loadDishes = () => {
    setLoading(true);
    setError('');
    getPendingDishes()
      .then(setDishes)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  };

  // Duy's code: Tải hàng chờ khi mở trang và hủy cập nhật state khi unmount.
  useEffect(() => {
    let active = true;
    getPendingDishes()
      .then((items) => { if (active) setDishes(items); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Duy's code: Gửi duyệt/từ chối, cập nhật danh sách và hiện lỗi nếu thất bại.
  const confirmDecision = async (note) => {
    if (!decision) return;
    setSaving(true);
    setError('');
    try {
      await decideDish(decision.dish.id, decision.action, note);
      setDishes((current) => current.filter((dish) => dish.id !== decision.dish.id));
      setDecision(null);
    } catch (requestError) {
      setError(requestError.message);
      setDecision(null);
    } finally {
      setSaving(false);
    }
  };

  // Duy's code: Đăng xuất Admin và điều hướng về trang gốc.
  const handleLogout = () => { logout(); window.location.assign('/'); };
  const isRejecting = decision?.action === 'reject';

  return (
    <AdminLayout activeKey="dish-verify" title="Duyệt món ăn" user={user} onLogout={handleLogout}>
      {/* Duy's code: Giải thích quyết định duyệt và nút tải lại hàng chờ. */}
      <PageHeader
        title="Duyệt món ăn"
        description="Duyệt hoặc từ chối đề xuất món ăn đang chờ. Quyết định sẽ được ghi AdminLog và gửi thông báo cho người đề xuất."
        actions={<Button variant="outline" icon="arrow-clockwise" onClick={loadDishes} disabled={loading}>Tải lại</Button>}
      />
      {error && <Notice tone="alert" title="Không thể tải hoặc xử lý hàng chờ" className="mt-3">{error}</Notice>}
      {/* Duy's code: Hiển thị trạng thái tải, rỗng hoặc từng Dish chờ duyệt. */}
      <div className="d-grid gap-3 mt-3">
        {loading ? (
          <div className="py-5 text-center"><Spinner label="Đang tải đề xuất..." showLabel /></div>
        ) : dishes.length === 0 ? (
          <EmptyState title="Không có món đang chờ duyệt" description="Các đề xuất mới sẽ xuất hiện tại đây." />
        ) : dishes.map((dish) => (
          <DishCard
            key={dish.id}
            layout="row"
            name={dish.name}
            description={dish.description}
            imageUrl={dish.thumbnailUrl}
            categories={dish.categories}
            status={dish.status}
            showStatus
            moderationNote={dish.moderationNote}
            action={(
              <div className="d-flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setDecision({ dish, action: 'approve' })}>Duyệt</Button>
                <Button size="sm" variant="alert" onClick={() => setDecision({ dish, action: 'reject' })}>Từ chối</Button>
              </div>
            )}
          />
        ))}
      </div>
      {/* Duy's code: Yêu cầu xác nhận trước khi duyệt hoặc từ chối; bắt buộc lý do khi từ chối. */}
      <ConfirmDialog
        open={!!decision}
        title={isRejecting ? 'Từ chối đề xuất món ăn?' : 'Duyệt món ăn?'}
        message={isRejecting
          ? `Món “${decision?.dish.name}” sẽ chuyển sang Bị từ chối; người đề xuất sẽ nhận lý do.`
          : `Món “${decision?.dish.name}” sẽ chuyển sang Đã duyệt và có thể được dùng trong các luồng món ăn.`}
        confirmLabel={isRejecting ? 'Từ chối đề xuất' : 'Duyệt món ăn'}
        tone={isRejecting ? 'alert' : 'primary'}
        reason={isRejecting ? { label: 'Lý do từ chối', required: true } : undefined}
        loading={saving}
        onConfirm={confirmDecision}
        onCancel={() => setDecision(null)}
      />
    </AdminLayout>
  );
}
