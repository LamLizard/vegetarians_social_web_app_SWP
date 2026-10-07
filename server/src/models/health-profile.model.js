const pool = require('../config/db');

// Duy's code: Chuẩn hóa các cột hồ sơ sức khỏe thành cấu trúc phản hồi API.
const PROFILE_FIELDS = `
  p.profile_id AS id, p.gender, p.date_of_birth AS "dateOfBirth",
  p.height_cm AS "heightCm", p.weight_kg AS "weightKg",
  p.bmi, p.bmi_category AS "bmiCategory", p.activity_level AS "activityLevel",
  p.health_goal AS "healthGoal", p.tdee_kcal AS "tdeeKcal",
  p.target_calories_kcal AS "targetCaloriesKcal",
  p.created_at AS "createdAt", p.updated_at AS "updatedAt"
`;

// Duy's code: Gom thay đổi nhiều bảng thành một transaction có rollback khi lỗi.
async function withTransaction(work) {
  // Duy's code: Mượn một PostgreSQL client để transaction dùng chung một kết nối.
  const client = await pool.connect();
  try {
    // Duy's code: Bắt đầu transaction trước mọi thao tác nhiều bảng.
    await client.query('BEGIN');
    const result = await work(client);
    // Duy's code: Lưu mọi thay đổi nếu toàn bộ nghiệp vụ hoàn tất.
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // Duy's code: Hủy một phần thay đổi nhưng giữ nguyên lỗi gốc để caller xử lý.
    try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

// Duy's code: Tải hồ sơ cùng danh sách dị ứng thuộc đúng tài khoản.
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

// Duy's code: Đọc trực tiếp hồ sơ sức khỏe của tài khoản đã được xác thực.
async function getHealthProfile(accountId) {
  return loadHealthProfile(pool, accountId);
}

// Duy's code: Lưu hồ sơ và danh sách dị ứng nguyên tử trong cùng transaction.
async function saveHealthProfile(accountId, payload, calculated) {
  return withTransaction(async (client) => {
    // Duy's code: Upsert các trường profile để lần lưu sau cập nhật hồ sơ hiện có.
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

    // Duy's code: Lấy khóa profile để thay danh sách dị ứng theo payload mới nhất.
    const { rows } = await client.query('SELECT profile_id FROM public.profile WHERE account_id = $1', [accountId]);
    const profileId = rows[0].profile_id;
    await client.query('DELETE FROM public.allergy WHERE profile_id = $1', [profileId]);
    for (const name of payload.allergies) {
      await client.query('INSERT INTO public.allergy (profile_id, name) VALUES ($1, $2)', [profileId, name]);
    }

    return { profile: await loadHealthProfile(client, accountId) };
  });
}

// Duy's code: Xóa profile và allergy cùng transaction, chỉ theo account_id đã xác thực.
async function deleteHealthProfile(accountId) {
  return withTransaction(async (client) => {
    await client.query(`
      DELETE FROM public.allergy a
      USING public.profile p
      WHERE a.profile_id = p.profile_id AND p.account_id = $1
    `, [accountId]);
    await client.query('DELETE FROM public.profile WHERE account_id = $1', [accountId]);
  });
}

module.exports = {
  getHealthProfile, saveHealthProfile, deleteHealthProfile,
};
