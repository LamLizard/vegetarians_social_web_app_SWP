import { useEffect, useLayoutEffect, useState } from 'react';
import { Button, EmptyState, Notice, Pagination, Select, SkeletonCard, ShopCard } from '../components';
import FeedSidebar from '../components/FeedSidebar/FeedSidebar';
import FeedTopbar from '../components/FeedTopbar/FeedTopbar';
import shopService from '../services/shop.service';
import '../styles/feed-theme.css';
import styles from './ShopExplorePage.module.css';

const NAV = [
  { key: 'feed', label: 'Bảng tin', icon: 'house', iconActive: 'house-fill', href: '/' },
  { key: 'dishes', label: 'Món chay', icon: 'egg-fried', href: '#' },
  { key: 'meal-plan', label: 'Thực đơn', icon: 'calendar-week', href: '#' },
  { key: 'shops', label: 'Quán chay', icon: 'shop', iconActive: 'shop-window', href: '/shops' },
];

const COLLAPSE_KEY = 'anchay-shop-sidebar-collapsed';
const readCollapsed = () => {
  try {
    const value = localStorage.getItem(COLLAPSE_KEY);
    if (value !== null) return value === '1';
  } catch {
    // trình duyệt chặn localStorage → dùng mặc định
  }
  return window.innerWidth < 1200;
};

const MOBILE_QUERY = '(max-width: 767.98px)';
const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
};

function toUserShape(user) {
  if (!user) return null;
  return {
    name: user.fullName || user.name || 'Tài khoản',
    avatarUrl: user.avatarUrl || null,
    roleLabel: user.role === 'admin' ? 'Quản trị viên' : undefined,
  };
}

export default function ShopExplorePage({ user, accountMenu = [] }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [reloadKey, setReloadKey] = useState(0);

  useLayoutEffect(() => {
    document.documentElement.dataset.feedV2 = '';
    return () => { delete document.documentElement.dataset.feedV2; };
  }, []);

  useEffect(() => {
    let ignore = false;
    shopService.getCategories()
      .then((res) => {
        if (ignore) return;
        setCategories((res?.items ?? []).map((item) => ({ value: String(item.id), label: item.name })));
      })
      .catch(() => {
        if (!ignore) setCategories([]);
      });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    setStatus('loading');
    (async () => {
      try {
        const res = await shopService.getShops({
          q: query || undefined,
          category: category || undefined,
          page,
        });
        if (ignore) return;
        setItems(res.items ?? []);
        setTotalPages(res.totalPages ?? 1);
        setTotalItems(res.totalItems ?? 0);
        setPageSize(res.pageSize ?? 8);
        setStatus('ready');
      } catch (err) {
        if (ignore) return;
        setError(err.message || 'Không tải được danh sách quán chay.');
        setStatus('error');
      }
    })();
    return () => { ignore = true; };
  }, [category, page, query, reloadKey]);

  const toggleCollapsed = () => setCollapsed((value) => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(value ? 0 : 1));
    } catch {
      // bỏ qua nếu trình duyệt chặn localStorage
    }
    return !value;
  });

  const clearFilters = () => {
    setSearchText('');
    setQuery('');
    setCategory('');
    setPage(1);
  };

  const hasFilters = Boolean(query || category);

  return (
    <div className={`feed-v2-page ${styles.shell}`}>
      <FeedSidebar
        nav={NAV}
        activeKey="shops"
        user={user ? toUserShape(user) : null}
        accountMenu={accountMenu}
        collapsed={!isMobile && collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={isMobile && drawerOpen}
        onCloseMobile={() => setDrawerOpen(false)}
      />

      <div className={styles.main}>
        <FeedTopbar
          value={searchText}
          onChange={setSearchText}
          onSearch={(value) => {
            const nextValue = String(value ?? '').trim();
            setSearchText(nextValue);
            setQuery(nextValue);
            setPage(1);
          }}
          onOpenMenu={() => setDrawerOpen(true)}
          placeholder="Tìm quán theo tên hoặc địa chỉ…"
          searchLabel="Tìm quán chay"
        />

        <main className={styles.content} aria-labelledby="shop-explore-title">
          <div className={styles.header}>
            <h1 id="shop-explore-title" className={styles.title}>Khám phá quán chay</h1>
          </div>

          <div className={styles.filterBar}>
            <div className={styles.filterWrap}>
              <Select
                label="Danh mục món"
                value={category}
                onChange={(value) => {
                  setCategory(value);
                  setPage(1);
                }}
                options={[{ value: '', label: 'Tất cả danh mục' }, ...categories]}
              />
            </div>

            {hasFilters && (
              <Button type="button" variant="subtle" icon="x-lg" size="sm" onClick={clearFilters}>
                Xoá lọc
              </Button>
            )}
          </div>

          <div className={styles.summary}>Tìm thấy {totalItems} quán</div>

          {status === 'loading' && (
            <div className={styles.list} aria-busy="true">
              {Array.from({ length: 3 }).map((_, idx) => <SkeletonCard key={idx} />)}
            </div>
          )}

          {status === 'error' && (
            <Notice tone="alert" title="Không tải được danh sách quán" action={{ label: 'Thử lại', onClick: () => setReloadKey((value) => value + 1) }}>
              {error}
            </Notice>
          )}

          {status === 'ready' && items.length === 0 && (
            query || category
              ? (
                <EmptyState icon="search" title="Không tìm thấy quán nào">
                  Thử từ khoá khác hoặc bỏ lọc danh mục để xem thêm kết quả.
                </EmptyState>
              )
              : (
                <EmptyState icon="shop" title="Chưa có quán chay nào">
                  Quán mới sẽ xuất hiện tại đây khi được xác minh.
                </EmptyState>
              )
          )}

          {status === 'ready' && items.length > 0 && (
            <div className={styles.list}>
              {items.map((shop) => (
                <ShopCard
                  key={shop.id}
                  name={shop.name}
                  imageUrl={shop.imageUrl}
                  address={shop.address}
                  phone={shop.phone}
                  openTime={shop.openTime}
                  closeTime={shop.closeTime}
                  dishCount={shop.dishCount}
                  href={`/shops/${shop.id}`}
                />
              ))}
            </div>
          )}

          {status === 'ready' && totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              itemLabel="quán"
              onChange={(nextPage) => setPage(nextPage)}
            />
          )}
        </main>
      </div>

      <nav className={styles.mobileNav} aria-label="Điều hướng nhanh">
        {NAV.map((item) => {
          const isActive = item.key === 'shops';
          return (
            <a key={item.key} href={item.href} className={`${styles.mItem} ${isActive ? styles.mOn : ''}`} aria-current={isActive ? 'page' : undefined}>
              <i className={`bi bi-${isActive && item.iconActive ? item.iconActive : item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
