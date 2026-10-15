import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  Notice,
  Photo,
  StatusBadge,
  SkeletonCard,
  mapsSearchUrl,
} from '../components';
import FeedSidebar from '../components/FeedSidebar/FeedSidebar';
import shopService from '../services/shop.service';
import { formatPrice } from '../utils/format';
import { getTodayHours } from '../utils/time';
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
  const [schedule, setSchedule] = useState([]);
  const [activeCategory, setActiveCategory] = useState('*');
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
      setSchedule([]);
      return undefined;
    }

    let ignore = false;
    setStatus('loading');
    setError('');
    setShop(null);
    setMenu([]);
    setSchedule([]);
    setActiveCategory('*');

    (async () => {
      try {
        const res = await shopService.getShop(shopId);
        if (ignore) return;
        setShop(res?.shop ?? null);
        setMenu(res?.menu ?? []);
        setSchedule(res?.schedule ?? []);
        setStatus('ready');
      } catch (err) {
        if (ignore) return;
        if (err?.status === 404) {
          setStatus('not-found');
          setShop(null);
          setMenu([]);
          setSchedule([]);
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

  const visibleGroups = activeCategory === '*'
    ? groupedMenu
    : groupedMenu.filter(([category]) => category === activeCategory);
  const { dayLabel, hoursText } = getTodayHours(schedule);
  const dishCount = shop?.dishCount ?? menu.length;

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
            <IconButton
              icon="list"
              label="Mở menu quán chay"
              className={styles.mobileMenuButton}
              onClick={() => setDrawerOpen(true)}
            />
            <a href="/shops" className={styles.backLink}>← Quán chay</a>
            <span className={styles.breadcrumbSlash} aria-hidden="true">/</span>
            <span className={styles.breadcrumbName}>{shop?.name || 'Chi tiết quán'}</span>
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
              {/* Lam's code: Hero hiển thị nhận diện quán và giờ của ngày hiện tại. */}
              <section className={styles.hero} aria-labelledby="shop-detail-title">
                <Photo src={shop.imageUrl} alt={shop.name} className={styles.heroImg} />
                <div className={styles.heroOverlay} aria-hidden="true" />
                {shop.operatingStatus === 'inactive' && (
                  <span className={styles.inactiveNotice}>Tạm ngưng hoạt động</span>
                )}
                <div className={styles.heroBody}>
                  <div className={styles.heroTags}>
                    <StatusBadge entity="shop" status="verified" />
                    <Chip icon="flower1">Quán chay</Chip>
                  </div>
                  <h1 id="shop-detail-title" className={styles.heroTitle}>{shop.name}</h1>
                  <div className={styles.heroMeta}>
                    <span><i className="bi bi-geo-alt-fill" aria-hidden="true" />{shop.address || 'Chưa cập nhật địa chỉ'}</span>
                    <span><i className="bi bi-clock-fill" aria-hidden="true" />Hôm nay: {hoursText}</span>
                    <span><i className="bi bi-egg-fried" aria-hidden="true" />{dishCount} món</span>
                  </div>
                </div>
              </section>

              <div className={styles.detailColumns}>
                <section className={styles.menuSection} aria-labelledby="menu-title">
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 id="menu-title" className={styles.sectionTitle}>Thực đơn</h2>
                      <p className={styles.sectionSummary}>{dishCount} món · {groupedMenu.length} nhóm</p>
                    </div>
                  </div>

                  {groupedMenu.length > 0 && (
                    <div className={styles.filterBar} aria-label="Lọc thực đơn theo nhóm">
                      <Chip selected={activeCategory === '*'} onClick={() => setActiveCategory('*')}>Tất cả</Chip>
                      {groupedMenu.map(([category]) => (
                        <Chip key={category} selected={activeCategory === category} onClick={() => setActiveCategory(category)}>
                          {category}
                        </Chip>
                      ))}
                    </div>
                  )}

                  {groupedMenu.length === 0 ? (
                    <EmptyState icon="card-list" title="Quán chưa cập nhật menu" />
                  ) : (
                    <div className={styles.menuGroups}>
                      {visibleGroups.map(([category, items]) => (
                        <div key={category} className={styles.group}>
                          <h3 className={styles.groupTitle}>{category}<span>{items.length} món</span></h3>
                          <ul className={styles.menuList}>
                            {items.map((item) => (
                              <li key={item.id} className={`${styles.dishCard} ${item.isAvailable === false ? styles.unavailable : ''}`}>
                                <Photo src={item.imageUrl} alt={item.name} ratio="1/1" shape="leaf" className={styles.dishPhoto} />
                                <div className={styles.dishBody}>
                                  <div className={styles.dishNameRow}>
                                    {/* Lam's code: Liên kết chi tiết món chờ trang M-13. */}
                                    <a href="#" className={styles.dishName}>{item.name}</a>
                                    {item.isAvailable === false && <StatusBadge entity="shopDish" status="unavailable" size="sm" />}
                                  </div>
                                  {item.ingredientNote && <p className={styles.dishNote}>{item.ingredientNote}</p>}
                                  <strong className={styles.dishPrice}>{formatPrice(item.price)}</strong>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <aside className={styles.shopAside} aria-labelledby="shop-info-title">
                  <section className={styles.infoCard}>
                    <h2 id="shop-info-title" className={styles.infoTitle}>Thông tin quán</h2>
                    <dl className={styles.infoList}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}><i className="bi bi-geo-alt" aria-hidden="true" /></span>
                        <div><dt>Địa chỉ</dt><dd>{shop.address || 'Chưa cập nhật'}</dd></div>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}><i className="bi bi-clock" aria-hidden="true" /></span>
                        <div><dt>Giờ mở cửa</dt><dd>{dayLabel}: {hoursText}</dd></div>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}><i className="bi bi-telephone" aria-hidden="true" /></span>
                        <div><dt>Điện thoại</dt><dd>{shop.phone || 'Chưa cập nhật'}</dd></div>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}><i className="bi bi-journal-text" aria-hidden="true" /></span>
                        <div><dt>Thực đơn</dt><dd>{dishCount} món trong thực đơn</dd></div>
                      </div>
                    </dl>
                    {(shop.phone || shop.address) && (
                      <div className={`${styles.infoActions} ${!shop.phone || !shop.address ? styles.singleAction : ''}`}>
                        {shop.phone && <Button as="a" variant="outline" icon="telephone-fill" href={`tel:${shop.phone.replace(/\s+/g, '')}`}>Gọi điện</Button>}
                        {shop.address && <Button as="a" variant="primary" icon="sign-turn-right-fill" href={mapsSearchUrl(shop.address)} target="_blank" rel="noreferrer">Chỉ đường</Button>}
                      </div>
                    )}
                  </section>
                  <p className={styles.infoNote}>Giờ mở cửa hiển thị theo dữ liệu quán cập nhật — bản đồ &amp; giờ chi tiết mở qua Chỉ đường.</p>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>

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
