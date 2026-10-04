import assert from 'node:assert/strict';
import test from 'node:test';
import { calcBmi, calcBmr, calcHealth } from './health.js';

// Duy's code: Đảm bảo gender other không bị gán công thức BMR/TDEE nam hoặc nữ.
test('does not estimate BMR or TDEE for gender other', () => {
  assert.equal(calcBmr({ gender: 'other', weightKg: 60, heightCm: 165, age: 30 }), null);
  assert.deepEqual(calcHealth({
    gender: 'other',
    age: 30,
    heightCm: 165,
    weightKg: 60,
    activityLevel: 'moderate',
    goal: 'maintain',
  }), {
      bmi: 22,
      bmiCategory: 'normal',
      bmr: null,
      tdee: null,
      targetCalories: null,
  });
});

// Duy's code: Bảo toàn công thức Mifflin-St Jeor cho male và female.
test('continues to calculate BMR for the supported male and female formula inputs', () => {
  const values = { weightKg: 60, heightCm: 165, age: 30 };
  assert.equal(calcBmr({ ...values, gender: 'male' }), 1486.25);
  assert.equal(calcBmr({ ...values, gender: 'female' }), 1320.25);
});

// Duy's code: Không coi ngày sinh chưa nhập là tuổi 0 để tính ra mức năng lượng.
test('does not calculate energy targets when date of birth is missing', () => {
  const result = calcHealth({
    gender: 'female',
    age: null,
    heightCm: 165,
    weightKg: 60,
    activityLevel: 'moderate',
    goal: 'maintain',
  });

  assert.equal(result.bmi, 22);
  assert.equal(result.tdee, null);
  assert.equal(result.targetCalories, null);
});

// Duy's code: Chấp nhận tuổi 0 khi đó là tuổi đã được xác định hợp lệ.
test('accepts age zero as a known age instead of treating it as missing', () => {
  assert.equal(calcBmr({ gender: 'male', age: 0, heightCm: 50, weightKg: 3 }), 347.5);
});

// Duy's code: Không hiển thị BMI cho chiều cao hoặc cân nặng không hợp lệ.
test('does not calculate BMI from non-positive measurements', () => {
  assert.equal(calcBmi(-165, 60), null);
  assert.equal(calcBmi(165, 0), null);
});
