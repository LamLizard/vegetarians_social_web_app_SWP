const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db');
const { getHealthProfile, saveHealthProfile } = require('./health-profile.model');

async function withClient(steps, run) {
  const calls = [];
  const originalConnect = pool.connect;
  let released = false;
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      const next = steps.shift();
      assert.ok(next, `Unexpected query: ${sql}`);
      assert.match(sql, next.sql);
      if (next.error) throw next.error;
      return { rows: next.rows || [] };
    },
    release() {
      released = true;
    },
  };
  pool.connect = async () => client;

  try {
    await run({
      calls,
      verify: () => {
        assert.equal(steps.length, 0);
        assert.equal(released, true);
      },
    });
  } finally {
    pool.connect = originalConnect;
  }
}

test('loads a health profile and its allergies without checking consent', async () => {
  const originalQuery = pool.query;
  const calls = [];
  const steps = [
    {
      sql: /FROM public\.profile p/,
      rows: [{ id: '8', gender: 'female', dateOfBirth: '1996-06-01' }],
    },
    {
      sql: /FROM public\.allergy/,
      rows: [{ id: '11', name: 'Đậu phộng' }],
    },
  ];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    const next = steps.shift();
    assert.ok(next, `Unexpected query: ${sql}`);
    assert.match(sql, next.sql);
    return { rows: next.rows };
  };

  try {
    const profile = await getHealthProfile('42');
    assert.equal(profile.id, '8');
    assert.deepEqual(profile.allergies, [{ id: '11', name: 'Đậu phộng' }]);
    assert.equal(calls.some(({ sql }) => /health_consent_event/.test(sql)), false);
    assert.equal(steps.length, 0);
  } finally {
    pool.query = originalQuery;
  }
});

test('saves a profile and replaces its allergies in one transaction', async () => {
  await withClient([
    { sql: /^BEGIN$/ },
    { sql: /INSERT INTO public\.profile/ },
    { sql: /SELECT profile_id FROM public\.profile/, rows: [{ profile_id: '8' }] },
    { sql: /DELETE FROM public\.allergy/ },
    { sql: /INSERT INTO public\.allergy/, rows: [] },
    { sql: /FROM public\.profile p/, rows: [{ id: '8', gender: 'female', dateOfBirth: '1996-06-01' }] },
    { sql: /FROM public\.allergy/, rows: [{ id: '11', name: 'Đậu phộng' }] },
    { sql: /^COMMIT$/ },
  ], async ({ calls, verify }) => {
    const result = await saveHealthProfile(
      '42',
      {
        gender: 'female',
        dateOfBirth: '1996-06-01',
        heightCm: 165,
        weightKg: 60,
        activityLevel: 'moderate',
        healthGoal: 'maintain',
        allergies: ['Đậu phộng'],
      },
      { bmi: 22, bmiCategory: 'normal', tdee: 1800, targetCalories: 1800 },
    );

    assert.equal(result.profile.id, '8');
    assert.deepEqual(result.profile.allergies, [{ id: '11', name: 'Đậu phộng' }]);
    assert.equal(calls.some(({ sql }) => /health_consent_event/.test(sql)), false);
    verify();
  });
});
