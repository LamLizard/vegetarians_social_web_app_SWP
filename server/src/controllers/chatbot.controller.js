const { createHash } = require('node:crypto');
const chatbotModel = require('../models/chatbot.model');
const groq = require('../utils/groq');
const aiConfig = require('../models/aiConfig.model');
const { issueSession, verifySession, issueSimpleSession, verifySimpleSession } = require('../utils/chatSessionToken');
const chatDiscoveryModel = require('../models/chatDiscovery.model');

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

function validateSimpleTurn(body, account) {
  if (!validKeys(body, ['text', 'history', 'deviceId', 'sessionToken'])
    || (!account && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))
    || (body.deviceId !== undefined && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))
    || (body.sessionToken !== undefined && (typeof body.sessionToken !== 'string' || body.sessionToken.length > 1024))
    || !validText(body.text) || !Array.isArray(body.history) || body.history.length > MAX_HISTORY_ITEMS
    || !body.history.every((entry) => validKeys(entry, ['sender', 'content'])
      && ['user', 'bot'].includes(entry.sender) && validText(entry.content, true))) return null;
  return { deviceId: account ? undefined : body.deviceId, text: body.text.trim(),
    history: body.history.map(({ sender, content }) => ({ sender, content })), sessionToken: body.sessionToken };
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

// Receipt endpoints are separate from the existing v1 API. The receipt is
// returned only after the operation metadata transaction commits.
async function prepareTurn(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const body = req.body;
  if (!validKeys(body, ['operationId', 'deviceId', 'kind', 'payloadHash', 'flowToken', 'sessionToken'])
    || typeof body.operationId !== 'string' || !UUID.test(body.operationId)
    || body.kind !== 'turn' || typeof body.payloadHash !== 'string' || !/^[0-9a-f]{64}$/.test(body.payloadHash)
    || (body.flowToken !== undefined && (typeof body.flowToken !== 'string' || body.flowToken.length > 2048
      || typeof body.sessionToken !== 'string' || body.sessionToken.length > 1024 || !req.account))
    || (body.sessionToken !== undefined && (typeof body.sessionToken !== 'string' || body.sessionToken.length > 1024))
    || (!req.account && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))
    || (body.deviceId !== undefined && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))) {
    return fail(res, 'INVALID_INPUT');
  }
  try {
    if (!(await aiConfig.getConfig()).chatbot.enabled) return fail(res, 'CHATBOT_DISABLED');
    if (!isRequestCleanupReady()) return fail(res, 'STORE_UNAVAILABLE');
    const sessionValid = body.flowToken ? Boolean(verifySession(body.sessionToken, req.account, body.deviceId)) : true;
    const input = { account: req.account, deviceId: body.deviceId,
      operationId: body.operationId.toLowerCase(), payloadHash: body.payloadHash };
    const result = body.flowToken
      ? await chatbotModel.prepareChoice({ ...input, flowToken: body.flowToken, sessionToken: body.sessionToken, allowCreate: sessionValid })
      : await chatbotModel.prepareV2(input);
    return res.json(result);
  } catch (error) { return fail(res, error.code); }
}

async function discoveryStatus(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const body = req.body;
  if (!validKeys(body, ['operationId', 'deviceId', 'receipt'])
    || typeof body.operationId !== 'string' || !UUID.test(body.operationId)
    || typeof body.receipt !== 'string' || body.receipt.length > 2048
    || (!req.account && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))
    || (body.deviceId !== undefined && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))) {
    return fail(res, 'INVALID_INPUT');
  }
  try {
    return res.json(await chatbotModel.statusV2({ account: req.account, deviceId: body.deviceId,
      operationId: body.operationId.toLowerCase(), receipt: body.receipt }));
  } catch (error) { return fail(res, error.code); }
}

async function availability(req, res) {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json({ enabled: (await aiConfig.getConfig()).chatbot.enabled });
  } catch {
    return fail(res, 'CONFIG_UNAVAILABLE');
  }
}

async function getDiscoveryPost(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const postId = String(req.params.id ?? '');
  if (!/^[1-9]\d{0,17}$/.test(postId)) {
    return res.status(400).json({ code: 'INVALID_INPUT', message: 'Mã bài viết không hợp lệ.' });
  }
  try {
    const post = await chatDiscoveryModel.findPostForModal(postId, req.account);
    if (!post) return res.status(404).json({ code: 'POST_UNAVAILABLE', message: 'Bài viết không còn khả dụng.' });
    return res.json({ post });
  } catch {
    return res.status(503).json({ code: 'STORE_UNAVAILABLE', message: 'Chưa thể tải bài viết, vui lòng thử lại.' });
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

async function verifySimpleChatSession(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  if (!req.account && !UUID.test(String(req.body?.deviceId ?? ''))) return fail(res, 'INVALID_INPUT');
  try {
    const result = verifySimpleSession(req.body?.token, req.account, req.body?.deviceId);
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

async function getSimpleQuota(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  try {
    return res.json({ quota: await chatbotModel.getSimpleQuota(req.account.id) });
  } catch {
    return fail(res, 'STORE_UNAVAILABLE');
  }
}

async function simpleTurnStream(req, res) {
  res.set('Cache-Control', 'private, no-store, no-transform');
  res.vary('Authorization');
  const input = validateSimpleTurn(req.body, req.account);
  if (!input) return fail(res, 'INVALID_INPUT');
  let session;
  try {
    if (!(await aiConfig.getConfig()).chatbot.enabled) return fail(res, 'CHATBOT_DISABLED');
    if (input.history.length && !verifySimpleSession(input.sessionToken, req.account, input.deviceId)) {
      return fail(res, 'SESSION_EXPIRED');
    }
    // Ensure a signed session can be issued before charging the member.
    session = issueSimpleSession(req.account, input.deviceId);
  } catch { return fail(res, 'CONFIG_UNAVAILABLE'); }

  let quota;
  try {
    if (req.account) quota = await chatbotModel.admitSimpleTurn(req.account.id);
  } catch (error) { return fail(res, error.code); }

  const controller = new AbortController();
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnect);
  if (res.destroyed) controller.abort();
  const emit = (event, data) => {
    if (!controller.signal.aborted && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    res.status(200).set('Content-Type', 'text/event-stream; charset=utf-8');
    res.flushHeaders();
    emit('accepted', { session, ...(quota ? { quota } : {}) });
    const intent = await groq.classifySimpleTurn(input.text, input.history);
    if (controller.signal.aborted) throw Object.assign(new Error('DISCONNECTED'), { code: 'MODEL_UNAVAILABLE' });
    let limited = false;
    if (intent.intent === 'post') {
      if (!req.account) {
        emit('delta', { text: 'Bạn hãy đăng nhập để tìm bài viết trong cuộc trò chuyện nhé.' });
      } else if (!intent.subject) {
        emit('delta', { text: 'Bạn muốn tìm bài viết về chủ đề gì?' });
      } else {
        const result = await chatDiscoveryModel.findBestMatch(req.account, 'post', intent.subject);
        emit('delta', { text: result ? 'Mình đã tìm được bài viết phù hợp cho bạn.' : 'Mình chưa tìm thấy bài viết phù hợp.' });
        if (result) emit('result', result);
      }
    } else {
      const result = await groq.streamReply(input.text, input.history, {
        signal: controller.signal, onDelta: (text) => emit('delta', { text }),
      });
      limited = result.limited;
    }
    if (controller.signal.aborted) throw Object.assign(new Error('DISCONNECTED'), { code: 'MODEL_UNAVAILABLE' });
    session = issueSimpleSession(req.account, input.deviceId);
    emit('done', { session, limited, ...(quota ? { quota } : {}) });
    if (!res.destroyed) res.end();
  } catch (error) {
    const code = MESSAGES[error.code] ? error.code : 'STORE_UNAVAILABLE';
    emit('error', { code, message: MESSAGES[code][1] });
    if (!res.destroyed) res.end();
  } finally {
    res.off('close', disconnect);
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

function clarificationText(subject) {
  const detailed = `Bạn muốn tìm bài viết hay công thức về “${subject}”?`;
  return Array.from(detailed).length <= 10000 ? detailed : 'Bạn muốn tìm bài viết hay công thức?';
}

// V2 binds a deterministic payload digest to the receipt. A result card is
// emitted only after its outcome and quota have committed.
async function discoveryStream(req, res) {
  res.set('Cache-Control', 'private, no-store, no-transform');
  res.vary('Authorization');
  const body = req.body;
  const keys = ['operationId', 'receipt', 'text', 'history', 'deviceId', 'sessionToken', 'flowToken', 'flowSubject'];
  if (!validKeys(body, keys) || typeof body.receipt !== 'string' || body.receipt.length > 2048
    || (body.flowToken !== undefined && (typeof body.flowToken !== 'string' || body.flowToken.length > 2048
      || !req.account || !validText(body.flowSubject)))
    || (body.flowToken === undefined && body.flowSubject !== undefined)) return fail(res, 'INVALID_INPUT');
  const input = validateStreamMessage({ operationId: body.operationId, text: body.text, history: body.history,
    ...(body.deviceId !== undefined ? { deviceId: body.deviceId } : {}),
    ...(body.sessionToken !== undefined ? { sessionToken: body.sessionToken } : {}) }, req.account);
  if (!input) return fail(res, 'INVALID_INPUT');
  input.operationId = input.operationId.toLowerCase();
  const canonical = { text: input.text, history: input.history, sessionToken: input.sessionToken ?? null,
    flowToken: body.flowToken ?? null, flowSubject: body.flowSubject ?? null };
  const payloadHash = createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
  try {
    if (!(await aiConfig.getConfig()).chatbot.enabled) return fail(res, 'CHATBOT_DISABLED');
    if (!isRequestCleanupReady()) return fail(res, 'STORE_UNAVAILABLE');
    if ((input.history.length || body.flowToken) && !verifySession(input.sessionToken, req.account, input.deviceId)) {
      return fail(res, 'SESSION_EXPIRED');
    }
  } catch { return fail(res, 'STORE_UNAVAILABLE'); }
  let reservation;
  try {
    const args = { account: req.account, deviceId: input.deviceId, operationId: input.operationId,
      receipt: body.receipt, payloadHash };
    reservation = body.flowToken
      ? await chatbotModel.claimChoice({ ...args, flowToken: body.flowToken, sessionToken: input.sessionToken })
      : await chatbotModel.claimV2(args);
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
    const intent = body.flowToken && input.text === 'Hủy tìm kiếm và mở công cụ lập thực đơn'
      ? { intent: 'cancel', subject: null, offerPlanner: true }
      : await groq.classifyDiscovery(input.text, input.history, Boolean(body.flowToken));
    if (controller.signal.aborted) throw new Error('DISCONNECTED');
    const search = ['post', 'recipe'].includes(intent.intent);
    const searching = search || intent.intent === 'clarify';
    let outcome;
    let result = null;
    let flowToken;
    let flowSubject;
    let reply = '';
    let limited = false;
    let session;
    const pendingPlanner = reservation.offerPlanner === true;
    if (!req.account && searching) {
      outcome = 'login_required';
      reply = 'Bạn hãy đăng nhập để tìm bài viết hoặc công thức trong cuộc trò chuyện nhé.';
    } else if (body.flowToken) {
      if (!chatbotModel.matchesFlowSubject(reservation, body.flowSubject)) {
        throw Object.assign(new Error('INVALID_INPUT'), { code: 'INVALID_INPUT' });
      }
      if (search) {
        result = await chatDiscoveryModel.findBestMatch(req.account, intent.intent, body.flowSubject);
        outcome = result ? 'found' : 'empty';
        reply = result ? 'Mình đã tìm được nội dung phù hợp cho bạn.' : 'Mình chưa tìm thấy nội dung phù hợp.';
      } else if (intent.intent === 'cancel') {
        outcome = 'cancelled';
        if (intent.offerPlanner) reply = 'Mình đã dừng tìm kiếm. Bạn có thể mở công cụ lập thực đơn.';
        else {
          const streamed = await groq.streamReply(input.text, input.history, {
            signal: controller.signal, onDelta: (text) => emit('delta', { text }),
          });
          limited = streamed.limited;
        }
      } else {
        outcome = 'clarify';
        flowToken = body.flowToken;
        flowSubject = body.flowSubject;
        reply = clarificationText(body.flowSubject);
      }
    } else if (intent.intent === 'clarify') {
      outcome = 'clarify';
      flowSubject = intent.subject;
      reply = clarificationText(intent.subject);
    } else if (search) {
      result = await chatDiscoveryModel.findBestMatch(req.account, intent.intent, intent.subject);
      outcome = result ? 'found' : 'empty';
      reply = result ? 'Mình đã tìm được nội dung phù hợp cho bạn.' : 'Mình chưa tìm thấy nội dung phù hợp.';
    } else if (intent.intent === 'planner') {
      outcome = 'success';
      reply = 'Bạn có thể chọn “Lên thực đơn tuần” để xem gợi ý phù hợp với hồ sơ của mình.';
    } else {
      outcome = 'success';
      const streamed = await groq.streamReply(input.text, input.history, {
        signal: controller.signal, onDelta: (text) => emit('delta', { text }),
      });
      limited = streamed.limited;
    }
    if (controller.signal.aborted) throw new Error('DISCONNECTED');
    // Start the choice window after emitting the initial question, rather than
    // at classification start. A lost done event remains recoverable by status.
    const questionEmitted = outcome === 'clarify' && !body.flowToken;
    if (questionEmitted) {
      emit('delta', { text: reply });
      if (controller.signal.aborted) throw new Error('DISCONNECTED');
    }
    if (outcome === 'clarify' && body.flowToken) {
      const verified = verifySession(input.sessionToken, req.account, input.deviceId);
      if (!verified) throw Object.assign(new Error('SESSION_EXPIRED'), { code: 'SESSION_EXPIRED' });
      session = { token: input.sessionToken, ...verified };
    } else session = issueSession(req.account, input.deviceId);
    finishing = true;
    if (outcome === 'clarify' && body.flowToken) await chatbotModel.reaskChoice(reservation);
    else if (outcome === 'clarify') flowToken = await chatbotModel.beginClarification(reservation, session.token, flowSubject, intent.offerPlanner);
    else if (body.flowToken) await chatbotModel.finishChoice(reservation, outcome);
    else await chatbotModel.finishV2(reservation, outcome);
    reservation = null;
    if (reply && !questionEmitted) emit('delta', { text: reply });
    if (result) emit('result', result);
    const quota = req.account ? await chatbotModel.getQuota(req.account.id) : undefined;
    emit('done', { session, limited, outcome: outcome === 'success' ? 'chat' : outcome,
      ...(flowToken ? { flowToken, flowSubject } : {}),
      ...((outcome !== 'clarify' && (intent.offerPlanner || (pendingPlanner && ['found', 'empty'].includes(outcome))))
        ? { offerPlanner: true } : {}),
      ...(quota ? { quota } : {}) });
    if (!res.destroyed) res.end();
  } catch (error) {
    let code = error.code;
    if (reservation && !finishing) {
      try {
        if (reservation.flowId) await chatbotModel.finishChoice(reservation, 'failed');
        else await chatbotModel.finishV2(reservation, 'failed');
      } catch { code = 'STORE_UNAVAILABLE'; }
    } else if (finishing) code = 'STORE_UNAVAILABLE';
    const [, message] = MESSAGES[code] ?? MESSAGES.STORE_UNAVAILABLE;
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

module.exports = { availability, getDiscoveryPost, verifyChatSession, verifySimpleChatSession, getQuota, getSimpleQuota, getRequestState, prepareTurn, discoveryStatus, discoveryStream, sendMessage, streamMessage, simpleTurnStream,
  startRequestCleanup, isRequestCleanupReady };
