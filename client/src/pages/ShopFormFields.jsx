// Tùng — Sprint 2: composition UI kit cho form/snapshot Shop, không thay component dùng chung.
// Tùng — Sprint 2: BRIDGE-02A Shop dùng cùng sidebar với Bảng tin/Profile.
import MemberNavigationLayout from '../components/MemberNavigationLayout';
import TextField from '../components/TextField/TextField';
import Checkbox from '../components/Checkbox/Checkbox';
import Select from '../components/Select/Select';
import styles from './ShopFormFields.module.css';

export const SHOP_DAY_LABELS = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
export const SUBMISSION_LABELS = { registration: 'Đăng ký lần đầu', resubmission: 'Đăng ký lại', identity_edit: 'Sửa thông tin quán' };
const FIELD_LABELS = { name: 'Tên quán', address: 'Địa chỉ', phone: 'Điện thoại' };
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour).padStart(2, '0'), label: `${hour}g` }));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => ({ value: String(minute).padStart(2, '0'), label: String(minute).padStart(2, '0') }));

export function emptyShopForm() {
  return { name: '', address: '', phone: '', schedule: SHOP_DAY_LABELS.map((_, index) => ({
    dayOfWeek: index + 1, isClosed: true, openTime: null, closeTime: null,
  })) };
}

export function ShopMemberShell({ children }) {
  // Tùng — Sprint 2: navigation chung giữ theme, profile/logout, collapse và nút Shop.
  return <MemberNavigationLayout>{children}</MemberNavigationLayout>;
}

export function ShopIdentityFields({ value, onChange, errors = {}, disabled = false }) {
  const update = (field, next) => onChange({ ...value, [field]: next });
  return <fieldset disabled={disabled} className={styles.fields}>
    <legend className="visually-hidden">Thông tin nhận diện quán</legend>
    <TextField label="Tên quán" value={value.name} onChange={next => update('name', next)} required maxLength={200} error={errors.name} autoComplete="organization" />
    <TextField label="Địa chỉ" value={value.address} onChange={next => update('address', next)} required maxLength={300} error={errors.address} autoComplete="street-address" />
    <TextField label="Điện thoại" type="tel" value={value.phone} onChange={next => update('phone', next)} required maxLength={20} error={errors.phone} autoComplete="tel" hint="Số điện thoại Việt Nam, ví dụ 0901234567 hoặc +84901234567." />
  </fieldset>;
}

function TimeSelect({ label, value, onChange, disabled }) {
  const hour = value ? value.slice(0, 2) : '';
  const minute = value ? value.slice(3, 5) : '';
  return <div className={styles.time}>
    <Select label={label} options={HOUR_OPTIONS} placeholder="Giờ" value={hour} required={!disabled} disabled={disabled}
      onChange={next => onChange(`${next}:${minute || '00'}`)} />
    <Select label="Phút" options={MINUTE_OPTIONS} placeholder="Phút" value={minute} disabled={disabled || !hour}
      onChange={next => onChange(`${hour}:${next}`)} />
  </div>;
}

export function ShopScheduleFields({ value, onChange, errors = {}, disabled = false }) {
  const update = (index, patch) => onChange(value.map((day, current) => current === index ? { ...day, ...patch } : day));
  return <fieldset disabled={disabled} className={styles.fields}>
    <legend className={styles.legend}>Lịch mở cửa</legend>
    <p className={styles.hint}>Giờ Việt Nam · 24 giờ · chọn ít nhất một ngày mở cửa. Giờ đóng phải sau giờ mở, trong cùng ngày.</p>
    {errors.schedule && <p className={styles.error} role="alert">{errors.schedule}</p>}
    {value.map((day, index) => <div key={day.dayOfWeek} className={styles.day}>
      <Checkbox checked={!day.isClosed} disabled={disabled}
        onChange={open => update(index, { isClosed: !open, openTime: open ? '' : null, closeTime: open ? '' : null })}>
        {SHOP_DAY_LABELS[day.dayOfWeek - 1]} {day.isClosed && <small>· Nghỉ</small>}
      </Checkbox>
      <TimeSelect label="Mở cửa" value={day.openTime} disabled={disabled || day.isClosed} onChange={openTime => update(index, { openTime })} />
      <TimeSelect label="Đóng cửa" value={day.closeTime} disabled={disabled || day.isClosed} onChange={closeTime => update(index, { closeTime })} />
      {errors[`schedule.${day.dayOfWeek}`] && <p className={styles.error} role="alert">{errors[`schedule.${day.dayOfWeek}`]}</p>}
    </div>)}
  </fieldset>;
}

export function ShopSnapshot({ value }) {
  if (!value) return <p className={styles.hint}>Chưa có bản trước khi gửi.</p>;
  return <div className={styles.snapshot}>
    <dl>{Object.entries(FIELD_LABELS).filter(([key]) => Object.hasOwn(value, key)).map(([key, label]) =>
      <div key={key}><dt>{label}</dt><dd>{value[key] || 'Chưa có'}</dd></div>)}</dl>
    {Array.isArray(value.schedule) && <ul className={styles.scheduleList} aria-label="Lịch mở cửa">
      {value.schedule.map(day => <li key={day.dayOfWeek}><span>{SHOP_DAY_LABELS[day.dayOfWeek - 1]}</span>
        <b>{day.isClosed ? 'Nghỉ' : `${day.openTime} – ${day.closeTime}`}</b></li>)}
    </ul>}
  </div>;
}

export function ShopSubmissionStatus({ status }) {
  const labels = { pending: 'Hồ sơ chờ duyệt', accepted: 'Hồ sơ đã được duyệt', rejected: 'Hồ sơ bị từ chối' };
  return <span className={`${styles.submission} ${styles[status] || ''}`}>{labels[status] || status}</span>;
}

export function shopDate(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'Chưa có';
}
