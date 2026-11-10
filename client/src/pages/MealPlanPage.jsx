import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import {
  Button,
  Checkbox,
  Modal,
  Notice,
  NumberStepper,
  SearchInput,
  useToast,
} from '../components';
import { getHealthProfile } from '../services/user.service';
import mealPlanService from '../services/meal-plan.service';
import styles from './MealPlanPage.module.css';

const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_LABEL = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
  snack: 'Bữa phụ',
};
const SLOT_ICON = {
  breakfast: 'sunrise',
  lunch: 'sun',
  dinner: 'moon-stars',
  snack: 'cup-hot',
};
const WEEKDAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const MIN_PERSON_TARGET = 500;
const MAX_PERSON_TARGET = 8000;
// Số người ăn chung KHÔNG tính bản thân: 0 → 10 (cả nhà tối đa 11 người).
const MAX_OTHERS_SHARING = 10;

// Trang Hồ sơ → tab Hồ sơ sức khỏe (?tab=health đọc ở UserProfilePage).
const HEALTH_PROFILE_HREF = '/profile?tab=health';

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function mondayOf(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

function shortDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDayLabel(value) {
  const date = parseDateKey(value);
  const weekdayIndex = (date.getDay() + 6) % 7;
  return `${WEEKDAY_LABELS[weekdayIndex]} ${shortDate(date)}`;
}

function isoWeekNumber(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - (utcDate.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
}

function formatWeekLabel(weekStartDate) {
  const endDate = addDays(weekStartDate, 6);
  return `Tuần ${isoWeekNumber(weekStartDate)} · ${shortDate(weekStartDate)} – ${shortDate(endDate)}`;
}

function getVietnamDateKey(at = new Date()) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(at);
}

function getTodayInVietnam() {
  const key = getVietnamDateKey(new Date());
  return parseDateKey(key);
}

function isPastDate(dateKeyValue) {
  return parseDateKey(dateKeyValue) < getTodayInVietnam();
}

function normalizeItem(item = null) {
  if (!item) return null;
  return {
    id: String(item.id ?? item.itemId ?? ''),
    mealSlot: item.mealSlot ?? item.meal_slot,
    recipeId: String(item.recipeId ?? item.recipe_id ?? ''),
    recipeName: item.recipeName ?? item.recipe_name ?? 'Chưa có món',
    description: item.description ?? '',
    caloriesKcal: item.caloriesKcal ?? item.calories_kcal ?? null,
    nutritionGroup: item.nutritionGroup ?? item.nutrition_group ?? null,
    ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
    imageUrl: item.imageUrl ?? item.thumbnailUrl ?? null,
  };
}

function sortItems(items = []) {
  return [...items].sort((left, right) => {
    const slotDiff = SLOT_ORDER.indexOf(left.mealSlot) - SLOT_ORDER.indexOf(right.mealSlot);
    if (slotDiff !== 0) return slotDiff;
    return Number(left.id) - Number(right.id);
  });
}

function itemsForSlot(items, slot) {
  return (items ?? []).filter((item) => item.mealSlot === slot);
}

function sumCalories(items) {
  return (items ?? []).reduce((sum, item) => sum + (Number(item.caloriesKcal) || 0), 0);
}

function recipeHref(recipeId) {
  return `/recipes/${encodeURIComponent(recipeId)}`;
}

function formatKcal(value) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0));
}

/** Mục tiêu calo chỉ nhận 500–8.000 kcal → kẹp giá trị (không báo lỗi). */
function clampPersonTarget(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return '';
  return Math.min(MAX_PERSON_TARGET, Math.max(MIN_PERSON_TARGET, number));
}

function getWarning(item, allergies) {
  if (!item || !allergies?.length) return null;

  const allergyNames = allergies
    .map((entry) => (typeof entry === 'string' ? entry : entry?.name || entry?.ingredient || ''))
    .filter(Boolean)
    .map((value) => value.toLocaleLowerCase());

  const ingredientNames = (item.ingredients ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.name || entry?.ingredient || ''))
    .filter(Boolean)
    .map((value) => value.toLocaleLowerCase());

  const matches = ingredientNames.filter((ingredientName) => allergyNames.some((allergyName) => (
    ingredientName.includes(allergyName) || allergyName.includes(ingredientName)
  )));

  return matches.length ? `Có thể chứa ${[...new Set(matches)].join(', ')}` : null;
}

function WeekPicker({ weekStart, selectedDate, todayKey, dayHasItems, onWeekChange, onSelectDate }) {
  const monday = mondayOf(parseDateKey(weekStart));
  const currentMonday = mondayOf(getTodayInVietnam());
  const finalMonday = mondayOf(new Date(new Date().getFullYear(), 11, 31, 12));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(monday, index));

  return (
    <section className={styles.weekCard} aria-label="Chọn tuần và ngày">
      <div className={styles.weekHead}>
        <button
          type="button"
          className={styles.weekArrow}
          aria-label="Tuần trước"
          disabled={monday <= currentMonday}
          onClick={() => onWeekChange(dateKey(addDays(monday, -7)))}
        >
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <span className={styles.weekLabel}>{formatWeekLabel(monday)}</span>
        <button
          type="button"
          className={styles.weekArrow}
          aria-label="Tuần sau"
          disabled={monday >= finalMonday}
          onClick={() => onWeekChange(dateKey(addDays(monday, 7)))}
        >
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>

      <div className={styles.weekDays} role="group" aria-label="Ngày trong tuần">
        {weekDays.map((day, index) => {
          const key = dateKey(day);
          const selected = key === selectedDate;
          const filled = Boolean(dayHasItems?.(key));
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              className={`${styles.weekDay} ${selected ? styles.weekDaySelected : ''} ${isToday ? styles.weekDayToday : ''}`}
              aria-pressed={selected}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onSelectDate(key)}
            >
              <span className={styles.weekDayName}>{WEEKDAY_SHORT[index]}</span>
              <strong>{shortDate(day)}</strong>
              <span className={`${styles.weekDayDot} ${filled ? styles.weekDayDotOn : ''}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DishRow({ item, warning, disabled, removing, onRemove }) {
  return (
    <li className={styles.dishRow}>
      <a className={styles.dishLink} href={recipeHref(item.recipeId)} title={`Xem công thức: ${item.recipeName}`}>
        <span className={`${styles.dishThumb} ${!item.imageUrl ? styles.thumbEmpty : ''}`}>
          {item.imageUrl
            ? <img src={item.imageUrl} alt="" loading="lazy" />
            : <i className="bi bi-egg-fried" aria-hidden="true" />}
        </span>
        <span className={styles.dishText}>
          <span className={styles.dishName}>{item.recipeName}</span>
          <span className={styles.dishMeta}>
            <span className={styles.dishKcal}>{formatKcal(item.caloriesKcal ?? 0)} kcal/người</span>
            {item.nutritionGroup ? <span className={styles.dishTag}>{item.nutritionGroup}</span> : null}
          </span>
          {warning ? (
            <span className={styles.dishWarning}>
              <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> {warning}
            </span>
          ) : null}
        </span>
        <i className={`bi bi-arrow-up-right ${styles.dishGo}`} aria-hidden="true" />
      </a>

      <button
        type="button"
        className={styles.dishRemove}
        aria-label={`Xóa ${item.recipeName} khỏi ${SLOT_LABEL[item.mealSlot] ?? 'bữa'}`}
        title="Xóa món khỏi bữa"
        disabled={disabled || removing}
        onClick={onRemove}
      >
        <i className={`bi ${removing ? 'bi-hourglass-split' : 'bi-x-lg'}`} aria-hidden="true" />
      </button>
    </li>
  );
}

function MealSlotCard({ slot, items, allergies, disabled, removingId, onAdd, onRemove }) {
  const empty = items.length === 0;
  const subtotal = sumCalories(items);

  return (
    <section className={`${styles.slotCard} ${empty ? styles.slotCardEmpty : ''}`} aria-label={SLOT_LABEL[slot]}>
      <header className={styles.slotHead}>
        <span className={styles.slotIcon} aria-hidden="true">
          <i className={`bi bi-${SLOT_ICON[slot]}`} />
        </span>
        <span className={styles.slotTitles}>
          <span className={styles.slotTitle}>{SLOT_LABEL[slot]}</span>
          <span className={styles.slotMeta}>
            {empty ? 'Chưa có món' : `${items.length} món · ${formatKcal(subtotal)} kcal/người`}
          </span>
        </span>
      </header>

      {empty ? (
        <p className={styles.slotHint}>Thêm 1–3 món cho bữa này, hoặc để trống rồi random cả ngày.</p>
      ) : (
        <ul className={styles.dishList}>
          {items.map((item) => (
            <DishRow
              key={item.id}
              item={item}
              warning={getWarning(item, allergies)}
              disabled={disabled}
              removing={removingId === item.id}
              onRemove={() => onRemove(item)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        className={`${styles.slotAdd} ${empty ? styles.slotAddStrong : ''}`}
        disabled={disabled}
        onClick={onAdd}
      >
        <i className="bi bi-plus-lg" aria-hidden="true" />
        Thêm món
      </button>
    </section>
  );
}

function RecipePickerModal({ open, onClose, slot, query, recipes, loading, error, inSlotIds, onQueryChange, onChoose, savingId }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={slot ? `Thêm món cho ${SLOT_LABEL[slot]}` : 'Chọn công thức'}
      description="Chọn được nhiều món cho một bữa. Bấm tên món để mở công thức."
      size="lg"
      dismissible={!savingId}
      footer={<Button variant="subtle" onClick={onClose} disabled={Boolean(savingId)}>Xong</Button>}
    >
      <div className={styles.pickerPanel}>
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Tìm theo tên hoặc mô tả"
          label="Tìm công thức"
          size="md"
        />

        {error ? (
          <Notice tone="alert" title="Không tải được công thức" action={{ label: 'Đóng', onClick: onClose }}>
            {error}
          </Notice>
        ) : null}

        <div className={styles.recipeResults} aria-busy={loading}>
          {loading ? (
            <p className={styles.pickerMessage}>Đang tải công thức…</p>
          ) : recipes.length === 0 && !error ? (
            <p className={styles.pickerMessage}>Không tìm thấy công thức phù hợp.</p>
          ) : (
            recipes.map((recipe) => {
              const added = inSlotIds.has(String(recipe.id));
              return (
                <article key={recipe.id} className={styles.recipeItem}>
                  <span className={`${styles.recipeThumb} ${!recipe.thumbnailUrl ? styles.thumbEmpty : ''}`}>
                    {recipe.thumbnailUrl
                      ? <img src={recipe.thumbnailUrl} alt="" loading="lazy" />
                      : <i className="bi bi-egg-fried" aria-hidden="true" />}
                  </span>
                  <div className={styles.recipeText}>
                    <a className={styles.recipeTitleLink} href={recipeHref(recipe.id)} title={recipe.title}>
                      {recipe.title}
                    </a>
                    <small title={recipe.description || ''}>{recipe.description || 'Chưa có mô tả.'}</small>
                    <span>{formatKcal(recipe.caloriesKcal ?? 0)} kcal</span>
                  </div>
                  <Button
                    size="sm"
                    variant={added ? 'subtle' : 'outline'}
                    icon={added ? 'check2' : 'plus-lg'}
                    disabled={added || Boolean(savingId)}
                    loading={savingId === String(recipe.id)}
                    onClick={() => onChoose(recipe)}
                  >
                    {added ? 'Đã thêm' : 'Thêm'}
                  </Button>
                </article>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}

function PersonTargetRow({ index, value, disabled, invalid, onChange, onBlur }) {
  const inputId = `person-target-${index}`;
  return (
    <li className={`${styles.personRow} ${index === 0 ? styles.personRowSelf : ''}`}>
      <label className={styles.personLabel} htmlFor={inputId}>
        <i className={`bi bi-${index === 0 ? 'person-check' : 'person'}`} aria-hidden="true" />
        {index === 0 ? 'Bạn' : `Người ${index + 1}`}
      </label>
      <span className={`${styles.personInputWrap} ${invalid ? styles.personInputInvalid : ''}`}>
        <input
          id={inputId}
          className={styles.personInput}
          type="number"
          inputMode="numeric"
          min={MIN_PERSON_TARGET}
          max={MAX_PERSON_TARGET}
          step={50}
          value={value ?? ''}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
          onBlur={onBlur}
        />
        <span className={styles.personUnit}>kcal</span>
      </span>
    </li>
  );
}

function RandomPlanModal({
  open,
  form,
  weekDays,
  defaultTarget,
  hasHealthProfile,
  profileLoading,
  profileError,
  mealsPerDay = 3,
  isRunning,
  onChange,
  onClose,
  onSubmit,
}) {
  const {
    days, others, sameTarget, targets, replace, error,
  } = form;

  const meals = Math.max(1, Number(mealsPerDay) || 3);
  const household = Number(others) + 1; // bản thân + số người ăn chung
  const perPersonValues = Array.from({ length: household }, (_, index) => Number(targets[index]));
  const everyPersonHasTarget = perPersonValues.every((value) => Number.isFinite(value) && value > 0);
  const householdTotal = everyPersonHasTarget ? perPersonValues.reduce((sum, value) => sum + value, 0) : 0;
  const perPersonTarget = householdTotal ? Math.round(householdTotal / household) : 0;
  const perMealHousehold = householdTotal ? householdTotal / meals : 0;
  const perMealPerPerson = perPersonTarget ? perPersonTarget / meals : 0;
  const missingTargetIndex = perPersonValues.findIndex((value) => !Number.isFinite(value) || value <= 0);
  const canSubmit = hasHealthProfile && !isRunning;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Random thực đơn"
      description="Chọn ngày và số người ăn — mỗi bữa sẽ được random từ 1 đến 3 món."
      size="lg"
      dismissible={!isRunning}
      footer={(
        <>
          <Button variant="subtle" disabled={isRunning} onClick={onClose}>Hủy</Button>
          <Button
            icon="shuffle"
            loading={isRunning}
            disabled={!canSubmit}
            onClick={onSubmit}
            title={hasHealthProfile ? undefined : 'Cần điền hồ sơ sức khỏe trước'}
          >
            Random ngày đã chọn
          </Button>
        </>
      )}
    >
      <div className={styles.randomPanel}>
        {!hasHealthProfile ? (
          <div className={styles.gate} role="alert">
            <span className={styles.gateIcon} aria-hidden="true"><i className="bi bi-heart-pulse" /></span>
            <div className={styles.gateBody}>
              <p className={styles.gateText}>
                {profileError
                  ? 'Không tải được hồ sơ sức khỏe của bạn. Vui lòng thử lại sau.'
                  : profileLoading
                    ? 'Đang kiểm tra hồ sơ sức khỏe…'
                    : 'Bạn chưa điền hồ sơ sức khỏe. Vui lòng điền hồ sơ sức khoẻ'}
              </p>
              <a className={styles.gateAction} href={HEALTH_PROFILE_HREF}>
                Điền hồ sơ sức khỏe
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                <span className={styles.step} aria-hidden="true">1</span>
                Chọn ngày
                <span className={styles.legendHint}>{days.length ? `Đã chọn ${days.length} ngày` : 'Chưa chọn ngày'}</span>
              </legend>
              <div className={styles.randomDayList}>
                {weekDays.map(({ date, isPast }) => {
                  const selected = days.includes(date);
                  const parsed = parseDateKey(date);
                  return (
                    <label
                      key={date}
                      className={`${styles.randomDayOption} ${selected ? styles.randomDayOptionSelected : ''} ${isPast ? styles.randomDayOptionDisabled : ''}`}
                    >
                      <input
                        className={styles.randomDayCheckbox}
                        type="checkbox"
                        checked={selected}
                        disabled={isPast || isRunning}
                        onChange={() => onChange({
                          days: selected ? days.filter((entry) => entry !== date) : [...days, date],
                          error: '',
                        })}
                      />
                      <span className={styles.randomDayLabel}>
                        <strong>{WEEKDAY_LABELS[(parsed.getDay() + 6) % 7]}</strong>
                        <span>{shortDate(parsed)}{isPast ? ' · đã qua' : ''}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                <span className={styles.step} aria-hidden="true">2</span>
                Số người ăn
              </legend>

              <NumberStepper
                label="Ngoài bạn còn bao nhiêu người ăn chung?"
                value={others}
                min={0}
                max={MAX_OTHERS_SHARING}
                unit="người"
                disabled={isRunning}
                hint={`Tính cả bạn: ${household} người · tối đa ${MAX_OTHERS_SHARING + 1} người ăn chung.`}
                onChange={(value) => {
                  const nextOthers = Math.min(MAX_OTHERS_SHARING, Math.max(0, Number(value) || 0));
                  const nextHousehold = nextOthers + 1;
                  const nextTargets = Array.from({ length: nextHousehold }, (_, index) => (
                    targets[index] ?? defaultTarget ?? ''
                  ));
                  onChange({
                    others: nextOthers,
                    targets: sameTarget ? nextTargets.map(() => defaultTarget ?? '') : nextTargets,
                    error: '',
                  });
                }}
              />

              <div className={styles.targetBlock}>
                {household > 1 ? (
                  <Checkbox
                    checked={sameTarget}
                    disabled={isRunning || !defaultTarget}
                    onChange={(checked) => onChange({
                      sameTarget: checked,
                      targets: checked
                        ? Array.from({ length: household }, () => defaultTarget ?? '')
                        : targets,
                      error: '',
                    })}
                  >
                    Cả {household} người dùng cùng mục tiêu {defaultTarget ? `${formatKcal(defaultTarget)} kcal` : 'hiện tại'}
                  </Checkbox>
                ) : null}

                <ul className={styles.personList}>
                  {Array.from({ length: household }, (_, index) => (
                    <PersonTargetRow
                      key={index}
                      index={index}
                      value={targets[index] ?? ''}
                      disabled={isRunning || (sameTarget && household > 1)}
                      invalid={(!sameTarget || household === 1) && missingTargetIndex === index}
                      onChange={(value) => {
                        const nextTargets = [...targets];
                        nextTargets[index] = value;
                        onChange({ targets: nextTargets, error: '' });
                      }}
                      onBlur={() => {
                        const current = targets[index];
                        if (current === '' || current === null || current === undefined) return;
                        const clamped = clampPersonTarget(current);
                        if (clamped === current) return;
                        const nextTargets = [...targets];
                        nextTargets[index] = clamped;
                        onChange({ targets: nextTargets });
                      }}
                    />
                  ))}
                </ul>
                <p className={styles.targetNote}>
                  <i className="bi bi-info-circle" aria-hidden="true" />
                  {household === 1
                    ? 'Mục tiêu hôm nay của bạn, tính bằng kcal/người/ngày — giá trị ngoài khoảng hợp lệ sẽ tự điều chỉnh.'
                    : sameTarget
                      ? 'Bỏ chọn để nhập mục tiêu riêng cho từng người.'
                      : 'Mục tiêu tính bằng kcal/người/ngày — giá trị ngoài khoảng hợp lệ sẽ được tự điều chỉnh.'}
                </p>
              </div>

              <div className={styles.randomSummary}>
                {perPersonTarget ? (
                  household > 1 ? (
                    <>
                      <span className={styles.summaryStat}>
                        <small>Cả nhà</small>
                        <strong>{formatKcal(householdTotal)} <em>kcal/ngày</em></strong>
                      </span>
                      <span className={styles.summaryStat}>
                        <small>Trung bình</small>
                        <strong>{formatKcal(perPersonTarget)} <em>kcal/người/ngày</em></strong>
                      </span>
                      <span className={styles.summaryStat}>
                        <small>Chia {meals} bữa</small>
                        <strong>{formatKcal(perMealPerPerson)} <em>kcal/người/bữa</em></strong>
                        <small className={styles.summarySub}>Cả nhà {formatKcal(perMealHousehold)} kcal/bữa</small>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={styles.summaryStat}>
                        <small>Mục tiêu của bạn</small>
                        <strong>{formatKcal(perPersonTarget)} <em>kcal/ngày</em></strong>
                      </span>
                      <span className={styles.summaryStat}>
                        <small>Chia {meals} bữa</small>
                        <strong>{formatKcal(perMealPerPerson)} <em>kcal/bữa</em></strong>
                      </span>
                    </>
                  )
                ) : (
                  <span className={styles.summaryEmpty}>Nhập mục tiêu calo cho từng người để xem tổng cả nhà.</span>
                )}
              </div>
            </fieldset>

            <Checkbox
              checked={replace}
              disabled={isRunning}
              onChange={(checked) => onChange({ replace: checked, error: '' })}
              hint="Bỏ trống: chỉ điền vào các bữa còn trống, giữ món đã chọn."
            >
              Xóa món hiện có trước khi random
            </Checkbox>
          </>
        )}

        {error ? <p className={styles.randomDaysError} role="alert">{error}</p> : null}
      </div>
    </Modal>
  );
}

export default function MealPlanPage({ user = null, accountMenu = [] }) {
  const [weekStart, setWeekStart] = useState(() => dateKey(mondayOf(new Date())));
  const [selectedDate, setSelectedDate] = useState(() => getVietnamDateKey(new Date()));
  const [days, setDays] = useState([]);
  const [healthProfile, setHealthProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [removingId, setRemovingId] = useState('');
  const [notice, setNotice] = useState({ tone: 'info', message: '' });
  const [picker, setPicker] = useState(null);
  const [query, setQuery] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState('');
  const [isRandomizing, setIsRandomizing] = useState(false);
  const randomizingRef = useRef(false);
  const [randomModalOpen, setRandomModalOpen] = useState(false);
  const [randomForm, setRandomForm] = useState({
    days: [], others: 0, sameTarget: true, targets: [], replace: false, error: '',
  });
  const toast = useToast();

  const isSaving = Boolean(savingKey) || Boolean(removingId) || isRandomizing;
  const allergies = useMemo(() => healthProfile?.allergies ?? [], [healthProfile]);

  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? { date: selectedDate, plan: null },
    [days, selectedDate],
  );

  const selectedPlan = selectedDay.plan;
  const planItems = useMemo(() => selectedPlan?.items ?? [], [selectedPlan]);
  const totalCalories = sumCalories(planItems);

  // Mục tiêu lấy từ hồ sơ sức khỏe: chưa điền hồ sơ ⇒ không có mục tiêu ⇒ không random được.
  const rawProfileTarget = healthProfile?.targetCalories ?? healthProfile?.targetCaloriesKcal;
  const profileTargetValue = Number(rawProfileTarget);
  const profileTarget = Number.isFinite(profileTargetValue) && profileTargetValue > 0 ? profileTargetValue : null;
  const hasHealthProfile = Boolean(profileTarget);

  const rawTargetCalories = selectedPlan?.targetCaloriesKcal ?? profileTarget;
  const targetCaloriesValue = Number(rawTargetCalories);
  const targetCalories = Number.isFinite(targetCaloriesValue) && targetCaloriesValue > 0
    ? targetCaloriesValue
    : null;
  const householdSize = Number(selectedPlan?.householdSize ?? 1) || 1;
  const mealsPerDay = Math.max(1, Number(selectedPlan?.mealsPerDay) || 3);
  const personTargets = Array.isArray(selectedPlan?.personTargets) ? selectedPlan.personTargets : null;
  // Mục tiêu cả ngày của CẢ NHÀ = tổng mục tiêu từng người (nếu đã khai báo).
  const householdTargetKcal = personTargets?.length
    ? personTargets.reduce((sum, entry) => sum + (Number(entry) || 0), 0)
    : (targetCalories ? targetCalories * householdSize : null);
  // Mục tiêu MỖI NGƯỜI/ngày = mục tiêu cả nhà chia số người.
  const perPersonTargetKcal = householdTargetKcal
    ? Math.round(householdTargetKcal / householdSize)
    : targetCalories;
  // Món lưu kcal mỗi suất → tổng đã chọn của cả nhà = mỗi suất × số người.
  const householdConsumedKcal = totalCalories * householdSize;
  const perMealPerPersonKcal = perPersonTargetKcal ? perPersonTargetKcal / mealsPerDay : null;
  const canEditSelectedDate = !isPastDate(selectedDate);
  const remainingKcal = perPersonTargetKcal ? perPersonTargetKcal - totalCalories : null;
  const caloriePercentage = perPersonTargetKcal && totalCalories > 0 && planItems.length
    ? (totalCalories / perPersonTargetKcal) * 100
    : null;
  const calorieWarning = caloriePercentage > 110
    ? {
      title: 'Tổng calo hôm nay đang vượt 110% mục tiêu',
      message: `Hiện tại ${formatKcal(totalCalories)} / ${formatKcal(perPersonTargetKcal)} kcal mỗi người (${caloriePercentage.toFixed(0)}%)${householdSize > 1 ? `, cả nhà ${formatKcal(householdConsumedKcal)} / ${formatKcal(householdTargetKcal)} kcal` : ''}. Nên bớt món hoặc đổi sang món nhẹ hơn.`,
    }
    : caloriePercentage !== null && caloriePercentage < 80
      ? {
        title: 'Tổng calo hôm nay mới đạt dưới 80% mục tiêu',
        message: `Hiện tại ${formatKcal(totalCalories)} / ${formatKcal(perPersonTargetKcal)} kcal mỗi người (${caloriePercentage.toFixed(0)}%)${householdSize > 1 ? `, cả nhà ${formatKcal(householdConsumedKcal)} / ${formatKcal(householdTargetKcal)} kcal` : ''}. Có thể thêm món cho bữa phụ.`,
      }
      : null;

  const loadWeek = useCallback(async (nextWeekStart, signal) => {
    setIsLoading(true);
    setNotice({ tone: 'info', message: '' });

    try {
      const response = await mealPlanService.getWeek(nextWeekStart, { signal });
      const normalizedDays = (response.days ?? []).map((entry) => ({
        date: entry.date,
        plan: entry.plan
          ? {
            ...entry.plan,
            householdSize: Number(entry.plan.householdSize ?? 1) || 1,
            personTargets: Array.isArray(entry.plan.personTargets) ? entry.plan.personTargets : null,
            items: sortItems((entry.plan.items ?? []).map(normalizeItem).filter(Boolean)),
          }
          : null,
      }));
      setDays(normalizedDays);
      if (normalizedDays.length > 0 && !normalizedDays.some((day) => day.date === selectedDate)) {
        setSelectedDate(normalizedDays[0].date);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setNotice({ tone: 'alert', message: error.message || 'Không tải được thực đơn của tuần.' });
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    const controller = new AbortController();
    loadWeek(weekStart, controller.signal);
    return () => controller.abort();
  }, [weekStart, loadWeek]);

  useEffect(() => {
    const controller = new AbortController();
    setProfileLoading(true);
    setProfileError('');
    getHealthProfile({ signal: controller.signal })
      .then(({ profile }) => {
        if (!controller.signal.aborted) setHealthProfile(profile);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setProfileError(error.message || 'Không tải được hồ sơ sức khỏe.');
          setNotice({ tone: 'alert', message: error.message || 'Không tải được hồ sơ sức khỏe.' });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setProfileLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!picker) return undefined;
    const controller = new AbortController();
    setRecipesLoading(true);
    setRecipesError('');

    mealPlanService.getAvailableRecipes(query.trim(), '', { signal: controller.signal })
      .then(({ items = [] }) => {
        if (!controller.signal.aborted) setRecipes(items.map((recipe) => ({ ...recipe, id: String(recipe.id ?? recipe.recipeId ?? '') })));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setRecipesError(error.message || 'Không tải được danh sách công thức.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecipesLoading(false);
      });

    return () => controller.abort();
  }, [picker, query]);

  const updatePlanForDate = useCallback((date, updater) => {
    setDays((current) => {
      const existingDay = current.find((day) => day.date === date);
      const nextDay = { date, plan: updater(existingDay?.plan ?? null) };
      if (existingDay) {
        return current.map((day) => (day.date === date ? nextDay : day));
      }
      return [...current, nextDay].sort((left, right) => left.date.localeCompare(right.date));
    });
  }, []);

  const ensurePlanForDate = useCallback(async (date) => {
    const existing = days.find((day) => day.date === date)?.plan ?? null;
    if (existing) return existing;

    const response = await mealPlanService.createDay({ planDate: date, mealsPerDay: 3 });
    const createdPlan = {
      ...response.plan,
      householdSize: Number(response.plan?.householdSize ?? 1) || 1,
      personTargets: Array.isArray(response.plan?.personTargets) ? response.plan.personTargets : null,
      items: sortItems((response.plan?.items ?? []).map(normalizeItem).filter(Boolean)),
    };
    updatePlanForDate(date, () => createdPlan);
    return createdPlan;
  }, [days, updatePlanForDate]);

  const openPicker = (slot) => {
    if (!canEditSelectedDate) return;
    setQuery('');
    setRecipes([]);
    setRecipesError('');
    setPicker({ slot });
  };

  const closePicker = () => {
    setPicker(null);
    setQuery('');
    setRecipes([]);
    setRecipesError('');
  };

  const inSlotIds = useMemo(() => {
    if (!picker) return new Set();
    return new Set(itemsForSlot(planItems, picker.slot).map((item) => item.recipeId));
  }, [picker, planItems]);

  const handleChooseRecipe = async (recipe) => {
    if (!canEditSelectedDate || isSaving || !picker) return;
    const slot = picker.slot;
    const recipeId = String(recipe.id);
    if (inSlotIds.has(recipeId)) return;

    setSavingKey(recipeId);
    try {
      const planToUse = selectedPlan ?? await ensurePlanForDate(selectedDate);
      if (!planToUse) return;

      const { item } = await mealPlanService.addItem(planToUse.id, slot, recipeId);
      const nextItem = normalizeItem(item);
      if (nextItem) {
        updatePlanForDate(selectedDate, (currentPlan) => {
          const base = currentPlan ?? { id: planToUse.id, planDate: selectedDate, items: [] };
          return {
            ...base,
            id: planToUse.id,
            planDate: selectedDate,
            items: sortItems([...(base.items ?? []), nextItem]),
          };
        });
      }
      toast(`Đã thêm ${recipe.title ?? 'món'} vào ${SLOT_LABEL[slot]}.`, { tone: 'success' });
    } catch (error) {
      const message = error.message || 'Không thêm được món.';
      setNotice({ tone: 'alert', message });
      toast(message, { tone: 'alert' });
    } finally {
      setSavingKey('');
    }
  };

  const handleRemoveItem = async (item) => {
    if (!canEditSelectedDate || !selectedPlan || isSaving) return;

    setRemovingId(item.id);
    try {
      await mealPlanService.removeItem(selectedPlan.id, item.id);
      updatePlanForDate(selectedDate, (currentPlan) => ({
        ...(currentPlan ?? { id: selectedPlan.id, planDate: selectedDate, items: [] }),
        items: (currentPlan?.items ?? []).filter((entry) => entry.id !== item.id),
      }));
      setNotice({ tone: 'success', message: 'Đã xóa món.' });
    } catch (error) {
      setNotice({ tone: 'alert', message: error.message || 'Không xóa được món.' });
      toast('Không xóa được món.', { tone: 'alert' });
    } finally {
      setRemovingId('');
    }
  };

  const defaultTarget = targetCalories ?? null;

  const openRandomModal = () => {
    setRandomForm({
      days: [],
      others: 0,
      sameTarget: true,
      targets: defaultTarget ? [defaultTarget] : [''],
      replace: false,
      error: '',
    });
    setRandomModalOpen(true);
  };

  const patchRandomForm = (patch) => setRandomForm((current) => ({ ...current, ...patch }));

  const randomWeekDays = Array.from({ length: 7 }, (_, index) => {
    const date = dateKey(addDays(parseDateKey(weekStart), index));
    return { date, isPast: isPastDate(date) };
  });

  const handleRandomize = async () => {
    if (randomizingRef.current || isSaving) return;
    // Chưa điền hồ sơ sức khỏe → modal đang hiện thông báo + link, không submit.
    if (!hasHealthProfile) return;

    const { days: pickedDates, others, sameTarget, targets, replace } = randomForm;
    const household = Number(others) + 1;
    const selectedDates = pickedDates.filter((date) => randomWeekDays.some((day) => day.date === date && !day.isPast));

    if (selectedDates.length === 0) {
      patchRandomForm({ error: 'Vui lòng chọn ít nhất một ngày chưa qua để random.' });
      return;
    }

    const finalTargets = Array.from({ length: household }, (_, index) => (
      household === 1
        ? Number(targets[0] ?? defaultTarget)
        : (sameTarget ? Number(defaultTarget) : Number(targets[index]))
    ));

    if (finalTargets.some((value) => !Number.isFinite(value) || value <= 0)) {
      patchRandomForm({ error: 'Nhập mục tiêu calo cho từng người trước khi random.' });
      return;
    }

    const clampedTargets = finalTargets.map((value) => clampPersonTarget(value));

    randomizingRef.current = true;
    setIsRandomizing(true);
    patchRandomForm({ error: '' });
    setNotice({ tone: 'info', message: `Đang random ${selectedDates.length} ngày…` });

    const successful = [];
    const failed = [];

    try {
      for (const date of selectedDates) {
        try {
          const plan = await ensurePlanForDate(date);
          if (!plan?.id) throw new Error('Không tạo được thực đơn cho ngày này.');

          const response = await mealPlanService.randomize(plan.id, {
            householdSize: household,
            personTargets: clampedTargets,
            replace,
          });
          const newItems = (response.items ?? []).map(normalizeItem).filter(Boolean);

          updatePlanForDate(date, (currentPlan) => {
            const planToUpdate = currentPlan ?? plan;
            const base = replace ? [] : (planToUpdate.items ?? []);
            return {
              ...planToUpdate,
              id: plan.id,
              planDate: date,
              targetCaloriesKcal: response.targetCaloriesKcal ?? planToUpdate.targetCaloriesKcal ?? null,
              householdSize: Number(response.householdSize ?? household) || 1,
              personTargets: Array.isArray(response.personTargets) ? response.personTargets : clampedTargets,
              items: sortItems([...base, ...newItems]),
            };
          });
          successful.push(formatDayLabel(date));
        } catch (error) {
          failed.push(`${formatDayLabel(date)}: ${error.message || 'lỗi không xác định'}`);
        }
      }

      const message = successful.length
        ? `Đã random ${successful.length} ngày: ${successful.join(', ')}.${failed.length ? ` Lỗi: ${failed.join('; ')}.` : ''}`
        : `Không random được ngày nào. ${failed.join('; ')}`;
      setNotice({ tone: successful.length ? 'success' : 'alert', message });
      toast(message, { tone: successful.length ? 'success' : 'alert' });
      if (successful.length) {
        setRandomModalOpen(false);
      } else {
        patchRandomForm({ error: failed.join('; ') });
      }
    } finally {
      randomizingRef.current = false;
      setIsRandomizing(false);
    }
  };

  const todayKey = getVietnamDateKey(new Date());
  const selectedDateLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(parseDateKey(selectedDate));

  return (
    <MemberLayout activeKey="meal-plan" user={user} accountMenu={accountMenu}>
      <main className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>
              <i className="bi bi-calendar2-week" aria-hidden="true" /> Thực đơn
            </p>
            <h1 className={styles.heroTitle}>Hôm nay bạn ăn gì?</h1>
            <div className={styles.heroMeta}>
              <span><i className="bi bi-calendar3" aria-hidden="true" /> {selectedDateLabel}</span>
              <span className={styles.heroDivider} aria-hidden="true" />
              <span>
                <i className="bi bi-people" aria-hidden="true" />{' '}
                {householdSize > 1 ? `${householdSize} người ăn chung` : 'Chỉ mình bạn'}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            icon="shuffle"
            disabled={isSaving}
            onClick={openRandomModal}
          >
            Random món ăn theo ngày
          </Button>
        </header>

        <WeekPicker
          weekStart={weekStart}
          selectedDate={selectedDate}
          todayKey={todayKey}
          dayHasItems={(key) => Boolean(days.find((day) => day.date === key)?.plan?.items?.length)}
          onWeekChange={setWeekStart}
          onSelectDate={setSelectedDate}
        />

        <section className={styles.calorieCard} aria-label="Tổng calo trong ngày">
          <div className={styles.calorieHead}>
            <span className={styles.sectionLabel}>
              <i className="bi bi-fire" aria-hidden="true" /> Calo đã chọn
            </span>
            <span className={styles.chip}>
              <i className="bi bi-people" aria-hidden="true" /> {householdSize} người
            </span>
          </div>

          <div className={styles.calorieMain}>
            <span className={styles.calorieNow}>{formatKcal(totalCalories)}</span>
            <span className={styles.calorieTarget}>
              / {perPersonTargetKcal ? formatKcal(perPersonTargetKcal) : '—'} kcal/người/ngày
            </span>
          </div>

          <div
            className={styles.calorieTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={perPersonTargetKcal ?? 100}
            aria-valuenow={Math.round(totalCalories)}
            aria-label="Calo đã chọn so với mục tiêu mỗi người"
          >
            <span
              className={`${styles.calorieFill} ${caloriePercentage > 110 ? styles.calorieFillOver : ''}`}
              style={{ width: `${Math.min(100, caloriePercentage ?? 0)}%` }}
            />
          </div>

          <div className={styles.calorieStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Còn lại / người</span>
              <span className={`${styles.statValue} ${remainingKcal !== null && remainingKcal < 0 ? styles.statValueOver : ''}`}>
                {remainingKcal === null
                  ? '—'
                  : remainingKcal < 0
                    ? `Vượt ${formatKcal(Math.abs(remainingKcal))}`
                    : formatKcal(remainingKcal)}
                <small> kcal</small>
              </span>
            </div>

            <div className={styles.stat}>
              <span className={styles.statLabel}>Mỗi bữa / người</span>
              <span className={styles.statValue}>
                {perMealPerPersonKcal ? formatKcal(perMealPerPersonKcal) : '—'}
                <small> kcal · {mealsPerDay} bữa</small>
              </span>
            </div>

            <div className={styles.stat}>
              <span className={styles.statLabel}>{householdSize > 1 ? 'Cả nhà / ngày' : 'Mục tiêu / ngày'}</span>
              <span className={styles.statValue}>
                {householdSize > 1 && householdTargetKcal
                  ? <>{formatKcal(householdConsumedKcal)}<small> / {formatKcal(householdTargetKcal)} kcal</small></>
                  : <>{perPersonTargetKcal ? formatKcal(perPersonTargetKcal) : '—'}<small> kcal</small></>}
              </span>
            </div>
          </div>

          {!hasHealthProfile && !profileLoading ? (
            <p className={styles.calorieHint}>
              <i className="bi bi-info-circle" aria-hidden="true" />
              Chưa có mục tiêu calo.{' '}
              <a href={HEALTH_PROFILE_HREF}>Điền hồ sơ sức khỏe</a> để hệ thống tính mục tiêu mỗi ngày.
            </p>
          ) : null}
        </section>

        {calorieWarning ? (
          <Notice tone="alert" title={calorieWarning.title}>
            {calorieWarning.message}
          </Notice>
        ) : null}

        {notice.message ? (
          <Notice tone={notice.tone === 'alert' ? 'alert' : notice.tone === 'success' ? 'success' : 'info'}>
            {notice.message}
          </Notice>
        ) : null}

        {isLoading ? (
          <div className={styles.loading}>
            <span className={styles.loadingDot} aria-hidden="true" />
            Đang tải thực đơn…
          </div>
        ) : (
          <section className={styles.slotGrid} aria-label="Các bữa ăn trong ngày" aria-busy={isSaving}>
            {SLOT_ORDER.map((slot) => (
              <MealSlotCard
                key={slot}
                slot={slot}
                items={itemsForSlot(planItems, slot)}
                allergies={allergies}
                disabled={!canEditSelectedDate || isSaving}
                removingId={removingId}
                onAdd={() => openPicker(slot)}
                onRemove={handleRemoveItem}
              />
            ))}
          </section>
        )}

        {!canEditSelectedDate ? (
          <p className={styles.lockedHint}>
            <i className="bi bi-lock" aria-hidden="true" /> Ngày đã qua — chỉ xem lại thực đơn.
          </p>
        ) : null}
      </main>

      <RecipePickerModal
        open={Boolean(picker)}
        onClose={closePicker}
        slot={picker?.slot}
        query={query}
        recipes={recipes}
        loading={recipesLoading}
        error={recipesError}
        inSlotIds={inSlotIds}
        savingId={savingKey}
        onQueryChange={setQuery}
        onChoose={handleChooseRecipe}
      />

      <RandomPlanModal
        open={randomModalOpen}
        form={randomForm}
        weekDays={randomWeekDays}
        defaultTarget={defaultTarget}
        hasHealthProfile={hasHealthProfile}
        profileLoading={profileLoading}
        profileError={profileError}
        mealsPerDay={mealsPerDay}
        isRunning={isRandomizing}
        onChange={patchRandomForm}
        onClose={() => setRandomModalOpen(false)}
        onSubmit={handleRandomize}
      />
    </MemberLayout>
  );
}
