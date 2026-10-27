import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  Notice,
  Photo,
  StatusBadge,
  SkeletonCard,
  mapsSearchUrl,
} from '../components';
import FeedTopbar from '../components/FeedTopbar/FeedTopbar';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import shopService from '../services/shop.service';
import { formatPrice } from '../utils/format';
import { getHoursForDay, getTodayHours, todayDayOfWeek } from '../utils/time';
import styles from './ShopDetailPage.module.css';

const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function ShopDetailPage({ shopId, user, accountMenu = [] }) {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [shop, setShop] = useState(null);
  const [menu, setMenu] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [scheduleDay, setScheduleDay] = useState(null);
  const [activeCategory, setActiveCategory] = useState('*');
  const [reloadKey, setReloadKey] = useState(0);

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
    setScheduleDay(null);
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
  const activeDay = scheduleDay ?? todayDayOfWeek();
  const dayInfo = getHoursForDay(schedule, activeDay);
  const { hoursText } = getTodayHours(schedule);
  const dishCount = shop?.dishCount ?? menu.length;

  const goTo = (url) => window.location.assign(url);

  return (
    <MemberLayout
      activeKey="shops"
      user={user}
      accountMenu={accountMenu}
      renderTopbar={({ openMenu }) => <FeedTopbar hideSearch onOpenMenu={openMenu} />}
    >
      <main className={styles.content} aria-labelledby="shop-detail-title">
          <div className={styles.headerRow}>
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
                              <li key={item.id} className={`${styles.dishCard} ${item.isAvailable === false ? styles.unavailable : ''} ${item.imageUrl ? '' : styles.dishCardNoPhoto}`}>
                                {item.imageUrl && (
                                  <Photo src={item.imageUrl} alt={item.name} ratio="1/1" shape="leaf" className={styles.dishPhoto} />
                                )}
                                <div className={styles.dishBody}>
                                  <div className={styles.dishNameRow}>
                                    {/* Lam's code: Tên hiển thị của món tại quán (shop_dish.display_name) — chữ thường, không phải liên kết. */}
                                    <span className={styles.dishName}>{item.name}</span>
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
                    </dl>
                    {/* Lam's code: Lịch mở cửa — bấm từng thứ để xem giờ, mặc định thứ của hôm nay. */}
                    <div className={styles.scheduleBlock}>
                      <p className={styles.scheduleTitle}><i className="bi bi-calendar-week" aria-hidden="true" /> Lịch mở cửa</p>
                      <div className={styles.scheduleDays} role="group" aria-label="Chọn thứ trong tuần">
                        {WEEKDAY_SHORT.map((label, index) => {
                          const day = index + 1;
                          const isOn = day === activeDay;
                          return (
                            <button
                              key={day}
                              type="button"
                              className={`${styles.scheduleDay} ${isOn ? styles.scheduleDayOn : ''}`}
                              aria-pressed={isOn}
                              onClick={() => setScheduleDay(day)}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <p className={styles.scheduleHours}>{dayInfo.hoursText}</p>
                    </div>
                    <dl className={styles.infoList}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}><i className="bi bi-telephone" aria-hidden="true" /></span>
                        <div><dt>Điện thoại</dt><dd>{shop.phone || 'Chưa cập nhật'}</dd></div>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoIcon}><i className="bi bi-journal-text" aria-hidden="true" /></span>
                        <div><dt>Thực đơn</dt><dd>{dishCount} món trong thực đơn</dd></div>
                      </div>
                    </dl>
                    {shop.address && (
                      <div className={styles.infoActions}>
                        <Button as="a" variant="primary" icon="sign-turn-right-fill" href={mapsSearchUrl(shop.address)} target="_blank" rel="noreferrer" className={styles.singleAction}>Chỉ đường</Button>
                      </div>
                    )}
                  </section>
                  {shop.address && (
                    <section className={styles.mapCard} aria-label={`Bản đồ đường tới ${shop.name}`}>
                      <iframe
                        className={styles.mapFrame}
                        title={`Bản đồ đường tới ${shop.name}`}
                        src={`https://www.google.com/maps?q=${encodeURIComponent(shop.address)}&output=embed`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </section>
                  )}
                  <p className={styles.infoNote}>Lịch mở cửa hiển thị theo dữ liệu quán cập nhật — bản đồ chỉ đường ở ngay bên dưới.</p>
                </aside>
              </div>
            </>
          )}
      </main>
    </MemberLayout>
  );
}
