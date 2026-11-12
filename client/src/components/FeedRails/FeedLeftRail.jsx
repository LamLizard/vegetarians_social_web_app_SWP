// Khoi's code (01/11/2026): cột TRÁI của Bảng tin = "của bạn" — theo prototype v4 (src/v4/components/LeftRail.jsx).
//  1. Calo hôm nay   — từ Thực đơn AI (GET /api/meal-plans/week, chỉ ĐỌC); tích món đã ăn lưu trên trình duyệt (eatenMeals.js).
//  2. Công thức yêu thích — công thức đã thả tim (likedByMe từ GET /api/recipes, bảng recipe_like có sẵn)
//  3. Chủ đề hay dùng — postCount từ GET /api/categories, bấm để lọc Bảng tin
// Khách: thẻ mời đăng nhập. Phẳng, không bóng → bài post ở giữa luôn nổi bật nhất.
import { useState } from 'react';
import cx from '../cx';
import { localDateKey } from '../../utils/dailyPick';
import { readEaten, summarizeMeals, toggleEaten, writeEaten } from './eatenMeals';
import RecipeMini from './RecipeMini';
import useRailHeight from './useRailHeight';
import s from './FeedRails.module.css';

const R = 44;
const C = 2 * Math.PI * R;

function CalorieRing({ value, target }) {
  const pct = target ? Math.min(1, value / target) : 0;
  return (
    <div className={s.ring} role="img" aria-label={`Đã ăn ${value} trên ${target} kcal`}>
      <svg viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r={R} className={s.ringTrack} />
        {target > 0 && value > 0 && (
          <circle cx="52" cy="52" r={R} className={s.ringBar} strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 52 52)" />
        )}
      </svg>
      <div className={s.ringText}>
        <b>{value}</b>
        <span>/ {target} kcal</span>
      </div>
    </div>
  );
}

// Khoi's code (06/11/2026): tích món đã ăn → vòng tròn tăng dần (đã ăn / mục tiêu). Phương án B: nhóm theo bữa.
// Lưu trên trình duyệt (eatenMeals.js, L1) theo id thực đơn + ngày; khối được gắn key theo id thực đơn.
function CalorieBlock({ plan }) {
  const today = plan.today;
  const items = today?.items ?? [];
  const planId = today?.id ?? null;
  const date = today?.planDate ?? localDateKey();
  const [eatenIds, setEatenIds] = useState(() => readEaten(
    typeof window === 'undefined' ? null : window.localStorage, planId, date, items.map((item) => item.id)));

  if (plan.status === 'loading') {
    return <section className={s.box} aria-busy="true"><h2 className={s.title}>Calo hôm nay</h2><div className={cx(s.sk, s.skRing)} /></section>;
  }
  if (plan.status === 'error' || items.length === 0) {
    return (
      <section className={s.box}>
        <h2 className={s.title}>Calo hôm nay</h2>
        <div className={s.emptyPlan}>
          <i className="bi bi-stars" aria-hidden="true" />
          <p>{plan.status === 'error' ? 'Chưa tải được thực đơn hôm nay.' : 'Bạn chưa có thực đơn hôm nay. Để AI gợi ý các bữa vừa đủ calo cho bạn.'}</p>
          <a className={s.cta} href="/meal-plan">{plan.status === 'error' ? 'Mở Thực đơn' : 'Tạo thực đơn'}</a>
        </div>
      </section>
    );
  }
  const summary = summarizeMeals(items, eatenIds, Number(today.targetCaloriesKcal) || plan.profileTarget || 0);
  const left = summary.goal - summary.eatenKcal;
  const toggle = (id) => {
    const next = toggleEaten(eatenIds, id);
    setEatenIds(next);
    writeEaten(window.localStorage, planId, date, next);
  };
  return (
    <section className={s.box}>
      <div className={s.head}>
        <h2 className={s.title}>Calo hôm nay</h2>
        <a className={s.more} href="/meal-plan">Chi tiết</a>
      </div>
      <div className={s.ringRow}>
        <CalorieRing value={summary.eatenKcal} target={summary.goal} />
        <div className={s.ringSide}>
          <span>Đã ăn</span>
          <b>{summary.eatenCount}/{summary.itemCount} món</b>
          <span>{left >= 0 ? `Còn ${left} kcal` : `Vượt ${-left} kcal`}</span>
        </div>
      </div>
      {!summary.hasTarget && <p className={s.goalNote}>Chưa có mục tiêu calo trong hồ sơ, đang tính theo tổng thực đơn.</p>}
      {summary.slots.map((group) => (
        <div key={group.slot} className={s.slot}>
          <div className={s.slotHead}>
            <span>{group.label}</span>
            <span className={s.slotKcal}>{group.eatenKcal} / {group.totalKcal}</span>
          </div>
          <ul className={s.meals}>
            {group.items.map((m) => (
              <li key={m.id}>
                <button type="button" role="checkbox" aria-checked={m.done}
                  className={cx(s.mealCheck, m.done && s.mealDone)} onClick={() => toggle(m.id)}
                  aria-label={`${m.done ? 'Bỏ đánh dấu' : 'Đánh dấu đã ăn'} ${m.recipeName}, ${m.caloriesKcal ?? 0} kcal`}>
                  <span className={s.check} aria-hidden="true">{m.done && <i className="bi bi-check-lg" />}</span>
                  <span className={s.mealDish}>{m.recipeName}</span>
                  <span className={s.mealKcal}>{m.caloriesKcal ?? '–'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * @param {boolean} isGuest
 * @param {{status, today}} plan   today = { targetCaloriesKcal, items: [{mealSlot, recipeName, caloriesKcal}] } | null
 * @param {object[]|null} favorites   công thức đã thả tim (null = đang tải)
 * @param {(recipe) => void} onLike
 * @param {{id, name, postCount}[]} topics · @param {string|null} activeTopicId · @param {(topic) => void} onTopic
 * @param {() => void} [onLogin] · [onRegister]
 */
export default function FeedLeftRail({ isGuest, plan, favorites, onLike, topics = [], activeTopicId, onTopic, onLogin, onRegister }) {
  const ref = useRailHeight();

  if (isGuest) {
    return (
      <aside ref={ref} className={s.rail} aria-label="Tham gia Green Bowl">
        <section className={cx(s.box, s.join)}>
          <i className="bi bi-flower1" aria-hidden="true" />
          <h2 className={s.title}>Cùng ăn chay dễ hơn</h2>
          <p>Đăng nhập để lướt hết bảng tin, lưu công thức yêu thích và nhận thực đơn AI theo calo của bạn.</p>
          <button type="button" className={s.cta} onClick={onLogin}>Đăng nhập</button>
          <button type="button" className={s.ghost} onClick={onRegister}>Tạo tài khoản miễn phí</button>
        </section>
      </aside>
    );
  }

  return (
    <aside ref={ref} className={s.rail} aria-label="Của bạn">
      <CalorieBlock key={plan.today?.id ?? plan.status} plan={plan} />

      <section className={s.box}>
        <div className={s.head}>
          <h2 className={s.title}>Công thức yêu thích</h2>
          {favorites?.length > 3 && <a className={s.more} href="/recipes?liked=1">Tất cả</a>}
        </div>
        {favorites == null && <div className={cx(s.sk, s.skList)} />}
        {favorites?.length > 0 && (
          <ul className={s.recipes}>
            {favorites.slice(0, 3).map((r) => <RecipeMini key={r.id} recipe={r} onLike={onLike} />)}
          </ul>
        )}
        {favorites?.length === 0 && (
          <p className={s.emptyText}>Thả tim <i className="bi bi-heart" aria-hidden="true" /> một công thức để lưu lại nấu sau.</p>
        )}
      </section>

      {topics.length > 0 && (
        <section className={s.box}>
          <h2 className={s.title}>Chủ đề hay dùng</h2>
          <div className={s.topics}>
            {topics.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cx(s.topic, activeTopicId === t.id && s.topicOn)}
                aria-pressed={activeTopicId === t.id}
                onClick={() => onTopic(activeTopicId === t.id ? null : t)}
              >
                {t.name}{t.postCount > 0 && <small>{t.postCount}</small>}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
