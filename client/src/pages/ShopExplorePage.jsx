import { useEffect, useLayoutEffect, useState } from 'react';
import { Button, EmptyState, Notice, Pagination, Photo, SkeletonCard, ShopCard } from '../components';
import FeedSidebar from '../components/FeedSidebar/FeedSidebar';
import FeedTopbar from '../components/FeedTopbar/FeedTopbar';
import shopService from '../services/shop.service';
import { formatPrice } from '../utils/format';
import { getOpenStateFromSlots, getTodayHours } from '../utils/time';
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
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const isSearching = Boolean(query.trim());

  useLayoutEffect(() => {
    document.documentElement.dataset.feedV2 = '';
    return () => { delete document.documentElement.dataset.feedV2; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;
    setStatus('loading');
    (async () => {
      try {
        const res = await shopService.getShops({
          q: query || undefined,
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
  }, [page, query, reloadKey]);

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
    setPage(1);
  };

  const hasFilters = Boolean(query);

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
          placeholder="Tìm quán, món ăn, danh mục…"
          searchLabel="Tìm quán chay"
        />

        <main className={styles.content} aria-labelledby="shop-explore-title">
          <div className={styles.header}>
            <h1 id="shop-explore-title" className={styles.title}>Khám phá quán chay</h1>
          </div>

          <div className={styles.filterBar}>
            {hasFilters && (
              <Button type="button" variant="subtle" icon="x-lg" size="sm" onClick={clearFilters}>
                Xoá lọc
              </Button>
            )}
          </div>

          <div className={styles.summary}>
            Tìm thấy {totalItems} quán{query ? <> cho <span className={styles.summaryQuery}>“{query}”</span></> : null}
          </div>

          {status === 'loading' && (
            <div className={isSearching ? styles.resultList : styles.list} aria-busy="true">
              {Array.from({ length: isSearching ? 3 : 9 }).map((_, idx) => <SkeletonCard key={idx} />)}
            </div>
          )}

          {status === 'error' && (
            <Notice tone="alert" title="Không tải được danh sách quán" action={{ label: 'Thử lại', onClick: () => setReloadKey((value) => value + 1) }}>
              {error}
            </Notice>
          )}

          {status === 'ready' && items.length === 0 && (
            query
              ? (
                <EmptyState icon="search" title="Không tìm thấy quán nào">
                  Thử từ khoá khác để xem thêm kết quả.
                </EmptyState>
              )
              : (
                <EmptyState icon="shop" title="Chưa có quán chay nào">
                  Quán mới sẽ xuất hiện tại đây khi được xác minh.
                </EmptyState>
              )
          )}

          {status === 'ready' && items.length > 0 && (
            isSearching ? (
              <div className={styles.resultList}>
                {items.map((shop) => <ShopSearchResult key={shop.id} shop={shop} now={now} />)}
              </div>
            ) : (
              <div className={styles.list}>
                {items.map((shop) => {
                  const today = getTodayHours(shop.schedule ?? [], now);
                  const openState = today.isClosed ? 'closed' : getOpenStateFromSlots(today.slots ?? [], now);
                  return (
                    <div key={shop.id} className={styles.shopEntry}>
                      {shop.operatingStatus === 'inactive' && <span className={styles.operatingLabel}>Tạm ngưng hoạt động</span>}
                      <ShopCard
                        name={shop.name}
                        imageUrl={shop.imageUrl}
                        address={shop.address}
                        phone={shop.phone}
                        hoursText={today.hoursText}
                        openState={openState}
                        showOpenState={shop.operatingStatus !== 'inactive'}
                        dishCount={shop.dishCount}
                        href={`/shops/${shop.id}`}
                      />
                    </div>
                  );
                })}
              </div>
            )
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

/* Lam's code: Kết quả tìm kiếm dạng hàng, chỉ nhận dữ liệu đã được page tải qua service. */
function ShopSearchResult({ shop, now }) {
  const today = getTodayHours(shop.schedule ?? [], now);
  const openState = today.isClosed ? 'closed' : getOpenStateFromSlots(today.slots ?? [], now);
  const dishes = (shop.matchedDishes ?? []).slice(0, 5);

  return (
    <article className={styles.resultRow}>
      <a className={styles.resultMedia} href={`/shops/${shop.id}`} tabIndex={-1} aria-hidden="true">
        <Photo src={shop.imageUrl} ratio="1/1" shape="rounded" className={styles.resultImg} />
      </a>

      <div className={styles.resultBody}>
        <div className={styles.resultHead}>
          <h2 className={styles.resultName}><a href={`/shops/${shop.id}`}>{shop.name}</a></h2>
          {shop.operatingStatus === 'inactive'
            ? <span className={`${styles.stateTag} ${styles.stateOff}`}>Tạm ngưng</span>
            : <span className={`${styles.stateTag} ${openState === 'closed' ? styles.stateOff : styles.stateOn}`}>
                {openState === 'closed' ? 'Đóng cửa' : 'Mở cửa'}
              </span>}
        </div>

        <div className={styles.resultMeta}>
          <span className={styles.verified}><i className="bi bi-patch-check-fill" aria-hidden="true" /> Đã xác minh</span>
          <span><i className="bi bi-clock" aria-hidden="true" /> Hôm nay: {today.hoursText}</span>
          <span><i className="bi bi-list-ul" aria-hidden="true" /> {shop.dishCount} món</span>
        </div>

        <div className={styles.resultAddress}><i className="bi bi-geo-alt" aria-hidden="true" /><span>{shop.address}</span></div>

        {dishes.length > 0 && (
          <>
            <div className={styles.dishHead}>
              <span className={styles.dishLabel}>Món khớp</span>
              <span className={styles.dishCount}>{dishes.length} món</span>
            </div>
            <div className={styles.dishScroller} tabIndex="0" aria-label={`Các món khớp của ${shop.name}`}>
              {dishes.map((dish) => (
                <a key={dish.id} className={styles.dishCard} href={`/shops/${shop.id}`}>
                  <Photo src={dish.imageUrl} alt={dish.name} ratio="1/1" shape="rounded" className={styles.dishPhoto} />
                  <span className={styles.dishPrice}>{formatPrice(dish.price)}</span>
                  <span className={styles.dishName}>{dish.name}</span>
                </a>
              ))}
            </div>
          </>
        )}

        <div className={styles.resultFoot}>
          <a className={styles.resultCta} href={`/shops/${shop.id}`}>Xem quán <i className="bi bi-arrow-right" aria-hidden="true" /></a>
        </div>
      </div>
    </article>
  );
}
