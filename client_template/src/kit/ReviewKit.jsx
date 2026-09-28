import { useState } from 'react';
import {
  Button, StatusBadge, STATUSES, Tag, HighlightChip, FormField, SearchInput, DayTabs,
  MealCard, MacroProgress, NutritionSummary, MicronutrientList, PromptChip, AiTip,
  ShoppingChecklist, Notice, Avatar, ChatBubble,
} from '../components';
import Section from './Section';
import styles from './kit.module.css';
import {
  MEALS, NUTRITION_PARTS, MACRO_TARGETS, MICROS, SHOPPING, PROMPTS, TOKEN_GROUPS,
} from './sampleData';

const NAV = [
  ['P0-01', 'Token'], ['P0-02', 'Button'], ['P0-03', 'StatusBadge'], ['P0-04', 'Tag & Chip'],
  ['P0-05', 'Ô nhập'], ['P0-06', 'DayTabs'], ['P0-07', 'MealCard'], ['P0-08', 'Dinh dưỡng'],
  ['P0-09', 'Vi chất'], ['P0-10', 'Gợi ý AI'], ['P0-11', 'Đi chợ'], ['P0-12', 'Notice'],
  ['P0-13', 'Avatar & Chat'],
];

const STATUS_GROUPS = [
  ['Bài đăng / công thức / món / nguyên liệu', ['draft', 'pending', 'public', 'rejected', 'hidden']],
  ['Quán (xác minh)', ['pending_verification', 'verified', 'rejected']],
  ['Tài khoản', ['active', 'locked']],
  ['Thực đơn tuần', ['draft', 'saved', 'archived']],
  ['Vi chất', ['enough', 'low', 'lacking']],
];

export default function ReviewKit() {
  const [day, setDay] = useState('mon');
  const [filter, setFilter] = useState('Tất cả');
  const [saved, setSaved] = useState(() => MEALS.map((m) => !!m.saved));

  return (
    <>
      <nav className={styles.nav} aria-label="Mục lục Review Kit">
        <span className={styles.brand}>ĂN CHAY · REVIEW KIT</span>
        {NAV.map(([code, name]) => (
          <a key={code} href={`#${code}`}>{code} {name}</a>
        ))}
      </nav>

      <main className={styles.page}>
        <div className={styles.intro}>
          <h1>App Ăn Chay — Review Kit</h1>
          <p>Toàn bộ component dùng chung của app, theo theme <b>A "Vườn Nhà"</b> (nền) + <b>C "Botanical Garden"</b> (điểm nhấn, dữ liệu dinh dưỡng). Mọi thứ trên trang này được vẽ từ chính component React trong <code>src/components</code>, nên nhìn ở đây thế nào thì code ra thế ấy.</p>
          <p>Góp ý chỉ cần ghi <b>mã mục + yêu cầu sửa</b>, ví dụ: <i>"P0-07: nút Xem công thức to quá"</i>.</p>
        </div>

        <div className={styles.howto}>
          <b>Lấy component ra dùng</b>
          <ol>
            <li>Mở mục cần dùng → bấm <b>Cách dùng</b> → <b>Copy</b>.</li>
            <li>Import từ thư mục components: <code>{"import { MealCard } from '../components';"}</code></li>
            <li>Cần màu? Dùng class Bootstrap (<code>btn-primary</code>, <code>text-danger</code>…) hoặc biến CSS (<code>var(--ac-moss)</code>). <b>Không gõ mã màu trực tiếp.</b></li>
          </ol>
        </div>

        <h2 className={styles.groupTitle}>P0 · Component dùng chung</h2>

        {/* ---------------- P0-01 TOKEN ---------------- */}
        <Section
          code="P0-01"
          title="Token màu & chữ"
          file="src/styles/_tokens.scss"
          note="Muốn đổi màu cả app chỉ sửa file _tokens.scss. Trong JSX dùng class Bootstrap; trong file .module.css dùng biến var(--ac-…)."
          usage={`/* Trong file *.module.css */
.box {
  background: var(--ac-card);
  color: var(--ac-ink);
  border: 1px solid var(--ac-border);
}

// Trong JSX: dùng class Bootstrap, màu đã được theme đổi sẵn
<p className="text-body-secondary">Chữ phụ</p>
<h2 className="fw-bold">Tiêu đề (cùng font, chỉ đậm hơn)</h2>`}
        >
          <div className={styles.tokenGrid}>
            {TOKEN_GROUPS.map((g) => (
              <div key={g.title} className={styles.tokenCard}>
                <h3>{g.title}</h3>
                <small>{g.note}</small>
                {g.items.map(([name, hex, desc]) => (
                  <div key={name} className={styles.swatch}>
                    <i style={{ background: hex }} />
                    <span>{desc}</span>
                    <code>{name}</code>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className={styles.fontRow}>
            <div className={styles.tokenCard}>
              <h3>Tiêu đề · Be Vietnam Pro Bold</h3>
              <small>Tiêu đề trang, tên món, số liệu lớn</small>
              <div className="fs-3 fw-bold lh-sm">Kế hoạch thực đơn tuần</div>
            </div>
            <div className={styles.tokenCard}>
              <h3>Nội dung · Be Vietnam Pro Regular</h3>
              <small>Cả app dùng 1 font – hiển thị dấu tiếng Việt tốt, dễ đọc</small>
              <div>Bún riêu chay sữa đậu nành & chả nấm thì là. Ăn ngon, sống lành.</div>
            </div>
          </div>
        </Section>

        {/* ---------------- P0-02 BUTTON ---------------- */}
        <Section
          code="P0-02"
          title="Button"
          file="components/Button"
          note="Mỗi khu vực chỉ 1 nút primary. Nút alert (đất nung) chỉ cho hành động quan trọng. Nút chỉ có icon bắt buộc có aria-label."
          usage={`<Button onClick={handleSave}>Lưu thực đơn</Button>
<Button variant="outline" icon="arrow-repeat">Đổi món</Button>
<Button variant="subtle">Hủy</Button>
<Button variant="alert" icon="trash">Xoá bài</Button>
<Button size="sm" icon="plus-lg">Thêm món</Button>
<Button disabled>Đang lưu…</Button>
<Button variant="subtle" icon="bookmark" iconOnly aria-label="Lưu món" />`}
        >
          <div className={styles.stack}>
            <div className={styles.row}>
              <Button icon="check2">Lưu thực đơn</Button>
              <Button variant="outline" icon="arrow-repeat">Đổi món</Button>
              <Button variant="subtle">Hủy</Button>
              <Button variant="alert" icon="trash">Xoá bài</Button>
              <Button disabled>Đang lưu…</Button>
            </div>
            <div className={styles.row}>
              <Button size="sm" icon="plus-lg">Thêm món</Button>
              <Button size="sm" variant="outline">Xem chi tiết</Button>
              <Button size="sm" variant="subtle" icon="bookmark" iconOnly aria-label="Lưu món" title="Lưu món" />
              <Button size="sm" variant="subtle" icon="share" iconOnly aria-label="Chia sẻ" title="Chia sẻ" />
              <Button size="lg" icon="stars">Tạo thực đơn bằng AI</Button>
            </div>
          </div>
        </Section>

        {/* ---------------- P0-03 STATUS BADGE ---------------- */}
        <Section
          code="P0-03"
          title="StatusBadge – nhãn trạng thái"
          file="components/StatusBadge"
          note="Truyền đúng giá trị status trong database, component tự ra chữ tiếng Việt, icon và màu. Luôn có icon + chữ, không chỉ dựa vào màu."
          usage={`<StatusBadge status={post.status} />          // "pending" → Chờ duyệt
<StatusBadge status="pending_verification" />   // quán chờ xác minh
<StatusBadge status="lacking" />                // vi chất: Thiếu
<StatusBadge status="rejected" label="Bị từ chối: thiếu ghi chú thành phần" />

// Danh sách status có sẵn: ${Object.keys(STATUSES).join(', ')}`}
        >
          <div className={styles.stack}>
            {STATUS_GROUPS.map(([label, keys]) => (
              <div key={label}>
                <span className={styles.label}>{label}</span>
                <div className={styles.row}>
                  {keys.map((k) => <StatusBadge key={k} status={k} />)}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------- P0-04 TAG & CHIP ---------------- */}
        <Section
          code="P0-04"
          title="Tag & HighlightChip"
          file="components/Tag · components/HighlightChip"
          note="Tag: nhãn nội dung/danh mục; truyền onClick để thành bộ lọc. HighlightChip (vàng cúc) là ĐIỂM NHẤN: mỗi khu vực tối đa 1 cái."
          usage={`<Tag>Giàu đạm thực vật</Tag>
<Tag icon="droplet">Món nước</Tag>

// Tag làm bộ lọc
<Tag active={filter === 'Món nước'} onClick={() => setFilter('Món nước')}>Món nước</Tag>

<HighlightChip>AI đã cân đối</HighlightChip>
<HighlightChip variant="new">Mới</HighlightChip>`}
        >
          <div className={styles.stack}>
            <div>
              <span className={styles.label}>Tag nội dung</span>
              <div className={styles.row}>
                <Tag>Giàu đạm thực vật</Tag>
                <Tag>Không trứng sữa</Tag>
                <Tag icon="droplet">Món nước</Tag>
                <Tag icon="egg-fried">Món khô</Tag>
              </div>
            </div>
            <div>
              <span className={styles.label}>Tag làm bộ lọc (bấm thử)</span>
              <div className={styles.row}>
                {['Tất cả', 'Món nước', 'Món khô', 'Đồ ngọt', 'Ăn sáng nhanh'].map((f) => (
                  <Tag key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Tag>
                ))}
              </div>
            </div>
            <div>
              <span className={styles.label}>HighlightChip – điểm nhấn</span>
              <div className={styles.row}>
                <HighlightChip>AI đã cân đối</HighlightChip>
                <HighlightChip icon="trophy">7 ngày ăn đủ rau</HighlightChip>
                <HighlightChip variant="new">Mới</HighlightChip>
              </div>
            </div>
          </div>
        </Section>

        {/* ---------------- P0-05 FORM ---------------- */}
        <Section
          code="P0-05"
          title="FormField & SearchInput"
          file="components/FormField · components/SearchInput"
          note="FormField tự nối label với ô nhập và đọc lỗi cho trình đọc màn hình. Có error thì hint bị thay bằng lỗi."
          usage={`<FormField
  label="Tên món"
  required
  placeholder="Vd: Bún riêu chay"
  value={name}
  onChange={(e) => setName(e.target.value)}
  hint="Tên ngắn gọn, không ghi thương hiệu."
  error={errors.name}
/>
<FormField label="Ghi chú thành phần" multiline required />

<SearchInput value={q} onChange={(e) => setQ(e.target.value)} />`}
        >
          <div className="row g-4">
            <div className="col-md-6">
              <FormField label="Tên món" required placeholder="Vd: Bún riêu chay" hint="Tên ngắn gọn, không ghi thương hiệu." />
              <FormField label="Ghi chú thành phần" required multiline defaultValue="Có sữa đậu nành" error="Ghi chú thành phần bắt buộc phải nêu rõ có trứng/sữa hay không (BR-01)." />
            </div>
            <div className="col-md-6">
              <span className={styles.label}>Ô tìm kiếm (header)</span>
              <SearchInput />
            </div>
          </div>
        </Section>

        {/* ---------------- P0-06 DAY TABS ---------------- */}
        <Section
          code="P0-06"
          title="DayTabs – chọn ngày trong tuần"
          file="components/DayTabs"
          note="Chấm vàng = hôm nay. Trên điện thoại dãy tự cuộn ngang."
          usage={`const [day, setDay] = useState('mon');

<DayTabs value={day} todayKey="wed" onChange={setDay} />

// Muốn hiện thêm ngày tháng:
<DayTabs
  days={[{ key: 'mon', label: 'Thứ 2', sub: '21/09' }, ...]}
  value={day}
  onChange={setDay}
/>`}
        >
          <DayTabs value={day} todayKey="wed" onChange={setDay} />
        </Section>

        {/* ---------------- P0-07 MEAL CARD ---------------- */}
        <Section
          code="P0-07"
          title="MealCard – thẻ món trong thực đơn"
          file="components/MealCard"
          note="Bo góc lệch là nét riêng của app. slot khớp 4 meal_slot trong database. Chip MỚI là điểm nhấn duy nhất trên thẻ. Thẻ không có nút đổi món riêng – dùng 1 nút “Đổi thực đơn ngày” phía trên để AI gợi ý lại cả 4 bữa."
          usage={`<MealCard
  slot="dinner"               // breakfast | lunch | snack | dinner
  time="19:00"
  image={dish.imageUrl}
  kcal={540}
  tag="Giàu đạm thực vật"
  cookTime="45 phút"
  title={dish.name}
  description={dish.description}
  macros={{ protein: 22, carb: 78, fat: 8 }}
  isNew
  saved={isSaved}
  onView={() => navigate(\`/recipes/\${dish.recipeId}\`)}
  onToggleSave={() => setIsSaved(!isSaved)}
/>

// Đầu khu thực đơn ngày: 1 nút đổi cả 4 bữa
<div className="d-flex justify-content-between align-items-center mb-3">
  <h2 className="h4 mb-0">Thực đơn Thứ 2</h2>
  <Button variant="outline" icon="arrow-repeat" onClick={regenerateDay}>Đổi thực đơn ngày</Button>
</div>

// Lưới 4 bữa:
<div className="row g-3">
  {meals.map((m) => (
    <div key={m.slot} className="col-sm-6 col-lg-3"><MealCard {...m} /></div>
  ))}
</div>`}
        >
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <div className="h5 fw-bold mb-0">Thực đơn Thứ 2, 21/09</div>
              <small className="text-body-secondary">Không hợp khẩu vị? AI gợi ý lại cả 4 bữa với dinh dưỡng tương đương.</small>
            </div>
            <Button variant="outline" icon="arrow-repeat">Đổi thực đơn ngày</Button>
          </div>
          <div className="row g-3">
            {MEALS.map((m, i) => (
              <div key={m.slot} className="col-sm-6 col-lg-3">
                <MealCard
                  {...m}
                  saved={saved[i]}
                  onToggleSave={() => setSaved((s) => s.map((v, j) => (j === i ? !v : v)))}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------- P0-08 NUTRITION ---------------- */}
        <Section
          code="P0-08"
          title="NutritionSummary & MacroProgress"
          file="components/NutritionSummary · components/MacroProgress"
          note="Chỗ chính để dùng màu dữ liệu. Màu gắn cố định với nhóm chất (file nutrients.js). Rê chuột lên thanh xếp chồng để xem chi tiết."
          usage={`// Tổng quan trong ngày (thanh xếp chồng)
<NutritionSummary
  kcal={1840}
  target={2000}
  parts={[
    { key: 'protein', grams: 68,  percent: 17 },
    { key: 'carb',    grams: 240, percent: 52 },
    { key: 'fat',     grams: 53,  percent: 26 },
    { key: 'fiber',   grams: 32,  percent: 5 },
  ]}
/>

// Từng nhóm chất so với mục tiêu
<MacroProgress
  items={[
    { key: 'protein', value: 68, target: 75 },
    { key: 'carb', value: 240, target: 260 },
  ]}
/>`}
        >
          <div className="row g-3">
            <div className="col-lg-6">
              <div className={styles.cardBox}>
                <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap mb-2">
                  <h3 className={styles.cardTitle}>Phân bổ dinh dưỡng hôm nay</h3>
                  <HighlightChip>AI đã cân đối</HighlightChip>
                </div>
                <NutritionSummary kcal={1840} target={2000} parts={NUTRITION_PARTS} />
              </div>
            </div>
            <div className="col-lg-6">
              <div className={styles.cardBox}>
                <h3 className={styles.cardTitle}>So với mục tiêu</h3>
                <MacroProgress items={MACRO_TARGETS} />
              </div>
            </div>
          </div>
        </Section>

        {/* ---------------- P0-09 MICRO ---------------- */}
        <Section
          code="P0-09"
          title="MicronutrientList – vi chất"
          file="components/MicronutrientList"
          usage={`<MicronutrientList
  items={[
    { name: 'Vitamin B12', short: 'B12', amount: '0,8 / 2,4 µg', status: 'lacking' },
    { name: 'Sắt', short: 'Fe', amount: '14 / 18 mg', status: 'low' },
    { name: 'Canxi', short: 'Ca', status: 'enough' },
  ]}
/>`}
        >
          <div className={styles.cardBox} style={{ maxWidth: 420 }}>
            <h3 className={styles.cardTitle}>Vi chất hôm nay</h3>
            <MicronutrientList items={MICROS} />
          </div>
        </Section>

        {/* ---------------- P0-10 AI ---------------- */}
        <Section
          code="P0-10"
          title="AiTip & PromptChip"
          file="components/AiTip · components/PromptChip"
          note="AiTip: hộp gợi ý trên các trang. PromptChip dùng riêng được, ví dụ danh sách câu hỏi mẫu ở sidebar trang Trợ lý AI (block)."
          usage={`<AiTip
  prompts={['Món nào giàu B12?', 'Đổi bữa tối ít calo hơn']}
  onPrompt={(q) => sendToAssistant(q)}
>
  Vắt thêm lát chanh vào bát bún riêu: vitamin C giúp hấp thu sắt từ nấm tốt hơn.
</AiTip>

// Sidebar trang Trợ lý AI
<PromptChip block icon="egg" onClick={...}>Người ăn chay lấy đạm từ đâu?</PromptChip>`}
        >
          <div className="row g-3">
            <div className="col-lg-7">
              <AiTip prompts={PROMPTS}>
                "Sắt từ nấm rơm và rau bina hấp thu tốt hơn nhiều khi đi cùng vitamin C. Hôm nay nhớ vắt thêm lát chanh vào bát bún riêu nhé!"
              </AiTip>
            </div>
            <div className="col-lg-5">
              <span className={styles.label}>PromptChip dạng block</span>
              <div className="d-grid gap-2">
                <PromptChip block icon="egg">Người ăn chay lấy đạm từ đâu?</PromptChip>
                <PromptChip block icon="capsule">Có cần bổ sung B12 không?</PromptChip>
                <PromptChip block icon="calendar-week">Lên thực đơn 7 ngày cho mình</PromptChip>
              </div>
            </div>
          </div>
        </Section>

        {/* ---------------- P0-11 SHOPPING ---------------- */}
        <Section
          code="P0-11"
          title="ShoppingChecklist – danh sách đi chợ"
          file="components/ShoppingChecklist"
          usage={`<ShoppingChecklist
  title="Rau củ quả tươi"
  icon="flower3"
  items={[
    { id: 'kale', name: 'Cải kale', qty: '200 g', checked: true },
    { id: 'bido', name: 'Bí đỏ', qty: '500 g' },
  ]}
  onChange={(items) => saveShoppingList(items)}
/>`}
        >
          <div className="row g-3">
            {SHOPPING.map((g) => (
              <div key={g.title} className="col-md-6">
                <ShoppingChecklist {...g} />
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------- P0-12 NOTICE ---------------- */}
        <Section
          code="P0-12"
          title="Notice – thông báo trong trang"
          file="components/Notice"
          note='tone="alert" (đất nung) chỉ khi người dùng cần xử lý. Bài vừa đăng phải qua duyệt → dùng tone="info" để báo, tránh người dùng tưởng đăng bị lỗi.'
          usage={`<Notice
  tone="alert"
  title="Bạn thiếu vitamin B12 3 ngày liền"
  action={{ label: 'Xem món giàu B12', onClick: () => navigate('/dishes?nutrient=b12') }}
>
  Thêm sữa hạt hoặc ngũ cốc có bổ sung B12 vào bữa sáng nhé.
</Notice>

<Notice tone="info" title="Bài viết đang chờ duyệt">
  Bài sẽ hiện công khai sau khi quản trị viên duyệt.
</Notice>

<Notice tone="success" title="Đã lưu thực đơn tuần" />`}
        >
          <div className={styles.stack}>
            <Notice tone="alert" title="Bạn thiếu vitamin B12 3 ngày liền" action={{ label: 'Xem món giàu B12' }}>
              Thêm sữa hạt hoặc ngũ cốc có bổ sung B12 vào bữa sáng nhé.
            </Notice>
            <Notice tone="info" title="Bài viết đang chờ duyệt">
              Bài sẽ hiện công khai sau khi quản trị viên duyệt. Bạn sẽ nhận thông báo khi có kết quả.
            </Notice>
            <Notice tone="success" title="Đã lưu thực đơn tuần" />
          </div>
        </Section>

        {/* ---------------- P0-13 AVATAR & CHAT ---------------- */}
        <Section
          code="P0-13"
          title="Avatar & ChatBubble"
          file="components/Avatar · components/ChatBubble"
          note='status của ChatBubble khớp chat_message trong database: ok, filtered (bị bộ lọc từ khoá chặn), error (lỗi gọi AI, không trừ lượt).'
          usage={`<Avatar name="Lâm Anh Khôi" />            // không có ảnh → chữ "K"
<Avatar src={user.avatarUrl} name={user.fullName} size={32} />

<ChatBubble from="user" time="19:02">Tối nay ăn gì cho đủ đạm?</ChatBubble>
<ChatBubble from="ai" time="19:02">Bạn thử đậu hũ kho nấm…</ChatBubble>
<ChatBubble from="ai" status="error" time="19:03" onRetry={retry}>…</ChatBubble>`}
        >
          <div className={styles.stack}>
            <div className={styles.row}>
              <Avatar name="Lâm Anh Khôi" size={48} />
              <Avatar name="Minh Thắng" />
              <Avatar name="Vi Lâm" size={32} />
            </div>
            <div className={styles.chat}>
              <ChatBubble from="user" time="19:02">Tối nay mình nên ăn gì để đủ đạm? Hôm nay mới được khoảng 40g.</ChatBubble>
              <ChatBubble from="ai" time="19:02">{'Bạn còn thiếu khoảng 35g đạm. Gợi ý:\n• Đậu hũ kho nấm (≈ 20g)\n• Canh rong biển đậu non (≈ 9g)\n• Một ly sữa đậu nành (≈ 7g)'}</ChatBubble>
              <ChatBubble from="ai" status="error" time="19:03" onRetry={() => {}}>Không nhận được câu trả lời.</ChatBubble>
            </div>
          </div>
        </Section>

        <p className={styles.foot}>
          Các màn hình (C1, C2…) sẽ thêm vào đây sau khi chốt bố cục trang chủ kiểu mạng xã hội.
        </p>
      </main>
    </>
  );
}
