const pool = require('../config/db');

const PROFILE_FIELDS = `
  p.profile_id AS id, p.gender, p.date_of_birth AS "dateOfBirth",
  p.height_cm AS "heightCm", p.weight_kg AS "weightKg",
  p.bmi, p.bmi_category AS "bmiCategory", p.activity_level AS "activityLevel",
  p.health_goal AS "healthGoal", p.tdee_kcal AS "tdeeKcal",
  p.target_calories_kcal AS "targetCaloriesKcal",
  p.created_at AS "createdAt", p.updated_at AS "updatedAt"
`;

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

async function getLatestConsent(client, accountId) {
  const { rows } = await client.query(`
    SELECT action, policy_version AS "policyVersion", occurred_at AS "occurredAt"
    FROM public.health_consent_event
    WHERE account_id = $1
    ORDER BY occurred_at DESC, event_id DESC
    LIMIT 1
  `, [accountId]);
  return rows[0] ?? null;
}

async function loadHealthProfile(client, accountId) {
  const { rows } = await client.query(`
    SELECT ${PROFILE_FIELDS}
    FROM public.profile p
    WHERE p.account_id = $1
  `, [accountId]);
  const profile = rows[0] ?? null;
  if (!profile) return null;

  const allergies = await client.query(`
    SELECT allergy_id AS id, name
    FROM public.allergy
    WHERE profile_id = $1
    ORDER BY allergy_id
  `, [profile.id]);
  return { ...profile, allergies: allergies.rows };
}

async function getHealthProfile(accountId) {
  return withTransaction(async (client) => {
    const consent = await getLatestConsent(client, accountId);
    if (consent?.action !== 'granted') {
      return { consented: false, consentVersion: null, profile: null };
    }
    return {
      consented: true,
      consentVersion: consent.policyVersion,
      profile: await loadHealthProfile(client, accountId),
    };
  });
}

async function saveHealthProfile(accountId, payload, calculated, consentPolicy) {
  return withTransaction(async (client) => {
    await client.query('SELECT account_id FROM public.account WHERE account_id = $1 FOR UPDATE', [accountId]);
    const latestConsent = await getLatestConsent(client, accountId);
    if (latestConsent?.action !== 'granted') {
      await client.query(`
        INSERT INTO public.health_consent_event (account_id, action, policy_version, policy_text)
        VALUES ($1, 'granted', $2, $3)
      `, [accountId, consentPolicy.version, consentPolicy.text]);
    }

    await client.query(`
      INSERT INTO public.profile (
        account_id, gender, date_of_birth, height_cm, weight_kg,
        bmi, bmi_category, activity_level, health_goal, tdee_kcal, target_calories_kcal
      )
      VALUES (
        $1, $2::profile_gender_enum, $3::date, $4, $5,
        $6, $7::bmi_category_enum, $8::activity_level_enum, $9::health_goal_enum, $10, $11
      )
      ON CONFLICT (account_id) DO UPDATE SET
        gender = EXCLUDED.gender,
        date_of_birth = EXCLUDED.date_of_birth,
        height_cm = EXCLUDED.height_cm,
        weight_kg = EXCLUDED.weight_kg,
        bmi = EXCLUDED.bmi,
        bmi_category = EXCLUDED.bmi_category,
        activity_level = EXCLUDED.activity_level,
        health_goal = EXCLUDED.health_goal,
        tdee_kcal = EXCLUDED.tdee_kcal,
        target_calories_kcal = EXCLUDED.target_calories_kcal,
        updated_at = NOW()
    `, [
      accountId, payload.gender, payload.dateOfBirth, payload.heightCm, payload.weightKg,
      calculated.bmi, calculated.bmiCategory, payload.activityLevel, payload.healthGoal,
      calculated.tdee, calculated.targetCalories,
    ]);

    const { rows } = await client.query('SELECT profile_id FROM public.profile WHERE account_id = $1', [accountId]);
    const profileId = rows[0].profile_id;
    await client.query('DELETE FROM public.allergy WHERE profile_id = $1', [profileId]);
    for (const name of payload.allergies) {
      await client.query('INSERT INTO public.allergy (profile_id, name) VALUES ($1, $2)', [profileId, name]);
    }

    return {
      consented: true,
      consentVersion: consentPolicy.version,
      profile: await loadHealthProfile(client, accountId),
    };
  });
}

async function withdrawHealthConsent(accountId, consentPolicy) {
  return withTransaction(async (client) => {
    await client.query('SELECT account_id FROM public.account WHERE account_id = $1 FOR UPDATE', [accountId]);
    await client.query(`
      INSERT INTO public.health_consent_event (account_id, action, policy_version, policy_text)
      VALUES ($1, 'withdrawn', $2, $3)
    `, [accountId, consentPolicy.version, consentPolicy.text]);
    await client.query(`
      DELETE FROM public.allergy
      WHERE profile_id IN (SELECT profile_id FROM public.profile WHERE account_id = $1)
    `, [accountId]);
    await client.query('DELETE FROM public.profile WHERE account_id = $1', [accountId]);
    return { consented: false, consentVersion: consentPolicy.version, profile: null };
  });
}

module.exports = { getHealthProfile, saveHealthProfile, withdrawHealthConsent };
