import { useCallback, useEffect, useState } from 'react';
import { AdminLayout, Button, ConfirmDialog, EmptyState, Notice, PageHeader, Panel, Spinner } from '../components';
import useAuth from '../hooks/useAuth';
import { decideIngredientProposal, getPendingIngredientProposals } from '../services/ingredientProposal.service';

// Duy's Code : Duyệt các tên dị ứng được đề cử vào ingredient, không cần cột trạng thái mới.
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
    setSaving(true);
    setError('');
    try {
      await decideIngredientProposal(decision.name, decision.action, {
        note,
        ...(classification[decision.name] || {}),
      });
      setItems((current) => current.filter((item) => item.name !== decision.name));
      setDecision(null);
    } catch (e) { setError(e.message); setDecision(null); }
    finally { setSaving(false); }
  };

  const toggleFlag = (name, key) => (event) => {
    setClassification((current) => ({
      ...current,
      [name]: { ...current[name], [key]: event.target.checked },
    }));
  };

  return (
    <AdminLayout activeKey="ingredient-verify" title="Duyệt nguyên liệu" user={user} onLogout={() => { logout(); window.location.assign('/'); }}>
      <PageHeader
        title="Duyệt nguyên liệu"
        description="Tên nguyên liệu do thành viên đề cử sẽ được thêm vào kho ingredient sau khi Admin duyệt."
        actions={<Button variant="outline" icon="arrow-clockwise" onClick={load} disabled={loading}>Tải lại</Button>}
      />
      {error && <Notice tone="alert" title="Không thể tải hoặc xử lý đề xuất" className="mt-3">{error}</Notice>}
      <div className="d-grid gap-3 mt-3">
        {loading ? <div className="py-5 text-center"><Spinner label="Đang tải nguyên liệu chờ duyệt…" showLabel /></div>
          : items.length === 0 ? <EmptyState icon="basket" title="Không có nguyên liệu chờ duyệt" description="Đề xuất mới từ hồ sơ sức khỏe sẽ xuất hiện tại đây." />
            : items.map((item) => (
              <Panel key={item.name} className="p-4">
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
                  <div>
                    <h2 className="h5 mb-1">{item.name}</h2>
                    <p className="text-body-secondary mb-2">Được đề cử bởi {item.memberNames || `${item.memberCount} thành viên`}</p>
                    <div className="d-flex flex-wrap gap-3">
                      {[
                        ['isAnimalDerived', 'Có nguồn gốc động vật'],
                        ['isNguViTan', 'Thuộc ngũ vị tân'],
                        ['isCommonAllergen', 'Dị ứng phổ biến'],
                      ].map(([key, label]) => (
                        <label key={key} className="form-check d-flex align-items-center gap-2 mb-0">
                          <input className="form-check-input m-0" type="checkbox" checked={Boolean(classification[item.name]?.[key])} onChange={toggleFlag(item.name, key)} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Button variant="alert" icon="x-circle" onClick={() => setDecision({ name: item.name, action: 'reject' })}>Từ chối</Button>
                    <Button icon="check-circle" onClick={() => setDecision({ name: item.name, action: 'approve' })}>Duyệt nguyên liệu</Button>
                  </div>
                </div>
              </Panel>
            ))}
      </div>
      <ConfirmDialog
        open={!!decision}
        title={decision?.action === 'reject' ? 'Từ chối đề xuất?' : 'Duyệt nguyên liệu?'}
        message={`“${decision?.name || ''}” sẽ ${decision?.action === 'reject' ? 'bị từ chối' : 'được thêm vào kho ingredient'}.`}
        confirmLabel={decision?.action === 'reject' ? 'Từ chối' : 'Duyệt nguyên liệu'}
        tone={decision?.action === 'reject' ? 'alert' : 'primary'}
        reason={decision?.action === 'reject' ? { label: 'Lý do từ chối', required: true } : undefined}
        loading={saving}
        onConfirm={decide}
        onCancel={() => setDecision(null)}
      />
    </AdminLayout>
  );
}
