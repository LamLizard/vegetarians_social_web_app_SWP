import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminLayout, Button, ConfirmDialog, DataTable, ErrorDialog, Modal, Notice, PageHeader,
  SearchInput, StatusBadge, Tabs, TextField, useToast,
} from '../components';
import useAuth from '../hooks/useAuth';
import {
  createCategory, getCategories, renameCategory, setCategoryStatus,
} from '../services/admin-category.service';
import styles from './AdminCategoryManagementPage.module.css';

const EMPTY_COUNTS = { all: 0, active: 0, inactive: 0 };

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function CategoryFormDialog({
  editor, category, formName, setFormName, formError, saving, onSubmit, onClose,
}) {
  const editingUsage = category && category.postCount + category.dishCount > 0;

  return (
    <Modal
      open={Boolean(editor)}
      onClose={onClose}
      title={editor?.mode === 'edit' ? 'Sửa danh mục' : 'Thêm danh mục'}
      size="sm"
      dismissible={!saving}
      footer={(
        <>
          <Button variant="subtle" onClick={onClose} disabled={saving}>Huỷ</Button>
          <Button type="submit" form="admin-category-form" loading={saving}>Lưu</Button>
        </>
      )}
    >
      <form id="admin-category-form" onSubmit={onSubmit}>
        <TextField
          label="Tên danh mục"
          value={formName}
          onChange={setFormName}
          maxLength={120}
          required
          autoFocus
          placeholder="Ví dụ: Món chính, Ăn sáng, Đồ uống…"
          hint="Tên này hiện trên bài viết, món ăn và bộ lọc. Tối đa 120 ký tự."
          error={formError}
          disabled={saving}
        />
        {editingUsage && (
          <Notice tone="info" className="mt-3">
            Đổi tên sẽ cập nhật {category.postCount} bài viết và {category.dishCount} món ăn đang dùng danh mục này.
          </Notice>
        )}
      </form>
    </Modal>
  );
}

export default function AdminCategoryManagementPage() {
  const { user, logout } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [editor, setEditor] = useState(null);
  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const handleLogout = () => { logout(); window.location.assign('/'); };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCategories();
      setItems(data.items);
      setCounts(data.counts);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setFormName('');
    setFormError('');
    setEditor({ mode: 'create' });
  };

  const openEdit = (category) => {
    setFormName(category.name);
    setFormError('');
    setEditor({ mode: 'edit', category });
  };

  const closeEditor = () => {
    if (!saving) setEditor(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || !editor) return;

    const name = formName.trim();
    if (name.length < 2 || name.length > 120) {
      setFormError('Tên danh mục phải có từ 2 đến 120 ký tự.');
      return;
    }

    const editingId = editor.mode === 'edit' ? editor.category.id : null;
    const duplicate = items.some((item) => (
      item.id !== editingId && item.name.trim().toLowerCase() === name.toLowerCase()
    ));
    if (duplicate) {
      setFormError(`Danh mục “${name}” đã tồn tại.`);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editor.mode === 'edit') {
        await renameCategory(editor.category.id, name);
        toast('Đã cập nhật danh mục.');
      } else {
        await createCategory(name);
        toast('Đã thêm danh mục.');
      }
      setEditor(null);
      await load();
    } catch (saveError) {
      setFormError(saveError.message || 'Không thể lưu danh mục. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const confirmToggle = async () => {
    if (!confirm || confirming) return;
    setConfirming(true);
    try {
      await setCategoryStatus(confirm.category.id, confirm.nextActive);
      setConfirm(null);
      toast(confirm.nextActive ? 'Đã bật danh mục.' : 'Đã tắt danh mục.');
      await load();
    } catch (toggleError) {
      setConfirm(null);
      setError(toggleError);
    } finally {
      setConfirming(false);
    }
  };

  const visible = useMemo(() => {
    const search = normalize(query.trim());
    return items.filter((item) => {
      const matchesTab = tab === 'all' || item.isActive === (tab === 'active');
      return matchesTab && (!search || normalize(item.name).includes(search));
    });
  }, [items, query, tab]);

  const columns = [
    {
      key: 'name',
      header: 'Tên danh mục',
      primary: true,
      width: '34%',
      render: (row) => (
        <div className={styles.categoryName}>
          <span className={styles.categoryIcon}><i className="bi bi-tag" aria-hidden="true" /></span>
          <span>
            <b title={row.name}>{row.name}</b>
            <small>#{row.id}</small>
          </span>
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Đang dùng cho',
      width: '30%',
      render: (row) => (
        <div className={styles.usage}>
          <span className={row.postCount === 0 ? styles.zero : undefined}>
            <i className="bi bi-journal-text" aria-hidden="true" />{row.postCount} bài viết
          </span>
          <span className={row.dishCount === 0 ? styles.zero : undefined}>
            <i className="bi bi-egg-fried" aria-hidden="true" />{row.dishCount} món ăn
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '16%',
      render: (row) => <StatusBadge entity="category" status={row.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      width: '20%',
      render: (row) => (
        <div className={styles.actions}>
          <Button size="sm" variant="outline" icon="pencil" onClick={() => openEdit(row)}>Sửa</Button>
          <Button
            size="sm"
            variant={row.isActive ? 'outline' : 'primary'}
            icon={row.isActive ? 'pause-circle' : 'play-circle'}
            onClick={() => setConfirm({ category: row, nextActive: !row.isActive })}
          >
            {row.isActive ? 'Tắt' : 'Bật'}
          </Button>
        </div>
      ),
    },
  ];

  const noCategories = counts.all === 0;
  const noMatches = Boolean(query.trim()) || tab !== 'all';

  return (
    <AdminLayout activeKey="categories" title="Danh mục" user={user} onLogout={handleLogout}>
      <div className={styles.page}>
        <PageHeader
          title="Quản lý danh mục"
          description="Nhãn dùng chung cho bài viết và món ăn. Tắt một danh mục sẽ ẩn nó khỏi lựa chọn mới nhưng không làm mất nhãn trên nội dung cũ."
          actions={<Button icon="plus-lg" onClick={openCreate}>Thêm danh mục</Button>}
        />

        <div className={styles.toolbar}>
          <Tabs
            label="Lọc danh mục"
            items={[
              { key: 'all', label: 'Tất cả', count: counts.all },
              { key: 'active', label: 'Đang dùng', count: counts.active },
              { key: 'inactive', label: 'Đã tắt', count: counts.inactive },
            ]}
            value={tab}
            onChange={setTab}
          />
          <SearchInput
            className={styles.search}
            value={query}
            onChange={setQuery}
            placeholder="Tìm danh mục..."
            label="Tìm danh mục"
          />
        </div>

        <DataTable
          caption="Danh sách danh mục"
          rows={visible}
          columns={columns}
          rowKey="id"
          loading={loading}
          isRowMuted={(row) => row.isActive === false}
          empty={{
            title: noCategories ? 'Chưa có danh mục' : noMatches ? 'Không tìm thấy danh mục' : 'Chưa có danh mục',
            children: noCategories
              ? 'Thêm danh mục đầu tiên để phân loại bài viết và món ăn.'
              : noMatches ? 'Thử từ khóa khác hoặc chọn tab khác.' : undefined,
            action: noCategories
              ? <Button size="sm" icon="plus-lg" onClick={openCreate}>Thêm danh mục</Button>
              : undefined,
          }}
        />
      </div>

      <CategoryFormDialog
        editor={editor}
        category={editor?.mode === 'edit' ? editor.category : null}
        formName={formName}
        setFormName={setFormName}
        formError={formError}
        saving={saving}
        onSubmit={submit}
        onClose={closeEditor}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm
          ? `${confirm.nextActive ? 'Bật lại' : 'Tắt'} danh mục “${confirm.category.name}”?`
          : ''}
        message={confirm?.nextActive
          ? 'Danh mục sẽ xuất hiện lại trong form đăng bài và tạo món.'
          : confirm
            ? `Danh mục sẽ bị ẩn khỏi form đăng bài và tạo món. ${confirm.category.postCount} bài viết và ${confirm.category.dishCount} món ăn đang dùng vẫn giữ nhãn này.`
            : undefined}
        confirmLabel={confirm?.nextActive ? 'Bật danh mục' : 'Tắt danh mục'}
        tone={confirm?.nextActive ? 'primary' : 'alert'}
        loading={confirming}
        onConfirm={confirmToggle}
        onCancel={() => { if (!confirming) setConfirm(null); }}
      />
      <ErrorDialog error={error} onRetry={load} onDismiss={() => setError(null)} />
    </AdminLayout>
  );
}
