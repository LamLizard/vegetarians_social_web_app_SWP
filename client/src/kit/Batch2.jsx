import { useState } from 'react';
import {
  Button, CategoryPicker, Checkbox, ChipInput, ImageUpload, NumberStepper, Notice, Pagination,
  PasswordField, RadioGroup, SearchInput, Select, TextArea, TextField, useToast,
  rules, validate, hasErrors, toOptions, ACTIVITY_LEVEL, GENDER, REPORT_REASON,
} from '../components';
import Section, { DemoLabel } from './Section';
import { mockUpload } from './mock';
import styles from './kit.module.css';

// ---------------- Dữ liệu mẫu ----------------
const CATEGORIES = [
  'Món nước', 'Món khô', 'Món xào', 'Món chiên', 'Món hấp', 'Món nướng', 'Canh & súp', 'Gỏi & salad',
  'Cơm', 'Bún & phở', 'Bánh', 'Tráng miệng', 'Đồ uống', 'Chay miền Nam', 'Chay miền Bắc', 'Chay miền Trung',
].map((label, i) => ({ value: i + 1, label }));

const GOALS = [
  { value: 'lose_weight', label: 'Giảm cân', icon: 'graph-down-arrow', description: 'Ăn ít hơn TDEE khoảng 10 đến 20%' },
  { value: 'maintain', label: 'Giữ cân', icon: 'arrow-left-right', description: 'Ăn bằng TDEE' },
  { value: 'gain_muscle', label: 'Tăng cơ', icon: 'graph-up-arrow', description: 'Ăn hơn TDEE 150 đến 300 kcal' },
];
const ALLERGY_SUGGEST = ['Đậu phộng', 'Đậu nành', 'Gluten', 'Mè', 'Hạt điều', 'Nấm'];


// ---------------- Form mẫu M-05 ----------------
function BlogForm() {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', categories: [], images: [], content: '' });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const set = (key) => (v) => {
    setForm((f) => ({ ...f, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate(form, {
      title: [rules.required('Nhập tiêu đề bài viết'), rules.maxLength(200)],
      categories: [rules.minItems(1, 'Chọn ít nhất 1 danh mục')],
      content: [rules.required('Nhập nội dung bài viết'), rules.minLength(30, 'Nội dung cần ít nhất 30 ký tự')],
    });
    setErrors(errs);
    if (hasErrors(errs)) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast('Đã gửi bài. Bài đang chờ Admin duyệt.', { tone: 'info' });
      setForm({ title: '', categories: [], images: [], content: '' });
    }, 1200);
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <TextField label="Tiêu đề" required maxLength={200} value={form.title} onChange={set('title')} error={errors.title}
        placeholder="Vd: Bún riêu chay nấm rơm" />
      <CategoryPicker label="Danh mục" required max={3} options={CATEGORIES} value={form.categories} onChange={set('categories')}
        error={errors.categories} />
      <ImageUpload label="Ảnh minh hoạ" multiple max={4} value={form.images} onChange={set('images')} onUpload={mockUpload(false)} />
      <TextArea label="Nội dung" required rows={5} maxLength={5000} value={form.content} onChange={set('content')}
        error={errors.content} placeholder="Chia sẻ cách nấu, mẹo chọn nguyên liệu..." />
      <div className={styles.formActions}>
        <Button variant="subtle" disabled={sending}>Lưu nháp</Button>
        <Button type="submit" icon="send" loading={sending}>Đăng bài</Button>
      </div>
    </form>
  );
}

// ---------------- Form mẫu M-10 ----------------
function MealPlanForm() {
  const toast = useToast();
  const [f, setF] = useState({
    height: '165', weight: '', gender: 'female', activity: '', goal: 'maintain',
    allergies: ['Đậu phộng'], ingredients: [], days: 7, meals: 3, consent: false,
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const set = (key) => (v) => { setF((s) => ({ ...s, [key]: v })); if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined })); };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate(f, {
      height: [rules.required('Nhập chiều cao'), rules.between(100, 250, 'cm')],
      weight: [rules.required('Nhập cân nặng'), rules.between(25, 250, 'kg')],
      activity: [rules.required('Chọn mức vận động')],
      consent: [(v) => (v ? '' : 'Cần đồng ý để AI dùng số đo của bạn')],
    });
    setErrors(errs);
    if (hasErrors(errs)) return;
    setSending(true);
    setTimeout(() => { setSending(false); toast(`AI đang lên thực đơn ${f.days} ngày × ${f.meals} bữa`, { tone: 'info' }); }, 1200);
  };

  const bmi = f.height && f.weight ? (Number(f.weight) / (Number(f.height) / 100) ** 2).toFixed(1) : null;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.grid2}>
        <TextField label="Chiều cao" type="number" inputMode="decimal" suffix="cm" required value={f.height} onChange={set('height')} error={errors.height} />
        <TextField label="Cân nặng" type="number" inputMode="decimal" suffix="kg" required value={f.weight} onChange={set('weight')} error={errors.weight}
          hint={bmi ? `BMI tạm tính: ${bmi}` : undefined} />
      </div>
      <div className={styles.grid2}>
        <RadioGroup label="Giới tính" variant="segmented" options={toOptions(GENDER)} value={f.gender} onChange={set('gender')} />
        <Select label="Mức vận động" required placeholder="Chọn mức vận động" options={toOptions(ACTIVITY_LEVEL)} value={f.activity}
          onChange={set('activity')} error={errors.activity} />
      </div>
      <RadioGroup label="Mục tiêu" variant="card" options={GOALS} value={f.goal} onChange={set('goal')} />
      <ChipInput label="Dị ứng / món kiêng" value={f.allergies} onChange={set('allergies')} suggestions={ALLERGY_SUGGEST} max={10}
        hint="AI sẽ không gợi ý món có các nguyên liệu này (BR-02)" />
      <ChipInput label="Nguyên liệu đang có" value={f.ingredients} onChange={set('ingredients')} placeholder="Vd: đậu hũ, nấm rơm" />
      <div className={styles.row}>
        <NumberStepper label="Số ngày" min={1} max={7} unit="ngày" value={f.days} onChange={set('days')} />
        <NumberStepper label="Số bữa mỗi ngày" min={1} max={4} unit="bữa" value={f.meals} onChange={set('meals')} />
      </div>
      <Checkbox checked={f.consent} onChange={set('consent')} error={errors.consent} required
        hint="Chỉ bạn thấy số đo này. Không hiện công khai (BR-08).">
        Tôi đồng ý cho AI dùng chiều cao, cân nặng để lên thực đơn
      </Checkbox>
      <div className={styles.formActions}>
        <Button type="submit" icon="stars" loading={sending}>{sending ? 'AI đang lên thực đơn' : 'Tạo thực đơn'}</Button>
      </div>
    </form>
  );
}

// ---------------- Các mục đợt 2 ----------------
export default function Batch2() {
  const toast = useToast();
  const [title, setTitle] = useState('Bún riêu chay nấm rơm');
  const [email, setEmail] = useState('khoi@');
  const [price, setPrice] = useState('45000');
  const [note, setNote] = useState('');
  const [pw, setPw] = useState('');
  const [reason, setReason] = useState('');
  const [postType, setPostType] = useState('blog');
  const [gender, setGender] = useState('');
  const [goal, setGoal] = useState('maintain');
  const [remember, setRemember] = useState(true);
  const [available, setAvailable] = useState(true);
  const [cats, setCats] = useState([1, 14]);
  const [allergies, setAllergies] = useState(['Đậu phộng', 'Gluten']);
  const [days, setDays] = useState(7);
  const [avatar, setAvatar] = useState('');
  const [photos, setPhotos] = useState([]);
  const [fail, setFail] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(6);

  return (
    <>
      <h2 className={styles.groupTitle}>Đợt 2 · Form <small>14 mục</small></h2>
      <Notice tone="info" title="Quy ước chung của mọi ô nhập">
        <code>onChange</code> nhận <b>thẳng giá trị</b>, không phải event: viết <code>{'onChange={setTitle}'}</code> là xong.
        Mọi ô đều có <code>label</code>, <code>hint</code>, <code>error</code>, <code>required</code>, <code>disabled</code> giống nhau.
        Có <code>maxLength</code> thì tự hiện bộ đếm, nên đặt đúng độ dài cột VARCHAR trong database.
      </Notice>

      <Section
        code="2-01"
        title="TextField"
        file="components/TextField"
        when="ô nhập 1 dòng: tiêu đề, email, tên quán, giá, chiều cao. Mật khẩu dùng PasswordField."
        props={[
          ['value / onChange', 'string / (value) => void', '', 'onChange={setTitle}'],
          ['label · hint · error · required', '', '', 'Giống mọi ô nhập'],
          ['type', 'string', "'text'", "'email' · 'number' · 'url' · 'tel'"],
          ['maxLength', 'number', '', 'Hiện bộ đếm 12/200'],
          ['icon', 'string', '', 'Icon bên trái'],
          ['suffix', 'string', '', 'Đơn vị bên phải: kg, cm, kcal, đ'],
          ['size', "'sm'|'md'|'lg'", "'md'", ''],
          ['...rest', '', '', 'name, autoComplete, min, max, inputMode, onBlur'],
        ]}
        usage={`<TextField label="Tiêu đề" required maxLength={200}
  value={title} onChange={setTitle} error={errors.title} />

<TextField label="Giá" type="number" suffix="đ" value={price} onChange={setPrice} />`}
      >
        <div className={styles.grid2}>
          <TextField label="Tiêu đề bài viết" required maxLength={200} value={title} onChange={setTitle} />
          <TextField label="Email" type="email" icon="envelope" value={email} onChange={setEmail}
            error={rules.email()(email)} autoComplete="email" />
          <TextField label="Giá bán" type="number" suffix="đ" value={price} onChange={setPrice} hint="Giá món trong menu quán" />
          <TextField label="Tên quán" value="Quán Chay Tịnh Tâm" disabled />
        </div>
      </Section>

      <Section
        code="2-02"
        title="TextArea"
        file="components/TextArea"
        when="nhiều dòng: nội dung blog, mô tả món, hướng dẫn nấu, bình luận. Tự cao lên khi gõ."
        props={[
          ['rows', 'number', '3', 'Chiều cao tối thiểu'],
          ['maxRows', 'number', '12', 'Cao tối đa rồi mới cuộn'],
          ['maxLength', 'number', '', 'Hiện bộ đếm'],
        ]}
        usage={`<TextArea label="Nội dung" required rows={5} maxLength={5000}
  value={content} onChange={setContent} error={errors.content} />`}
      >
        <TextArea label="Ghi chú thành phần" maxLength={255} value={note} onChange={setNote}
          placeholder="Gõ thử nhiều dòng để thấy ô tự cao lên" hint="shop_dish.ingredient_note" />
      </Section>

      <Section
        code="2-03"
        title="PasswordField"
        file="components/PasswordField"
        when="Đăng ký, Đăng nhập (M-17). Có nút hiện/ẩn mật khẩu."
        note="Tài liệu chưa quy định độ mạnh mật khẩu. Tạm dùng rules.password(8), nhóm chốt rồi sửa trong src/utils/validate.js."
        props={[
          ['autoComplete', "'current-password'|'new-password'", "'current-password'", 'Đăng ký dùng new-password'],
          ['label', 'string', "'Mật khẩu'", ''],
        ]}
        usage={`<PasswordField value={pw} onChange={setPw} autoComplete="new-password"
  error={errors.password} hint="Ít nhất 8 ký tự" />`}
      >
        <div style={{ maxWidth: 360 }}>
          <PasswordField value={pw} onChange={setPw} autoComplete="new-password" hint="Ít nhất 8 ký tự" error={rules.password(8)(pw)} />
        </div>
      </Section>

      <Section
        code="2-04"
        title="Select"
        file="components/Select"
        when="chọn 1 trong nhiều lựa chọn (5 trở lên). Ít hơn thì dùng RadioGroup cho người dùng thấy hết."
        props={[
          ['options', '{value, label, disabled?}[]', '', 'Lấy từ hằng số: toOptions(ACTIVITY_LEVEL)'],
          ['placeholder', 'string', '', 'Dòng "Chọn..." đầu tiên'],
          ['size', "'sm'|'md'|'lg'", "'md'", ''],
        ]}
        usage={`import { Select, toOptions, REPORT_REASON } from '../components';

<Select label="Lý do báo cáo" required placeholder="Chọn lý do"
  options={toOptions(REPORT_REASON)} value={reason} onChange={setReason} />`}
      >
        <div style={{ maxWidth: 360 }}>
          <Select label="Lý do báo cáo" required placeholder="Chọn lý do" options={toOptions(REPORT_REASON)} value={reason} onChange={setReason}
            hint={reason ? `Giá trị gửi API: report.reason_code = '${reason}'` : 'Chọn thử để xem giá trị gửi lên API'} />
        </div>
      </Section>

      <Section
        code="2-05"
        title="RadioGroup"
        file="components/RadioGroup"
        when="chọn 1 trong 2 đến 5 lựa chọn, hiện hết ra. segmented: nút gộp ngang. card: thẻ có icon + mô tả cho lựa chọn quan trọng."
        props={[
          ['options', '{value, label, description?, icon?, disabled?}[]', '', ''],
          ['variant', "'list'|'segmented'|'card'", "'list'", ''],
          ['name', 'string', '', 'Tự sinh nếu bỏ trống'],
        ]}
        usage={`<RadioGroup variant="segmented" value={type} onChange={setType}
  options={[{ value: 'blog', label: 'Blog', icon: 'journal-text' },
            { value: 'video', label: 'Video', icon: 'play-btn' }]} />`}
      >
        <div>
          <DemoLabel>segmented · loại bài (post.post_type)</DemoLabel>
          <RadioGroup variant="segmented" value={postType} onChange={setPostType}
            options={[{ value: 'blog', label: 'Blog', icon: 'journal-text' }, { value: 'video', label: 'Video', icon: 'play-btn' }]} />
        </div>
        <div className={styles.grid2}>
          <RadioGroup label="Giới tính" options={toOptions(GENDER)} value={gender} onChange={setGender} />
          <RadioGroup label="Mục tiêu" variant="card" options={GOALS} value={goal} onChange={setGoal} />
        </div>
      </Section>

      <Section
        code="2-06"
        title="Checkbox"
        file="components/Checkbox"
        when="có / không: đồng ý điều khoản, ghi nhớ đăng nhập. switch: bật tắt có hiệu lực ngay (món đang bán)."
        props={[
          ['checked / onChange', 'boolean / (checked) => void', '', ''],
          ['children', 'ReactNode', '', 'Chữ bên cạnh'],
          ['switch', 'boolean', 'false', 'Dạng công tắc'],
          ['hint · error · required', '', '', ''],
        ]}
        usage={`<Checkbox checked={remember} onChange={setRemember}>Ghi nhớ đăng nhập</Checkbox>
<Checkbox switch checked={item.is_available} onChange={(v) => toggleAvailable(item.shop_dish_id, v)}>Đang bán</Checkbox>`}
      >
        <div className={styles.stackSm}>
          <Checkbox checked={remember} onChange={setRemember}>Ghi nhớ đăng nhập</Checkbox>
          <Checkbox switch checked={available} onChange={(v) => { setAvailable(v); toast(v ? 'Món đang bán' : 'Đã chuyển sang tạm hết', { tone: 'info' }); }}
            hint="shop_dish.is_available">
            Bún riêu chay đang bán
          </Checkbox>
          <Checkbox checked={false} error="Cần đồng ý để tiếp tục" required>Tôi đồng ý với quy định cộng đồng</Checkbox>
        </div>
      </Section>

      <Section
        code="2-07"
        title="CategoryPicker"
        file="components/CategoryPicker"
        when="chọn nhiều Category cho bài, món (quan hệ N-M). Nhiều hơn 12 danh mục thì tự hiện ô lọc nhanh, gõ không dấu cũng tìm được."
        props={[
          ['options', '{value, label}[]', '', 'category_id + name từ API'],
          ['value / onChange', '(id)[] / (ids) => void', '', ''],
          ['max', 'number', '', 'Đủ số thì khoá các chip còn lại'],
          ['searchFrom', 'number', '12', ''],
        ]}
        usage={`<CategoryPicker label="Danh mục" required max={3}
  options={categories.map((c) => ({ value: c.category_id, label: c.name }))}
  value={form.categoryIds} onChange={set('categoryIds')} error={errors.categoryIds} />`}
      >
        <CategoryPicker label="Danh mục" required max={3} options={CATEGORIES} value={cats} onChange={setCats} />
      </Section>

      <Section
        code="2-08"
        title="ChipInput"
        file="components/ChipInput"
        when="nhập nhiều chữ tự do: dị ứng, món kiêng (allergy), nguyên liệu đang có. Enter hoặc dấu phẩy để thêm, Backspace để xoá."
        props={[
          ['value / onChange', 'string[] / (values) => void', '', 'Tự bỏ trùng'],
          ['suggestions', 'string[]', '', 'Gợi ý bấm nhanh'],
          ['max', 'number', '', ''],
          ['maxLength', 'number', '50', 'Độ dài mỗi mục'],
        ]}
        usage={`<ChipInput label="Dị ứng / món kiêng" value={allergies} onChange={setAllergies}
  suggestions={['Đậu phộng', 'Gluten', 'Đậu nành']} max={10} />`}
      >
        <ChipInput label="Dị ứng / món kiêng" value={allergies} onChange={setAllergies} suggestions={ALLERGY_SUGGEST} max={10} />
      </Section>

      <Section
        code="2-09"
        title="NumberStepper"
        file="components/NumberStepper"
        when="số nhỏ có giới hạn: số ngày Meal Plan (1 đến 7), số bữa mỗi ngày, khẩu phần."
        props={[
          ['value / onChange', 'number / (value) => void', '', 'Luôn nằm trong [min, max]'],
          ['min · max · step', 'number', '0 · 99 · 1', ''],
          ['unit', 'string', '', '"ngày", "bữa", "người"'],
        ]}
        usage={'<NumberStepper label="Số ngày" min={1} max={7} unit="ngày" value={days} onChange={setDays} />'}
      >
        <NumberStepper label="Số ngày" min={1} max={7} unit="ngày" value={days} onChange={setDays} />
      </Section>

      <Section
        code="2-10"
        title="ImageUpload"
        file="components/ImageUpload"
        when="chọn ảnh bài blog, ảnh món, ảnh quán. Component không biết cloud nào: trang truyền hàm onUpload(file) trả về link ảnh (Cloudinary, Firebase... đều được)."
        note="Demo dưới đây giả lập tải lên. Bật 'Giả lập lỗi mạng' để xem trạng thái lỗi và nút Thử lại. Chọn file lớn hơn 5MB hoặc file PDF để xem báo lỗi định dạng."
        props={[
          ['value / onChange', 'string | string[]', '', '1 link, hoặc mảng link khi multiple'],
          ['onUpload', '(file, {onProgress, signal}) => Promise<string>', '', 'Tải lên cloud, trả về link. Gọi onProgress(0..100) để hiện %'],
          ['multiple', 'boolean', 'false', ''],
          ['max', 'number', '1 hoặc 5', ''],
          ['maxSizeMB', 'number', '5', ''],
          ['accept', 'string', "'image/jpeg,image/png,image/webp'", ''],
          ['ratio', "'1/1'|'4/3'|'16/9'", "'4/3'", 'Khung xem trước'],
        ]}
        usage={`// Người làm BE viết hàm này 1 lần trong src/services/upload.js
import { uploadImage } from '../services/upload';

<ImageUpload label="Ảnh món" value={form.image_url} onChange={set('image_url')}
  onUpload={uploadImage} ratio="4/3" />`}
      >
        <Checkbox switch checked={fail} onChange={setFail}>Giả lập lỗi mạng</Checkbox>
        <div className={styles.grid2}>
          <ImageUpload label="Ảnh đại diện quán" value={avatar} onChange={setAvatar} onUpload={mockUpload(fail)} ratio="1/1" />
          <ImageUpload label="Ảnh bài viết" multiple max={4} value={photos} onChange={setPhotos} onUpload={mockUpload(fail)} />
        </div>
      </Section>

      <Section
        code="2-11"
        title="SearchInput"
        file="components/SearchInput"
        when="ô tìm kiếm ở thanh trên, trang kết quả, danh sách quán, bảng admin. Bấm Enter mới gọi API (onSearch)."
        props={[
          ['value / onChange', 'string / (value) => void', '', 'Mỗi lần gõ'],
          ['onSearch', '(value) => void', '', 'Bấm Enter hoặc bấm ×'],
          ['loading', 'boolean', 'false', 'Vòng xoay thay kính lúp'],
          ['label', 'string', "'Tìm kiếm'", 'Cho trình đọc màn hình'],
        ]}
        usage={`<SearchInput value={q} onChange={setQ} onSearch={(v) => navigate(\`/search?q=\${v}\`)} loading={searching} />`}
      >
        <div style={{ maxWidth: 420 }}>
          <SearchInput value={q} onChange={setQ} onSearch={(v) => toast(v ? `Tìm: "${v}"` : 'Đã xoá tìm kiếm', { tone: 'info' })} />
        </div>
      </Section>

      <Section
        code="2-12"
        title="Pagination"
        file="components/Pagination"
        when="danh sách dài: kết quả tìm bài, danh sách quán, bảng admin. Trang bắt đầu từ 1. Trên điện thoại chỉ còn ‹ 6 / 20 ›."
        props={[
          ['page · totalPages', 'number', '', 'totalPages ≤ 1 thì ẩn'],
          ['onChange', '(page) => void', '', ''],
          ['totalItems · pageSize', 'number', '', 'Hiện "Hiển thị 51 đến 60 trong 196 bài"'],
          ['itemLabel', 'string', "'mục'", ''],
        ]}
        usage={'<Pagination page={page} totalPages={data.totalPages} onChange={setPage}\n  totalItems={data.total} pageSize={10} itemLabel="bài" />'}
      >
        <Pagination page={page} totalPages={20} onChange={setPage} totalItems={196} pageSize={10} itemLabel="bài" />
      </Section>

      <Section
        code="2-13"
        title="Form mẫu: Viết Blog (M-05)"
        file="kit/Batch2.jsx › BlogForm"
        when="làm form bất kỳ. Copy khung này: 1 object form, 1 object errors, hàm set(key), validate khi bấm gửi, Button loading khi đang gửi."
        note="Bấm Đăng bài khi để trống để thấy lỗi. Lỗi của ô nào tự tắt khi sửa ô đó."
        usage={`const [form, setForm] = useState({ title: '', categories: [], content: '' });
const [errors, setErrors] = useState({});
const [sending, setSending] = useState(false);
const set = (key) => (v) => {
  setForm((f) => ({ ...f, [key]: v }));
  if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
};

const submit = async (e) => {
  e.preventDefault();
  const errs = validate(form, {
    title: [rules.required('Nhập tiêu đề'), rules.maxLength(200)],
    categories: [rules.minItems(1, 'Chọn ít nhất 1 danh mục')],
  });
  setErrors(errs);
  if (hasErrors(errs)) return;
  setSending(true);
  try {
    await api.createPost(form);           // → post.status = 'pending'
    toast('Đã gửi bài. Bài đang chờ Admin duyệt.', { tone: 'info' });
  } catch (err) {
    setErrors(err.fieldErrors ?? {});     // lỗi từ BE (vd từ khoá cấm)
    toast(err.message, { tone: 'alert' });
  } finally {
    setSending(false);
  }
};`}
      >
        <div className={styles.box} style={{ maxWidth: 680 }}><BlogForm /></div>
      </Section>

      <Section
        code="2-14"
        title="Form mẫu: Meal Planner (M-10)"
        file="kit/Batch2.jsx › MealPlanForm"
        when="tham khảo cách ghép nhiều loại ô: số có đơn vị, segmented, select, thẻ chọn, chip, stepper, checkbox đồng ý."
        note="Giá trị gửi API giữ đúng enum database: gender, activity_level, health_goal, days_count, meals_per_day."
      >
        <div className={styles.box} style={{ maxWidth: 680 }}><MealPlanForm /></div>
      </Section>
    </>
  );
}
