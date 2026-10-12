// =====================================================================
//  CHỈ SỐ SỨC KHOẺ (BR-03) · dùng để XEM TRƯỚC trên form Meal Planner / Profile.
//  Số chính thức vẫn do Backend tính và lưu trong profile (bmi, tdee, target_calories).
// =====================================================================

/** Duy's code: Hệ số vận động nhân với BMR để xem trước TDEE trên giao diện. */
export const ACTIVITY_FACTOR = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };

/** Duy's code: Điều chỉnh mục tiêu calo theo quy tắc Sprint 2; phải đồng bộ với backend. */
export const GOAL_ADJUST = { lose_weight: (t) => t * 0.85, maintain: (t) => t, gain_muscle: (t) => t + 200 };

/** Duy's code: Tính BMI từ chiều cao và cân nặng, làm tròn một chữ số thập phân. */
export function calcBmi(heightCm, weightKg) {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return null;
  return Math.round((w / (h * h)) * 10) / 10;
}

/** Duy's code: Ánh xạ BMI sang một trong các nhóm lưu được trong profile. */
export function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/** Duy's code: Tính BMR theo Mifflin-St Jeor, không ước đoán giới tính other. */
export function calcBmr({ gender, weightKg, heightCm, age }) {
  const weight = Number(weightKg);
  const height = Number(heightCm);
  if (age === null || age === undefined || age === '') return null;
  const years = Number(age);
  if (![weight, height, years].every(Number.isFinite) || weight <= 0 || height <= 0 || years < 0) return null;
  const base = 10 * weight + 6.25 * height - 5 * years;
  if (gender === 'male') return base + 5;
  if (gender === 'female') return base - 161;
  return null;
}

/** Duy's code: Tạo bản xem trước chỉ số và để null cho phép tính thiếu dữ liệu đầu vào. */
export function calcHealth({ gender, age, heightCm, weightKg, activityLevel, goal }) {
  const bmi = calcBmi(heightCm, weightKg);
  const bmr = calcBmr({ gender, weightKg, heightCm, age });
  const tdee = bmr != null && ACTIVITY_FACTOR[activityLevel] ? Math.round(bmr * ACTIVITY_FACTOR[activityLevel]) : null;
  const target = tdee != null && GOAL_ADJUST[goal] ? Math.round(GOAL_ADJUST[goal](tdee) / 10) * 10 : null;
  return { bmi, bmiCategory: bmiCategory(bmi), bmr: bmr == null ? null : Math.round(bmr), tdee, targetCalories: target };
}
