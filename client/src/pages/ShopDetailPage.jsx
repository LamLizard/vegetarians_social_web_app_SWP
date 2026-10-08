import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  Notice,
  ShopCard,
  ShopMenuItem,
  SkeletonCard,
  mapsSearchUrl,
} from '../components';
import FeedSidebar from '../components/FeedSidebar/FeedSidebar';
import shopService from '../services/shop.service';
import '../styles/feed-theme.css';
import pageStyles from './ShopExplorePage.module.css';
import styles from './ShopDetailPage.module.css';

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

export default function ShopDetailPage({ shopId, user, accountMenu = [] }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [shop, setShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  useLayoutEffect(() => {
    document.documentElement.dataset.feedV2 = '';
    return () => { delete document.documentElement.dataset.feedV2; };
  }, []);

  useEffect(() => {
    if (!shopId) {
      setStatus('not-found');
      setShop(null);
      setMenu([]);
      return undefined;
    }

    let ignore = false;
    setStatus('loading');
    setError('');

    (async () => {
      try {
        const res = await shopService.getShop(shopId);
        if (ignore) return;
        setShop(res?.shop ?? null);
        setMenu(res?.menu ?? []);
        setStatus('ready');
      } catch (err) {
        if (ignore) return;
        if (err?.status === 404) {
          setStatus('not-found');
          setShop(null);
          setMenu([]);
          return;
        }
        setError(err?.message || 'Không tải được thông tin quán.');
        setStatus('error');
      }
    })();

    return () => { ignore = true; };
  }, [reloadKey, shopId]);

  const toggleCollapsed = () => setCollapsed((value) => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(value ? 0 : 1));
    } catch {
      // bỏ qua nếu trình duyệt chặn localStorage
    }
    return !value;
  });

  const groupedMenu = useMemo(() => {
    const map = new Map();
    menu.forEach((item) => {
      const key = item.category || 'Khác';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries());
  }, [menu]);

  const goTo = (url) => window.location.assign(url);

  return (
    <div className={`${pageStyles.shell} ${styles.shell}`}>
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
        <main className={styles.content} aria-labelledby="shop-detail-title">
          <div className={styles.headerRow}>
            <Button
              type="button"
              variant="subtle"
              size="sm"
              icon="list"
              className={styles.mobileMenuButton}
              onClick={() => setDrawerOpen(true)}
              aria-label="Mở menu quán chay"
            >
              Menu
            </Button>
            <a href="/shops" className={styles.backLink}>← Quán chay</a>
          </div>

          {status === 'loading' && (
            <div className={styles.loading} aria-busy="true">
              <div className={styles.loadingCard}><SkeletonCard /></div>
              <div className={styles.loadingGroup}><SkeletonCard /></div>
              <div className={styles.loadingGroup}><SkeletonCard /></div>
            </div>
          )}

          {status === 'not-found' && (
            <EmptyState icon="pin-map-fill" title="Không tìm thấy quán này">
              <Button type="button" variant="primary" onClick={() => goTo('/shops')}>Về danh sách quán</Button>
            </EmptyState>
          )}

          {status === 'error' && (
            <Notice tone="alert" title="Không tải được thông tin quán" action={{ label: 'Thử lại', onClick: () => setReloadKey((value) => value + 1) }}>
              {error}
            </Notice>
          )}

          {status === 'ready' && shop && (
            <>
              <ShopCard
                layout="row"
                name={shop.name}
                imageUrl={shop.imageUrl}
                address={shop.address}
                phone={shop.phone}
                openTime={shop.openTime}
                closeTime={shop.closeTime}
                dishCount={shop.dishCount}
                href="#"
                showOpenState={false}
              />

              <section className={styles.menuSection}>
                <div className={styles.sectionHeader}>
                  <h2 id="shop-detail-title" className={styles.sectionTitle}>Menu ({shop.dishCount ?? menu.length} món)</h2>
                </div>

                {groupedMenu.length === 0 ? (
                  <EmptyState icon="card-list" title="Quán chưa cập nhật menu" />
                ) : (
                  groupedMenu.map(([category, items]) => (
                    <div key={category} className={styles.group}>
                      <h3 className={styles.groupTitle}>{category}</h3>
                      <ul className={styles.menuList}>
                        {items.map((item) => (
                          <ShopMenuItem
                            key={item.id}
                            name={item.name}
                            price={item.price}
                            ingredientNote={item.ingredientNote}
                            isAvailable={item.isAvailable}
                            showPhoto
                            imageUrl={item.imageUrl}
                            dishHref="#"
                          />
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {isMobile && shop && (
        <nav className={styles.mobileActions} aria-label="Thao tác nhanh quán">
          {shop.phone && (
            <a href={`tel:${shop.phone.replace(/\s+/g, '')}`} className={styles.mobileAction}>
              <i className="bi bi-telephone-fill" aria-hidden="true" />
              <span>Gọi điện</span>
            </a>
          )}
          {shop.address && (
            <a href={mapsSearchUrl(shop.address)} target="_blank" rel="noreferrer" className={styles.mobileAction}>
              <i className="bi bi-sign-turn-right" aria-hidden="true" />
              <span>Chỉ đường</span>
            </a>
          )}
        </nav>
      )}

      <nav className={pageStyles.mobileNav} aria-label="Điều hướng nhanh">
        {NAV.map((item) => {
          const isActive = item.key === 'shops';
          return (
            <a key={item.key} href={item.href} className={`${pageStyles.mItem} ${isActive ? pageStyles.mOn : ''}`} aria-current={isActive ? 'page' : undefined}>
              <i className={`bi bi-${isActive && item.iconActive ? item.iconActive : item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
