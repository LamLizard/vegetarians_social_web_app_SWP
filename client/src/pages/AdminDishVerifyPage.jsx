import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdminLayout, Button, ConfirmDialog, DishCard, EmptyState, Modal, Notice, PageHeader, Photo, Spinner, StatusBadge, Tabs,
} from '../components';
import useAuth from '../hooks/useAuth';
import { decideDish, getAdminDishes, getPendingDishes } from '../services/dish.service';
import styles from './AdminDishVerifyPage.module.css';

// Duy's code: Màn hình Admin quản lý hàng chờ và gửi quyết định kiểm duyệt Dish.
// Duy's Code: Hiển thị thời gian gửi theo locale Việt Nam trong hàng chờ kiểm duyệt.
const formatSubmittedAt = (value) => {
  if (!value) return 'Thời gian không rõ';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Thời gian không rõ' : new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export default function AdminDishVerifyPage() {
  const { user, logout } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(null);
  const [detailDish, setDetailDish] = useState(null); // Duy's Code: Lưu đề xuất đang mở trong popup chi tiết.
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const isMounted = useRef(false);
  const requestSequence = useRef(0);

  // Duy's Code: Nạp dữ liệu theo tab đang chọn để giữ hàng chờ và lịch sử trên cùng trang.
  const loadDishes = useCallback(async () => {
    const currentRequest = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const items = activeTab === 'pending' ? await getPendingDishes() : await getAdminDishes();
      if (isMounted.current && requestSequence.current === currentRequest) setDishes(items);
    } catch (requestError) {
      if (isMounted.current && requestSequence.current === currentRequest) setError(requestError.message);
    } finally {
      if (isMounted.current && requestSequence.current === currentRequest) setLoading(false);
    }
  }, [activeTab]);

  // Duy's Code: Tải lại danh sách khi Admin chuyển tab và chặn cập nhật sau unmount.
  useEffect(() => {
    isMounted.current = true;
    loadDishes();
    return () => { isMounted.current = false; };
  }, [loadDishes]);

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
  const isHistoryTab = activeTab === 'all';

  // Duy's Code: Đóng popup chi tiết trước khi mở hộp xác nhận quyết định.
  const requestDecision = (dish, action) => {
    setDetailDish(null);
    setDecision({ dish, action });
  };

  return (
    <AdminLayout activeKey="dish-verify" title="Duyệt món ăn" user={user} onLogout={handleLogout}>
      {/* Duy's code: Giải thích quyết định duyệt và nút tải lại hàng chờ. */}
      <PageHeader
        title="Duyệt món ăn"
        description="Duyệt đề xuất đang chờ hoặc xem lại các món đã được duyệt và bị từ chối. Quyết định được ghi AdminLog và gửi thông báo cho người đề xuất."
        actions={<Button variant="outline" icon="arrow-clockwise" onClick={loadDishes} disabled={loading}>Tải lại</Button>}
      />
      {/* Duy's Code: Hai tab chuyển giữa hàng chờ duyệt và danh sách món đã có kết quả. */}
      <Tabs
        className="mt-3"
        label="Danh sách món ăn quản trị"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'pending', label: 'Chờ duyệt', icon: 'hourglass-split', id: 'dish-pending-tab', controls: 'dish-list-panel' },
          { key: 'all', label: 'Tất cả món ăn', icon: 'egg-fried', id: 'dish-all-tab', controls: 'dish-list-panel' },
        ]}
      />
      {error && <Notice tone="alert" title={isHistoryTab ? 'Không thể tải danh sách món ăn' : 'Không thể tải hoặc xử lý hàng chờ'} className="mt-3">{error}</Notice>}
      {/* Duy's code: Hiển thị trạng thái tải, rỗng hoặc từng Dish chờ duyệt. */}
      <div id="dish-list-panel" role="tabpanel" aria-labelledby={isHistoryTab ? 'dish-all-tab' : 'dish-pending-tab'} className="d-grid gap-3 mt-3">
        {loading ? (
          <div className="py-5 text-center"><Spinner label={isHistoryTab ? 'Đang tải món ăn...' : 'Đang tải đề xuất...'} showLabel /></div>
        ) : dishes.length === 0 ? (
          <EmptyState
            title={isHistoryTab ? 'Chưa có món ăn nào đã được xử lý' : 'Không có món đang chờ duyệt'}
            description={isHistoryTab ? 'Món ăn đã được duyệt hoặc từ chối sẽ xuất hiện tại đây.' : 'Các đề xuất mới sẽ xuất hiện tại đây.'}
          />
        ) : dishes.map((dish) => (
          <div key={dish.id} className="d-grid gap-2">
            {/* Duy's Code: Hiển thị người gửi và thời điểm để Admin có ngữ cảnh khi duyệt. */}
            <div className="d-flex flex-wrap align-items-center gap-2 small text-body-secondary">
              <span><i className="bi bi-person-circle me-1" aria-hidden="true" />{dish.authorName || 'Thành viên'}</span>
              {dish.authorEmail && <span>{dish.authorEmail}</span>}
              <span>· {isHistoryTab ? 'Xử lý lúc' : 'Gửi lúc'} <time dateTime={isHistoryTab ? (dish.moderatedAt || dish.createdAt) : dish.createdAt}>{formatSubmittedAt(isHistoryTab ? (dish.moderatedAt || dish.createdAt) : dish.createdAt)}</time></span>
            </div>
            <DishCard
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
                  <Button size="sm" variant="outline" icon="eye" onClick={() => setDetailDish(dish)}>Xem chi tiết</Button>
                </div>
              )}
            />
          </div>
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
      {/* Duy's Code: Mở popup lớn để Admin xem ảnh và toàn bộ dữ liệu đề xuất trước khi quyết định. */}
      <Modal
        open={!!detailDish}
        onClose={() => setDetailDish(null)}
        title={detailDish?.name || 'Chi tiết đề xuất món ăn'}
        description={isHistoryTab ? 'Thông tin món ăn và kết quả kiểm duyệt.' : 'Kiểm tra thông tin và ảnh do thành viên gửi trước khi duyệt.'}
        size="lg"
        footer={detailDish && (
          <>
            <Button variant="subtle" onClick={() => setDetailDish(null)}>Đóng</Button>
            {!isHistoryTab && <Button variant="alert" icon="x-circle" onClick={() => requestDecision(detailDish, 'reject')}>Từ chối</Button>}
            {!isHistoryTab && <Button icon="check-circle" onClick={() => requestDecision(detailDish, 'approve')}>Duyệt món</Button>}
          </>
        )}
      >
        {detailDish && (
          <div className={styles.detailLayout}>
            <Photo
              src={detailDish.thumbnailUrl}
              alt={`Ảnh món ${detailDish.name}`}
              ratio="16/9"
              className={styles.detailPhoto}
            />
            <div className={styles.detailMeta}>
              {isHistoryTab && <StatusBadge entity="dish" status={detailDish.status} size="sm" />}
              <span><i className="bi bi-person-circle me-1" aria-hidden="true" />{detailDish.authorName || 'Thành viên'}</span>
              {detailDish.authorEmail && <span>{detailDish.authorEmail}</span>}
              <span>Gửi lúc <time dateTime={detailDish.createdAt}>{formatSubmittedAt(detailDish.createdAt)}</time></span>
              {isHistoryTab && detailDish.moderatedAt && <span>Xử lý lúc {formatSubmittedAt(detailDish.moderatedAt)}</span>}
            </div>
            <section aria-labelledby="dish-suggestion-description">
              <h3 id="dish-suggestion-description" className="h6">Mô tả</h3>
              <p className="mb-0 text-body-secondary" style={{ whiteSpace: 'pre-wrap' }}>
                {detailDish.description || 'Người đề xuất chưa thêm mô tả.'}
              </p>
            </section>
            <section aria-labelledby="dish-suggestion-categories">
              <h3 id="dish-suggestion-categories" className="h6">Danh mục</h3>
              {detailDish.categories?.length ? (
                <div className="d-flex flex-wrap gap-2">
                  {detailDish.categories.map((category) => (
                    <span key={category.id} className="badge rounded-pill text-bg-light border">{category.name}</span>
                  ))}
                </div>
              ) : <p className="mb-0 text-body-secondary">Chưa gắn danh mục.</p>}
            </section>
            {isHistoryTab && detailDish.moderationNote && (
              <section aria-labelledby="dish-moderation-note">
                <h3 id="dish-moderation-note" className="h6">Lý do từ chối</h3>
                <p className="mb-0 text-body-secondary" style={{ whiteSpace: 'pre-wrap' }}>{detailDish.moderationNote}</p>
              </section>
            )}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
