const chatbotModel = require('../models/chatbot.model');
const groq = require('../utils/groq');
const aiConfig = require('../models/aiConfig.model');
const { issueSession, verifySession } = require('../utils/chatSessionToken');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 1000;
const MAX_HISTORY_ITEMS = 20;
const CLEANUP_INTERVAL_MS = 60000;
let cleanupTimer = null;
let cleanupRunning = false;
let cleanupHealthy = false;
const MESSAGES = {
  INVALID_INPUT: [400, 'Dữ liệu câu hỏi không hợp lệ.'],
  QUOTA_EXCEEDED: [429, 'Bạn đã hết lượt trong ngày.'],
  IDEMPOTENCY_CONFLICT: [409, 'Mã yêu cầu đã được dùng cho nội dung khác.'],
  IN_PROGRESS: [409, 'Yêu cầu đang được xử lý.'],
  RESULT_UNAVAILABLE: [409, 'Không thể khôi phục kết quả của yêu cầu trước.'],
  CHATBOT_DISABLED: [503, 'Trợ lý hiện không khả dụng.'],
  SESSION_EXPIRED: [409, 'Phiên trò chuyện đã hết hạn. Vui lòng bắt đầu lại.'],
  SESSION_UNAVAILABLE: [503, 'Không thể kiểm tra phiên trò chuyện.'],
  CONFIG_UNAVAILABLE: [503, 'Không thể đọc cấu hình AI.'],
  MODEL_UNAVAILABLE: [503, 'Trợ lý tạm thời không khả dụng.'],
  STORE_UNAVAILABLE: [503, 'Chưa thể kiểm tra lượt sử dụng, vui lòng thử lại sau.'],
};

function fail(res, code) {
  const [status, message] = MESSAGES[code] ?? MESSAGES.STORE_UNAVAILABLE;
  return res.status(status).json({ code: MESSAGES[code] ? code : 'STORE_UNAVAILABLE', message });
}

function validateMessage(body, account) {
  if (!body || typeof body !== 'object' || !UUID.test(String(body.operationId ?? ''))) return null;
  if (!account && !UUID.test(String(body.deviceId ?? ''))) return null;
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > MAX_TEXT_LENGTH) return null;
  if (!Array.isArray(body.history) || body.history.length > MAX_HISTORY_ITEMS) return null;
  if (!body.history.every((entry) => entry && ['user', 'bot'].includes(entry.sender)
    && typeof entry.content === 'string' && entry.content.length <= MAX_TEXT_LENGTH)) return null;
  return {
    operationId: body.operationId,
    deviceId: account ? undefined : body.deviceId,
    text: body.text.trim(),
    history: body.history.map(({ sender, content }) => ({ sender, content })),
    sessionToken: body.sessionToken,
  };
}

function validText(value, allowEmpty = false) {
  return typeof value === 'string' && (allowEmpty || Boolean(value.trim()))
    && Array.from(value).length <= 10000
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
}

function validKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => keys.includes(key));
}

function validateStreamMessage(body, account) {
  if (!validKeys(body, ['operationId', 'text', 'history', 'deviceId', 'sessionToken'])
    || typeof body.operationId !== 'string' || !UUID.test(body.operationId)
    || (!account && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))
    || (body.deviceId !== undefined && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))
    || (body.sessionToken !== undefined && (typeof body.sessionToken !== 'string' || body.sessionToken.length > 1024))
    || !validText(body.text) || !Array.isArray(body.history) || body.history.length > MAX_HISTORY_ITEMS
    || !body.history.every((entry) => validKeys(entry, ['sender', 'content'])
      && ['user', 'bot'].includes(entry.sender) && validText(entry.content, true))) return null;
  return { operationId: body.operationId, deviceId: account ? undefined : body.deviceId,
    text: body.text.trim(), history: body.history.map(({ sender, content }) => ({ sender, content })),
    sessionToken: body.sessionToken };
}

async function getRequestState(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const body = req.body;
  if (!validKeys(body, ['operationId', 'deviceId']) || typeof body.operationId !== 'string'
    || !UUID.test(body.operationId) || (!req.account && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))
    || (body.deviceId !== undefined && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))) {
    return fail(res, 'INVALID_INPUT');
  }
  try {
    const state = await chatbotModel.getRequestState({ account: req.account, deviceId: body.deviceId,
      operationId: body.operationId });
    return res.json({ state });
  } catch { return fail(res, 'STORE_UNAVAILABLE'); }
}

async function availability(req, res) {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json({ enabled: (await aiConfig.getConfig()).chatbot.enabled });
  } catch {
    return fail(res, 'CONFIG_UNAVAILABLE');
  }
}

async function verifyChatSession(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  if (!req.account && !UUID.test(String(req.body?.deviceId ?? ''))) return fail(res, 'INVALID_INPUT');
  try {
    const result = verifySession(req.body?.token, req.account, req.body?.deviceId);
    return res.json(result ? { valid: true, ...result } : { valid: false });
  } catch {
    return fail(res, 'SESSION_UNAVAILABLE');
  }
}

async function getQuota(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  try {
    return res.json({ quota: await chatbotModel.getQuota(req.account.id) });
  } catch {
    return fail(res, 'STORE_UNAVAILABLE');
  }
}

function isRequestCleanupReady() {
  return process.env.CHATBOT_CLEANUP_ENABLED === 'true' && Boolean(cleanupTimer) && cleanupHealthy;
}

async function sendMessage(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const input = validateMessage(req.body, req.account);
  if (!input) return fail(res, 'INVALID_INPUT');
  let config;
  try { config = await aiConfig.getConfig(); } catch { return fail(res, 'CONFIG_UNAVAILABLE'); }
  if (!config.chatbot.enabled) return fail(res, 'CHATBOT_DISABLED');
  try {
    if (input.history.length && !verifySession(input.sessionToken, req.account, input.deviceId)) {
      return fail(res, 'SESSION_EXPIRED');
    }
  } catch { return fail(res, 'SESSION_UNAVAILABLE'); }
  if (!isRequestCleanupReady()) {
    return fail(res, 'STORE_UNAVAILABLE');
  }
  let reservation;
  try {
    reservation = await chatbotModel.reserveRequest({
      account: req.account,
      deviceId: input.deviceId,
      operationId: input.operationId,
      payload: { text: input.text, history: input.history },
    });
    const reply = await groq.generateReply(input.text, input.history);
    const session = issueSession(req.account, input.deviceId);
    await chatbotModel.finishRequest(reservation, true);
    reservation = null;
    const quota = req.account ? await chatbotModel.getQuota(req.account.id) : undefined;
    return res.json({ reply, session, ...(quota ? { quota } : {}) });
  } catch (error) {
    if (reservation) {
      try {
        await chatbotModel.finishRequest(reservation, false);
      } catch {
        return fail(res, 'STORE_UNAVAILABLE');
      }
    }
    return fail(res, error.code);
  }
}

async function streamMessage(req, res) {
  res.set('Cache-Control', 'private, no-store, no-transform');
  res.vary('Authorization');
  const input = validateStreamMessage(req.body, req.account);
  if (!input) return fail(res, 'INVALID_INPUT');
  let config;
  try { config = await aiConfig.getConfig(); } catch { return fail(res, 'CONFIG_UNAVAILABLE'); }
  if (!config.chatbot.enabled) return fail(res, 'CHATBOT_DISABLED');
  try {
    if (input.history.length && !verifySession(input.sessionToken, req.account, input.deviceId)) {
      return fail(res, 'SESSION_EXPIRED');
    }
  } catch { return fail(res, 'SESSION_UNAVAILABLE'); }
  if (!isRequestCleanupReady()) return fail(res, 'STORE_UNAVAILABLE');

  let reservation;
  try {
    reservation = await chatbotModel.reserveRequest({ account: req.account, deviceId: input.deviceId,
      operationId: input.operationId, payload: { text: input.text, history: input.history } });
  } catch (error) { return fail(res, error.code); }

  const controller = new AbortController();
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnect);
  if (res.destroyed) controller.abort();
  let finishing = false;
  const emit = (event, data) => {
    if (!controller.signal.aborted && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    res.status(200).set('Content-Type', 'text/event-stream; charset=utf-8');
    res.flushHeaders();
    const result = await groq.streamReply(input.text, input.history, {
      signal: controller.signal, onDelta: (text) => emit('delta', { text }),
    });
    if (controller.signal.aborted) throw Object.assign(new Error('DISCONNECTED'), { code: 'MODEL_UNAVAILABLE' });
    const session = issueSession(req.account, input.deviceId);
    finishing = true;
    await chatbotModel.finishRequest(reservation, true);
    reservation = null;
    const quota = req.account ? await chatbotModel.getQuota(req.account.id) : undefined;
    emit('done', { session, ...(quota ? { quota } : {}), limited: result.limited });
    if (!res.destroyed) res.end();
  } catch (error) {
    let code = error.code;
    if (reservation && !finishing) {
      try { await chatbotModel.finishRequest(reservation, false); } catch { code = 'STORE_UNAVAILABLE'; }
    } else if (finishing) code = 'STORE_UNAVAILABLE';
    const [status, message] = MESSAGES[code] ?? MESSAGES.STORE_UNAVAILABLE;
    void status;
    emit('error', { code: MESSAGES[code] ? code : 'STORE_UNAVAILABLE', message });
    if (!res.destroyed) res.end();
  } finally {
    res.off('close', disconnect);
  }
}

async function runRequestCleanup() {
  if (cleanupRunning) return;
  cleanupRunning = true;
  try {
    await chatbotModel.deleteExpiredRequests();
    cleanupHealthy = true;
  } catch {
    cleanupHealthy = false;
    console.error('[chatbot] Metadata cleanup failed.');
  } finally {
    cleanupRunning = false;
  }
}

function startRequestCleanup() {
  // The draft table must be provisioned before enabling this explicitly.
  if (cleanupTimer || process.env.CHATBOT_CLEANUP_ENABLED !== 'true') return;
  cleanupTimer = setInterval(runRequestCleanup, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
  void runRequestCleanup();
}

module.exports = { availability, verifyChatSession, getQuota, getRequestState, sendMessage, streamMessage,
  startRequestCleanup, isRequestCleanupReady };
