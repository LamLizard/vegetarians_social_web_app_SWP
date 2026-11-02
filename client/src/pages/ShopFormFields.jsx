// Tùng — Sprint 2: composition riêng của ba trang Shop; kit và navigation giữ nguyên.
import { useCallback, useEffect, useRef, useState } from 'react';
import MemberNavigationLayout from '../components/MemberNavigationLayout';
import Button from '../components/Button/Button';
import IconButton from '../components/IconButton/IconButton';
import TextField from '../components/TextField/TextField';
import Checkbox from '../components/Checkbox/Checkbox';
import ImageUpload from '../components/ImageUpload/ImageUpload';
import Modal from '../components/Modal/Modal';
import Photo from '../components/Photo/Photo';
import Select from '../components/Select/Select';
import shopImageUploadService from '../services/shopImageUpload.service';
// Tùng — Sprint 3: editor lịch mới tách riêng, bảo toàn helper và editor cũ.
import ShopScheduleEditor from './ShopScheduleEditor';
import styles from './ShopFormFields.module.css';

export const SHOP_DAY_LABELS = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
export const SUBMISSION_LABELS = { registration: 'Đăng ký lần đầu', resubmission: 'Đăng ký lại', identity_edit: 'Sửa thông tin quán' };
export const SHOP_OPERATING_LABELS = { active: 'Được phép hoạt động', inactive: 'Tạm ngưng hoạt động' };
export function ShopOperatingStatus({ status, showLabel = false }) {
  const label = SHOP_OPERATING_LABELS[status] || 'Chưa có trạng thái hoạt động';
  return <span className={`${styles.operatingStatus} ${status === 'active' ? styles.operatingActive : styles.operatingInactive}`} title={label}>
    <i className={`bi bi-${status === 'active' ? 'unlock-fill' : 'lock-fill'}`} role="img" aria-label={showLabel ? undefined : label} aria-hidden={showLabel || undefined} />
    {showLabel && <span>{label}</span>}
  </span>;
}
const FIELD_LABELS = { name: 'Tên quán', address: 'Địa chỉ', phone: 'Điện thoại', avtShopUrl: 'Ảnh quán' };
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour).padStart(2, '0'), label: `${hour}g` }));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => ({ value: String(minute).padStart(2, '0'), label: String(minute).padStart(2, '0') }));
const EMPTY_SLOT = () => ({ openTime: '', closeTime: '' });
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function emptyShopForm() {
  return { name: '', address: '', phone: '', avtShopUrl: '', schedule: SHOP_DAY_LABELS.map((_, index) => ({
    dayOfWeek: index + 1, isClosed: true, slots: [],
  })) };
}

export function shopIdentityValue(shop) {
  return { name: shop.name, address: shop.address, phone: shop.phone || '', avtShopUrl: shop.avtShopUrl || '' };
}

export function cloneShopSchedule(schedule) {
  return schedule.map(day => ({ ...day, slots: day.slots.map(slot => ({ ...slot })) }));
}

function scheduleKey(schedule) {
  return JSON.stringify(schedule.map(day => ({ dayOfWeek: day.dayOfWeek, isClosed: day.isClosed,
    slots: day.slots.map(slot => ({ openTime: slot.openTime, closeTime: slot.closeTime }))
      .sort((a, b) => a.openTime.localeCompare(b.openTime) || a.closeTime.localeCompare(b.closeTime)),
  })).sort((a, b) => a.dayOfWeek - b.dayOfWeek));
}

export function shopSchedulesEqual(left, right) {
  return scheduleKey(left) === scheduleKey(right);
}

export function validateShopSchedule(schedule) {
  const errors = {};
  // Tùng — user cho phép tuần nghỉ toàn bộ; vẫn kiểm tra đầy đủ ca của ngày mở.
  schedule.forEach(day => {
    if (day.isClosed) return;
    const key = `schedule.${day.dayOfWeek}`;
    if (!day.slots.length) { errors[key] = 'Ngày mở cửa cần ít nhất một ca.'; return; }
    day.slots.forEach((slot, index) => {
      const slotKey = `${key}.slots.${index}`;
      if (!TIME_PATTERN.test(slot.openTime) || !TIME_PATTERN.test(slot.closeTime)) errors[slotKey] = 'Chọn đủ giờ mở và giờ đóng.';
      else if (slot.closeTime <= slot.openTime) errors[slotKey] = 'Giờ đóng phải sau giờ mở trong cùng ngày.';
    });
    const slots = [...day.slots].sort((a, b) => a.openTime.localeCompare(b.openTime));
    if (!Object.keys(errors).some(errorKey => errorKey.startsWith(`${key}.slots.`))
      && slots.some((slot, index) => index > 0 && slot.openTime < slots[index - 1].closeTime)) {
      errors[key] = 'Các ca trong cùng ngày không được chồng lấn.';
    }
  });
  return errors;
}

export function ShopMemberShell({ children }) {
  return <MemberNavigationLayout>{children}</MemberNavigationLayout>;
}

function changedIdentityKeys(beforeValue = {}, afterValue = {}) {
  return Object.keys(FIELD_LABELS).filter(key => Object.hasOwn(afterValue, key)
    && (beforeValue[key] ?? '') !== (afterValue[key] ?? ''));
}

function IdentityComparisonField({ field, current, proposed, beforeLabel = 'Hiện tại', afterLabel = 'Đề xuất' }) {
  const image = field === 'avtShopUrl';
  return <section className={styles.pendingField} aria-label={`${FIELD_LABELS[field]} thay đổi`}>
    <div className={styles.pendingHeading}><b>{FIELD_LABELS[field]}</b></div>
    <div className={styles.comparison}>
      <div><span className={styles.valueLabel}>{beforeLabel}</span>{image
        ? <Photo src={current} alt={`Ảnh quán · ${beforeLabel}`} ratio="1/1" shape="rounded" className={styles.image} />
        : <p>{current || 'Chưa có'}</p>}</div>
      <div><span className={styles.valueLabel}>{afterLabel}</span>{image
        ? <Photo src={proposed} alt={`Ảnh quán · ${afterLabel}`} ratio="1/1" shape="rounded" className={styles.image} />
        : <p>{proposed || 'Chưa có'}</p>}</div>
    </div>
  </section>;
}

export function ShopIdentityComparison({ beforeValue, afterValue, status }) {
  const before = beforeValue || {};
  const after = afterValue || {};
  const keys = changedIdentityKeys(before, after);
  return <div className={styles.fields}>{keys.map(field => <IdentityComparisonField key={field} field={field}
    current={before[field]} proposed={after[field]} beforeLabel={status && status !== 'pending' ? 'Trước khi gửi' : 'Hiện tại'}
    afterLabel={status === 'accepted' ? 'Đã duyệt' : 'Đề xuất'} />)}
    {!keys.length && <p className={styles.hint}>Hồ sơ không có thông tin nhận diện thay đổi.</p>}
  </div>;
}

export function ShopIdentityFields({ value, onChange, errors = {}, disabled = false, pendingSubmission, onUploadStateChange, onShopUnavailable, desktopColumns = false }) {
  const latest = useRef({ value, onChange, onUploadStateChange, onShopUnavailable });
  latest.current = { value, onChange, onUploadStateChange, onShopUnavailable };
  const uploads = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const upload = useCallback(async (file, options) => {
    uploads.current += 1;
    if (alive.current) latest.current.onUploadStateChange?.(true);
    try { return await shopImageUploadService.upload(file, options); }
    catch (error) {
      if (alive.current && error.details?.code === 'SHOP_INACTIVE') latest.current.onShopUnavailable?.(error.message);
      throw error;
    }
    finally {
      uploads.current -= 1;
      if (alive.current) latest.current.onUploadStateChange?.(uploads.current > 0);
    }
  }, []);
  const update = (field, next) => latest.current.onChange({ ...latest.current.value, [field]: next });
  const before = pendingSubmission?.beforeValue || {};
  const after = pendingSubmission?.afterValue || {};
  const changed = changedIdentityKeys(before, after);
  const pendingField = field => changed.includes(field) ? <IdentityComparisonField field={field}
    current={before[field]} proposed={after[field]} /> : null;
  return <fieldset disabled={disabled} className={`${styles.fields} ${desktopColumns ? styles.identityColumns : ''}`}>
    <legend className="visually-hidden">Thông tin nhận diện quán</legend>
    <div className={styles.identityText}>
    {pendingField('name') || <TextField label="Tên quán" value={value.name} onChange={next => update('name', next)} required maxLength={200} error={errors.name} autoComplete="organization" />}
    {pendingField('address') || <TextField label="Địa chỉ" value={value.address} onChange={next => update('address', next)} required maxLength={300} error={errors.address} autoComplete="street-address" />}
    {pendingField('phone') || <TextField label="Điện thoại" type="tel" value={value.phone} onChange={next => update('phone', next)} required maxLength={20} error={errors.phone} autoComplete="tel" hint="Số điện thoại Việt Nam, ví dụ 0901234567 hoặc +84901234567." />}
    </div>
    <div className={styles.identityImage}>
    {pendingField('avtShopUrl') || <ImageUpload label="Ảnh quán" value={value.avtShopUrl} onChange={url => update('avtShopUrl', url)}
      onUpload={upload} maxSizeMB={5} required disabled={disabled} error={errors.avtShopUrl}
      hint="Một ảnh JPG, PNG hoặc WEBP, tối đa 5 MB. Ảnh mới được áp dụng sau khi quản trị viên duyệt." className={styles.imageField} />}
    </div>
  </fieldset>;
}

function TimeSelect({ label, value, onChange, disabled, error }) {
  const hour = value ? value.slice(0, 2) : '';
  const minute = value ? value.slice(3, 5) : '';
  return <div className={styles.time}>
    <Select label={label} options={HOUR_OPTIONS} placeholder="Giờ" value={hour} required={!disabled} disabled={disabled} error={error}
      onChange={next => onChange(`${next}:${minute || '00'}`)} />
    <Select label="Phút" options={MINUTE_OPTIONS} placeholder="Phút" value={minute} disabled={disabled || !hour}
      onChange={next => onChange(`${hour}:${next}`)} />
  </div>;
}

function ScheduleCopyDialog({ source, disabled, onClose, onCopy }) {
  const [targets, setTargets] = useState([]);
  return <Modal open title={`Sao chép lịch ${SHOP_DAY_LABELS[source.dayOfWeek - 1]}`} onClose={onClose} dismissible={!disabled}
    footer={<><Button variant="subtle" disabled={disabled} onClick={onClose}>Hủy</Button>
      <Button disabled={disabled || !targets.length} onClick={() => { onCopy(targets); onClose(); }}>Sao chép vào bản nháp</Button></>}>
    <p className={styles.hint}>Ghi đè toàn bộ ca của ngày được chọn và chuyển ngày đó sang Mở. Lịch được ghi nhận khi bạn gửi hoặc lưu form.</p>
    <div className={styles.copyDays}>{SHOP_DAY_LABELS.map((label, index) => index + 1 !== source.dayOfWeek
      ? <Checkbox key={label} checked={targets.includes(index + 1)} disabled={disabled}
        onChange={checked => setTargets(current => checked ? [...current, index + 1] : current.filter(day => day !== index + 1))}>{label}</Checkbox>
      : null)}</div>
  </Modal>;
}

// Tùng — Sprint 3: giữ nguyên body cũ để bảo toàn code, hai page dùng wrapper mới bên dưới.
export function LegacyShopScheduleFields({ value, onChange, errors = {}, disabled = false, savedSchedule, allowCopy = false, showHeading = true }) {
  const [copyDay, setCopyDay] = useState(null);
  const update = (dayOfWeek, patch) => onChange(value.map(day => day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day));
  const updateSlot = (day, index, patch) => update(day.dayOfWeek, { slots: day.slots.map((slot, current) => current === index ? { ...slot, ...patch } : slot) });
  const source = value.find(day => day.dayOfWeek === copyDay);
  return <fieldset disabled={disabled} className={styles.fields}>
    <legend className={showHeading ? styles.legend : 'visually-hidden'}>Lịch mở cửa</legend>
    <p className={styles.hint}>Giờ Việt Nam · 24 giờ · chọn ít nhất một ngày mở cửa. Các ca trong ngày không được chồng lấn.</p>
    {errors.schedule && <p className={styles.error} role="alert">{errors.schedule}</p>}
    {value.map(day => {
      const saved = savedSchedule?.find(item => item.dayOfWeek === day.dayOfWeek);
      const changed = saved && !shopSchedulesEqual([saved], [day]);
      const dayKey = `schedule.${day.dayOfWeek}`;
      const dayError = errors[dayKey] || errors[`${dayKey}.slots`] || errors[`${dayKey}.isClosed`];
      return <section key={day.dayOfWeek} className={styles.day}>
        <div className={styles.dayHeading}><Checkbox checked={!day.isClosed} disabled={disabled}
          onChange={open => update(day.dayOfWeek, { isClosed: !open, slots: open ? [EMPTY_SLOT()] : [] })}>
          {SHOP_DAY_LABELS[day.dayOfWeek - 1]} <small>· {day.isClosed ? 'Nghỉ' : 'Mở'}</small>
        </Checkbox>{changed && <span className={styles.changed}>Đã thay đổi</span>}</div>
        {!day.isClosed && <div className={styles.slots}>{day.slots.map((slot, index) => {
          const key = `schedule.${day.dayOfWeek}.slots.${index}`;
          return <div key={index} className={styles.slot}>
            <span className={styles.slotLabel}>Ca {index + 1}</span>
            <TimeSelect label="Mở cửa" value={slot.openTime} disabled={disabled} error={errors[`${key}.openTime`]} onChange={openTime => updateSlot(day, index, { openTime })} />
            <TimeSelect label="Đóng cửa" value={slot.closeTime} disabled={disabled} error={errors[`${key}.closeTime`]} onChange={closeTime => updateSlot(day, index, { closeTime })} />
            <Button variant="subtle" size="sm" disabled={disabled} onClick={() => {
              const slots = day.slots.filter((_, current) => current !== index);
              update(day.dayOfWeek, { slots, isClosed: !slots.length });
            }}>Xóa ca</Button>
            {errors[key] && <p className={styles.error} role="alert">{errors[key]}</p>}
          </div>;
        })}<div className={styles.dayActions}>
          <Button size="sm" variant="outline" icon="plus-lg" disabled={disabled} onClick={() => update(day.dayOfWeek, { slots: [...day.slots, EMPTY_SLOT()] })}>Thêm ca</Button>
          {allowCopy && <IconButton size="sm" variant="ghost" icon="copy" label="Sao chép sang ngày khác" disabled={disabled || !day.slots.length} onClick={() => setCopyDay(day.dayOfWeek)} />}
        </div></div>}
        {dayError && <p className={styles.error} role="alert">{dayError}</p>}
      </section>;
    })}
    {source && <ScheduleCopyDialog source={source} disabled={disabled} onClose={() => setCopyDay(null)} onCopy={targets => {
      onChange(value.map(day => targets.includes(day.dayOfWeek) ? { ...day, isClosed: false, slots: source.slots.map(slot => ({ ...slot })) } : day));
    }} />}
  </fieldset>;
}

// Tùng — Sprint 3: giữ props công khai và inject helper, tránh import vòng từ editor.
export function ShopScheduleFields(props) {
  return <ShopScheduleEditor {...props} dayLabels={SHOP_DAY_LABELS} validateSchedule={validateShopSchedule} schedulesEqual={shopSchedulesEqual} />;
}

function displayTime(value) {
  if (!TIME_PATTERN.test(value)) return 'Chưa có';
  return `${Number(value.slice(0, 2))}g${value.slice(3) === '00' ? '' : value.slice(3)}`;
}

export function ShopSnapshot({ value }) {
  if (!value) return <p className={styles.hint}>Chưa có bản trước khi gửi.</p>;
  const hasImage = Object.hasOwn(value, 'avtShopUrl');
  const identityFields = Object.entries(FIELD_LABELS).filter(([key]) => key !== 'avtShopUrl' && Object.hasOwn(value, key));
  return <div className={`${styles.snapshot} ${hasImage ? styles.snapshotWithImage : ''}`}>
    {identityFields.length > 0 && <dl>{identityFields.map(([key, label]) =>
      <div key={key}><dt>{label}</dt><dd>{value[key] || 'Chưa có'}</dd></div>)}</dl>}
    {hasImage && <Photo src={value.avtShopUrl} alt={`Ảnh quán ${value.name || ''}`} ratio="1/1" shape="rounded" className={styles.snapshotImage} />}
    {Array.isArray(value.schedule) && !value.schedule.length && <p className={`${styles.hint} ${styles.snapshotSchedule}`}>Chưa cập nhật lịch mở cửa.</p>}
    {Array.isArray(value.schedule) && value.schedule.length > 0 && <ul className={`${styles.scheduleList} ${styles.snapshotSchedule}`} aria-label="Lịch mở cửa">
      {value.schedule.map(day => <li key={day.dayOfWeek}><span>{SHOP_DAY_LABELS[day.dayOfWeek - 1]}</span>
        <div>{day.isClosed ? <b>Nghỉ</b> : Array.isArray(day.slots) && day.slots.length
          ? day.slots.map((slot, index) => <b key={index}>{displayTime(slot.openTime)} – {displayTime(slot.closeTime)}</b>)
          : <b>Lịch chưa đầy đủ</b>}</div></li>)}
    </ul>}
  </div>;
}

export function ShopSubmissionStatus({ status }) {
  const labels = { pending: 'Hồ sơ chờ duyệt', accepted: 'Hồ sơ đã được duyệt', rejected: 'Hồ sơ bị từ chối' };
  return <span className={`${styles.submission} ${styles[status] || ''}`}>{labels[status] || status}</span>;
}

const SHOP_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' });

export function shopDate(value) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có';
  const parts = Object.fromEntries(SHOP_DATE_FORMAT.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
