const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db');
const {
  getHealthProfile, grantHealthConsent, saveHealthProfile,
} = require('./health-profile.model');

async function withDatabase(steps, run) {
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

test('does not return health data when consent is from an older policy version', async () => {
  await withDatabase([
    { sql: /^BEGIN$/ },
    {
      sql: /FROM public\.health_consent_event/,
      rows: [{ action: 'granted', policyVersion: 'health-profile-v0' }],
    },
    {
      sql: /SELECT EXISTS[\s\S]*FROM public\.profile/,
      rows: [{ hasUnconsentedProfile: true }],
    },
    { sql: /^COMMIT$/ },
  ], async ({ calls, verify }) => {
    const result = await getHealthProfile('42', 'health-profile-v1');

    assert.deepEqual(result, {
      consented: false,
      consentVersion: 'health-profile-v0',
      hasUnconsentedProfile: true,
      profile: null,
    });
    assert.equal(calls.some(({ sql }) => /SELECT p\./.test(sql)), false);
    verify();
  });
});

test('grants consent before returning a locked legacy profile', async () => {
  await withDatabase([
    { sql: /^BEGIN$/ },
    { sql: /FROM public\.account WHERE account_id = \$1 FOR UPDATE/ },
    { sql: /FROM public\.health_consent_event/, rows: [] },
    { sql: /INSERT INTO public\.health_consent_event/ },
    {
      sql: /FROM public\.profile p/,
      rows: [{ id: '8', gender: null, dateOfBirth: null, heightCm: null, weightKg: null }],
    },
    { sql: /FROM public\.allergy/, rows: [] },
    { sql: /^COMMIT$/ },
  ], async ({ calls, verify }) => {
    const result = await grantHealthConsent(
      '42',
      { version: 'health-profile-v1', text: 'Updated consent text' },
    );

    const grant = calls.find(({ sql }) => /INSERT INTO public\.health_consent_event/.test(sql));
    assert.deepEqual(grant.values, ['42', 'health-profile-v1', 'Updated consent text']);
    assert.equal(result.consented, true);
    assert.equal(result.profile.id, '8');
    verify();
  });
});

test('preserves a legacy profile when a direct save first renews consent', async () => {
  await withDatabase([
    { sql: /^BEGIN$/ },
    { sql: /FROM public\.account WHERE account_id = \$1 FOR UPDATE/ },
    {
      sql: /FROM public\.health_consent_event/,
      rows: [{ action: 'granted', policyVersion: 'health-profile-v0' }],
    },
    { sql: /INSERT INTO public\.health_consent_event/ },
    {
      sql: /FROM public\.profile p/,
      rows: [{ id: '8', gender: 'female', dateOfBirth: '1996-06-01', heightCm: 165, weightKg: 60 }],
    },
    { sql: /FROM public\.allergy/, rows: [{ id: '11', name: 'Đậu phộng' }] },
    { sql: /^COMMIT$/ },
  ], async ({ calls, verify }) => {
    const result = await saveHealthProfile(
      '42',
      {
        gender: null,
        dateOfBirth: null,
        heightCm: null,
        weightKg: null,
        activityLevel: null,
        healthGoal: null,
        allergies: [],
      },
      { bmi: null, bmiCategory: null, tdee: null, targetCalories: null },
      { version: 'health-profile-v1', text: 'Updated consent text' },
    );

    assert.equal(result.requiresReview, true);
    assert.equal(result.profile.dateOfBirth, '1996-06-01');
    assert.deepEqual(result.profile.allergies, [{ id: '11', name: 'Đậu phộng' }]);
    assert.equal(calls.some(({ sql }) => /INSERT INTO public\.profile/.test(sql)), false);
    assert.equal(calls.some(({ sql }) => /DELETE FROM public\.allergy/.test(sql)), false);
    verify();
  });
});
