// =====================================================================
//  CHỈ SỐ SỨC KHOẺ (BR-03) · dùng để XEM TRƯỚC trên form Meal Planner / Profile.
//  Số chính thức vẫn do Backend tính và lưu trong profile (bmi, tdee, target_calories).
// =====================================================================

/** Hệ số vận động nhân với BMR. Key = profile.activity_level. Chốt lại với Backend nếu đổi. */
export const ACTIVITY_FACTOR = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };

/** Điều chỉnh calo theo mục tiêu (BR-03): giảm cân bớt 15% (khoảng 10 đến 20%), tăng cơ thêm 200 kcal (150 đến 300). */
export const GOAL_ADJUST = { lose_weight: (t) => t * 0.85, maintain: (t) => t, gain_muscle: (t) => t + 200 };

/** BMI = kg / m². 170cm, 65kg → 22.5 */
export function calcBmi(heightCm, weightKg) {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  if (!h || !w) return null;
  return Math.round((w / (h * h)) * 10) / 10;
}

/** Phân loại BMI theo BR-03 → key của BMI_CATEGORY. */
export function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/** BMR Mifflin-St Jeor (BR-03). gender 'male' | 'female' (khác → lấy trung bình 2 công thức). */
export function calcBmr({ gender, weightKg, heightCm, age }) {
  const base = 10 * Number(weightKg) + 6.25 * Number(heightCm) - 5 * Number(age);
  if (!weightKg || !heightCm || !age) return null;
  if (gender === 'male') return base + 5;
  if (gender === 'female') return base - 161;
  return base - 78;
}

/**
 * Tính trọn bộ để xem trước: { bmi, bmiCategory, bmr, tdee, targetCalories } (số làm tròn).
 * Thiếu dữ liệu → các giá trị là null.
 */
export function calcHealth({ gender, age, heightCm, weightKg, activityLevel, goal }) {
  const bmi = calcBmi(heightCm, weightKg);
  const bmr = calcBmr({ gender, weightKg, heightCm, age });
  const tdee = bmr && ACTIVITY_FACTOR[activityLevel] ? Math.round(bmr * ACTIVITY_FACTOR[activityLevel]) : null;
  const target = tdee && GOAL_ADJUST[goal] ? Math.round(GOAL_ADJUST[goal](tdee) / 10) * 10 : null;
  return { bmi, bmiCategory: bmiCategory(bmi), bmr: bmr && Math.round(bmr), tdee, targetCalories: target };
}
