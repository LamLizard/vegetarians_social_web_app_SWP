const planner = require('../models/aiMealPlanner.model');
const quota = require('../models/chatbot.model');
const aiConfig = require('../models/aiConfig.model');
const { isRequestCleanupReady } = require('./chatbot.controller');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ERRORS = {
  INVALID_INPUT: [400, 'Dữ liệu thực đơn không hợp lệ.'],
  PROFILE_MISSING: [409, 'Bạn chưa có hồ sơ sức khỏe.'],
  NO_RECIPES: [422, 'Không có công thức phù hợp để đề xuất.'],
  QUOTA_EXCEEDED: [429, 'Bạn đã hết lượt trong ngày.'],
  IDEMPOTENCY_CONFLICT: [409, 'Mã yêu cầu đã được dùng cho nội dung khác.'],
  IN_PROGRESS: [409, 'Yêu cầu đang được xử lý.'],
  RESULT_UNAVAILABLE: [409, 'Không thể khôi phục kết quả yêu cầu trước.'],
  CHATBOT_DISABLED: [503, 'Trợ lý hiện không khả dụng.'],
  STORE_UNAVAILABLE: [503, 'Không thể tạo thực đơn lúc này.'],
};

function fail(res, code) {
  const [status, message] = ERRORS[code] ?? ERRORS.STORE_UNAVAILABLE;
  return res.status(status).json({ code: ERRORS[code] ? code : 'STORE_UNAVAILABLE', message });
}

function validWeek(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

async function preview(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const { operationId, weekStart, continueWithoutProfile = false } = req.body ?? {};
  if (!UUID.test(String(operationId ?? '')) || !validWeek(weekStart)
    || typeof continueWithoutProfile !== 'boolean') return fail(res, 'INVALID_INPUT');
  let reservation;
  try {
    if (!(await aiConfig.getConfig()).chatbot.enabled) return fail(res, 'CHATBOT_DISABLED');
    if (!isRequestCleanupReady()) return fail(res, 'STORE_UNAVAILABLE');
    reservation = await quota.reserveRequest({ account: req.account, operationId,
      payload: { kind: 'meal_preview', weekStart, continueWithoutProfile } });
    // Reservation does not consume a successful turn if profile/data is unavailable.
    const result = await planner.preview(req.account.id, weekStart, continueWithoutProfile);
    await quota.finishRequest(reservation, true);
    reservation = null;
    return res.json({ preview: result, quota: await quota.getQuota(req.account.id) });
  } catch (error) {
    if (reservation) {
      try { await quota.finishRequest(reservation, false); } catch { return fail(res, 'STORE_UNAVAILABLE'); }
    }
    return fail(res, error.code);
  }
}

async function confirm(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  // Save remains blocked until all plan/profile writers share a verified concurrency contract.
  return res.status(503).json({ code: 'CONFIRM_UNAVAILABLE', message: 'Chưa thể lưu thực đơn lúc này.' });
}

module.exports = { preview, confirm };
