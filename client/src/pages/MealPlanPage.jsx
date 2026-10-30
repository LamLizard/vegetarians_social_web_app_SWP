import { useCallback, useEffect, useMemo, useState } from 'react';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import {
  Button,
  Modal,
  Notice,
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

function isPastDate(dateKey) {
  return parseDateKey(dateKey) < getTodayInVietnam();
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

function getItemForSlot(plan, slot) {
  return (plan?.items ?? []).find((item) => item.mealSlot === slot) ?? null;
}

function getEmptySlots(plan) {
  return SLOT_ORDER.filter((slot) => !getItemForSlot(plan, slot));
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

function WeekPicker({ weekStart, selectedDate, onWeekChange, onSelectDate }) {
  const monday = mondayOf(parseDateKey(weekStart));
  const currentMonday = mondayOf(getTodayInVietnam());
  const finalMonday = mondayOf(new Date(new Date().getFullYear(), 11, 31, 12));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(monday, index));

  return (
    <section className={styles.weekPicker} aria-label="Chọn tuần và ngày">
      <div className={styles.weekControls}>
        <button
          type="button"
          className={styles.weekArrow}
          aria-label="Tuần trước"
          disabled={monday <= currentMonday}
          onClick={() => onWeekChange(dateKey(addDays(monday, -7)))}
        >
          ‹
        </button>
        <strong className={styles.weekLabel}>{formatWeekLabel(monday)}</strong>
        <button
          type="button"
          className={styles.weekArrow}
          aria-label="Tuần sau"
          disabled={monday >= finalMonday}
          onClick={() => onWeekChange(dateKey(addDays(monday, 7)))}
        >
          ›
        </button>
      </div>

      <div className={styles.weekDays} role="group" aria-label="Ngày trong tuần"
        style={{ gridTemplateColumns: 'repeat(7, minmax(4rem, 1fr))', overflowX: 'auto' }}>
        {weekDays.map((day, index) => {
          const key = dateKey(day);
          const selected = key === selectedDate;
          return (
            <button
              key={key}
              type="button"
              className={`${styles.weekDay} ${selected ? styles.weekDaySelected : ''}`}
              aria-pressed={selected}
              onClick={() => onSelectDate(key)}
            >
              <span>{WEEKDAY_LABELS[index]}</span>
              <strong>{shortDate(day)}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MealRow({ item, slot, warning, disabled, onChoose, onRemove }) {
  const empty = !item;
  const actionLabel = item ? 'Đổi món' : 'Chọn món';

  return (
    <article className={`${styles.mealRow} ${empty ? styles.mealRowEmpty : ''}`}>
      <div className={styles.slot}>
        <i className={`bi bi-${SLOT_ICON[slot]}`} aria-hidden="true" />
        <span>{SLOT_LABEL[slot]}</span>
      </div>

      <div className={`${styles.thumbnail} ${!item?.imageUrl ? styles.thumbnailEmpty : ''}`}>
        {item?.imageUrl ? (
          <img src={item.imageUrl} alt="" loading="lazy" />
        ) : (
          <i className="bi bi-egg-fried" aria-hidden="true" />
        )}
      </div>

      <div className={styles.mealInfo}>
        {item ? (
          <>
            <strong className={styles.recipeName} title={item.recipeName}>{item.recipeName}</strong>
            <span className={styles.description} title={item.description || ''}>{item.description || 'Chưa có mô tả.'}</span>
            <div className={styles.mealFacts}>
              <span>{item.caloriesKcal ?? '—'} kcal</span>
              {item.nutritionGroup ? <span className={styles.nutritionTag}>{item.nutritionGroup}</span> : null}
            </div>
            {warning ? <span className={styles.allergyWarning}>{warning}</span> : null}
          </>
        ) : (
          <>
            <strong className={styles.recipeName}>Chưa có món</strong>
            <span className={styles.description}>Hãy chọn công thức phù hợp cho bữa này.</span>
          </>
        )}
      </div>

      <div className={styles.rowActions}>
        <Button
          size="sm"
          variant={item ? 'outline' : 'primary'}
          icon={item ? 'arrow-left-right' : 'plus-lg'}
          disabled={disabled}
          onClick={onChoose}
        >
          {actionLabel}
        </Button>
        {item ? (
          <button
            type="button"
            className={styles.removeButton}
            aria-label={`Xóa ${SLOT_LABEL[slot].toLocaleLowerCase()}`}
            title="Xóa món"
            disabled={disabled}
            onClick={onRemove}
          >
            <i className="bi bi-trash3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function RecipePickerModal({
  open,
  onClose,
  slot,
  query,
  recipes,
  loading,
  error,
  onQueryChange,
  onChoose,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={slot ? `Chọn công thức cho ${SLOT_LABEL[slot]}` : 'Chọn công thức'}
      description="Chỉ hiển thị công thức đã duyệt phù hợp với hồ sơ sức khỏe của bạn."
      size="lg"
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
          <Notice tone="alert" title="Không tải được công thức" action={{ label: 'Thử lại', onClick: onClose }}>
            {error}
          </Notice>
        ) : null}

        <div className={styles.recipeResults} aria-busy={loading}>
          {loading ? (
            <p className={styles.pickerMessage}>Đang tải công thức…</p>
          ) : recipes.length === 0 && !error ? (
            <p className={styles.pickerMessage}>Không tìm thấy công thức phù hợp.</p>
          ) : (
            recipes.map((recipe) => (
              <article key={recipe.id} className={styles.recipeItem}>
                <div className={`${styles.recipeThumb} ${!recipe.thumbnailUrl ? styles.thumbnailEmpty : ''}`}>
                  {recipe.thumbnailUrl ? <img src={recipe.thumbnailUrl} alt="" loading="lazy" /> : <i className="bi bi-egg-fried" aria-hidden="true" />}
                </div>
                <div className={styles.recipeText}>
                  <strong title={recipe.title}>{recipe.title}</strong>
                  <small title={recipe.description || ''}>{recipe.description || 'Chưa có mô tả.'}</small>
                  <span>{recipe.caloriesKcal ?? '—'} kcal</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => onChoose(recipe)}>Chọn</Button>
              </article>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function MealPlanPage({ user = null, accountMenu = [] }) {
  const [weekStart, setWeekStart] = useState(() => dateKey(mondayOf(new Date())));
  const [selectedDate, setSelectedDate] = useState(() => getVietnamDateKey(new Date()));
  const [days, setDays] = useState([]);
  const [healthProfile, setHealthProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState({ tone: 'info', message: '' });
  const [picker, setPicker] = useState(null);
  const [query, setQuery] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState('');
  const toast = useToast();

  const allergies = useMemo(() => healthProfile?.allergies ?? [], [healthProfile]);

  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? { date: selectedDate, plan: null },
    [days, selectedDate],
  );

  const selectedPlan = selectedDay.plan;
  const totalCalories = (selectedPlan?.items ?? []).reduce((sum, item) => sum + (Number(item.caloriesKcal) || 0), 0);
  const rawTargetCalories = selectedPlan?.targetCaloriesKcal
    ?? healthProfile?.targetCalories
    ?? healthProfile?.targetCaloriesKcal;
  const targetCaloriesValue = Number(rawTargetCalories);
  const targetCalories = Number.isFinite(targetCaloriesValue) && targetCaloriesValue > 0
    ? targetCaloriesValue
    : null;
  const canEditSelectedDate = !isPastDate(selectedDate);
  const emptySlots = getEmptySlots(selectedPlan);
  const caloriePercentage = targetCalories && totalCalories > 0 && selectedPlan?.items?.length
    ? (totalCalories / targetCalories) * 100
    : null;
  const calorieWarning = caloriePercentage > 110
    ? {
      title: 'Tổng calo hôm nay đang vượt 110% mục tiêu',
      message: `Hiện tại ${totalCalories} / ${targetCalories} kcal (${caloriePercentage.toFixed(2)}%). Nên giảm bớt món hoặc đổi sang món nhẹ hơn.`,
    }
    : caloriePercentage < 80 && caloriePercentage !== null
      ? {
        title: 'Tổng calo hôm nay mới đạt dưới 80% mục tiêu',
        message: `Hiện tại ${totalCalories} / ${targetCalories} kcal (${caloriePercentage.toFixed(2)}%). Có thể thêm bữa phụ hoặc chọn món giàu năng lượng hơn.`,
      }
      : null;

  const loadWeek = useCallback(async (nextWeekStart, signal) => {
    setIsLoading(true);
    setNotice({ tone: 'info', message: '' });

    try {
      const response = await mealPlanService.getWeek(nextWeekStart, { signal });
      const normalizedDays = (response.days ?? []).map((entry) => ({
        date: entry.date,
        plan: entry.plan ? { ...entry.plan, items: (entry.plan.items ?? []).map(normalizeItem).filter(Boolean) } : null,
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
    getHealthProfile({ signal: controller.signal })
      .then(({ profile }) => {
        if (!controller.signal.aborted) setHealthProfile(profile);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setNotice({ tone: 'alert', message: error.message || 'Không tải được hồ sơ sức khỏe.' });
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

  const updateSelectedDayPlan = useCallback((updater) => {
    setDays((current) => current.map((day) => (day.date !== selectedDate ? day : { ...day, plan: updater(day.plan) })));
  }, [selectedDate]);

  const ensurePlanForSelectedDate = useCallback(async () => {
    if (selectedPlan) return selectedPlan;
    const response = await mealPlanService.createDay({ planDate: selectedDate, mealsPerDay: 3 });
    const createdPlan = { ...response.plan, items: (response.plan?.items ?? []).map(normalizeItem).filter(Boolean) };
    setDays((current) => {
      const existing = current.find((day) => day.date === selectedDate);
      if (existing) {
        return current.map((day) => (day.date === selectedDate ? { ...day, plan: createdPlan } : day));
      }
      return [...current, { date: selectedDate, plan: createdPlan }];
    });
    return createdPlan;
  }, [selectedDate, selectedPlan]);

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

  const handleChooseRecipe = async (recipe) => {
    if (!canEditSelectedDate || isSaving) return;
    const planToUse = selectedPlan ?? await ensurePlanForSelectedDate();
    if (!planToUse) return;

    setIsSaving(true);
    setNotice({ tone: 'info', message: 'Đang lưu…' });

    try {
      const { item } = await mealPlanService.updateItem(planToUse.id, picker.slot, String(recipe.id));
      const nextItem = normalizeItem(item);
      updateSelectedDayPlan((currentPlan) => {
        const currentItems = currentPlan?.items ?? [];
        return {
          ...(currentPlan ?? { id: planToUse.id, planDate: selectedDate, items: [] }),
          id: planToUse.id,
          planDate: selectedDate,
          items: [...currentItems.filter((entry) => entry.mealSlot !== picker.slot), nextItem].filter(Boolean),
        };
      });
      setNotice({ tone: 'success', message: 'Đã lưu công thức.' });
      toast('Đã lưu công thức.');
      closePicker();
    } catch (error) {
      setNotice({ tone: 'alert', message: error.message || 'Không lưu được công thức.' });
      toast('Không lưu được công thức.', { tone: 'alert' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecipe = async (slot) => {
    if (!canEditSelectedDate || !selectedPlan || isSaving) return;

    setIsSaving(true);
    setNotice({ tone: 'info', message: 'Đang lưu…' });

    try {
      await mealPlanService.deleteItem(selectedPlan.id, slot);
      updateSelectedDayPlan((currentPlan) => ({
        ...(currentPlan ?? { id: selectedPlan.id, planDate: selectedDate, items: [] }),
        id: selectedPlan.id,
        planDate: selectedDate,
        items: (currentPlan?.items ?? []).filter((entry) => entry.mealSlot !== slot),
      }));
      setNotice({ tone: 'success', message: 'Đã xóa món.' });
      toast('Đã xóa món.');
    } catch (error) {
      setNotice({ tone: 'alert', message: error.message || 'Không xóa được món.' });
      toast('Không xóa được món.', { tone: 'alert' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRandomize = async () => {
    if (!canEditSelectedDate || isSaving) return;
    if (!targetCalories || emptySlots.length === 0) {
      setNotice({ tone: 'alert', message: 'Không thể random bữa trống cho ngày này.' });
      return;
    }

    setIsSaving(true);
    setNotice({ tone: 'info', message: 'Đang chọn món…' });

    try {
      const planToUse = selectedPlan ?? await ensurePlanForSelectedDate();
      const response = await mealPlanService.randomize(planToUse.id);
      const newItems = (response.items ?? []).map(normalizeItem).filter(Boolean);
      updateSelectedDayPlan((currentPlan) => {
        const itemsBySlot = new Map((currentPlan?.items ?? []).map((item) => [item.mealSlot, item]));
        newItems.forEach((item) => {
          if (SLOT_ORDER.includes(item.mealSlot)) itemsBySlot.set(item.mealSlot, item);
        });
        return {
          ...(currentPlan ?? { id: planToUse.id, planDate: selectedDate, items: [] }),
          id: planToUse.id,
          planDate: selectedDate,
          items: SLOT_ORDER.map((slot) => itemsBySlot.get(slot)).filter(Boolean),
        };
      });
      setNotice({ tone: 'success', message: response.message || `Đã thêm ${newItems.length} món.` });
      toast(response.message || `Đã thêm ${newItems.length} món.`);
    } catch (error) {
      setNotice({ tone: 'alert', message: error.message || 'Không thể random bữa trống.' });
      toast(error.message || 'Không thể random bữa trống.', { tone: 'alert' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedItems = SLOT_ORDER.map((slot) => ({
    slot,
    item: getItemForSlot(selectedPlan, slot),
  }));

  return (
    <MemberLayout activeKey="meal-plan" user={user} accountMenu={accountMenu}>
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.headerEyebrow}>Thực đơn AI</p>
              <h1>Hôm nay bạn ăn gì?</h1>
            </div>

            <Button
              type="button"
              size="sm"
              variant="primary"
              icon="shuffle"
              disabled={!canEditSelectedDate || isSaving || !targetCalories || emptySlots.length === 0}
              onClick={handleRandomize}
            >
              Random bữa trống
            </Button>
          </div>

          <div className={styles.summaryStrip}>
            <span>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parseDateKey(selectedDate))}</span>
            <span>{totalCalories} kcal</span>
            <span>{targetCalories ? `${Math.max(targetCalories - totalCalories, 0)} kcal còn lại` : 'Chưa có mục tiêu'}</span>
          </div>
        </header>

        <WeekPicker
          weekStart={weekStart}
          selectedDate={selectedDate}
          onWeekChange={setWeekStart}
          onSelectDate={setSelectedDate}
        />

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

        <section className={styles.calorieSummary}>
          <strong>{totalCalories}</strong>
          <span>/ {targetCalories ?? '—'} kcal</span>
        </section>

        {isLoading ? (
          <div className={styles.loading}>Đang tải thực đơn…</div>
        ) : (
          <section className={styles.mealRows} aria-label="Các bữa ăn trong ngày" aria-busy={isSaving}>
            {selectedItems.map(({ slot, item }) => (
              <MealRow
                key={slot}
                item={item}
                slot={slot}
                warning={getWarning(item, allergies)}
                disabled={!canEditSelectedDate || isSaving}
                onChoose={() => openPicker(slot)}
                onRemove={() => handleDeleteRecipe(slot)}
              />
            ))}
          </section>
        )}
      </main>

      <RecipePickerModal
        open={Boolean(picker)}
        onClose={closePicker}
        slot={picker?.slot}
        query={query}
        recipes={recipes}
        loading={recipesLoading}
        error={recipesError}
        onQueryChange={setQuery}
        onChoose={handleChooseRecipe}
      />
    </MemberLayout>
  );
}
