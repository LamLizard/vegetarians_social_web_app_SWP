// Khoi's code (05/11/2026): kiểm tra luồng hoàn lượt của turnV3 bằng mock — không gọi DeepSeek, không ghi DB.
process.env.CHATBOT_REQUEST_HMAC_KEY = process.env.CHATBOT_REQUEST_HMAC_KEY || 'test-hmac-key';

const test = require('node:test');
const assert = require('node:assert/strict');

const chatbotModel = require('../models/chatbot.model');
const aiConfig = require('../models/aiConfig.model');
const deepseek = require('../utils/deepseek');
const controller = require('./chatbot.controller');

const TURN_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_ID = '22222222-2222-4222-8222-222222222222';
const GUEST_IP = '203.0.113.9';

function vietnamDay(at) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type) => parts.find((entry) => entry.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const day = vietnamDay(Date.now());

function classifierJson(overrides = {}) {
  return JSON.stringify({
    intent: 'chat', subject: null, hasOtherAllowedQuestion: false, needsPersonalization: false,
    needsWebsiteGuide: false, postMode: 'none', postOrder: 'none', nearTerms: [],
    scope: 'allowed', allowedParts: [], ...overrides,
  });
}

function fakeReq({ account = null, body = {}, ip = GUEST_IP } = {}) {
  const abort = new AbortController();
  return {
    account, ip, body, turnSignal: abort.signal, turnDeadlineAt: Date.now() + 20000,
  };
}

function guestBody(overrides = {}) {
  return { protocol: 3, turnId: TURN_ID, text: 'Gợi ý món chay', history: [],
    deviceId: DEVICE_ID, expectedDay: day, ...overrides };
}

function memberBody(overrides = {}) {
  return { protocol: 3, turnId: TURN_ID, text: 'Gợi ý món chay', history: [], ...overrides };
}

function fakeRes() {
  const listeners = new Map();
  const res = {
    destroyed: false, writableEnded: false, headersSent: false, statusCode: null, body: null, frames: [],
    set() { return res; },
    vary() { return res; },
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; res.headersSent = true; res.writableEnded = true; return res; },
    flushHeaders() { res.headersSent = true; },
    write(chunk) { res.frames.push(String(chunk)); return true; },
    end() { res.writableEnded = true; },
    once(event, handler) { listeners.set(event, [...(listeners.get(event) ?? []), handler]); return res; },
    on(event, handler) { return res.once(event, handler); },
    off() { return res; },
  };
  return res;
}

function events(res) {
  return res.frames.map((frame) => {
    const name = frame.match(/^event: (.+)$/m)?.[1];
    const data = frame.match(/^data: (.+)$/m)?.[1];
    return { name, data: data ? JSON.parse(data) : null };
  });
}

let releases = [];
let admits = [];
let quotaReads = [];

function stubModel({ plan } = {}) {
  releases = [];
  admits = [];
  quotaReads = [];
  chatbotModel.admitTurn = async (subject, options) => {
    admits.push({ subject, hasDeadline: Number.isFinite(options?.deadlineAt) });
    if (plan) return plan(subject);
    return { used: 1, limit: subject.limit, remaining: subject.limit - 1,
      resetAt: new Date(`${day}T17:00:00.000Z`), day, admittedAt: new Date().toISOString() };
  };
  chatbotModel.releaseTurn = async (subject) => { releases.push(subject); };
  chatbotModel.turnQuota = async (subject) => {
    quotaReads.push(subject);
    return { used: 0, limit: subject.limit, remaining: subject.limit,
      resetAt: new Date(`${day}T17:00:00.000Z`), day };
  };
  aiConfig.getConfig = async () => ({ chatbot: { enabled: true } });
}

test('turnV3 khách: lỗi provider chưa gửi chữ → hoàn cả lượt thiết bị và IP', async () => {
  stubModel();
  deepseek.classify = async () => { throw Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE' }); };
  const res = fakeRes();
  await controller.turnV3(fakeReq({ body: guestBody() }), res);

  assert.equal(admits.length, 2);
  assert.equal(admits[0].subject.subjectType, 'device');
  assert.equal(admits[0].subject.subjectKey, DEVICE_ID);
  assert.equal(admits[0].subject.limit, 5);
  assert.match(admits[1].subject.subjectKey, /^ip:[0-9a-f]{32}$/);
  assert.equal(admits[1].subject.limit, 20);
  assert.equal(releases.length, 2);
  assert.deepEqual(releases.map((item) => item.subjectKey), [DEVICE_ID, admits[1].subject.subjectKey]);

  const frames = events(res);
  assert.equal(frames[0].name, 'accepted');
  assert.equal(frames[0].data.quota.limit, 5);
  const failed = frames.find((frame) => frame.name === 'error');
  assert.ok(failed);
  assert.equal(failed.data.code, 'MODEL_UNAVAILABLE');
  assert.equal(failed.data.refunded, true);
  assert.equal(failed.data.quota.remaining, 5);
  assert.equal(quotaReads[0].subjectKey, DEVICE_ID);
  assert.equal(frames.some((frame) => frame.name === 'done'), false);
});

test('turnV3 khách: câu ngoài phạm vi bị từ chối vẫn tính lượt', async () => {
  stubModel();
  deepseek.classify = async () => classifierJson({ scope: 'outside' });
  const res = fakeRes();
  await controller.turnV3(fakeReq({ body: guestBody() }), res);

  assert.equal(releases.length, 0);
  const frames = events(res);
  const done = frames.find((frame) => frame.name === 'done');
  assert.ok(done);
  assert.equal(done.data.refunded, undefined);
  assert.equal(done.data.quota.used, 1);
  assert.equal(frames.find((frame) => frame.name === 'error'), undefined);
});

test('turnV3 khách: IP hết lượt → trả lại lượt thiết bị vừa trừ và trả 429', async () => {
  stubModel({ plan: (subject) => {
    if (subject.subjectKey.startsWith('ip:')) throw Object.assign(new Error('QUOTA_EXCEEDED'), { code: 'QUOTA_EXCEEDED' });
    return { used: 1, limit: subject.limit, remaining: subject.limit - 1,
      resetAt: new Date(`${day}T17:00:00.000Z`), day, admittedAt: new Date().toISOString() };
  } });
  const res = fakeRes();
  await controller.turnV3(fakeReq({ body: guestBody() }), res);

  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, 'QUOTA_EXCEEDED');
  assert.equal(releases.length, 1);
  assert.equal(releases[0].subjectKey, DEVICE_ID);
  assert.equal(res.frames.length, 0);
});

test('turnV3 member: giữ hạn mức 50 và hoàn đúng subject tài khoản khi lỗi', async () => {
  stubModel();
  deepseek.classify = async () => { throw Object.assign(new Error('DEADLINE_EXCEEDED'), { code: 'DEADLINE_EXCEEDED' }); };
  const res = fakeRes();
  await controller.turnV3(fakeReq({ account: { id: 7 }, body: memberBody() }), res);

  assert.equal(admits.length, 1);
  assert.deepEqual(admits[0].subject, { subjectType: 'account', subjectKey: '7', limit: 50 });
  assert.deepEqual(releases, [{ subjectType: 'account', subjectKey: '7', day }]);
  const failed = events(res).find((frame) => frame.name === 'error');
  assert.equal(failed.data.refunded, true);
  assert.equal(failed.data.quota.limit, 50);
});
