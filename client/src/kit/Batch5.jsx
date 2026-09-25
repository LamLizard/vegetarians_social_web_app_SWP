import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdminLayout, AiProgress, AiTip, AppShell, Button, CalorieSummary, ChatBubble, ChatComposer, ChatThread,
  ConfirmDialog, DataTable, DayTabs, DishCard, EmptyState, Checkbox, HighlightChip, LoginPrompt, MealCard, Modal,
  Notice, NotificationList, PageHeader, Pagination, PromptChip, SearchInput, StatCard, StatusBadge, Tabs, TextField,
  useToast, AI_DISCLAIMER, AI_NAME, BMI_CATEGORY, GUEST_LIMIT, HEALTH_GOAL, MEAL_PLAN_STEPS, REPORT_REASON,
  calcHealth, formatNumber, timeAgo,
} from '../components';
import Section, { DemoLabel } from './Section';
import { wait } from './mock';
import styles from './kit.module.css';

// ---------------- Dữ liệu mẫu ----------------
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const ME = { name: 'Lâm Anh Khôi' };
const ADMIN = { name: 'Nguyễn Hoàng Tùng' };

const BOT_REPLY = `Đậu hũ là nguồn **đạm thực vật** rất tốt. 100g đậu hũ có khoảng 8g đạm và 76 kcal.

Bạn có thể thay thịt bằng:
- Đậu hũ ép, chiên vàng rồi kho
- Nấm đùi gà xé sợi
- Tàu hũ ky cuộn

Nếu muốn tăng cơ, nên ăn thêm đậu gà hoặc đậu lăng trong bữa trưa.`;

const NOTIFS = [
  { id: 1, type: 'post_approved', title: 'Bài "Bún riêu chay nấm rơm" đã được duyệt', createdAt: ago(8), isRead: false, href: '#5-10' },
  { id: 2, type: 'shop_verified', title: 'Quán Chay Bình An đã được xác minh', content: 'Quán đã hiện công khai trong danh sách quán.', createdAt: ago(60 * 3), isRead: false, href: '#5-10' },
  { id: 3, type: 'post_hidden', title: 'Bài "Mẹo làm nước tương" bị ẩn', content: 'Lý do: có link quảng cáo. Bạn có thể sửa và gửi lại.', createdAt: ago(60 * 26), isRead: true, href: '#5-10' },
  { id: 4, type: 'report_result', title: 'Báo cáo của bạn đã được xử lý', createdAt: ago(60 * 24 * 3), isRead: true },
];

const NAV = [
  { key: 'feed', label: 'Bảng tin', icon: 'house-door', iconActive: 'house-door-fill', href: '#5-12' },
  { key: 'dishes', label: 'Món ăn', icon: 'journal-richtext', href: '#5-12' },
  { key: 'assistant', label: 'Mầm AI', icon: 'flower1', href: '#5-12' },
  { key: 'plan', label: 'Thực đơn', icon: 'calendar-week', iconActive: 'calendar-week-fill', href: '#5-12', badge: 1 },
  { key: 'shops', label: 'Quán chay', icon: 'shop', iconActive: 'shop-window', href: '#5-12' },
];

// Thực đơn mẫu 3 ngày × 3 bữa (meal_plan_item)
const PLAN_ITEMS = [
  { id: 1, day: 1, slot: 'breakfast', dishName: 'Bánh mì chay đậu hũ sả', calories: 420, nutritionGroup: 'carb', description: 'Nhanh gọn buổi sáng, đủ tinh bột cho cả buổi làm việc.' },
  { id: 2, day: 1, slot: 'lunch', dishName: 'Cơm gạo lứt, đậu hũ kho nấm đông cô', calories: 650, nutritionGroup: 'protein', description: 'Bữa chính giàu đạm thực vật, hợp mục tiêu tăng cơ.' },
  { id: 3, day: 1, slot: 'dinner', dishName: 'Canh bí đỏ đậu xanh & rau luộc', calories: 480, nutritionGroup: 'vegetable', description: 'Nhẹ bụng buổi tối, nhiều chất xơ.' },
  { id: 4, day: 2, slot: 'breakfast', dishName: 'Cháo yến mạch hạt sen', calories: 380, nutritionGroup: 'carb' },
  { id: 5, day: 2, slot: 'lunch', dishName: 'Bún xào rau củ đậu phộng', calories: 700, nutritionGroup: 'fat', warning: 'Có đậu phộng, bạn đã khai báo dị ứng. Hãy đổi món khác.' },
  { id: 6, day: 2, slot: 'snack', dishName: 'Sữa đậu nành & chuối', calories: 300, nutritionGroup: 'fruit', description: 'Bữa phụ thay bữa tối nhẹ.' },
  { id: 7, day: 3, slot: 'breakfast', dishName: 'Xôi đậu xanh', calories: 450, nutritionGroup: 'carb' },
  { id: 8, day: 3, slot: 'lunch', dishName: 'Bún riêu chay', calories: 560, nutritionGroup: 'protein' },
  { id: 9, day: 3, slot: 'dinner', dishName: 'Gỏi cuốn chay', calories: 420, nutritionGroup: 'vegetable' },
];
const SWAP_OPTIONS = [
  { id: 21, name: 'Bún riêu chay', categories: [{ id: 1, name: 'Món nước' }], recipeCount: 12, calories: 560, nutritionGroup: 'protein' },
  { id: 22, name: 'Cơm chiên hạt sen', categories: [{ id: 9, name: 'Cơm' }], recipeCount: 4, calories: 610, nutritionGroup: 'carb' },
  { id: 23, name: 'Mì xào nấm bào ngư', categories: [{ id: 3, name: 'Món xào' }], recipeCount: 7, calories: 640, nutritionGroup: 'vegetable' },
];

// ---------------- 5-14: Trang mẫu Chatbot (M-12) ----------------
const PROMPTS = [
  { icon: 'egg', text: 'Ăn chay lấy đạm từ đâu?' },
  { icon: 'arrow-left-right', text: 'Thay nước mắm bằng gì?' },
  { icon: 'fire', text: 'Bún riêu chay bao nhiêu calo?' },
  { icon: 'heart-pulse', text: 'Ăn chay có thiếu B12 không?' },
];

function ChatPage() {
  const [member, setMember] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [used, setUsed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const idRef = useRef(1);
  const quota = member ? undefined : { used, limit: GUEST_LIMIT.chatTurnsPerDay };
  const out = quota && used >= quota.limit;

  const ask = async (text) => {
    const id = idRef.current++;
    const now = new Date().toISOString();
    if (/xxx|chửi/i.test(text)) {
      setMsgs((m) => [...m, { id, sender: 'user', content: text, time: now, status: 'filtered' }]);
      return;
    }
    setMsgs((m) => [...m, { id, sender: 'user', content: text, time: now }, { id: `t${id}`, sender: 'bot', typing: true }]);
    setBusy(true);
    await wait(1400);
    setBusy(false);
    if (/lỗi/i.test(text)) {
      setMsgs((m) => m.filter((x) => x.id !== `t${id}`).concat({ id: `b${id}`, sender: 'bot', status: 'error', content: '', time: new Date().toISOString(), retryOf: text }));
      return; // lỗi không trừ lượt (FR-15)
    }
    if (!member) setUsed((u) => u + 1);
    setMsgs((m) => m.filter((x) => x.id !== `t${id}`).concat({
      id: `b${id}`, sender: 'bot', content: BOT_REPLY, time: new Date().toISOString(),
      refPost: /đạm|đậu/i.test(text) ? { title: '5 món đậu hũ giàu đạm cho người mới ăn chay', href: '#5-14' } : undefined,
    }));
  };

  return (
    <div className={styles.stackSm}>
      <div className={styles.row}>
        <Button size="sm" variant={member ? 'primary' : 'outline'} icon={member ? 'person-check' : 'person'} onClick={() => { setMember((v) => !v); setUsed(1); }}>
          {member ? 'Đang xem với vai: Thành viên' : 'Đang xem với vai: Khách (3 lượt/ngày)'}
        </Button>
        <Button size="sm" variant="subtle" icon="arrow-counterclockwise" onClick={() => { setMsgs([]); setUsed(1); }}>Làm lại</Button>
      </div>
      <div className={styles.chatFrame}>
        <div className={styles.chatHead}>
          <span className={styles.chatMark} aria-hidden="true"><i className="bi bi-flower1" /></span>
          <div><b>{AI_NAME}</b><small>Trợ lý dinh dưỡng chay</small></div>
        </div>
        <ChatThread
          className={styles.chatBody}
          empty={(
            <div className={styles.chatEmpty}>
              <span className={styles.chatMarkLg} aria-hidden="true"><i className="bi bi-flower1" /></span>
              <h4>Chào bạn, mình là {AI_NAME}</h4>
              <p>Hỏi mình về món chay, cách thay nguyên liệu, calo hay dinh dưỡng nhé.</p>
              <div className={styles.promptGrid}>
                {PROMPTS.map((p) => <PromptChip key={p.text} icon={p.icon} block disabled={busy || out} onClick={() => ask(p.text)}>{p.text}</PromptChip>)}
              </div>
            </div>
          )}
        >
          {msgs.map((m) => (
            <ChatBubble key={m.id} {...m} onRetry={m.retryOf ? () => { setMsgs((l) => l.filter((x) => x.id !== m.id)); ask(m.retryOf.replace(/lỗi/gi, '')); } : undefined} />
          ))}
        </ChatThread>
        <div className={styles.chatFoot}>
          <ChatComposer onSend={ask} busy={busy} quota={quota} onRequireLogin={() => setLogin(true)} />
        </div>
      </div>
      <LoginPrompt open={login} reason="chat" onLogin={() => { setLogin(false); setMember(true); }} onRegister={() => setLogin(false)} onClose={() => setLogin(false)} />
    </div>
  );
}

// ---------------- 5-15: Trang mẫu Meal Plan (M-11) ----------------
function MealPlanPage() {
  const toast = useToast();
  const [phase, setPhase] = useState('idle'); // idle · loading · error · done
  const [step, setStep] = useState(0);
  const [items, setItems] = useState(PLAN_ITEMS);
  const [day, setDay] = useState(1);
  const [swapFor, setSwapFor] = useState(null);
  const [status, setStatus] = useState('draft');
  const [failNext, setFailNext] = useState(false);
  const health = calcHealth({ gender: 'female', age: 20, heightCm: 158, weightKg: 50, activityLevel: 'light', goal: 'maintain' });
  const target = health.targetCalories;

  useEffect(() => {
    if (phase !== 'loading') return undefined;
    if (step >= MEAL_PLAN_STEPS.length) { setPhase('done'); return undefined; }
    const t = setTimeout(() => {
      if (failNext && step === 2) { setPhase('error'); setFailNext(false); return; }
      setStep((s) => s + 1);
    }, 700);
    return () => clearTimeout(t);
  }, [phase, step, failNext]);

  const start = () => { setStep(0); setPhase('loading'); setItems(PLAN_ITEMS); setStatus('draft'); setDay(1); };
  const dayItems = items.filter((i) => i.day === day);
  const total = dayItems.reduce((s, i) => s + (i.calories ?? 0), 0);
  const warnDays = [...new Set(items.filter((i) => i.warning).map((i) => i.day))];

  const swap = (dish) => {
    setItems((list) => list.map((i) => (i.id === swapFor.id
      ? { ...i, dishName: dish.name, calories: dish.calories, nutritionGroup: dish.nutritionGroup, warning: undefined, isSwapped: true, originalDishName: i.originalDishName ?? i.dishName, description: undefined }
      : i)));
    setSwapFor(null);
    toast(`Đã đổi sang ${dish.name}`);
  };

  if (phase === 'idle') {
    return (
      <div className={styles.stackSm}>
        <Notice title="Form nhập thông tin (M-10) đã có ở mục 2-14">Ở đây bắt đầu từ lúc bấm "Tạo thực đơn".</Notice>
        <div className={styles.row}>
          <Button icon="stars" onClick={start}>Tạo thực đơn 3 ngày</Button>
          <Checkbox checked={failNext} onChange={setFailNext}>Giả lập AI lỗi ở bước 3</Checkbox>
        </div>
      </div>
    );
  }
  if (phase === 'loading' || phase === 'error') {
    return (
      <AiProgress
        current={step}
        error={phase === 'error' ? `${AI_NAME} trả kết quả sai định dạng. Lượt tạo này không bị tính, bạn thử lại nhé.` : undefined}
        onRetry={start}
        onCancel={() => setPhase('idle')}
      />
    );
  }

  return (
    <div className={styles.stackSm}>
      <PageHeader
        title="Thực đơn 3 ngày của bạn"
        description={<>Mục tiêu {HEALTH_GOAL.maintain.toLowerCase()} · tránh đậu phộng · 3 bữa mỗi ngày</>}
        actions={(
          <>
            <StatusBadge entity="mealPlan" status={status} />
            <Button variant="outline" icon="arrow-clockwise" onClick={start}>Tạo lại</Button>
            <Button icon="bookmark-check" disabled={status === 'saved' || warnDays.length > 0}
              onClick={() => { setStatus('saved'); toast('Đã lưu thực đơn'); }}>Lưu thực đơn</Button>
          </>
        )}
      />
      <div className={styles.grid3}>
        <StatCard label="BMI" value={health.bmi} icon="person" hint={BMI_CATEGORY[health.bmiCategory]} />
        <StatCard label="TDEE" value={health.tdee} unit="kcal" icon="activity" hint="Năng lượng tiêu hao mỗi ngày" />
        <StatCard label="Calo mục tiêu" value={target} unit="kcal" icon="bullseye" hint="Bằng TDEE (giữ cân)" />
      </div>
      {warnDays.length > 0 && (
        <Notice tone="alert" title="Có món chưa phù hợp với dị ứng của bạn">
          Ngày {warnDays.join(', ')} có món cần đổi. Đổi xong mới lưu được thực đơn (BR-02).
        </Notice>
      )}
      <DayTabs daysCount={3} value={day} onChange={setDay} warnDays={warnDays} todayNo={1}
        renderSub={(n) => `${formatNumber(items.filter((i) => i.day === n).reduce((s, i) => s + (i.calories ?? 0), 0))} kcal`} />
      <CalorieSummary total={total} target={target} bySlot={dayItems.map((i) => ({ slot: i.slot, kcal: i.calories }))} />
      <div className={styles.grid3}>
        {dayItems.map((i) => (
          <MealCard key={i.id} {...i} dishHref="#4-08" onSwap={status === 'saved' ? undefined : () => setSwapFor(i)} />
        ))}
      </div>
      <p className="small text-body-secondary mb-0"><i className="bi bi-info-circle" aria-hidden="true" /> {AI_DISCLAIMER}</p>

      <Modal open={!!swapFor} onClose={() => setSwapFor(null)} title="Đổi món" description={swapFor && `Thay cho "${swapFor.dishName}". Chỉ hiện món đã duyệt và không chứa thứ bạn dị ứng.`}>
        <div className={styles.stackSm}>
          <SearchInput placeholder="Tìm món khác..." onSearch={() => {}} />
          {SWAP_OPTIONS.map((d) => (
            <DishCard key={d.id} layout="row" {...d} href="#4-08"
              action={<Button size="sm" variant="outline" onClick={() => swap(d)}>Chọn</Button>} />
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ---------------- 5-16: Trang mẫu Admin (M-14, M-15, M-16) ----------------
const QUEUE = {
  post: [
    { id: 101, title: 'Salad đậu gà rang sốt mè', author: 'Lâm Anh Khôi', type: 'Blog', createdAt: ago(35) },
    { id: 102, title: 'Cách làm chả lụa chay dai giòn', author: 'Mai Khương Duy', type: 'Video', createdAt: ago(90) },
    { id: 103, title: 'Review quán chay mới mở Quận 3', author: 'Lê Minh Thắng', type: 'Video', createdAt: ago(60 * 5) },
  ],
  dish: [{ id: 201, title: 'Bánh xèo chay nấm mỡ', author: 'Dương Vĩ Lâm', type: 'Bánh', createdAt: ago(60 * 2) }],
  shop: [{ id: 301, title: 'Chay Bình An', author: 'Lâm Anh Khôi', type: '12 Phan Xích Long, Phú Nhuận', createdAt: ago(60 * 7) }],
  report: [
    { id: 401, title: 'Bình luận: "Mua hàng ở link này..."', author: 'Mai Khương Duy', type: REPORT_REASON.spam, createdAt: ago(20) },
    { id: 402, title: 'Công thức: Bún riêu chay 30 phút', author: 'Dương Vĩ Lâm', type: REPORT_REASON.not_vegan, createdAt: ago(60 * 9) },
  ],
};
const QUEUE_TABS = [
  { key: 'post', label: 'Bài đăng', icon: 'journal-text', entity: 'post', approve: 'Duyệt', reject: 'Từ chối' },
  { key: 'dish', label: 'Món ăn', icon: 'egg-fried', entity: 'dish', approve: 'Duyệt', reject: 'Từ chối' },
  { key: 'shop', label: 'Quán', icon: 'shop', entity: 'shop', approve: 'Xác minh', reject: 'Từ chối' },
  { key: 'report', label: 'Báo cáo', icon: 'flag', entity: 'report', approve: 'Chấp nhận', reject: 'Bác bỏ' },
];
const CATEGORIES = [
  { id: 1, name: 'Món nước', postCount: 42, dishCount: 18, active: true },
  { id: 2, name: 'Món xào', postCount: 25, dishCount: 11, active: true },
  { id: 3, name: 'Chay miền Trung', postCount: 9, dishCount: 4, active: true },
  { id: 4, name: 'Đồ uống', postCount: 0, dishCount: 0, active: false },
];

function AdminDemo() {
  const toast = useToast();
  const [page, setPage] = useState('dashboard');
  const [tab, setTab] = useState('post');
  const [queue, setQueue] = useState(QUEUE);
  const [selected, setSelected] = useState([]);
  const [confirm, setConfirm] = useState(null); // { kind: 'approve'|'reject', ids }
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [cats, setCats] = useState(CATEGORIES);
  const [catForm, setCatForm] = useState(null);
  const [delCat, setDelCat] = useState(null);
  const tabInfo = QUEUE_TABS.find((t) => t.key === tab);
  const counts = Object.fromEntries(Object.entries(queue).map(([k, v]) => [k, v.length]));
  const totalPending = Object.values(counts).reduce((a, b) => a + b, 0);

  const rows = [...queue[tab]].sort((a, b) => {
    const d = sort.key === 'title' ? a.title.localeCompare(b.title, 'vi') : new Date(a.createdAt) - new Date(b.createdAt);
    return sort.dir === 'asc' ? d : -d;
  });

  const doConfirm = async (reason) => {
    setBusy(true);
    await wait(600);
    setQueue((q) => ({ ...q, [tab]: q[tab].filter((r) => !confirm.ids.includes(r.id)) }));
    setSelected((s) => s.filter((id) => !confirm.ids.includes(id)));
    setBusy(false);
    toast(`${confirm.kind === 'approve' ? tabInfo.approve : tabInfo.reject} ${confirm.ids.length} mục${reason ? `, lý do: ${reason}` : ''}`);
    setConfirm(null);
  };

  const go = (key) => { setPage('moderation'); setTab(key); setSelected([]); };
  const nav = [
    { key: 'dashboard', label: 'Tổng quan', icon: 'speedometer2', href: '#5-16' },
    { key: 'moderation', label: 'Kiểm duyệt', icon: 'clipboard2-check', href: '#5-16', badge: totalPending },
    { key: 'categories', label: 'Danh mục', icon: 'tags', href: '#5-16', count: cats.length },
    { key: 'accounts', label: 'Tài khoản', icon: 'people', href: '#5-16', count: 128 },
    { divider: true },
    { key: 'site', label: 'Xem trang người dùng', icon: 'box-arrow-up-right', href: '#5-12' },
  ];
  const AdminLink = useMemo(() => function AdminLink({ to, onClick, ...rest }) {
    return <a href={to} {...rest} onClick={(e) => { e.preventDefault(); onClick?.(e); const k = to.replace('#admin-', ''); if (k !== 'site') setPage(k); }} />;
  }, []);

  return (
    <div className={styles.shellFrame}>
      <AdminLayout
        contained
        nav={nav.map((n) => (n.divider ? n : { ...n, href: `#admin-${n.key}` }))}
        activeKey={page}
        linkAs={AdminLink}
        title={nav.find((n) => n.key === page)?.label}
        user={ADMIN}
        accountMenu={[{ icon: 'house-door', label: 'Về bảng tin' }, { divider: true }, { icon: 'box-arrow-right', label: 'Đăng xuất', tone: 'alert' }]}
      >
        {page === 'dashboard' && (
          <>
            <PageHeader title="Tổng quan" description="Việc cần xử lý hôm nay. Bấm vào ô để mở đúng hàng chờ." />
            <div className={styles.grid4}>
              <StatCard label="Bài chờ duyệt" value={counts.post} icon="journal-text" tone={counts.post ? 'warn' : 'ok'} onClick={() => go('post')} hint="Post pending" />
              <StatCard label="Món chờ duyệt" value={counts.dish} icon="egg-fried" tone={counts.dish ? 'warn' : 'ok'} onClick={() => go('dish')} hint="Dish pending" />
              <StatCard label="Quán chờ xác minh" value={counts.shop} icon="shop" tone={counts.shop ? 'warn' : 'ok'} onClick={() => go('shop')} hint="Shop pending" />
              <StatCard label="Báo cáo chờ xử lý" value={counts.report} icon="flag" tone={counts.report ? 'warn' : 'ok'} onClick={() => go('report')} hint="Report pending" />
            </div>
            <h3 className={styles.subTitle}>Thao tác gần đây (AdminLog)</h3>
            <DataTable
              caption="Nhật ký thao tác quản trị"
              rowKey="id"
              columns={[
                { key: 'action', header: 'Thao tác', primary: true },
                { key: 'target', header: 'Đối tượng' },
                { key: 'admin', header: 'Người làm', hideOnMobile: true },
                { key: 'at', header: 'Lúc', render: (r) => timeAgo(r.at), align: 'right' },
              ]}
              rows={[
                { id: 1, action: 'Duyệt bài', target: 'Bún riêu chay nấm rơm', admin: ADMIN.name, at: ago(12) },
                { id: 2, action: 'Khoá tài khoản', target: 'spam_shop_99', admin: ADMIN.name, at: ago(60 * 4) },
                { id: 3, action: 'Tắt danh mục', target: 'Đồ uống', admin: ADMIN.name, at: ago(60 * 26) },
              ]}
            />
          </>
        )}

        {page === 'moderation' && (
          <>
            <PageHeader title="Kiểm duyệt" description="Duyệt bài, món, xác minh quán và xử lý báo cáo. Mọi thao tác được ghi AdminLog." />
            <Tabs
              label="Loại nội dung"
              value={tab}
              onChange={(k) => { setTab(k); setSelected([]); }}
              items={QUEUE_TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon, count: counts[t.key] }))}
            />
            <div className={styles.toolbar}>
              <SearchInput placeholder="Tìm theo tiêu đề, người gửi..." onSearch={() => {}} />
            </div>
            <DataTable
              caption={`Hàng chờ ${tabInfo.label.toLowerCase()}`}
              columns={[
                { key: 'title', header: tab === 'report' ? 'Nội dung bị báo cáo' : 'Tiêu đề', primary: true, sortable: true },
                { key: 'type', header: tab === 'report' ? 'Lý do' : tab === 'shop' ? 'Địa chỉ' : 'Loại' },
                { key: 'author', header: tab === 'report' ? 'Người bị báo cáo' : 'Người gửi', hideOnMobile: true },
                { key: 'createdAt', header: 'Gửi lúc', sortable: true, render: (r) => timeAgo(r.createdAt) },
                { key: 'status', header: 'Trạng thái', render: () => <StatusBadge entity={tabInfo.entity} status="pending" size="sm" /> },
                {
                  key: 'actions', header: '', align: 'right', render: (r) => (
                    <>
                      <Button size="sm" variant="subtle" icon="x-lg" onClick={() => setConfirm({ kind: 'reject', ids: [r.id] })}>{tabInfo.reject}</Button>
                      <Button size="sm" icon="check-lg" onClick={() => setConfirm({ kind: 'approve', ids: [r.id] })}>{tabInfo.approve}</Button>
                    </>
                  ),
                },
              ]}
              rows={rows}
              sort={sort}
              onSortChange={setSort}
              selectable
              selected={selected}
              onSelectionChange={setSelected}
              bulkActions={(
                <>
                  <Button size="sm" variant="subtle" onClick={() => setConfirm({ kind: 'reject', ids: selected })}>{tabInfo.reject}</Button>
                  <Button size="sm" icon="check2-all" onClick={() => setConfirm({ kind: 'approve', ids: selected })}>{tabInfo.approve} {selected.length} mục</Button>
                </>
              )}
              empty={{ icon: 'check2-circle', title: 'Đã xử lý hết', children: `Không còn ${tabInfo.label.toLowerCase()} nào chờ.` }}
              footer={rows.length > 0 && <Pagination page={1} totalPages={1} onChange={() => {}} totalItems={rows.length} pageSize={20} itemLabel="mục" />}
            />
            <ConfirmDialog
              open={!!confirm}
              title={confirm?.kind === 'approve' ? `${tabInfo.approve} ${confirm?.ids.length} mục?` : `${tabInfo.reject} ${confirm?.ids.length} mục?`}
              message={confirm?.kind === 'approve'
                ? 'Nội dung sẽ hiện công khai và người gửi nhận được thông báo.'
                : 'Người gửi sẽ nhận thông báo kèm lý do bạn ghi dưới đây.'}
              confirmLabel={confirm?.kind === 'approve' ? tabInfo.approve : tabInfo.reject}
              tone={confirm?.kind === 'approve' ? 'primary' : 'alert'}
              reason={confirm?.kind === 'reject' ? { label: 'Lý do (gửi cho người dùng)', required: true } : false}
              loading={busy}
              onConfirm={doConfirm}
              onCancel={() => setConfirm(null)}
            />
          </>
        )}

        {page === 'categories' && (
          <>
            <PageHeader title="Danh mục" description="Một bộ danh mục dùng chung cho bài đăng và món ăn (BR-06)."
              actions={<Button icon="plus-lg" onClick={() => setCatForm({ name: '', active: true })}>Thêm danh mục</Button>} />
            <DataTable
              caption="Danh sách danh mục"
              isRowMuted={(r) => !r.active}
              columns={[
                { key: 'name', header: 'Tên danh mục', primary: true },
                { key: 'postCount', header: 'Bài đăng', align: 'right' },
                { key: 'dishCount', header: 'Món ăn', align: 'right' },
                { key: 'active', header: 'Trạng thái', render: (r) => <StatusBadge entity="category" status={r.active ? 'active' : 'inactive'} size="sm" /> },
                {
                  key: 'actions', header: '', align: 'right', render: (r) => (
                    <>
                      <Button size="sm" variant="subtle" icon="pencil" onClick={() => setCatForm(r)}>Sửa</Button>
                      <Button size="sm" variant="subtle" icon="trash3" onClick={() => setDelCat(r)}>Xoá</Button>
                    </>
                  ),
                },
              ]}
              rows={cats}
            />
            <Modal open={!!catForm} onClose={() => setCatForm(null)} title={catForm?.id ? 'Sửa danh mục' : 'Thêm danh mục'} size="sm"
              footer={(
                <>
                  <Button variant="subtle" onClick={() => setCatForm(null)}>Huỷ</Button>
                  <Button disabled={!catForm?.name?.trim()} onClick={() => {
                    setCats((l) => (catForm.id ? l.map((c) => (c.id === catForm.id ? catForm : c)) : [...l, { ...catForm, id: Date.now(), postCount: 0, dishCount: 0 }]));
                    toast('Đã lưu danh mục');
                    setCatForm(null);
                  }}>Lưu</Button>
                </>
              )}
            >
              {catForm && (
                <div className={styles.form}>
                  <TextField label="Tên danh mục" value={catForm.name} onChange={(v) => setCatForm((f) => ({ ...f, name: v }))} maxLength={120} required autoFocus />
                  <Checkbox switch checked={catForm.active} onChange={(v) => setCatForm((f) => ({ ...f, active: v }))} hint="Tắt: không chọn được khi đăng bài/tạo món, nội dung cũ vẫn giữ.">Đang dùng</Checkbox>
                </div>
              )}
            </Modal>
            <ConfirmDialog
              open={!!delCat}
              title={delCat && (delCat.postCount + delCat.dishCount > 0 ? 'Không xoá được danh mục đang dùng' : `Xoá "${delCat.name}"?`)}
              message={delCat && (delCat.postCount + delCat.dishCount > 0
                ? `"${delCat.name}" đang gắn với ${delCat.postCount} bài và ${delCat.dishCount} món. Hãy tắt danh mục thay vì xoá để không mất liên kết dữ liệu (FR-21).`
                : 'Danh mục chưa gắn với nội dung nào nên xoá an toàn.')}
              confirmLabel={delCat && (delCat.postCount + delCat.dishCount > 0 ? 'Tắt danh mục' : 'Xoá danh mục')}
              tone={delCat && delCat.postCount + delCat.dishCount > 0 ? 'primary' : 'alert'}
              onConfirm={() => {
                if (delCat.postCount + delCat.dishCount > 0) setCats((l) => l.map((c) => (c.id === delCat.id ? { ...c, active: false } : c)));
                else setCats((l) => l.filter((c) => c.id !== delCat.id));
                setDelCat(null);
              }}
              onCancel={() => setDelCat(null)}
            />
          </>
        )}

        {page === 'accounts' && (
          <>
            <PageHeader title="Tài khoản" description="Khoá hoặc mở khoá tài khoản vi phạm (FR-19)." />
            <DataTable
              caption="Danh sách tài khoản"
              isRowMuted={(r) => r.status === 'locked'}
              columns={[
                { key: 'name', header: 'Họ tên', primary: true },
                { key: 'email', header: 'Email', hideOnMobile: true },
                { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge entity="account" status={r.status} size="sm" /> },
                { key: 'actions', header: '', align: 'right', render: (r) => (r.status === 'locked'
                  ? <Button size="sm" variant="outline" icon="unlock" onClick={() => toast('Mở hộp xác nhận mở khoá', { tone: 'info' })}>Mở khoá</Button>
                  : <Button size="sm" variant="subtle" icon="lock" onClick={() => toast('Mở hộp xác nhận khoá (có ô lý do)', { tone: 'info' })}>Khoá</Button>) },
              ]}
              rows={[
                { id: 1, name: 'Lâm Anh Khôi', email: 'khoi@example.com', status: 'active' },
                { id: 2, name: 'spam_shop_99', email: 'spam99@example.com', status: 'locked' },
                { id: 3, name: 'Mai Khương Duy', email: 'duy@example.com', status: 'active' },
              ]}
            />
          </>
        )}
      </AdminLayout>
    </div>
  );
}

// ---------------- Các mục đợt 5 ----------------
export default function Batch5() {
  const toast = useToast();
  const [day, setDay] = useState(1);
  const [notifs, setNotifs] = useState(NOTIFS);
  const [tableLoading, setTableLoading] = useState(false);
  const [active, setActive] = useState('feed');
  const [guestShell, setGuestShell] = useState(false);
  const ShellLink = useMemo(() => function ShellLink({ to, ...rest }) {
    return <a href={to} {...rest} onClick={(e) => { e.preventDefault(); setActive(to.replace('#shell-', '')); }} />;
  }, []);
  const health = calcHealth({ gender: 'female', age: 21, heightCm: 158, weightKg: 52, activityLevel: 'moderate', goal: 'maintain' });

  return (
    <>
      <h2 className={styles.groupTitle}>Đợt 5 · AI, Admin, khung trang <small>16 mục</small></h2>

      <Section
        code="5-01"
        title="ChatBubble"
        file="components/ChatBubble"
        when="1 tin nhắn trong khung chat với Mầm (M-12). Khớp chat_message: sender user/bot/system, status ok/filtered/error. Tin của bot hiểu **đậm** và gạch đầu dòng, có thể gắn bài liên quan (ref_post_id)."
        props={[
          ['sender', "'user'|'bot'|'system'", "'bot'", 'chat_message.sender'],
          ['status', "'ok'|'filtered'|'error'", "'ok'", 'error → nút Thử lại, không trừ lượt'],
          ['content', 'string', '', 'chat_message.content'],
          ['time', 'ISO', '', 'Hiện "19:02"'],
          ['typing', 'boolean', 'false', 'Mầm đang trả lời'],
          ['refPost · linkAs', '{title, href}', '', 'Thẻ "Bài liên quan"'],
          ['onRetry', '() => void', '', ''],
        ]}
        usage={`{messages.map((m) => (
  <ChatBubble key={m.chat_message_id} sender={m.sender} status={m.status} content={m.content}
    time={m.created_at} refPost={m.ref_post && { title: m.ref_post.title, href: \`/posts/\${m.ref_post_id}\` }}
    linkAs={Link} onRetry={m.status === 'error' ? () => resend(m) : undefined} />
))}
{waiting && <ChatBubble sender="bot" typing />}`}
      >
        <div className={styles.chatDemo}>
          <ChatBubble sender="system">Hôm nay, 19:00</ChatBubble>
          <ChatBubble sender="user" content="Ăn chay lấy đạm từ đâu vậy Mầm?" time={ago(3)} />
          <ChatBubble sender="bot" content={BOT_REPLY} time={ago(2)} refPost={{ title: '5 món đậu hũ giàu đạm cho người mới ăn chay', href: '#5-01' }} />
          <ChatBubble sender="user" status="filtered" content="Câu hỏi có từ bị cấm" time={ago(1)} />
          <ChatBubble sender="bot" status="error" time={ago(1)} onRetry={() => toast('Gửi lại câu hỏi')} />
          <ChatBubble sender="bot" typing />
        </div>
      </Section>

      <Section
        code="5-02"
        title="ChatThread · ChatComposer"
        file="components/ChatThread · components/ChatComposer"
        when="ChatThread: khung cuộn, tự xuống cuối khi có tin mới, trống thì hiện lời chào. ChatComposer: Enter gửi, Shift + Enter xuống dòng; khách truyền quota để hiện số lượt còn lại, hết lượt thì khoá và mời đăng nhập (BR-04). Luôn có câu cảnh báo y tế (BR-02)."
        props={[
          ['ChatThread children · empty', 'ReactNode', '', ''],
          ['ChatComposer onSend', '(text) => Promise', '', 'Ném lỗi → giữ chữ'],
          ['busy', 'boolean', '', 'Đang chờ Mầm trả lời'],
          ['quota', '{used, limit}', '', 'Chỉ truyền cho khách'],
          ['onRequireLogin', '() => void', '', ''],
          ['showDisclaimer', 'boolean', 'true', 'AI_DISCLAIMER'],
        ]}
        usage={`<div className="chat-page">                 {/* flex column, cao 100% */}
  <ChatThread empty={<Greeting />}>{messages.map(...)}</ChatThread>
  <ChatComposer onSend={ask} busy={waiting}
    quota={user ? undefined : { used: quota.chat_turns, limit: GUEST_LIMIT.chatTurnsPerDay }}
    onRequireLogin={() => setLoginPrompt('chat')} />
</div>`}
      >
        <div className={styles.grid2}>
          <div className={styles.stackSm}><DemoLabel>Thành viên</DemoLabel><ChatComposer onSend={async (t) => { await wait(400); toast(`Đã gửi: ${t}`); }} /></div>
          <div className={styles.stackSm}><DemoLabel>Khách còn 1 lượt</DemoLabel><ChatComposer quota={{ used: 2, limit: 3 }} onSend={() => {}} showDisclaimer={false} /></div>
        </div>
        <div className={styles.stackSm}><DemoLabel>Khách hết lượt</DemoLabel><ChatComposer quota={{ used: 3, limit: 3 }} onRequireLogin={() => toast('Mở LoginPrompt reason="chat"', { tone: 'info' })} /></div>
      </Section>

      <Section
        code="5-03"
        title="PromptChip · AiTip"
        file="components/PromptChip · components/AiTip"
        when="PromptChip: câu hỏi gợi ý, bấm là gửi (màn chào của Chatbot, dưới AiTip). AiTip: hộp lời khuyên của Mầm đặt cạnh nội dung (Dish Detail, kết quả Meal Plan)."
        props={[
          ['PromptChip icon · block · disabled · onClick', '', '', ''],
          ['AiTip title', 'string', '"Gợi ý từ Mầm"', ''],
          ['AiTip prompts · onPrompt', 'string[] · (p) => void', '', 'Bấm → mở Chatbot với câu hỏi đó'],
        ]}
        usage={`<AiTip prompts={['Món này bao nhiêu đạm?', 'Thay nấm bằng gì?']}
  onPrompt={(q) => navigate('/assistant', { state: { ask: q } })}>
  Bún riêu chay khá nhiều tinh bột, nên ăn kèm nhiều rau sống.
</AiTip>`}
      >
        <div className={styles.grid2}>
          <div className={styles.stackSm}>
            {PROMPTS.slice(0, 3).map((p) => <PromptChip key={p.text} icon={p.icon} block onClick={() => toast(p.text)}>{p.text}</PromptChip>)}
            <PromptChip icon="lock" block disabled>Khi hết lượt thì chip bị khoá</PromptChip>
          </div>
          <AiTip prompts={['Món này bao nhiêu đạm?', 'Thay nấm bằng gì?']} onPrompt={(q) => toast(`Hỏi Mầm: ${q}`)}>
            Bún riêu chay khá nhiều tinh bột, nên ăn kèm nhiều rau sống và thêm đậu hũ để đủ đạm.
          </AiTip>
        </div>
      </Section>

      <Section
        code="5-04"
        title="AiProgress"
        file="components/AiProgress"
        when="màn chờ khi Mầm tạo thực đơn (UC-09: tạo → loading → kết quả). Hiện từng bước, lỗi thì có Thử lại (AI lỗi / sai format)."
        props={[
          ['steps', 'string[]', 'MEAL_PLAN_STEPS', ''],
          ['current', 'number', '0', 'Bước đang làm (0-based)'],
          ['title', 'string', '', ''],
          ['error', 'string', '', 'Có → hiện lỗi'],
          ['onRetry · onCancel', '() => void', '', ''],
        ]}
        usage={`{generating && <AiProgress current={step} error={error} onRetry={generate} onCancel={() => navigate(-1)} />}`}
      >
        <div className={styles.grid2}>
          <AiProgress current={2} onCancel={() => toast('Huỷ')} />
          <AiProgress current={2} error="Mầm trả kết quả sai định dạng. Lượt này không bị tính." onRetry={() => toast('Thử lại')} onCancel={() => toast('Sửa thông tin')} />
        </div>
      </Section>

      <Section
        code="5-05"
        title="StatCard"
        file="components/StatCard"
        when="ô số liệu: Admin Dashboard (việc chờ xử lý, bấm được) và chỉ số sức khoẻ ở Meal Planner. Có calcHealth() tính BMI/TDEE/calo mục tiêu theo BR-03 để xem trước."
        props={[
          ['label · value · unit', '', '', 'Số tự có dấu chấm'],
          ['icon · hint', '', '', ''],
          ['tone', "'default'|'ok'|'warn'|'bad'", "'default'", 'warn = còn việc cần làm'],
          ['href · linkAs · onClick', '', '', 'Cả ô bấm được'],
          ['loading', 'boolean', '', ''],
        ]}
        usage={`const h = calcHealth({ gender, age, heightCm, weightKg, activityLevel, goal });
<StatCard label="BMI" value={h.bmi} hint={BMI_CATEGORY[h.bmiCategory]} icon="person" />
<StatCard label="Bài chờ duyệt" value={stats.post_pending} icon="journal-text"
  tone={stats.post_pending ? 'warn' : 'ok'} href="/admin/moderation?tab=post" linkAs={Link} />`}
      >
        <div className={styles.grid4}>
          <StatCard label="BMI" value={health.bmi} icon="person" hint={BMI_CATEGORY[health.bmiCategory]} />
          <StatCard label="Calo mục tiêu" value={health.targetCalories} unit="kcal" icon="bullseye" hint={`TDEE ${formatNumber(health.tdee)} kcal`} />
          <StatCard label="Bài chờ duyệt" value={12} icon="journal-text" tone="warn" onClick={() => toast('Mở hàng chờ bài')} hint="Cũ nhất: 2 giờ trước" />
          <StatCard label="Báo cáo chờ xử lý" value={0} icon="flag" tone="ok" hint="Đã xử lý hết" />
        </div>
        <div className={styles.grid4}><StatCard label="Đang tải" loading icon="hourglass" /></div>
      </Section>

      <Section
        code="5-06"
        title="DayTabs"
        file="components/DayTabs"
        when="chọn ngày trong thực đơn (M-11). Số ngày theo meal_plan.days_count, giá trị là day_no (từ 1). Có start_date thì hiện thứ và ngày; chấm đỏ = ngày có món cần đổi."
        props={[
          ['daysCount', 'number', '7', ''],
          ['value · onChange', 'number', '1', 'day_no'],
          ['startDate', 'ISO date', '', '"T2 29/9"'],
          ['todayNo · warnDays', 'number · number[]', '', ''],
          ['renderSub', '(dayNo) => string', '', 'vd tổng kcal'],
        ]}
        usage={`<DayTabs daysCount={plan.days_count} startDate={plan.start_date} value={day} onChange={setDay}
  warnDays={daysWithAllergy} renderSub={(n) => \`\${kcalOf(n)} kcal\`} />`}
      >
        <DemoLabel>Không có ngày bắt đầu</DemoLabel>
        <DayTabs value={day} onChange={setDay} warnDays={[3]} />
        <DemoLabel>Có start_date, 5 ngày</DemoLabel>
        <DayTabs daysCount={5} startDate={new Date().toISOString()} value={Math.min(day, 5)} onChange={setDay} todayNo={1} renderSub={(n) => `${formatNumber(1500 + n * 40)} kcal`} />
      </Section>

      <Section
        code="5-07"
        title="MealCard"
        file="components/MealCard"
        when="1 bữa (meal_plan_item) trong kết quả thực đơn. Có nhóm dinh dưỡng, dấu 'Đã đổi từ …' (is_swapped), cảnh báo dị ứng và nút Đổi món. Thực đơn đã lưu thì bỏ onSwap."
        props={[
          ['slot', "'breakfast'|'lunch'|'dinner'|'snack'", '', 'meal_slot'],
          ['dishName · description · calories', '', '', 'calories_kcal'],
          ['nutritionGroup', "'protein'|'carb'|'vegetable'|'fat'|'fruit'", '', ''],
          ['imageUrl · dishHref · linkAs', '', '', 'Tới Dish Detail'],
          ['isSwapped · originalDishName', '', '', ''],
          ['warning', 'string', '', 'Vi phạm dị ứng → viền đỏ'],
          ['onSwap · swapping', '', '', ''],
        ]}
        usage={`<MealCard slot={i.meal_slot} dishName={i.dish_name} description={i.description}
  calories={i.calories_kcal} nutritionGroup={i.nutrition_group} dishHref={\`/dishes/\${i.dish_id}\`} linkAs={Link}
  isSwapped={i.is_swapped} originalDishName={i.original_dish_name}
  warning={i.allergy_warning} onSwap={plan.status === 'draft' ? () => openSwap(i) : undefined} />`}
      >
        <div className={styles.grid3}>
          <MealCard {...PLAN_ITEMS[1]} dishHref="#4-08" onSwap={() => toast('Mở hộp đổi món')} />
          <MealCard {...PLAN_ITEMS[4]} dishHref="#4-08" onSwap={() => toast('Mở hộp đổi món')} />
          <MealCard {...PLAN_ITEMS[7]} isSwapped originalDishName="Phở chay" dishHref="#4-08" />
        </div>
      </Section>

      <Section
        code="5-08"
        title="CalorieSummary"
        file="components/CalorieSummary"
        when="tổng calo 1 ngày so với calo mục tiêu. v4.0 chỉ có calo từng bữa nên KHÔNG có biểu đồ đạm/béo/carb (đã bỏ NutritionSummary, MacroProgress, MicronutrientList)."
        props={[
          ['total', 'number', '', 'Tổng calories_kcal trong ngày'],
          ['target', 'number', '', 'meal_plan.target_calories_kcal'],
          ['bySlot', '{slot, kcal}[]', '', ''],
          ['title', 'string', '', ''],
        ]}
        usage={`<CalorieSummary total={sum(dayItems)} target={plan.target_calories_kcal}
  bySlot={dayItems.map((i) => ({ slot: i.meal_slot, kcal: i.calories_kcal }))} />`}
      >
        <div className={styles.grid3}>
          <CalorieSummary total={1540} target={1800} bySlot={[{ slot: 'breakfast', kcal: 420 }, { slot: 'lunch', kcal: 650 }, { slot: 'dinner', kcal: 470 }]} />
          <CalorieSummary total={1790} target={1800} />
          <CalorieSummary total={2150} target={1800} />
        </div>
      </Section>

      <Section
        code="5-09"
        title="DataTable"
        file="components/DataTable"
        when="bảng quản trị: hàng chờ duyệt, báo cáo, tài khoản, danh mục, AdminLog. Sắp xếp do API làm (onSortChange). Chọn nhiều dòng để duyệt hàng loạt. Điện thoại tự đổi thành thẻ."
        props={[
          ['columns', '{key, header, render?, width?, align?, sortable?, primary?, hideOnMobile?}[]', '', 'key "actions" cho cột nút'],
          ['rows · rowKey', 'object[] · string|fn', "'id'", ''],
          ['sort · onSortChange', '{key, dir}', '', ''],
          ['selectable · selected · onSelectionChange · bulkActions', '', '', ''],
          ['loading · empty · caption · footer · isRowMuted', '', '', 'caption bắt buộc'],
        ]}
        usage={`<DataTable caption="Bài chờ duyệt" rows={posts} rowKey="post_id"
  columns={[
    { key: 'title', header: 'Tiêu đề', primary: true, sortable: true },
    { key: 'created_at', header: 'Gửi lúc', sortable: true, render: (r) => timeAgo(r.created_at) },
    { key: 'actions', header: '', align: 'right', render: (r) => <Button size="sm" onClick={() => approve(r)}>Duyệt</Button> },
  ]}
  sort={sort} onSortChange={setSort} loading={isLoading}
  selectable selected={ids} onSelectionChange={setIds} bulkActions={<Button size="sm">Duyệt {ids.length} mục</Button>}
  footer={<Pagination page={page} totalPages={totalPages} onChange={setPage} />} />`}
      >
        <div className={styles.row}>
          <Button size="sm" variant="outline" onClick={() => { setTableLoading(true); setTimeout(() => setTableLoading(false), 1500); }}>Xem trạng thái đang tải</Button>
        </div>
        <DataTable
          caption="Ví dụ danh sách quán"
          loading={tableLoading}
          columns={[
            { key: 'name', header: 'Tên quán', primary: true },
            { key: 'address', header: 'Địa chỉ', hideOnMobile: true },
            { key: 'status', header: 'Xác minh', render: (r) => <StatusBadge entity="shop" status={r.status} size="sm" /> },
          ]}
          rows={[
            { id: 1, name: 'Quán Chay Tâm An', address: '123 Nguyễn Trãi, Quận 5', status: 'verified' },
            { id: 2, name: 'Chay Bình An', address: '12 Phan Xích Long, Phú Nhuận', status: 'pending' },
          ]}
        />
        <DataTable caption="Bảng trống" columns={[{ key: 'name', header: 'Tên', primary: true }]} rows={[]}
          empty={{ icon: 'check2-circle', title: 'Đã xử lý hết', children: 'Không còn báo cáo nào chờ.' }} />
      </Section>

      <Section
        code="5-10"
        title="NotificationList"
        file="components/NotificationList"
        when="danh sách thông báo trong menu chuông của AppShell. Icon và màu theo notification.type (NOTIFICATION_TYPE)."
        note="4 loại post_approved, post_rejected, dish_approved, dish_rejected là GIẢ ĐỊNH theo Report v4.0, Backend cần xác nhận tên."
        props={[
          ['items', '{id, type, title, content?, createdAt, isRead, href?}[]', '', ''],
          ['onItemClick · onMarkAllRead', '', '', ''],
          ['loading · linkAs · title', '', '', ''],
        ]}
        usage={`<AppShell notificationCount={unread} renderNotifications={(close) => (
  <NotificationList items={notifications.map(toNotif)} linkAs={Link}
    onItemClick={(n) => { api.markRead(n.id); close(); }} onMarkAllRead={api.markAllRead} />
)} ... />`}
      >
        <div className={styles.grid2}>
          <div className={styles.popoverDemo}>
            <NotificationList items={notifs} onItemClick={(n) => setNotifs((l) => l.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))}
              onMarkAllRead={() => setNotifs((l) => l.map((x) => ({ ...x, isRead: true })))} />
          </div>
          <div className={styles.stackSm}>
            <div className={styles.popoverDemo}><NotificationList items={[]} /></div>
            <div className={styles.popoverDemo}><NotificationList loading /></div>
          </div>
        </div>
      </Section>

      <Section
        code="5-11"
        title="PageHeader"
        file="components/PageHeader"
        when="đầu mọi trang: đường dẫn, tiêu đề H1, mô tả, nút thao tác bên phải. Mỗi trang chỉ 1 cái."
        props={[
          ['title', 'string', '', 'Thẻ <h1>'],
          ['description', 'ReactNode', '', ''],
          ['breadcrumb', '{label, href?}[]', '', ''],
          ['actions · linkAs', '', '', ''],
        ]}
        usage={`<PageHeader title="Bài của tôi" description="Bài chờ duyệt, đã đăng và bị ẩn."
  breadcrumb={[{ label: 'Trang chủ', href: '/' }, { label: 'Bài của tôi' }]} linkAs={Link}
  actions={<Button icon="plus-lg" as={Link} to="/write/blog">Viết bài</Button>} />`}
      >
        <PageHeader title="Bài của tôi" description="Bài chờ duyệt, đã đăng, bị từ chối hoặc bị ẩn đều ở đây."
          breadcrumb={[{ label: 'Trang chủ', href: '#5-11' }, { label: 'Tài khoản', href: '#5-11' }, { label: 'Bài của tôi' }]}
          actions={<Button icon="plus-lg">Viết bài</Button>} />
      </Section>

      <Section
        code="5-12"
        title="AppShell · Logo"
        file="components/AppShell"
        when="khung mọi trang của khách và thành viên, giữ bố cục bản app-an-chay-ui_1: dock trái (máy tính), tab dưới (điện thoại), thanh trên mờ kính, cột phải từ 1280px. Không biết route: App truyền nav, activeKey, user."
        note="Trong Review Kit khung được thu vào ô cao 640px (prop contained). Thu nhỏ cửa sổ dưới 768px để thấy tab dưới."
        props={[
          ['nav · activeKey · linkAs', '{key, label, icon, iconActive?, href, badge?}[]', '', ''],
          ['user', '{name, avatarUrl?}', '', 'Không có → nút Đăng nhập / Đăng ký'],
          ['accountMenu', 'Menu items', '', 'Tự thêm nút đổi chế độ Đêm'],
          ['notificationCount · renderNotifications', '', '', ''],
          ['onCreate', '() => void', '', 'Nút Đăng bài (thường mở PostComposer)'],
          ['search · onSearchClick', '', '', ''],
          ['mobileNavKeys', 'string[]', '4 mục đầu', ''],
          ['aside · width', "ReactNode · 'feed'|'wide'|'full'", "'wide'", ''],
          ['onLogin · onRegister', '', '', ''],
        ]}
        usage={`// App.jsx (react-router)
function MemberLayout() {
  const { pathname } = useLocation();
  const user = useAuth();
  return (
    <AppShell nav={NAV} activeKey={NAV.find((n) => pathname.startsWith(n.href))?.key} linkAs={Link}
      user={user} accountMenu={accountItems} onCreate={() => setComposer(true)}
      onSearchClick={() => navigate('/search')} notificationCount={unread}
      renderNotifications={(close) => <NotificationList ... />}
      onLogin={() => navigate('/login')} onRegister={() => navigate('/register')}>
      <Outlet />
    </AppShell>
  );
}`}
      >
        <div className={styles.row}>
          <Button size="sm" variant="outline" icon={guestShell ? 'person' : 'person-check'} onClick={() => setGuestShell((v) => !v)}>
            {guestShell ? 'Đang xem với vai: Khách' : 'Đang xem với vai: Thành viên'}
          </Button>
        </div>
        <div className={styles.shellFrame}>
          <AppShell
            contained
            nav={NAV.map((n) => ({ ...n, href: `#shell-${n.key}` }))}
            activeKey={active}
            linkAs={ShellLink}
            user={guestShell ? null : ME}
            accountMenu={[{ icon: 'person', label: 'Trang cá nhân' }, { icon: 'speedometer2', label: 'Trang quản trị' }, { divider: true }, { icon: 'box-arrow-right', label: 'Đăng xuất', tone: 'alert' }]}
            notificationCount={notifs.filter((n) => !n.isRead).length}
            renderNotifications={(close) => (
              <NotificationList items={notifs} onItemClick={(n) => { setNotifs((l) => l.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))); close(); }}
                onMarkAllRead={() => setNotifs((l) => l.map((x) => ({ ...x, isRead: true })))} />
            )}
            onCreate={() => toast('Mở PostComposer')}
            onSearchClick={() => toast('Mở trang tìm kiếm')}
            onLogin={() => setGuestShell(false)}
            onRegister={() => toast('Sang trang Đăng ký')}
            aside={(
              <>
                <AiTip prompts={['Hôm nay ăn gì?']} onPrompt={() => setActive('assistant')}>Trời nóng, thử canh chua chay nấm rơm nhé.</AiTip>
                <div className={styles.asideBox}><HighlightChip>Mới</HighlightChip> Cột phải chỉ hiện từ 1280px.</div>
              </>
            )}
          >
            <PageHeader title={NAV.find((n) => n.key === active)?.label} description="Nội dung trang con nằm ở đây (Outlet)." />
            <EmptyState icon="layout-text-window" title="Vùng nội dung">Bấm các mục ở dock trái để đổi trang đang chọn.</EmptyState>
          </AppShell>
        </div>
      </Section>

      <Section
        code="5-13"
        title="AdminLayout"
        file="components/AdminLayout"
        when="khung khu /admin: menu trái (số việc chờ nền vàng), thanh trên có đường dẫn, chế độ Đêm, tài khoản. Dưới 992px menu thành ngăn kéo. Demo đầy đủ ở 5-16."
        props={[
          ['nav', '({key, label, icon, href, badge?, count?} | {divider: true})[]', '', 'badge = việc chờ'],
          ['activeKey · linkAs · title', '', '', ''],
          ['user · accountMenu · actions', '', '', ''],
        ]}
        usage={`<AdminLayout nav={ADMIN_NAV.map((n) => ({ ...n, badge: n.key === 'moderation' ? pendingTotal : undefined }))}
  activeKey={key} linkAs={Link} title={current.label} user={admin} accountMenu={items}>
  <Outlet />
</AdminLayout>`}
      >
        <p className="mb-0 small text-body-secondary">Xem trực tiếp trong trang mẫu 5-16 bên dưới.</p>
      </Section>

      <Section
        code="5-14"
        title="Trang mẫu: Chatbot (M-12)"
        file="kit/Batch5.jsx › ChatPage"
        when="ghép ChatThread + ChatBubble + ChatComposer + PromptChip + LoginPrompt. Khách còn 2 lượt (đã dùng 1)."
        note="Thử: bấm 1 câu gợi ý. Gõ câu có chữ 'lỗi' để thấy lỗi AI (không trừ lượt, có Thử lại). Gõ 'xxx' để thấy tin bị lọc. Hết lượt thì ô nhập khoá và mời đăng nhập."
      >
        <ChatPage />
      </Section>

      <Section
        code="5-15"
        title="Trang mẫu: Kết quả Meal Plan (M-11)"
        file="kit/Batch5.jsx › MealPlanPage"
        when="UC-09: tạo → AiProgress → kết quả. Chỉ số sức khoẻ, cảnh báo dị ứng, DayTabs, CalorieSummary, MealCard, hộp đổi món (DishCard dạng row), lưu thực đơn (draft → saved)."
        note="Ngày 2 có món chứa đậu phộng: phải đổi xong mới lưu được. Tick 'Giả lập AI lỗi' để xem màn lỗi."
      >
        <MealPlanPage />
      </Section>

      <Section
        code="5-16"
        title="Trang mẫu: Quản trị (M-14, M-15, M-16)"
        file="kit/Batch5.jsx › AdminDemo"
        when="AdminLayout + StatCard (Dashboard) + Tabs + DataTable chọn nhiều + ConfirmDialog có lý do (Moderation Center) + Modal thêm/sửa danh mục, chặn xoá danh mục đang dùng (FR-21)."
        note="Bấm ô số liệu ở Tổng quan để nhảy tới đúng hàng chờ. Tick nhiều dòng để duyệt hàng loạt. Thử xoá danh mục 'Món nước'."
      >
        <AdminDemo />
      </Section>
    </>
  );
}
