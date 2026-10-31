// Tùng — Sprint 3: lịch tuần gọn, giữ dữ liệu nháp và validation tại page.
import { useEffect, useId, useRef, useState } from 'react';
import Button from '../components/Button/Button';
import Checkbox from '../components/Checkbox/Checkbox';
import IconButton from '../components/IconButton/IconButton';
import Modal from '../components/Modal/Modal';
import Select from '../components/Select/Select';
import styles from './ShopScheduleEditor.module.css';

const emptySlot = () => ({ openTime: '', closeTime: '' });
const cloneSlots = slots => slots.map(slot => ({ ...slot }));
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour).padStart(2, '0'), label: `${hour}g` }));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => ({ value: String(minute).padStart(2, '0'), label: String(minute).padStart(2, '0') }));

// Tùng — sửa theo góp ý: Select giờ/phút cho cả ngày và mẫu, giữ đủ từng phút.
function TimeSelect({ id, label, accessibleLabel, path, value, onChange, disabled, error }) {
  const hour = value ? value.slice(0, 2) : '';
  const minute = value ? value.slice(3, 5) : '';
  return <div className={styles.timeSelect}>
    <Select id={`${id}-hour`} label={label} aria-label={`${accessibleLabel}, giờ`} options={HOUR_OPTIONS}
      placeholder="Giờ" value={hour} disabled={disabled} error={error} data-schedule-path={path}
      onChange={next => onChange(`${next}:${minute || '00'}`)} />
    <Select id={`${id}-minute`} label="Phút" aria-label={`${accessibleLabel}, phút`} options={MINUTE_OPTIONS}
      placeholder="Phút" value={minute} disabled={disabled || !hour} onChange={next => onChange(`${hour}:${next}`)} />
  </div>;
}

function focusSchedulePath(root, path) {
  const target = [...(root?.querySelectorAll('[data-schedule-path]') || [])]
    .find(element => element.dataset.schedulePath === path);
  if (!target) return false;
  target.focus();
  return true;
}

function firstErrorTarget(errors, week) {
  const path = Object.keys(errors).filter(key => key === 'schedule' || key.startsWith('schedule.'))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))[0];
  if (!path || path === 'schedule') return path ? { path } : null;
  const match = /^schedule\.(\d+)(?:\.slots\.(\d+)(?:\.(openTime|closeTime))?)?/.exec(path);
  if (!match) return { path: 'schedule' };
  const dayOfWeek = Number(match[1]);
  const day = week.find(item => item.dayOfWeek === dayOfWeek);
  if (!day || day.isClosed || !day.slots.length) return { dayOfWeek, path: `schedule.${dayOfWeek}.isClosed` };
  const index = match[2] === undefined ? 0 : Number(match[2]);
  const slot = day.slots[index];
  if (!slot) return { dayOfWeek, path: `schedule.${dayOfWeek}` };
  const field = match[3] || (TIME_PATTERN.test(slot.openTime) ? 'closeTime' : 'openTime');
  return { dayOfWeek, path: `schedule.${dayOfWeek}.slots.${index}.${field}` };
}

function SlotFields({ slots, dayLabel, basePath, errors, disabled, onChange, onRemove }) {
  const id = useId();
  return <div className={styles.slots}>{slots.map((slot, index) => {
    const path = `${basePath}.slots.${index}`;
    const openError = errors[`${path}.openTime`] || (!TIME_PATTERN.test(slot.openTime) ? errors[path] : undefined);
    const closeError = errors[`${path}.closeTime`] || (TIME_PATTERN.test(slot.openTime) || !TIME_PATTERN.test(slot.closeTime) ? errors[path] : undefined);
    return <div key={index} className={styles.slot}>
      <b className={styles.slotLabel}>Ca {index + 1}</b>
      <TimeSelect id={`${id}-${index}-open`} label="Giờ mở" accessibleLabel={`${dayLabel}, ca ${index + 1}, giờ mở`}
        value={slot.openTime} disabled={disabled} path={`${path}.openTime`} error={openError}
        onChange={openTime => onChange(index, { openTime })} />
      <TimeSelect id={`${id}-${index}-close`} label="Giờ đóng" accessibleLabel={`${dayLabel}, ca ${index + 1}, giờ đóng`}
        value={slot.closeTime} disabled={disabled} path={`${path}.closeTime`} error={closeError}
        onChange={closeTime => onChange(index, { closeTime })} />
      <Button type="button" size="sm" variant="subtle" disabled={disabled} onClick={() => onRemove(index)}
        aria-label={`Xóa ca ${index + 1} của ${dayLabel}`}>Xóa ca</Button>
    </div>;
  })}</div>;
}

function QuickSetupDialog({ source, week, dayLabels, validateSchedule, disabled, onApply, onClose }) {
  const [slots, setSlots] = useState(() => source ? cloneSlots(source.slots) : [emptySlot()]);
  const [targets, setTargets] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const root = useRef(null);
  const pendingFocus = useRef(null);
  const template = { dayOfWeek: 1, isClosed: false, slots };
  const templateErrors = validateSchedule([template]);
  const availableDays = week.filter(day => day.dayOfWeek !== source?.dayOfWeek);
  const closedTargets = week.filter(day => targets.includes(day.dayOfWeek) && day.isClosed);

  useEffect(() => {
    if (!disabled && pendingFocus.current && focusSchedulePath(root.current, pendingFocus.current)) pendingFocus.current = null;
  }, [slots, showErrors, disabled]);

  const apply = () => {
    if (disabled) return;
    setShowErrors(true);
    if (Object.keys(templateErrors).length) {
      const target = firstErrorTarget(templateErrors, [template]);
      pendingFocus.current = target?.path || 'schedule.1';
      if (focusSchedulePath(root.current, pendingFocus.current)) pendingFocus.current = null;
      return;
    }
    if (!targets.length) { focusSchedulePath(root.current, 'targets'); return; }
    onApply(targets, slots);
    onClose();
  };
  const onKeyDown = event => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.target.closest('button')) return;
    // Tùng — Enter trên Select chỉ chọn giờ, không áp mẫu hay submit form cha.
    if (event.target.closest('select')) { event.stopPropagation(); return; }
    event.preventDefault();
    event.stopPropagation();
    apply();
  };
  return <div ref={root} role="group" aria-label="Thiết lập lịch trên bản nháp" onKeyDown={onKeyDown}>
    <Modal open size="lg" title={source ? `Sao chép lịch ${dayLabels[source.dayOfWeek - 1]}` : 'Thiết lập nhanh lịch mở cửa'}
      description="Áp dụng một lần vào bản nháp. Lịch chỉ được ghi nhận khi bạn lưu hoặc gửi form."
      onClose={onClose} dismissible={!disabled}
      footer={<><Button type="button" variant="subtle" disabled={disabled} onClick={onClose}>Hủy</Button>
        <Button type="button" disabled={disabled || !targets.length || Object.keys(templateErrors).length > 0} onClick={apply}>
          {source ? 'Sao chép vào bản nháp' : 'Áp dụng vào bản nháp'}
        </Button></>}>
      <div className={styles.quickSetup}>
        <div className={styles.template} onBlur={() => setShowErrors(true)} tabIndex={-1} data-schedule-path="schedule.1">
          <p className={styles.hint}>Mẫu giờ HH:mm · có thể thêm nhiều ca, không qua đêm và không chồng lấn.</p>
          <SlotFields slots={slots} dayLabel={source ? `Mẫu từ ${dayLabels[source.dayOfWeek - 1]}` : 'Mẫu giờ'}
            basePath="schedule.1" errors={showErrors ? templateErrors : {}} disabled={disabled}
            onChange={(index, patch) => { if (!disabled) setSlots(current => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...patch } : slot)); }}
            onRemove={index => {
              if (disabled) return;
              const next = slots.filter((_, slotIndex) => slotIndex !== index);
              pendingFocus.current = next.length ? `schedule.1.slots.${Math.min(index, next.length - 1)}.openTime` : 'template-add';
              setSlots(next);
            }} />
          {showErrors && templateErrors['schedule.1'] && <p className={styles.error} role="alert">{templateErrors['schedule.1']}</p>}
          <Button type="button" size="sm" variant="outline" icon="plus-lg" disabled={disabled} data-schedule-path="template-add"
            onClick={() => {
              if (disabled) return;
              pendingFocus.current = `schedule.1.slots.${slots.length}.openTime`;
              setSlots(current => [...current, emptySlot()]);
            }}>Thêm khung giờ</Button>
        </div>
        <fieldset disabled={disabled} className={styles.targets} tabIndex={-1} data-schedule-path="targets">
          <legend className={styles.legend}>Áp dụng cho ngày</legend>
          <div className={styles.presets}>
            <Button type="button" size="sm" variant="subtle" disabled={disabled}
              onClick={() => setTargets(availableDays.filter(day => day.dayOfWeek <= 5).map(day => day.dayOfWeek))}>Ngày thường</Button>
            <Button type="button" size="sm" variant="subtle" disabled={disabled}
              onClick={() => setTargets(availableDays.map(day => day.dayOfWeek))}>Cả tuần</Button>
            <Button type="button" size="sm" variant="subtle" disabled={disabled} onClick={() => setTargets([])}>Bỏ chọn</Button>
          </div>
          {source && <p className={styles.hint}>Ngày nguồn {dayLabels[source.dayOfWeek - 1]} được giữ nguyên và không nằm trong các ngày đích.</p>}
          <div className={styles.targetDays}>{availableDays.map(day => <Checkbox key={day.dayOfWeek} disabled={disabled}
            checked={targets.includes(day.dayOfWeek)} onChange={checked => setTargets(current => checked
              ? [...current, day.dayOfWeek] : current.filter(dayOfWeek => dayOfWeek !== day.dayOfWeek))}>{dayLabels[day.dayOfWeek - 1]}</Checkbox>)}</div>
          {!targets.length && <p className={showErrors ? styles.error : styles.hint} role={showErrors ? 'alert' : undefined}>Chọn ít nhất một ngày đích.</p>}
        </fieldset>
        {targets.length > 0 && <p className={styles.overwrite} aria-live="polite">
          Ghi đè toàn bộ ca của {targets.length} ngày: {dayLabels.filter((_, index) => targets.includes(index + 1)).join(', ')}.
          {' '}{closedTargets.length ? `Ngày đang Nghỉ sẽ chuyển Mở: ${closedTargets.map(day => dayLabels[day.dayOfWeek - 1]).join(', ')}.` : 'Không có ngày Nghỉ được chuyển Mở.'}
          {' '}Ngày không chọn được giữ nguyên. Sau khi áp dụng, bạn có thể sửa riêng từng ngày.
        </p>}
      </div>
    </Modal>
  </div>;
}

export default function ShopScheduleEditor({ value, onChange, errors = {}, disabled = false, savedSchedule,
  allowCopy = false, showHeading = true, validationAttempt = 0, dayLabels, validateSchedule, schedulesEqual }) {
  const [expandedDay, setExpandedDay] = useState(null);
  const [quickSetup, setQuickSetup] = useState(null);
  const root = useRef(null);
  const pendingFocus = useRef(null);
  const handledErrors = useRef(null);
  const id = useId();

  useEffect(() => {
    if (disabled) return;
    const scheduleErrors = Object.entries(errors).filter(([path]) => path === 'schedule' || path.startsWith('schedule.'));
    const signature = JSON.stringify([validationAttempt, scheduleErrors]);
    if (handledErrors.current === signature) return;
    handledErrors.current = signature;
    const target = firstErrorTarget(Object.fromEntries(scheduleErrors), value);
    if (!target) return;
    if (target.dayOfWeek) setExpandedDay(target.dayOfWeek);
    pendingFocus.current = target.path;
  }, [errors, validationAttempt, disabled, value]);

  useEffect(() => {
    if (!disabled && pendingFocus.current && focusSchedulePath(root.current, pendingFocus.current)) pendingFocus.current = null;
  }, [expandedDay, value, errors, validationAttempt, disabled]);

  const update = (dayOfWeek, patch) => {
    if (!disabled) onChange(value.map(day => day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day));
  };
  const editDay = day => {
    if (disabled) return;
    setExpandedDay(current => current === day.dayOfWeek ? null : day.dayOfWeek);
  };
  const toggleDay = (day, open) => {
    if (disabled) return;
    if (open) {
      pendingFocus.current = `schedule.${day.dayOfWeek}.slots.0.openTime`;
      setExpandedDay(day.dayOfWeek);
    } else if (expandedDay === day.dayOfWeek) setExpandedDay(null);
    update(day.dayOfWeek, { isClosed: !open, slots: open ? [emptySlot()] : [] });
  };
  const addSlot = day => {
    if (disabled) return;
    pendingFocus.current = `schedule.${day.dayOfWeek}.slots.${day.slots.length}.openTime`;
    update(day.dayOfWeek, { slots: [...day.slots, emptySlot()] });
  };
  const removeSlot = (day, index) => {
    if (disabled) return;
    const slots = day.slots.filter((_, slotIndex) => slotIndex !== index);
    pendingFocus.current = slots.length ? `schedule.${day.dayOfWeek}.slots.${Math.min(index, slots.length - 1)}.openTime`
      : `schedule.${day.dayOfWeek}.isClosed`;
    if (!slots.length) setExpandedDay(null);
    update(day.dayOfWeek, { slots, isClosed: !slots.length });
  };

  return <fieldset ref={root} disabled={disabled} className={styles.editor}>
    <legend className={showHeading ? styles.legend : 'visually-hidden'}>Lịch mở cửa</legend>
    <div className={styles.toolbar}>
      <p className={styles.hint}>Giờ Việt Nam · hệ 24 giờ (HH:mm). Có thể nghỉ cả tuần; các ca trong ngày mở không được chồng lấn.</p>
      <Button type="button" size="sm" variant="outline" icon="lightning-charge" disabled={disabled}
        onClick={() => { if (!disabled) setQuickSetup({ source: null }); }}>Thiết lập nhanh</Button>
    </div>
    {savedSchedule && !savedSchedule.length && <p className={styles.hint}>Chưa cập nhật lịch mở cửa. Các thay đổi bên dưới là bản nháp.</p>}
    {errors.schedule && <p className={styles.error} role="alert" tabIndex={-1} data-schedule-path="schedule">{errors.schedule}</p>}
    <div className={styles.week}>{[...value].sort((left, right) => left.dayOfWeek - right.dayOfWeek).map(day => {
      const dayPath = `schedule.${day.dayOfWeek}`;
      const dayLabel = dayLabels[day.dayOfWeek - 1];
      const saved = savedSchedule?.find(item => item.dayOfWeek === day.dayOfWeek);
      const changed = saved && !schedulesEqual([saved], [day]);
      const expanded = expandedDay === day.dayOfWeek && !day.isClosed;
      const dayError = errors[dayPath] || errors[`${dayPath}.slots`] || errors[`${dayPath}.isClosed`];
      const hasSlotErrors = Object.keys(errors).some(path => path.startsWith(`${dayPath}.slots.`));
      const summary = [...day.slots].sort((left, right) => left.openTime.localeCompare(right.openTime)
        || left.closeTime.localeCompare(right.closeTime));
      return <section key={day.dayOfWeek} className={`${styles.day} ${dayError || hasSlotErrors ? styles.invalidDay : ''}`}
        aria-label={dayLabel} tabIndex={-1} data-schedule-path={dayPath}>
        <div className={styles.dayHeader}>
          <div className={styles.dayLabel}>
            <Checkbox switch checked={!day.isClosed} disabled={disabled} data-schedule-path={`${dayPath}.isClosed`}
              onChange={open => toggleDay(day, open)}>{dayLabel} <small>· {day.isClosed ? 'Nghỉ' : 'Mở'}</small></Checkbox>
            {changed && <span className={styles.changed}>Đã thay đổi</span>}
          </div>
          {day.isClosed ? <span className={styles.hint}>Nghỉ cả ngày</span>
            : summary.length ? <ul className={styles.summary} aria-label={`Các ca của ${dayLabel}`}>
              {summary.map((slot, index) => <li key={index}>{slot.openTime || 'Chưa nhập'} – {slot.closeTime || 'Chưa nhập'}</li>)}
            </ul> : <span className={styles.hint}>Chưa có khung giờ</span>}
          <div className={styles.dayActions}>
            <Button type="button" size="sm" variant="subtle" disabled={disabled || day.isClosed}
              aria-label={`${expanded ? 'Thu gọn' : 'Sửa'} lịch ${dayLabel}`} aria-expanded={expanded}
              aria-controls={`${id}-day-${day.dayOfWeek}`} onClick={() => editDay(day)}>{expanded ? 'Thu gọn' : 'Sửa'}</Button>
            {/* Tùng — giữ icon ở mọi ngày để đồng bộ bố cục; ngày Nghỉ không được copy. */}
            {allowCopy && <IconButton type="button" size="sm" variant="ghost" icon="copy"
              label={day.isClosed ? `${dayLabel} đang nghỉ, không thể sao chép` : `Sao chép lịch ${dayLabel} sang ngày khác`}
              disabled={disabled || day.isClosed || !day.slots.length}
              onClick={() => { if (!disabled && !day.isClosed && day.slots.length) setQuickSetup({ source: { ...day, slots: cloneSlots(day.slots) } }); }} />}
          </div>
        </div>
        {dayError && <p className={styles.error} role="alert">{dayError}</p>}
        {!expanded && hasSlotErrors && <p className={styles.error} role="alert">Có ca chưa hợp lệ. Mở Sửa để xem lỗi.</p>}
        <div id={`${id}-day-${day.dayOfWeek}`} hidden={!expanded} className={styles.dayEditor}>
          {expanded && <>
            <SlotFields slots={day.slots} dayLabel={dayLabel} basePath={dayPath} errors={errors} disabled={disabled}
              onChange={(index, patch) => update(day.dayOfWeek, { slots: day.slots.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...patch } : slot) })}
              onRemove={index => removeSlot(day, index)} />
            <Button type="button" size="sm" variant="outline" icon="plus-lg" disabled={disabled} onClick={() => addSlot(day)}>Thêm khung giờ</Button>
          </>}
        </div>
      </section>;
    })}</div>
    {quickSetup && <QuickSetupDialog source={quickSetup.source} week={value} dayLabels={dayLabels}
      validateSchedule={validateSchedule} disabled={disabled} onClose={() => { if (!disabled) setQuickSetup(null); }}
      onApply={(targets, slots) => {
        if (!disabled) onChange(value.map(day => targets.includes(day.dayOfWeek)
          ? { ...day, isClosed: false, slots: cloneSlots(slots) } : day));
      }} />}
  </fieldset>;
}
