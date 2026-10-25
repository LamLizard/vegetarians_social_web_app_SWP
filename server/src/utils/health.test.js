const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateHealth, getAge } = require('./health');

// Duy's code: BMI vẫn được tính khi gender other nhưng không suy đoán TDEE/target.
test('calculates BMI independently from unsupported BMR inputs', () => {
  const result = calculateHealth({
    gender: 'other',
    dateOfBirth: '1996-06-01',
    heightCm: 165,
    weightKg: 60,
    activityLevel: 'moderate',
    healthGoal: 'maintain',
  }, new Date('2026-06-01T00:00:00.000Z'));

  assert.deepEqual(result, {
    bmi: 22,
    bmiCategory: 'normal',
    tdee: null,
    targetCalories: null,
  });
});

// Duy's code: Kiểm tra công thức giới tính được hỗ trợ, mục tiêu giảm cân và tuổi đủ năm.
test('calculates supported BMR-based targets and completed age', () => {
  assert.equal(getAge('2000-06-02', new Date('2026-06-01T00:00:00.000Z')), 25);
  const result = calculateHealth({
    gender: 'female',
    dateOfBirth: '1996-06-01',
    heightCm: 165,
    weightKg: 60,
    activityLevel: 'moderate',
    healthGoal: 'lose_weight',
  }, new Date('2026-06-01T00:00:00.000Z'));

  assert.equal(result.tdee, 2046);
  assert.equal(result.targetCalories, 1740);
});

// Duy's code: Thiếu ngày sinh thì bỏ tính năng lượng nhưng vẫn trả BMI khi đủ dữ liệu.
test('does not calculate calorie targets when any required input is missing', () => {
  const result = calculateHealth({
    gender: 'male',
    heightCm: 165,
    weightKg: 60,
    activityLevel: 'moderate',
    healthGoal: 'maintain',
  });

  assert.equal(result.bmi, 22);
  assert.equal(result.tdee, null);
  assert.equal(result.targetCalories, null);
});
