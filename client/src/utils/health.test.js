import assert from 'node:assert/strict';
import test from 'node:test';
import { calcBmr, calcHealth } from './health.js';

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

test('continues to calculate BMR for the supported male and female formula inputs', () => {
  const values = { weightKg: 60, heightCm: 165, age: 30 };
  assert.equal(calcBmr({ ...values, gender: 'male' }), 1486.25);
  assert.equal(calcBmr({ ...values, gender: 'female' }), 1320.25);
});
