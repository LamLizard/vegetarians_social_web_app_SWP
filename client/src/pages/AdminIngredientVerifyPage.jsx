import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout, Button, ConfirmDialog, EmptyState, ErrorDialog, Notice, PageHeader, Pagination, Panel, Spinner } from '../components';
import useAuth from '../hooks/useAuth';
import {
  decideIngredientProposal,
  getBannedKeywords,
  getIngredientProposalHistory,
  getPendingIngredientProposals,
} from '../services/ingredientProposal.service';
import styles from './AdminIngredientVerifyPage.module.css';

// Duy's Code: Mỗi loại nghiệp vụ là một trang con có thể mở trực tiếp bằng query tab.
const INGREDIENT_PAGES = [
  { key: 'allergy', label: 'Dị ứng', icon: 'heart-pulse', description: 'Nguyên liệu được khai báo trong hồ sơ dị ứng, cần xem xét ưu tiên.' },
  { key: 'recipe', label: 'Nguyên liệu công thức', icon: 'basket', description: 'Nguyên liệu mới thành viên dùng trong công thức, cần phân loại trước khi duyệt Recipe.' },
  { key: 'keywords', label: 'Banned Keyword', icon: 'incognito', description: 'Tra cứu các từ khóa đang được hệ thống dùng để cảnh báo hoặc kiểm tra nội dung.' },
  { key: 'history', label: 'Lịch sử duyệt', icon: 'clock-history', description: 'Các quyết định duyệt nguyên liệu được ghi trong admin_log.' },
];

const PAGE_KEYS = new Set(INGREDIENT_PAGES.map((item) => item.key));
const itemKey = (item) => `${item.sourceType}:${item.name}`;
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

function getPageFromUrl() {
  const requested = new URLSearchParams(window.location.search).get('tab');
  return PAGE_KEYS.has(requested) ? requested : 'allergy';
}

// Duy's Code: Chia hàng đợi theo nguồn; lịch sử và từ khóa được tải riêng khi mở trang tương ứng.
export default function AdminIngredientVerifyPage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [activePage, setActivePage] = useState(getPageFromUrl);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(null);
  const [classification, setClassification] = useState({});
  // Duy's Code: Giữ đường dẫn Recipe nguồn để Admin tiếp tục xử lý sau khi từ chối nguyên liệu.
  const [resolvedRecipeLinks, setResolvedRecipeLinks] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [keywordsError, setKeywordsError] = useState('');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [history, setHistory] = useState({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // Duy's Code: Tải riêng hàng đợi đang chờ để mỗi trang chỉ hiển thị đúng một nguồn đề xuất.
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setItems(await getPendingIngredientProposals()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  // Duy's Code: Banned Keyword chỉ đọc bảng hiện có, không tạo hoặc sửa dữ liệu từ trang này.
  const loadKeywords = useCallback(async () => {
    setKeywordsLoading(true);
    setKeywordsError('');
    try { setKeywords(await getBannedKeywords()); }
    catch (e) { setKeywordsError(e.message); }
    finally { setKeywordsLoading(false); }
  }, []);

  // Duy's Code: Lịch sử dùng phân trang trên admin_log hiện có.
  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    setHistoryError('');
    try { setHistory(await getIngredientProposalHistory(page)); }
    catch (e) { setHistoryError(e.message); }
    finally { setHistoryLoading(false); }
  }, []);

  // Duy's Code: Tải số liệu của cả bốn tab lúc vào trang để badge không hiện 0 giả trước khi mở tab.
  useEffect(() => {
    load();
    loadKeywords();
    loadHistory(1);
  }, [load, loadHistory, loadKeywords]);

  // Duy's Code: Hỗ trợ mở tab bằng URL và đồng bộ khi người dùng dùng nút Back/Forward.
  useEffect(() => {
    const syncPage = () => setActivePage(getPageFromUrl());
    window.addEventListener('popstate', syncPage);
    return () => window.removeEventListener('popstate', syncPage);
  }, []);

  // Duy's Code: Đổi trang con không tải lại ứng dụng và vẫn giữ đường dẫn có thể chia sẻ.
  const selectPage = (key) => {
    setActivePage(key);
    window.history.pushState(null, '', `${window.location.pathname}?tab=${encodeURIComponent(key)}`);
  };

  // Duy's Code: Nút tải lại gọi đúng nguồn dữ liệu của trang con đang mở.
  const refreshPage = () => {
    if (activePage === 'keywords') return loadKeywords();
    if (activePage === 'history') return loadHistory(history.page);
    return load();
  };

  const decide = async (note) => {
    if (!decision) return;
    const key = itemKey(decision.item);
    // Duy's Code: Chụp Recipe nguồn trước khi đề xuất bị từ chối rời khỏi hàng đợi.
    const linkedRecipes = decision.action === 'reject' && decision.item.sourceType === 'recipe'
      ? (decision.item.sources || []).filter((source) => source.type === 'recipe' && source.recipeId)
      : [];
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
      setResolvedRecipeLinks(linkedRecipes);
      setDecision(null);
    } catch (e) { setError(e.message); setDecision(null); }
    finally { setSaving(false); }
  };

  const setFlag = (item, key, value) => setClassification((current) => ({
    ...current,
    [itemKey(item)]: { ...current[itemKey(item)], [key]: value },
  }));

  // Duy's Code: Các cờ phân loại được yêu cầu trước khi thêm nguyên liệu vào kho chung.
  const renderClassification = (item) => {
    const flags = classification[itemKey(item)] || {};
    return <div className={styles.classification}>
      {/* Duy's Code: Chia ba nhóm phân loại thành một hàng gọn để thẻ duyệt không bị kéo cao. */}
      <fieldset className={styles.classificationGroup}>
        <legend>Phân loại đồ chay</legend>
        <div className={styles.options}>
          {[[false, 'Đồ chay'], [true, 'Có nguồn gốc động vật / không phải đồ chay']].map(([value, label]) => (
            <label key={String(value)} className={`${styles.choice} ${flags.isAnimalDerived === value ? styles.selectedChoice : ''}`}>
              <input className="form-check-input m-0" type="radio" name={`animal-${itemKey(item)}`}
                checked={flags.isAnimalDerived === value} onChange={() => setFlag(item, 'isAnimalDerived', value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.classificationGroup}>
        <legend>Ngũ vị tân</legend>
        <div className={styles.options}>
          {[[false, 'Không'], [true, 'Có']].map(([value, label]) => (
            <label key={String(value)} className={`${styles.choice} ${flags.isNguViTan === value ? styles.selectedChoice : ''}`}>
              <input className="form-check-input m-0" type="radio" name={`ngu-vi-tan-${itemKey(item)}`}
                checked={flags.isNguViTan === value} onChange={() => setFlag(item, 'isNguViTan', value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={`${styles.classificationGroup} ${styles.allergenGroup}`}>
        <legend>Dị ứng</legend>
        <label className={`${styles.choice} ${flags.isCommonAllergen ? styles.selectedChoice : ''}`}>
          <input className="form-check-input m-0" type="checkbox" checked={Boolean(flags.isCommonAllergen)}
            onChange={(event) => setFlag(item, 'isCommonAllergen', event.target.checked)} />
          <span>Dị ứng phổ biến</span>
        </label>
      </fieldset>
    </div>;
  };

  const allergyItems = items.filter((item) => item.sourceType === 'health_profile');
  const recipeItems = items.filter((item) => item.sourceType === 'recipe');
  // Duy's Code: Gắn link tới Recipe nguồn để duyệt tiếp sau thao tác trong trang nguyên liệu.
  const recipeSourcesFor = (item) => (item.sources || []).filter((source) => source.type === 'recipe' && source.recipeId);

  // Duy's Code: Dùng chung một thẻ đề xuất cho hai luồng, nhưng giữ phần mô tả riêng theo nguồn.
  const renderProposal = (item, isAllergy) => {
    const flags = classification[itemKey(item)] || {};
    const ready = typeof flags.isAnimalDerived === 'boolean' && typeof flags.isNguViTan === 'boolean';
    return (
    <Panel key={itemKey(item)} className={styles.proposalCard}>
      <div className={styles.proposalHeader}>
        <div className={styles.proposalTitle}>
          <span className={`${styles.sourceIcon} ${isAllergy ? styles.allergyIcon : styles.recipeIcon}`}>
            <i className={`bi bi-${isAllergy ? 'heart-pulse' : 'basket'}`} aria-hidden="true" />
          </span>
          <div>
            <h3>{item.name}</h3>
            <p>{isAllergy
              ? `Được khai báo trong hồ sơ dị ứng của ${item.memberNames || 'thành viên'} · ${item.memberCount || 1} hồ sơ`
              : `${recipeSourcesFor(item).length} công thức đang đề xuất nguyên liệu này`}</p>
          </div>
        </div>
        <span className={styles.reviewBadge}>{isAllergy ? 'Cần xem xét cao' : 'Chờ phân loại'}</span>
      </div>

      {!isAllergy && recipeSourcesFor(item).length > 0 && <div className={styles.sourceLinks}>
        {recipeSourcesFor(item).map((source) => <Button key={source.recipeId} size="sm" variant="outline" icon="arrow-return-right"
          onClick={() => window.location.assign(`/admin/recipes/verify?recipeId=${encodeURIComponent(source.recipeId)}`)}>
          Mở Recipe: {source.recipeTitle || `#${source.recipeId}`}
        </Button>)}
      </div>}

      {renderClassification(item)}

      {/* Duy's Code: Gắn thao tác vào footer thẻ và chỉ bật xác nhận khi đủ phân loại bắt buộc. */}
      <div className={styles.proposalActions}>
        {!ready && <span className={styles.actionHint}>Chọn phân loại đồ chay và ngũ vị tân để tiếp tục.</span>}
        {isAllergy ? <>
          <Button variant="subtle" icon="trash" onClick={() => setDecision({ item, action: 'delete' })}>Ẩn yêu cầu duyệt</Button>
          <Button icon="check-circle" disabled={!ready} onClick={() => setDecision({ item, action: 'approve' })}>Xác nhận phân loại</Button>
        </> : <>
          <Button variant="alert" icon="x-circle" onClick={() => setDecision({ item, action: 'reject' })}>Từ chối đề xuất</Button>
          <Button icon="check-circle" disabled={!ready} onClick={() => setDecision({ item, action: 'approve' })}>Thêm vào kho</Button>
        </>}
      </div>
    </Panel>
    );
  };

  const activeTab = INGREDIENT_PAGES.find((item) => item.key === activePage) || INGREDIENT_PAGES[0];
  const keywordRows = useMemo(() => {
    const query = keywordQuery.trim().toLocaleLowerCase('vi');
    return keywords.filter((item) => !query || [item.keyword, item.normalizedKeyword, item.category].some((value) => String(value || '').toLocaleLowerCase('vi').includes(query)));
  }, [keywordQuery, keywords]);

  const historyStatus = (entry) => ({
    approved: 'Đã thêm vào kho', rejected: 'Bị từ chối', removed: 'Đã ẩn yêu cầu',
  }[entry.status] || entry.action);
  const historySource = (sourceType) => ({ health_profile: 'Dị ứng', recipe: 'Công thức' }[sourceType] || 'Không rõ nguồn');

  const onLogout = () => { logout(); window.location.assign('/'); };

  return (
    <AdminLayout activeKey="ingredient-verify" title="Duyệt nguyên liệu" user={user} onLogout={onLogout}>
      <div className={styles.page}>
        <PageHeader
          title="Duyệt nguyên liệu"
          description="Xử lý dị ứng, nguyên liệu đề xuất trong công thức, tra cứu Banned Keyword và xem lịch sử quyết định."
          actions={<Button variant="outline" icon="arrow-clockwise" onClick={refreshPage}
            disabled={loading || keywordsLoading || historyLoading}>Tải lại</Button>}
        />

        <ErrorDialog error={error} title="Không thể xử lý đề xuất nguyên liệu" />

        {/* Duy's Code: Điều hướng 4 trang con, đồng thời hiện số lượng cần xử lý trên từng hàng đợi. */}
        <nav className={styles.pageNav} role="tablist" aria-label="Các trang quản lý nguyên liệu">
          {INGREDIENT_PAGES.map((tab) => {
            const count = tab.key === 'allergy' ? (loading ? '…' : allergyItems.length)
              : tab.key === 'recipe' ? (loading ? '…' : recipeItems.length)
                : tab.key === 'keywords' ? (keywordsLoading ? '…' : keywordsError ? '!' : keywords.length)
                  : historyLoading ? '…' : historyError ? '!' : history.totalItems;
            return <button key={tab.key} id={`ingredient-tab-${tab.key}`} type="button" role="tab" aria-selected={activePage === tab.key}
              className={activePage === tab.key ? styles.activePage : ''} onClick={() => selectPage(tab.key)}>
              <i className={`bi bi-${tab.icon}`} aria-hidden="true" />
              <span>{tab.label}</span>
              <b>{count}</b>
            </button>;
          })}
        </nav>

        <section role="tabpanel" aria-labelledby={`ingredient-tab-${activePage}`} className={styles.content}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>{activeTab.label}</h2>
              <p>{activeTab.description}</p>
            </div>
          </div>

          {activePage === 'allergy' && (loading
            ? <div className={styles.loading}><Spinner label="Đang tải yêu cầu dị ứng…" showLabel /></div>
            : allergyItems.length
              ? <>
                <Notice tone="alert" title="Ưu tiên xem xét">
                  Những nguyên liệu này được thành viên khai báo trong hồ sơ dị ứng. Xác nhận phân loại sẽ thêm nguyên liệu vào kho; ẩn yêu cầu chỉ gỡ khỏi hàng đợi.
                </Notice>
                <div className={styles.proposalList}>{allergyItems.map((item) => renderProposal(item, true))}</div>
              </>
              : <EmptyState icon="heart-pulse" title="Không có dị ứng chờ phân loại" description="Yêu cầu dị ứng mới sẽ xuất hiện tại trang này." />)}

          {activePage === 'recipe' && (loading
            ? <div className={styles.loading}><Spinner label="Đang tải nguyên liệu từ công thức…" showLabel /></div>
            : recipeItems.length
              ? <>
                <Notice title="Nguyên liệu đề xuất từ Recipe">
                  Khi thêm một nguyên liệu vào kho, các Recipe đang chờ có cùng tên nguyên liệu sẽ được liên kết với nguyên liệu đó.
                </Notice>
                {resolvedRecipeLinks.length > 0 && <Notice tone="alert" title="Đề xuất vừa bị từ chối">
                  Recipe liên quan vẫn đang chờ và cần Admin tự quyết định. Mở từng Recipe để xem nội dung và xử lý.
                  <div className={styles.sourceLinks}>{resolvedRecipeLinks.map((source) => <Button key={source.recipeId} size="sm" variant="outline"
                    onClick={() => window.location.assign(`/admin/recipes/verify?recipeId=${encodeURIComponent(source.recipeId)}`)}>
                    Mở Recipe: {source.recipeTitle || `#${source.recipeId}`}
                  </Button>)}</div>
                </Notice>}
                <div className={styles.proposalList}>{recipeItems.map((item) => renderProposal(item, false))}</div>
              </>
              : <>
                {resolvedRecipeLinks.length > 0 && <Notice tone="alert" title="Đề xuất vừa bị từ chối">
                  Recipe liên quan vẫn đang chờ và cần Admin tự quyết định.
                  <div className={styles.sourceLinks}>{resolvedRecipeLinks.map((source) => <Button key={source.recipeId} size="sm" variant="outline"
                    onClick={() => window.location.assign(`/admin/recipes/verify?recipeId=${encodeURIComponent(source.recipeId)}`)}>
                    Mở Recipe: {source.recipeTitle || `#${source.recipeId}`}
                  </Button>)}</div>
                </Notice>}
                <EmptyState icon="basket" title="Không có nguyên liệu công thức chờ duyệt" description="Các đề xuất mới từ Recipe sẽ xuất hiện tại đây." />
              </>)}

          {activePage === 'keywords' && (keywordsLoading
            ? <div className={styles.loading}><Spinner label="Đang tải Banned Keyword…" showLabel /></div>
            : keywordsError
              ? <ErrorDialog error={keywordsError} title="Không tải được Banned Keyword" onRetry={loadKeywords} />
              : <>
                <div className={styles.keywordToolbar}>
                  <p>{keywords.length} từ khóa trong bảng hiện có</p>
                  <input className="form-control" value={keywordQuery} onChange={(event) => setKeywordQuery(event.target.value)}
                    placeholder="Tìm từ khóa hoặc phân loại" aria-label="Tìm Banned Keyword" />
                </div>
                {keywordRows.length
                  ? <div className={styles.keywordTableWrap}><table className={styles.keywordTable}>
                    <thead><tr><th>Từ khóa</th><th>Dạng chuẩn hóa</th><th>Phân loại</th></tr></thead>
                    <tbody>{keywordRows.map((item) => <tr key={item.id}>
                      <td>{item.keyword}</td><td>{item.normalizedKeyword}</td>
                      <td><span className={styles.keywordCategory}>{item.category || 'Không có phân loại trong dữ liệu'}</span></td>
                    </tr>)}</tbody>
                  </table></div>
                  : <EmptyState icon="incognito" title="Không tìm thấy từ khóa" description={keywordQuery ? 'Thử từ khóa khác.' : 'Bảng Banned Keyword chưa có dữ liệu.'} />}
              </>)}

          {activePage === 'history' && (historyLoading
            ? <div className={styles.loading}><Spinner label="Đang tải lịch sử duyệt…" showLabel /></div>
            : historyError
              ? <ErrorDialog error={historyError} title="Không tải được lịch sử duyệt" onRetry={() => loadHistory(history.page)} />
              : history.items.length
                ? <>
                  <div className={styles.historyList}>{history.items.map((entry) => (
                    <Panel key={entry.id} className={styles.historyCard}>
                      <div className={styles.historyTop}>
                        <div><h3>{entry.name || 'Nguyên liệu không có tên'}</h3><p>{historySource(entry.sourceType)} · {entry.adminName || entry.adminEmail || 'Admin'}</p></div>
                        <span className={`${styles.historyStatus} ${entry.status === 'approved' ? styles.statusApproved : entry.status === 'rejected' ? styles.statusRejected : styles.statusRemoved}`}>
                          {historyStatus(entry)}
                        </span>
                      </div>
                      <div className={styles.historyMeta}>
                        <span><i className="bi bi-calendar3" aria-hidden="true" />{formatDate(entry.createdAt)}</span>
                        {entry.reason && <p>{entry.reason}</p>}
                      </div>
                    </Panel>
                  ))}</div>
                  <Pagination page={history.page} totalPages={history.totalPages} pageSize={history.pageSize}
                    totalItems={history.totalItems} itemLabel="quyết định" onChange={loadHistory} />
                </>
                : <EmptyState icon="clock-history" title="Chưa có lịch sử duyệt nguyên liệu" description="Các quyết định mới sẽ được ghi nhận tại đây." />)}
        </section>

        <ConfirmDialog
          open={!!decision}
          title={decision?.action === 'reject' ? 'Từ chối đề xuất?' : decision?.action === 'delete' ? 'Ẩn yêu cầu dị ứng?' : 'Thêm nguyên liệu vào kho?'}
          message={decision?.action === 'delete'
            ? `“${decision?.item?.name || ''}” sẽ được gỡ khỏi hàng đợi. Thông tin dị ứng vẫn được giữ trong hồ sơ thành viên.`
            : decision?.action === 'reject'
              ? `“${decision?.item?.name || ''}” sẽ bị từ chối khỏi kho nguyên liệu. Recipe liên quan vẫn giữ trạng thái chờ để Admin tự xem xét.`
              : `“${decision?.item?.name || ''}” sẽ được thêm vào kho với phân loại đồ chay và ngũ vị tân đã chọn.`}
          confirmLabel={decision?.action === 'reject' ? 'Từ chối' : decision?.action === 'delete' ? 'Ẩn yêu cầu' : 'Thêm vào kho'}
          tone={decision?.action === 'reject' || decision?.action === 'delete' ? 'alert' : 'primary'}
          reason={decision?.action === 'reject' ? { label: 'Lý do từ chối', required: true } : undefined}
          loading={saving}
          onConfirm={decide}
          onCancel={() => setDecision(null)}
        />
      </div>
    </AdminLayout>
  );
}
