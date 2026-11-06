// Khoi's code (07/11/2026): test hạn lượt — 20s tới chữ đầu tiên, 45s tổng khi đã stream.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTurnDeadline } = require('./turnDeadline');

const TURN_ID = '11111111-1111-4111-8111-111111111111';

function fakeRes() {
  const res = {
    destroyed: false, writableEnded: false, headersSent: false, statusCode: null, body: null, chunks: [],
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; res.writableEnded = true; return res; },
    write(chunk) { res.chunks.push(String(chunk)); res.headersSent = true; return true; },
    end() { res.writableEnded = true; },
    once() { return res; },
  };
  return res;
}

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clock = { at: 0 };
  const middleware = createTurnDeadline({ now: () => clock.at });
  const req = { body: { turnId: TURN_ID }, admissionStarted: false };
  const res = fakeRes();
  let nextCalled = 0;
  middleware(req, res, () => { nextCalled += 1; });
  return { clock, req, res, nextCalled: () => nextCalled };
}

test('chưa có chữ trong 20s → 503 DEADLINE_EXCEEDED, chưa admitted', (t) => {
  const { clock, req, res, nextCalled } = setup(t);
  assert.equal(nextCalled(), 1);
  assert.equal(req.turnDeadlineAt, 20000);
  clock.at = 20000;
  t.mock.timers.tick(20000);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'DEADLINE_EXCEEDED');
  assert.equal(res.body.admitted, false);
  assert.equal(res.body.turnId, TURN_ID);
  assert.equal(req.turnSignal.aborted, true);
});

test('đã có chữ đầu tiên → nới hạn 45s, quá hạn giữa stream trả error partial', (t) => {
  const { clock, req, res } = setup(t);
  clock.at = 5000;
  req.extendTurnDeadline();
  assert.equal(req.turnDeadlineAt, 45000);
  // gọi lại không kéo dài thêm
  clock.at = 30000;
  req.extendTurnDeadline();
  assert.equal(req.turnDeadlineAt, 45000);

  clock.at = 40000;
  res.headersSent = true;
  t.mock.timers.tick(35000);
  assert.equal(res.writableEnded, false);
  assert.equal(res.chunks.length, 0);

  clock.at = 45000;
  t.mock.timers.tick(5000);
  assert.equal(res.writableEnded, true);
  const frame = res.chunks.join('');
  assert.ok(frame.startsWith('event: error\ndata: '), frame);
  const payload = JSON.parse(frame.split('data: ')[1]);
  assert.deepEqual(payload, { turnId: TURN_ID, code: 'DEADLINE_EXCEEDED', message: 'Hết thời gian chờ.', partial: true });
});
