import { useCallback, useEffect, useState } from 'react';
import { AdminLayout, Button, ConfirmDialog, EmptyState, Notice, PageHeader, Panel, Spinner } from '../components';
import useAuth from '../hooks/useAuth';
import { decideIngredientProposal, getPendingIngredientProposals } from '../services/ingredientProposal.service';

const itemKey = (item) => `${item.sourceType}:${item.name}`;

export default function AdminIngredientVerifyPage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(null);
  const [classification, setClassification] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setItems(await getPendingIngredientProposals()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (note) => {
    if (!decision) return;
    const key = itemKey(decision.item);
    const classificationForItem = classification[key] || {};
    if (decision.action === 'approve'
      && (typeof classificationForItem.isAnimalDerived !== 'boolean' || typeof classificationForItem.isNguViTan !== 'boolean')) {
      setError('Hãy xác nhận nguyên liệu có nguồn gốc động vật hay không và có thuộc ngũ vị tân hay không.');
      setDecision(null);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await decideIngredientProposal(decision.item.name, decision.item.sourceType, decision.action, {
        note,
        ...classificationForItem,
      });
      await load();
      setDecision(null);
    } catch (e) { setError(e.message); setDecision(null); }
    finally { setSaving(false); }
  };

  const setFlag = (item, key, value) => setClassification((current) => ({
    ...current,
    [itemKey(item)]: { ...current[itemKey(item)], [key]: value },
  }));

  const renderClassification = (item) => {
    const flags = classification[itemKey(item)] || {};
    return <div className="d-flex flex-column gap-2 mt-3">
      <fieldset className="border-0 p-0 m-0">
        <legend className="small fw-semibold mb-1">Phân loại đồ chay</legend>
        <div className="d-flex flex-wrap gap-3">
          {[[false, 'Đồ chay'], [true, 'Có nguồn gốc động vật / không phải đồ chay']].map(([value, label]) => (
            <label key={String(value)} className="form-check d-flex align-items-center gap-2 mb-0">
              <input className="form-check-input m-0" type="radio" name={`animal-${itemKey(item)}`}
                checked={flags.isAnimalDerived === value} onChange={() => setFlag(item, 'isAnimalDerived', value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="border-0 p-0 m-0">
        <legend className="small fw-semibold mb-1">Ngũ vị tân</legend>
        <div className="d-flex flex-wrap gap-3">
          {[[false, 'Không'], [true, 'Có']].map(([value, label]) => (
            <label key={String(value)} className="form-check d-flex align-items-center gap-2 mb-0">
              <input className="form-check-input m-0" type="radio" name={`ngu-vi-tan-${itemKey(item)}`}
                checked={flags.isNguViTan === value} onChange={() => setFlag(item, 'isNguViTan', value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="form-check d-flex align-items-center gap-2 mb-0">
        <input className="form-check-input m-0" type="checkbox" checked={Boolean(flags.isCommonAllergen)}
          onChange={(event) => setFlag(item, 'isCommonAllergen', event.target.checked)} />
        <span>Dị ứng phổ biến</span>
      </label>
    </div>;
  };

  const healthItems = items.filter((item) => item.sourceType === 'health_profile');
  const otherItems = items.filter((item) => item.sourceType !== 'health_profile');
  const renderItem = (item, mandatory) => (
    <Panel key={itemKey(item)} className="p-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div className="flex-grow-1">
          <h3 className="h5 mb-1">{item.name}</h3>
          <p className="text-body-secondary mb-0">
            {mandatory
              ? `Được khai báo trong hồ sơ dị ứng của ${item.memberNames || 'thành viên'}. Cần chuẩn hóa vào danh mục để dữ liệu sức khỏe được phân loại chính xác.`
              : (item.sources || []).map((source) => `Công thức “${source.recipeTitle || 'không còn tồn tại'}” (#${source.recipeId || '?'})`).filter((label, index, all) => all.indexOf(label) === index).join(' · ')}
          </p>
          {renderClassification(item)}
        </div>
        <div className="d-flex flex-wrap gap-2">
          {mandatory ? <>
            <Button variant="subtle" icon="trash" onClick={() => setDecision({ item, action: 'delete' })}>Xóa khỏi hàng đợi</Button>
            <Button icon="check-circle" onClick={() => setDecision({ item, action: 'approve' })}>Xác nhận thêm</Button>
          </> : <>
            <Button variant="alert" icon="x-circle" onClick={() => setDecision({ item, action: 'reject' })}>Từ chối</Button>
            <Button icon="check-circle" onClick={() => setDecision({ item, action: 'approve' })}>Thêm vào kho</Button>
          </>}
        </div>
      </div>
    </Panel>
  );

  return (
    <AdminLayout activeKey="ingredient-verify" title="Duyệt nguyên liệu" user={user} onLogout={() => { logout(); window.location.assign('/'); }}>
      <PageHeader
        title="Duyệt nguyên liệu"
        description="Dị ứng trong hồ sơ sức khỏe cần được phân loại đầy đủ; đề xuất từ công thức được xử lý riêng theo mức độ phù hợp."
        actions={<Button variant="outline" icon="arrow-clockwise" onClick={load} disabled={loading}>Tải lại</Button>}
      />
      {error && <Notice tone="alert" title="Không thể tải hoặc xử lý đề xuất" className="mt-3">{error}</Notice>}
      {loading ? <div className="py-5 text-center"><Spinner label="Đang tải nguyên liệu chờ duyệt…" showLabel /></div>
        : <div className="d-grid gap-4 mt-3">
          <section aria-labelledby="mandatory-ingredients-title">
            <h2 id="mandatory-ingredients-title" className="h4">Bắt buộc xử lý · Dị ứng hồ sơ sức khỏe</h2>
            <p className="text-body-secondary">Xác nhận phân loại để thêm vào danh mục. “Xóa khỏi hàng đợi” chỉ ẩn yêu cầu duyệt, không xóa thông tin dị ứng của thành viên.</p>
            <div className="d-grid gap-3">
              {healthItems.length ? healthItems.map((item) => renderItem(item, true))
                : <EmptyState icon="heart-pulse" title="Không có dị ứng chờ phân loại" description="Các dị ứng chưa có trong danh mục sẽ xuất hiện tại đây." />}
            </div>
          </section>
          <section aria-labelledby="optional-ingredients-title">
            <h2 id="optional-ingredients-title" className="h4">Có thể xem xét · Nguồn khác</h2>
            <p className="text-body-secondary">Đề xuất từ nguyên liệu mới trong công thức; quản trị viên có thể thêm vào kho hoặc từ chối.</p>
            <div className="d-grid gap-3">
              {otherItems.length ? otherItems.map((item) => renderItem(item, false))
                : <EmptyState icon="basket" title="Không có đề xuất khác" description="Đề xuất từ công thức sẽ xuất hiện tại đây." />}
            </div>
          </section>
        </div>}
      <ConfirmDialog
        open={!!decision}
        title={decision?.action === 'reject' ? 'Từ chối đề xuất?' : decision?.action === 'delete' ? 'Xóa khỏi hàng đợi?' : 'Xác nhận thêm nguyên liệu?'}
        message={decision?.action === 'delete'
          ? `“${decision?.item?.name || ''}” sẽ được gỡ khỏi hàng đợi duyệt. Dị ứng vẫn được giữ trong hồ sơ sức khỏe thành viên.`
          : decision?.action === 'reject'
            ? `“${decision?.item?.name || ''}” sẽ bị từ chối khỏi luồng đề xuất công thức.`
            : `“${decision?.item?.name || ''}” sẽ được thêm vào danh mục cùng phân loại đồ chay và ngũ vị tân đã chọn.`}
        confirmLabel={decision?.action === 'reject' ? 'Từ chối' : decision?.action === 'delete' ? 'Xóa khỏi hàng đợi' : 'Xác nhận thêm'}
        tone={decision?.action === 'reject' || decision?.action === 'delete' ? 'alert' : 'primary'}
        reason={decision?.action === 'reject' ? { label: 'Lý do từ chối', required: true } : undefined}
        loading={saving}
        onConfirm={decide}
        onCancel={() => setDecision(null)}
      />
    </AdminLayout>
  );
}
