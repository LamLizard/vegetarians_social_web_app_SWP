// Duy's code: Hệ số vận động chuyển BMR thành mức tiêu hao năng lượng TDEE.
const ACTIVITY_FACTOR = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

// Duy's code: Điều chỉnh TDEE theo mục tiêu trước khi đề xuất lượng calo.
const GOAL_ADJUST = {
  lose_weight: (tdee) => tdee * 0.85,
  maintain: (tdee) => tdee,
  gain_muscle: (tdee) => tdee + 200,
};

// Duy's code: Tính tuổi đủ năm tại ngày hiện tại, không chỉ trừ năm sinh.
function getAge(dateOfBirth, today = new Date()) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) return null;
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayPending = today.getUTCMonth() < birthDate.getUTCMonth()
    || (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate());
  if (birthdayPending) age -= 1;
  return age >= 0 ? age : null;
}

// Duy's code: Tính BMI cho mọi lựa chọn giới tính; chỉ tính BMR khi có công thức hỗ trợ.
function calculateHealth({ gender, dateOfBirth, heightCm, weightKg, activityLevel, healthGoal }, today) {
  const height = Number(heightCm);
  const weight = Number(weightKg);
  const bmi = height > 0 && weight > 0 ? Math.round((weight / ((height / 100) ** 2)) * 10) / 10 : null;
  const bmiCategory = bmi == null
    ? null
    : bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese';
  const age = getAge(dateOfBirth, today);
  let bmr = null;
  if (age != null && height > 0 && weight > 0) {
    const base = 10 * weight + 6.25 * height - 5 * age;
    if (gender === 'male') bmr = base + 5;
    if (gender === 'female') bmr = base - 161;
  }
  const factor = ACTIVITY_FACTOR[activityLevel];
  const tdee = bmr != null && factor ? Math.round(bmr * factor) : null;
  const adjust = GOAL_ADJUST[healthGoal];
  const targetCalories = tdee != null && adjust ? Math.round(adjust(tdee) / 10) * 10 : null;

  return {
    bmi,
    bmiCategory,
    tdee,
    targetCalories,
  };
}

module.exports = { ACTIVITY_FACTOR, GOAL_ADJUST, calculateHealth, getAge };
