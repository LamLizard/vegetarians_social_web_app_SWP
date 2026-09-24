import { useState } from 'react';
import {
  Avatar, Button, Chip, ConfirmDialog, EmptyState, HighlightChip, IconButton, Menu, Modal,
  Notice, Panel, Photo, Skeleton, SkeletonCard, Spinner, StatusBadge, Tabs, useToast,
  STATUS, ENTITY_LABEL,
} from '../components';
import { useTheme } from '../utils/theme';
import Section, { DemoLabel } from './Section';
import Batch2 from './Batch2';
import Batch3 from './Batch3';
import Batch4 from './Batch4';
import Batch5 from './Batch5';
import styles from './kit.module.css';

// ---------------------------------------------------------------------
//  Mục lục. Thêm component mới → thêm 1 dòng vào đây + 1 <Section>.
// ---------------------------------------------------------------------
const NAV = [
  {
    title: 'Nền móng',
    items: [['K-01', 'Token màu'], ['K-02', 'Trạng thái (ERD)']],
  },
  {
    title: 'Đợt 1 · Nền tảng',
    items: [
      ['1-01', 'Button'], ['1-02', 'IconButton'], ['1-03', 'Spinner · Skeleton'],
      ['1-04', 'Avatar · Photo'], ['1-05', 'StatusBadge'], ['1-06', 'Chip · HighlightChip'],
      ['1-07', 'Notice · Toast'], ['1-08', 'Modal'], ['1-09', 'ConfirmDialog'],
      ['1-10', 'Menu'], ['1-11', 'Tabs'], ['1-12', 'Panel · EmptyState'],
    ],
  },
  {
    title: 'Đợt 2 · Form',
    items: [
      ['2-01', 'TextField'], ['2-02', 'TextArea'], ['2-03', 'PasswordField'], ['2-04', 'Select'],
      ['2-05', 'RadioGroup'], ['2-06', 'Checkbox'], ['2-07', 'CategoryPicker'], ['2-08', 'ChipInput'],
      ['2-09', 'NumberStepper'], ['2-10', 'ImageUpload'], ['2-11', 'SearchInput'], ['2-12', 'Pagination'],
      ['2-13', 'Form mẫu: Viết Blog'], ['2-14', 'Form mẫu: Meal Planner'],
    ],
  },
  {
    title: 'Đợt 3 · Bài đăng',
    items: [
      ['3-01', 'PostCard · thẻ'], ['3-02', 'PostCard · hàng'], ['3-03', 'YouTubeEmbed'], ['3-04', 'VoteButton'],
      ['3-05', 'Bình luận'], ['3-06', 'ReportDialog'], ['3-07', 'LoginPrompt'], ['3-08', 'Trang mẫu: Chi tiết Blog'],
      ['3-09', 'Đăng nhanh (status)'],
    ],
  },
  {
    title: 'Đợt 4 · Món & quán',
    items: [
      ['4-01', 'DishCard'], ['4-02', 'RecipeCard'], ['4-03', 'Xem công thức'], ['4-04', 'IngredientEditor'],
      ['4-05', 'StepEditor'], ['4-06', 'ShopCard'], ['4-07', 'ShopMenuItem'], ['4-08', 'Trang mẫu: Dish Detail'],
      ['4-09', 'Form mẫu: Tạo Recipe'], ['4-10', 'Trang mẫu: Chi tiết Shop'],
    ],
  },
  {
    title: 'Đợt 5 · AI, Admin, khung',
    items: [
      ['5-01', 'ChatBubble'], ['5-02', 'ChatThread · Composer'], ['5-03', 'PromptChip · AiTip'], ['5-04', 'AiProgress'],
      ['5-05', 'StatCard'], ['5-06', 'DayTabs'], ['5-07', 'MealCard'], ['5-08', 'CalorieSummary'],
      ['5-09', 'DataTable'], ['5-10', 'NotificationList'], ['5-11', 'PageHeader'], ['5-12', 'AppShell · Logo'],
      ['5-13', 'AdminLayout'], ['5-14', 'Trang mẫu: Chatbot'], ['5-15', 'Trang mẫu: Meal Plan'], ['5-16', 'Trang mẫu: Quản trị'],
    ],
  },
];

const TOKENS = [
  {
    title: 'Nền (theme "Vườn Nhà")', note: 'Khoảng 90% giao diện',
    items: [
      ['--ac-moss', 'Xanh rêu: màu chính, nút, link, tab'], ['--ac-matcha', 'Matcha: màu phụ, icon'],
      ['--ac-cream', 'Kem ngà: nền trang'], ['--ac-card', 'Ngà nhạt: nền thẻ'],
      ['--ac-ink', 'Chữ chính'], ['--ac-muted', 'Chữ phụ'], ['--ac-border', 'Viền mảnh'],
    ],
  },
  {
    title: 'Điểm nhấn (Botanical)', note: 'Dưới 10% diện tích, tối đa 1 chỗ mỗi khu vực',
    items: [
      ['--ac-highlight', 'Vàng cúc: "AI gợi ý", "MỚI". Chỉ làm nền'],
      ['--ac-alert', 'Đất nung: cảnh báo, xoá'], ['--ac-alert-soft', 'Nền cảnh báo nhạt'],
    ],
  },
  {
    title: 'Dữ liệu dinh dưỡng', note: 'Màu gắn cố định với nhóm chất',
    items: [
      ['--ac-protein', 'Đạm thực vật'], ['--ac-carb', 'Carbs'], ['--ac-fat', 'Chất béo'], ['--ac-fiber', 'Chất xơ'],
    ],
  },
  {
    title: 'Trạng thái', note: 'Luôn đi kèm icon + chữ',
    items: [
      ['--ac-ok-bg', 'Thành công / công khai'], ['--ac-warn-bg', 'Chờ duyệt'],
      ['--ac-bad-bg', 'Từ chối / khoá'], ['--ac-neutral-bg', 'Ẩn / trung tính'],
    ],
  },
];

const MENU_ITEMS = [
  { icon: 'pencil', label: 'Sửa bài' },
  { icon: 'link-45deg', label: 'Sao chép liên kết' },
  { icon: 'flag', label: 'Báo cáo', hint: 'Gửi cho Admin xem xét' },
  { divider: true },
  { icon: 'trash3', label: 'Xoá bài', tone: 'alert' },
];

export default function ReviewKit() {
  const [theme, toggleTheme] = useTheme();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'delete' | 'reject' | 'approve'
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [tab, setTab] = useState('pending');
  const [cats, setCats] = useState(['mon-nuoc']);
  const [showNotice, setShowNotice] = useState(true);

  const fakeSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); toast('Đã lưu bài viết'); }, 1200);
  };
  const runConfirm = (note) => {
    setConfirmLoading(true);
    setTimeout(() => {
      setConfirmLoading(false);
      setConfirm(null);
      toast(note ? `Đã từ chối. Lý do: ${note}` : 'Đã xoá bài viết', {
        tone: 'info',
        action: note ? undefined : { label: 'Hoàn tác', onClick: () => toast('Đã khôi phục bài viết') },
      });
    }, 900);
  };
  const toggleCat = (id) => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <>
      <header className={styles.topbar}>
        <span className={styles.brand}>
          <span className={styles.brandMark}><i className="bi bi-flower3" aria-hidden="true" /></span>
          Ăn Chay UI Kit
        </span>
        <span className={styles.version}>Hoàn tất 5 / 5</span>
        <span className={styles.spacer} />
        <IconButton
          icon={theme === 'dark' ? 'sun' : 'moon-stars'}
          label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang chế độ Đêm'}
          onClick={toggleTheme}
        />
      </header>

      <div className={styles.layout}>
        <nav className={styles.side} aria-label="Mục lục">
          {NAV.map((g) => (
            <div key={g.title} className={styles.sideGroup}>
              <span className={styles.sideTitle}>{g.title}</span>
              {g.items.map(([code, name]) => (
                <a key={code} href={`#${code}`}><span>{code}</span>{name}</a>
              ))}
            </div>
          ))}
        </nav>

        <main className={styles.page}>
          <div className={styles.intro}>
            <h1>Thư viện component App Ăn Chay</h1>
            <p>
              Mọi thứ trên trang này được vẽ từ chính component React trong <code>src/components</code>.
              Ở đây nhìn thế nào thì ghép vào trang sẽ ra đúng như vậy. Bấm nút mặt trăng góc phải để kiểm tra chế độ Đêm.
            </p>
            <p>Góp ý: ghi <b>mã mục + yêu cầu</b>, ví dụ <i>"1-09: nút Từ chối nên nằm bên trái"</i>.</p>
          </div>

          <ul className={styles.rules}>
            <li><b><i className="bi bi-plug" aria-hidden="true" />Không gọi API trong component</b>Trang của ai thì người đó lấy dữ liệu, rồi truyền vào component qua props.</li>
            <li><b><i className="bi bi-database" aria-hidden="true" />Dùng đúng giá trị database</b>Trạng thái, loại bài, bữa ăn... lấy từ <code>src/constants</code>. Không tự đặt tên khác.</li>
            <li><b><i className="bi bi-palette" aria-hidden="true" />Không gõ mã màu</b>Chỉ dùng <code>var(--ac-...)</code>. Gõ mã hex thì chế độ Đêm sẽ vỡ.</li>
            <li><b><i className="bi bi-puzzle" aria-hidden="true" />Thiếu thì báo, đừng tự chế</b>Cần component chưa có? Báo nhóm để thêm vào đây, đừng viết riêng trong trang.</li>
          </ul>

          {/* ============================ NỀN MÓNG ============================ */}
          <h2 className={styles.groupTitle}>Nền móng</h2>

          <Section
            code="K-01"
            title="Token màu"
            file="src/styles/_tokens.scss · theme.scss"
            when="viết CSS Module cho component hoặc trang. Mọi màu đều lấy từ biến var(--ac-...)."
            note="Ô màu dưới đây đọc trực tiếp từ biến CSS, nên khi bật chế độ Đêm bạn sẽ thấy màu tự đổi."
            usage={`/* Trong file *.module.css */
.box {
  background: var(--ac-card);
  color: var(--ac-ink);
  border: 1px solid var(--ac-border);
  border-radius: var(--ac-radius-lg);   /* 14px */
}
.box:focus-visible { outline: 3px solid var(--ac-focus-ring); }

/* SAI – chế độ Đêm sẽ vỡ */
.box { background: #FFFDF8; }`}
          >
            <div className={styles.tokenGrid}>
              {TOKENS.map((g) => (
                <div key={g.title} className={styles.tokenCard}>
                  <h4>{g.title}</h4>
                  <small>{g.note}</small>
                  {g.items.map(([name, desc]) => (
                    <div key={name} className={styles.swatch}>
                      <i style={{ background: `var(${name})` }} />
                      <span>{desc}</span>
                      <code>{name}</code>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Section>

          <Section
            code="K-02"
            title="Trạng thái theo từng đối tượng"
            file="src/constants/status.js"
            when="hiển thị trạng thái bất kỳ. Dòng chữ nhỏ dưới mỗi nhãn là giá trị lưu trong database, Backend phải trả đúng chữ này."
            note="Nguồn: Final Report v4.0. Lưu ý: file FINAL_ERD_Specification.docx trong Project là bản cũ (post chỉ có 3 trạng thái, shop dùng active/inactive), nhóm Backend cần theo bảng này."
            usage={`import { STATUS, POST_TYPE, MEAL_SLOT, toOptions } from '../components';

STATUS.post.pending.label        // "Chờ duyệt"
STATUS.shop.pending.label        // "Chờ xác minh"
Object.keys(STATUS.post)         // ['pending','public','rejected','hidden','deleted']

// Làm danh sách lựa chọn cho <select>
toOptions(HEALTH_GOAL)           // [{ value: 'lose_weight', label: 'Giảm cân' }, ...]`}
          >
            <div className={styles.statusTable}>
              {Object.entries(STATUS).map(([entity, map]) => (
                <div key={entity} className={styles.statusRow}>
                  <b>{ENTITY_LABEL[entity]}<code>entity="{entity}"</code></b>
                  <div>
                    {Object.keys(map).map((s) => (
                      <span key={s} className={styles.statusItem}>
                        <StatusBadge entity={entity} status={s} />
                        <code>{s}</code>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ============================ ĐỢT 1 ============================ */}
          <h2 className={styles.groupTitle}>Đợt 1 · Nền tảng <small>12 mục</small></h2>

          <Section
            code="1-01"
            title="Button"
            file="components/Button"
            when="mọi nút có chữ. Mỗi khu vực chỉ 1 nút primary."
            props={[
              ['variant', "'primary'|'outline'|'subtle'|'alert'", "'primary'", 'primary: hành động chính · outline: phụ · subtle: Huỷ/Đóng · alert: Xoá/Khoá'],
              ['size', "'sm'|'md'|'lg'", "'md'", ''],
              ['icon', 'string', '', 'Tên Bootstrap Icon, không cần "bi-"'],
              ['iconPosition', "'start'|'end'", "'start'", ''],
              ['loading', 'boolean', 'false', 'Hiện vòng xoay, khoá nút. Dùng khi đang gọi API'],
              ['block', 'boolean', 'false', 'Rộng hết khung (form đăng nhập, điện thoại)'],
              ['as', 'ElementType', "'button'", 'as={Link} to="/..." để làm link có kiểu nút'],
              ['type', 'string', "'button'", 'Nút gửi form thì ghi type="submit"'],
              ['...rest', '', '', 'onClick, disabled, aria-label... truyền thẳng xuống'],
            ]}
            usage={`import { Link } from 'react-router-dom';
import { Button } from '../components';

<Button icon="send" loading={submitting} type="submit">Đăng bài</Button>
<Button variant="subtle" onClick={onCancel}>Huỷ</Button>
<Button variant="alert" icon="trash3" onClick={() => setConfirm(true)}>Xoá bài</Button>
<Button as={Link} to="/posts/new" variant="outline" icon="plus-lg">Viết bài</Button>`}
          >
            <div>
              <DemoLabel>4 kiểu</DemoLabel>
              <div className={styles.row}>
                <Button icon="send">Đăng bài</Button>
                <Button variant="outline" icon="bookmark">Lưu nháp</Button>
                <Button variant="subtle">Huỷ</Button>
                <Button variant="alert" icon="trash3">Xoá bài</Button>
              </div>
            </div>
            <div>
              <DemoLabel>Kích thước · icon cuối · khoá</DemoLabel>
              <div className={styles.row}>
                <Button size="sm">Nhỏ</Button>
                <Button>Vừa</Button>
                <Button size="lg">Lớn</Button>
                <Button variant="outline" icon="arrow-right" iconPosition="end">Xem tất cả</Button>
                <Button disabled>Không bấm được</Button>
              </div>
            </div>
            <div>
              <DemoLabel>Đang gửi (bấm thử)</DemoLabel>
              <div className={styles.row}>
                <Button icon="floppy" loading={saving} onClick={fakeSave}>{saving ? 'Đang lưu' : 'Lưu bài viết'}</Button>
              </div>
            </div>
          </Section>

          <Section
            code="1-02"
            title="IconButton"
            file="components/IconButton"
            when="nút tròn chỉ có icon: thông báo trên header, nút … góc thẻ, nút đóng khung chat."
            props={[
              ['icon', 'string', '', 'BẮT BUỘC'],
              ['label', 'string', '', 'BẮT BUỘC. Đọc cho trình đọc màn hình và hiện khi rê chuột'],
              ['variant', "'soft'|'ghost'|'solid'", "'soft'", 'soft: nền be · ghost: trong suốt · solid: xanh rêu'],
              ['size', "'sm'|'md'|'lg'", "'md'", '32 · 40 · 48 px'],
              ['badge', 'number', '', 'Số thông báo, lớn hơn 9 hiện "9+"'],
              ['active', 'boolean', 'false', 'Đang bật'],
            ]}
            usage={`<IconButton icon="bell" label="Thông báo" badge={unread} onClick={openNoti} />
<IconButton icon="three-dots" label="Tuỳ chọn bài viết" variant="ghost" size="sm" />`}
          >
            <div className={styles.row}>
              <IconButton icon="bell" label="Thông báo" badge={3} />
              <IconButton icon="chat-dots" label="Tin nhắn" badge={12} />
              <IconButton icon="three-dots" label="Tuỳ chọn" variant="ghost" />
              <IconButton icon="plus-lg" label="Viết bài" variant="solid" />
              <IconButton icon="bookmark-fill" label="Đã lưu" active />
              <IconButton icon="x-lg" label="Đóng" size="sm" />
              <IconButton icon="stars" label="Mở trợ lý AI" size="lg" variant="solid" />
            </div>
          </Section>

          <Section
            code="1-03"
            title="Spinner · Skeleton"
            file="components/Spinner · components/Skeleton"
            when="đang tải. Tải danh sách thì dùng Skeleton (giữ bố cục, không nhảy trang). Chờ AI trả lời hoặc chờ 1 hành động thì dùng Spinner."
            props={[
              ['Spinner size', "'sm'|'md'|'lg'", "'md'", '16 · 24 · 40 px'],
              ['Spinner label', 'string|null', "'Đang tải'", 'Chữ cho trình đọc màn hình; null nếu bên cạnh đã có chữ'],
              ['Spinner showLabel', 'boolean', 'false', 'Hiện chữ bên cạnh'],
              ['Skeleton shape', "'text'|'block'|'circle'", "'text'", ''],
              ['Skeleton lines', 'number', '1', 'Số dòng (shape="text")'],
              ['Skeleton width / height', 'string|number', '', ''],
              ['SkeletonCard', '', '', 'Mẫu có sẵn: ảnh + 3 dòng, dùng cho lưới thẻ'],
            ]}
            usage={`// Danh sách đang tải
<div aria-busy={loading}>
  {loading
    ? Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)
    : posts.map((p) => <PostCard key={p.post_id} {...p} />)}
</div>

// Chờ AI tạo thực đơn (có thể tới 15 giây – NFR-03)
<Spinner size="lg" label="AI đang lên thực đơn cho bạn..." showLabel />`}
          >
            <div className={styles.row}>
              <Spinner size="sm" />
              <Spinner />
              <Spinner size="lg" label="AI đang lên thực đơn cho bạn..." showLabel />
            </div>
            <div className={styles.grid3}>
              <SkeletonCard />
              <div className={styles.box} style={{ display: 'grid', gap: '0.75rem' }}>
                <div className={styles.row}><Skeleton shape="circle" width={40} /><Skeleton width="50%" /></div>
                <Skeleton lines={3} />
              </div>
            </div>
          </Section>

          <Section
            code="1-04"
            title="Avatar · Photo"
            file="components/Avatar · components/Photo"
            when="Avatar cho người dùng (bài đăng, bình luận, header). Photo cho mọi ảnh món, bài, quán. Ảnh lỗi hoặc thiếu sẽ tự hiện nền lá, không bao giờ vỡ."
            props={[
              ['Avatar src', 'string', '', 'account.avatar_url'],
              ['Avatar name', 'string', '', 'account.full_name. Không có ảnh thì lấy chữ cái của tên gọi'],
              ['Avatar size', 'number', '40', 'px'],
              ['Photo src / alt', 'string', "alt=''", 'Ảnh trang trí để alt rỗng'],
              ['Photo ratio', "'1/1'|'4/3'|'16/9'|'3/2'", '', 'Giữ tỉ lệ → lưới thẻ đều nhau'],
              ['Photo shape', "'none'|'rounded'|'leaf'", "'none'", 'leaf: bo lệch 18/6, nét riêng của thẻ món'],
            ]}
            usage={`<Avatar src={author.avatar_url} name={author.full_name} size={36} />
<Photo src={post.thumbnail_url} alt={post.title} ratio="16/9" shape="rounded" />`}
          >
            <div className={styles.row}>
              <Avatar name="Lâm Anh Khôi" size={48} />
              <Avatar name="Dương Vĩ Lâm" />
              <Avatar name="Mai Khương Duy" size={32} />
              <Avatar name="Thắng" size={24} />
            </div>
            <div className={styles.grid3}>
              <div><DemoLabel>ratio 16/9 · rounded</DemoLabel><Photo ratio="16/9" shape="rounded" alt="Bún riêu chay" /></div>
              <div><DemoLabel>ratio 4/3 · leaf</DemoLabel><Photo ratio="4/3" shape="leaf" /></div>
              <div><DemoLabel>ratio 1/1 · link hỏng</DemoLabel><Photo src="https://example.invalid/anh-loi.jpg" ratio="1/1" shape="rounded" /></div>
            </div>
          </Section>

          <Section
            code="1-05"
            title="StatusBadge"
            file="components/StatusBadge"
            when="hiện trạng thái của bài, món, quán, tài khoản, báo cáo. Toàn bộ danh sách xem ở mục K-02."
            note="Thay đổi so với bản cũ: bắt buộc truyền entity. Lý do: cùng chữ 'pending' nhưng Post là 'Chờ duyệt', Shop là 'Chờ xác minh', Report là 'Chờ xử lý'."
            props={[
              ['entity', "'post'|'comment'|'dish'|'shop'|'shopDish'|'account'|'report'|'mealPlan'", '', 'BẮT BUỘC'],
              ['status', 'string', '', 'BẮT BUỘC. Đúng giá trị API trả về'],
              ['size', "'sm'|'md'", "'md'", 'sm dùng trong bảng admin'],
              ['label', 'string', '', 'Ghi đè chữ (hiếm khi cần)'],
            ]}
            usage={`<StatusBadge entity="post" status={post.status} />
<StatusBadge entity="shop" status={shop.verification_status} />
<StatusBadge entity="shopDish" status={item.is_available ? 'available' : 'unavailable'} size="sm" />`}
          >
            <div className={styles.row}>
              <StatusBadge entity="post" status="pending" />
              <StatusBadge entity="shop" status="pending" />
              <StatusBadge entity="report" status="pending" />
              <StatusBadge entity="dish" status="active" />
              <StatusBadge entity="account" status="locked" />
              <StatusBadge entity="shopDish" status="unavailable" size="sm" />
            </div>
          </Section>

          <Section
            code="1-06"
            title="Chip · HighlightChip"
            file="components/Chip · components/HighlightChip"
            when="Chip: hiện Category và làm bộ lọc (thay Tag cũ, vì v4.0 đã bỏ Tag). HighlightChip: điểm nhấn vàng cúc, tối đa 1 cái mỗi khu vực."
            props={[
              ['Chip onClick', '() => void', '', 'Có onClick → thành nút lọc bấm được'],
              ['Chip selected', 'boolean', 'false', 'Đang chọn (khi có onClick)'],
              ['Chip onRemove', '() => void', '', 'Hiện nút × (danh mục đã chọn trong form)'],
              ['Chip icon', 'string', '', ''],
              ['HighlightChip variant', "'default'|'new'", "'default'", 'new: chữ in hoa nhỏ, dán góc ảnh'],
              ['HighlightChip icon', 'string', "'stars'", ''],
            ]}
            usage={`// Hiện danh mục của bài
{post.categories.map((c) => <Chip key={c.category_id}>{c.name}</Chip>)}

// Bộ lọc
<Chip selected={filter === c.category_id} onClick={() => setFilter(c.category_id)}>{c.name}</Chip>

<HighlightChip>AI gợi ý</HighlightChip>`}
          >
            <div>
              <DemoLabel>Hiển thị</DemoLabel>
              <div className={styles.row}>
                <Chip>Món nước</Chip>
                <Chip>Món khô</Chip>
                <Chip icon="clock">30 phút</Chip>
              </div>
            </div>
            <div>
              <DemoLabel>Bộ lọc (bấm thử)</DemoLabel>
              <div className={styles.row}>
                {[['mon-nuoc', 'Món nước'], ['mon-kho', 'Món khô'], ['trang-mieng', 'Tráng miệng'], ['do-uong', 'Đồ uống']].map(([id, name]) => (
                  <Chip key={id} selected={cats.includes(id)} onClick={() => toggleCat(id)}>{name}</Chip>
                ))}
              </div>
            </div>
            <div>
              <DemoLabel>Đã chọn, bỏ được · Điểm nhấn</DemoLabel>
              <div className={styles.row}>
                <Chip onRemove={() => toast('Đã bỏ danh mục', { tone: 'info' })}>Món chay miền Nam</Chip>
                <HighlightChip>AI gợi ý</HighlightChip>
                <HighlightChip variant="new">Mới</HighlightChip>
              </div>
            </div>
          </Section>

          <Section
            code="1-07"
            title="Notice · Toast"
            file="components/Notice · components/Toast"
            when="Notice: thông báo nằm yên trong trang, người dùng cần đọc hoặc xử lý (tài khoản bị khoá, lý do bài bị từ chối). Toast: báo nhanh kết quả rồi tự ẩn (đã lưu, đã gửi)."
            props={[
              ['Notice tone', "'info'|'success'|'alert'", "'info'", 'alert chỉ khi người dùng phải hành động'],
              ['Notice title / children', 'ReactNode', '', ''],
              ['Notice action', '{label, onClick}', '', '1 nút, vd "Thử lại"'],
              ['Notice onDismiss', '() => void', '', 'Hiện nút ×'],
              ['toast(message, opts)', 'function', '', 'Lấy từ useToast(). opts: tone, duration, action'],
            ]}
            usage={`<Notice tone="alert" title="Bài viết bị từ chối">{post.moderation_note}</Notice>
<Notice tone="info">Trợ lý chỉ tham khảo, không thay thế tư vấn y tế.</Notice>

const toast = useToast();
toast('Đã gửi bài, đang chờ Admin duyệt', { tone: 'info' });`}
          >
            <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 640 }}>
              <Notice tone="alert" title="Tài khoản đã bị khoá" action={{ label: 'Liên hệ quản trị viên', onClick: () => {} }}>
                Tài khoản của bạn bị Admin khoá do vi phạm quy định cộng đồng.
              </Notice>
              <Notice tone="success" title="Đã gửi đăng ký quán">Quán đang chờ Admin xác minh. Bạn sẽ nhận thông báo khi có kết quả.</Notice>
              {showNotice && (
                <Notice tone="info" onDismiss={() => setShowNotice(false)}>
                  Trợ lý AI chỉ mang tính tham khảo, không thay thế tư vấn của bác sĩ hay chuyên gia dinh dưỡng.
                </Notice>
              )}
            </div>
            <div className={styles.row}>
              <Button variant="outline" size="sm" onClick={() => toast('Đã lưu vào món yêu thích')}>Toast thành công</Button>
              <Button variant="outline" size="sm" onClick={() => toast('Bài đã gửi, đang chờ Admin duyệt', { tone: 'info' })}>Toast thông tin</Button>
              <Button variant="outline" size="sm" onClick={() => toast('Không kết nối được máy chủ', { tone: 'alert' })}>Toast lỗi</Button>
            </div>
          </Section>

          <Section
            code="1-08"
            title="Modal"
            file="components/Modal"
            when="hộp thoại có nội dung: form báo cáo, xem trước video, đăng ký quán nhanh. Chỉ hỏi Có/Không thì dùng ConfirmDialog (1-09)."
            props={[
              ['open', 'boolean', '', 'BẮT BUỘC'],
              ['onClose', '() => void', '', 'Bấm X, Esc hoặc bấm ra ngoài'],
              ['title', 'string', '', 'BẮT BUỘC'],
              ['description', 'ReactNode', '', 'Dòng mô tả dưới tiêu đề'],
              ['size', "'sm'|'md'|'lg'", "'md'", '420 · 560 · 760 px'],
              ['footer', 'ReactNode', '', 'Thường là nút Huỷ + nút chính'],
              ['placement', "'center'|'left'", "'center'", 'left: ngăn kéo menu trên điện thoại'],
              ['dismissible', 'boolean', 'true', 'false khi đang gửi dữ liệu'],
            ]}
            usage={`<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="Đăng ký quán chay"
  description="Admin sẽ xác minh trong 1-2 ngày."
  footer={<>
    <Button variant="subtle" onClick={() => setOpen(false)}>Huỷ</Button>
    <Button type="submit" form="shop-form" loading={saving}>Gửi đăng ký</Button>
  </>}
>
  <form id="shop-form" onSubmit={submit}>...</form>
</Modal>`}
          >
            <div className={styles.row}>
              <Button icon="shop" onClick={() => setModalOpen(true)}>Mở hộp thoại</Button>
            </div>
            <Modal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Đăng ký quán chay"
              description="Mỗi tài khoản đăng ký tối đa 1 quán. Admin sẽ xác minh trước khi quán hiện công khai."
              footer={(
                <>
                  <Button variant="subtle" onClick={() => setModalOpen(false)}>Huỷ</Button>
                  <Button onClick={() => { setModalOpen(false); toast('Đã gửi đăng ký, quán đang chờ xác minh', { tone: 'info' }); }}>Gửi đăng ký</Button>
                </>
              )}
            >
              <p className="mb-2">Form nhập tên quán, địa chỉ, giờ mở cửa sẽ nằm ở đây (các ô nhập thuộc đợt 2).</p>
              <Notice tone="info">Quán ở trạng thái <b>Chờ xác minh</b> sẽ không hiện với người khác.</Notice>
            </Modal>
          </Section>

          <Section
            code="1-09"
            title="ConfirmDialog"
            file="components/ConfirmDialog"
            when="hỏi lại trước hành động khó hoàn tác: xoá, khoá tài khoản, từ chối, ẩn nội dung. Bật reason để Admin nhập lý do (moderation_note, resolution_note)."
            note="Nút xác nhận phải là động từ cụ thể (Xoá bài, Khoá tài khoản), không ghi OK hay Đồng ý."
            props={[
              ['open', 'boolean', '', 'BẮT BUỘC'],
              ['title', 'string', '', 'Câu hỏi, vd "Xoá bài viết này?"'],
              ['message', 'ReactNode', '', 'Hậu quả của hành động'],
              ['confirmLabel', 'string', "'Xác nhận'", 'Động từ cụ thể'],
              ['tone', "'alert'|'primary'", "'alert'", 'primary cho hành động tích cực (Duyệt bài)'],
              ['reason', 'boolean | {label, placeholder?, required?}', '', 'Bật ô nhập lý do (tối đa 255 ký tự)'],
              ['loading', 'boolean', 'false', 'Đang gọi API: khoá nút, không cho đóng'],
              ['onConfirm', '(reason?) => void', '', 'Nhận lý do nếu có ô lý do'],
              ['onCancel', '() => void', '', ''],
            ]}
            usage={`<ConfirmDialog
  open={!!rejecting}
  title="Từ chối bài viết?"
  message="Tác giả sẽ nhận thông báo kèm lý do."
  confirmLabel="Từ chối bài"
  reason={{ label: 'Lý do từ chối', required: true }}
  loading={saving}
  onConfirm={(note) => rejectPost(rejecting.post_id, note)}
  onCancel={() => setRejecting(null)}
/>`}
          >
            <div className={styles.row}>
              <Button variant="alert" icon="trash3" onClick={() => setConfirm('delete')}>Xoá bài (có hoàn tác)</Button>
              <Button variant="outline" icon="x-circle" onClick={() => setConfirm('reject')}>Admin từ chối (cần lý do)</Button>
              <Button variant="outline" icon="check2-circle" onClick={() => setConfirm('approve')}>Admin duyệt</Button>
            </div>
            <ConfirmDialog
              open={confirm === 'delete'}
              title="Xoá bài viết này?"
              message="Bài sẽ biến mất khỏi trang chủ và kết quả tìm kiếm."
              confirmLabel="Xoá bài"
              loading={confirmLoading}
              onConfirm={() => runConfirm()}
              onCancel={() => setConfirm(null)}
            />
            <ConfirmDialog
              open={confirm === 'reject'}
              title="Từ chối bài viết?"
              message="Tác giả sẽ nhận thông báo kèm lý do bạn nhập."
              confirmLabel="Từ chối bài"
              reason={{ label: 'Lý do từ chối', required: true, placeholder: 'Vd: Nội dung có món không phải đồ chay' }}
              loading={confirmLoading}
              onConfirm={(note) => runConfirm(note)}
              onCancel={() => setConfirm(null)}
            />
            <ConfirmDialog
              open={confirm === 'approve'}
              title="Duyệt bài viết?"
              message="Bài sẽ hiện công khai trên trang chủ."
              confirmLabel="Duyệt bài"
              tone="primary"
              onConfirm={() => { setConfirm(null); toast('Đã duyệt bài viết'); }}
              onCancel={() => setConfirm(null)}
            />
          </Section>

          <Section
            code="1-10"
            title="Menu"
            file="components/Menu"
            when="menu thả xuống: nút … trên bài viết/bình luận, menu tài khoản, danh sách thông báo."
            props={[
              ['renderTrigger', '(props) => ReactNode', '', 'Vẽ nút mở menu, nhớ rải {...props} vào nút'],
              ['items', '{icon?, label, onClick?, tone?, hint?}[]', '', '{ divider: true } là đường kẻ'],
              ['children', '(close) => ReactNode', '', 'Dùng thay items khi cần nội dung tự do'],
              ['align', "'start'|'end'", "'end'", 'Canh theo mép nút'],
              ['width', 'number', '240', 'px'],
            ]}
            usage={`<Menu
  renderTrigger={(p) => <IconButton icon="three-dots" label="Tuỳ chọn" variant="ghost" {...p} />}
  items={[
    { icon: 'pencil', label: 'Sửa bài', onClick: onEdit },
    { icon: 'flag', label: 'Báo cáo', onClick: onReport },
    { divider: true },
    { icon: 'trash3', label: 'Xoá bài', tone: 'alert', onClick: onDelete },
  ]}
/>`}
          >
            <div className={styles.row}>
              <Menu
                renderTrigger={(p) => <IconButton icon="three-dots" label="Tuỳ chọn bài viết" variant="soft" {...p} />}
                items={MENU_ITEMS.map((it) => (it.divider ? it : { ...it, onClick: () => toast(it.label, { tone: 'info' }) }))}
                align="start"
              />
              <Menu
                renderTrigger={(p) => <Button variant="outline" icon="person-circle" {...p}>Tài khoản</Button>}
                align="start"
                items={[
                  { icon: 'person', label: 'Hồ sơ của tôi' },
                  { icon: 'journal-text', label: 'Bài của tôi' },
                  { icon: 'shop', label: 'Quán của tôi' },
                  { divider: true },
                  { icon: 'box-arrow-right', label: 'Đăng xuất' },
                ]}
              />
            </div>
          </Section>

          <Section
            code="1-11"
            title="Tabs"
            file="components/Tabs"
            when="chia nội dung cùng trang: Bài của tôi (Blog/Video), Moderation Center (Bài/Món/Quán/Báo cáo). Dùng phím ← → để chuyển."
            props={[
              ['items', '{key, label, icon?, count?, disabled?}[]', '', 'BẮT BUỘC'],
              ['value', 'string', '', 'key đang chọn'],
              ['onChange', '(key) => void', '', ''],
              ['label', 'string', "'Chọn mục'", 'Mô tả nhóm tab cho trình đọc màn hình'],
            ]}
            usage={`const [tab, setTab] = useState('post');

<Tabs
  label="Hàng chờ duyệt"
  value={tab}
  onChange={setTab}
  items={[
    { key: 'post', label: 'Bài đăng', icon: 'journal-text', count: counts.post },
    { key: 'dish', label: 'Món ăn', icon: 'egg-fried', count: counts.dish },
  ]}
/>
{tab === 'post' && <PostQueue />}`}
          >
            <div>
              <Tabs
                label="Hàng chờ duyệt"
                value={tab}
                onChange={setTab}
                items={[
                  { key: 'pending', label: 'Bài chờ duyệt', icon: 'journal-text', count: 12 },
                  { key: 'dish', label: 'Món chờ duyệt', icon: 'basket', count: 4 },
                  { key: 'shop', label: 'Quán chờ xác minh', icon: 'shop', count: 2 },
                  { key: 'report', label: 'Báo cáo', icon: 'flag', count: 7 },
                  { key: 'log', label: 'Nhật ký', icon: 'clock-history', disabled: true },
                ]}
              />
              <div className={styles.box} style={{ borderTopLeftRadius: 0 }}>
                Đang xem tab: <b>{tab}</b>
              </div>
            </div>
          </Section>

          <Section
            code="1-12"
            title="Panel · EmptyState"
            file="components/Panel · components/EmptyState"
            when="Panel: khối có tiêu đề (cột phải trang chủ, dashboard admin, trang hồ sơ). EmptyState: danh sách trống, không tìm thấy kết quả, hàng chờ đã xử lý hết."
            props={[
              ['Panel title / icon', 'string', '', ''],
              ['Panel action', 'ReactNode', '', 'Góc phải tiêu đề, vd link "Xem tất cả"'],
              ['Panel flush', 'boolean', 'false', 'Thân không padding (danh sách, bảng sát mép)'],
              ['Panel as', 'ElementType', "'section'", ''],
              ['EmptyState icon / title', 'string', "'flower3'", ''],
              ['EmptyState children', 'ReactNode', '', 'Câu giải thích + gợi ý bước tiếp'],
              ['EmptyState action', 'ReactNode', '', 'Nút bước tiếp theo'],
            ]}
            usage={`<Panel title="Bài của tôi" icon="journal-text" action={<Link to="/me/posts">Xem tất cả</Link>}>
  {posts.length ? posts.map(...) : (
    <EmptyState icon="journal-plus" title="Bạn chưa đăng bài nào"
      action={<Button as={Link} to="/posts/new" icon="plus-lg">Viết bài đầu tiên</Button>}>
      Chia sẻ công thức hoặc video nấu ăn chay của bạn với cộng đồng.
    </EmptyState>
  )}
</Panel>`}
          >
            <div className={styles.grid2}>
              <Panel title="Hàng chờ hôm nay" icon="inbox" action={<a href="#1-12">Xem tất cả</a>}>
                <div className="d-grid gap-2 small">
                  <div className="d-flex justify-content-between"><span>Bài chờ duyệt</span><b>12</b></div>
                  <div className="d-flex justify-content-between"><span>Món chờ duyệt</span><b>4</b></div>
                  <div className="d-flex justify-content-between"><span>Báo cáo chưa xử lý</span><b>7</b></div>
                </div>
              </Panel>
              <Panel title="Bài của tôi" icon="journal-text">
                <EmptyState
                  icon="journal-plus"
                  title="Bạn chưa đăng bài nào"
                  action={<Button icon="plus-lg" size="sm">Viết bài đầu tiên</Button>}
                >
                  Chia sẻ công thức hoặc video nấu ăn chay của bạn với cộng đồng.
                </EmptyState>
              </Panel>
            </div>
          </Section>

          <Batch2 />
          <Batch3 />
          <Batch4 />
          <Batch5 />

          <p className={styles.foot}>Ăn Chay UI Kit · SWP391 · Hoàn tất 5 / 5 đợt</p>
        </main>
      </div>
    </>
  );
}
