// Khoi's code (06/11/2026): sau proxy, req.ip phải lấy từ X-Forwarded-For (hạn mức theo IP của khách).
const test = require('node:test');
const assert = require('node:assert/strict');

const APP_PATH = require.resolve('../app');

// Mỗi ca cần nạp lại app vì trust proxy đọc env lúc require.
function loadApp(value, render) {
  if (value === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = value;
  if (render === undefined) delete process.env.RENDER;
  else process.env.RENDER = render;
  delete require.cache[APP_PATH];
  return require('../app');
}

async function ipBehind(app, headers = {}) {
  app.get('/__probe-ip', (req, res) => res.json({ ip: req.ip }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/__probe-ip`, { headers });
    return (await response.json()).ip;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('không có TRUST_PROXY: giữ mặc định, bỏ qua X-Forwarded-For', async () => {
  const app = loadApp(undefined);
  assert.equal(app.get('trust proxy'), false);
  const ip = await ipBehind(app, { 'X-Forwarded-For': '203.0.113.7' });
  assert.equal(ip, '127.0.0.1');
});

test('TRUST_PROXY=1: req.ip = IP cuối trong X-Forwarded-For', async () => {
  const app = loadApp('1');
  assert.equal(app.get('trust proxy'), 1);
  const ip = await ipBehind(app, { 'X-Forwarded-For': '198.51.100.4, 203.0.113.9' });
  assert.equal(ip, '203.0.113.9');
});

test('TRUST_PROXY: giá trị không hợp lệ thì giữ như cũ', async () => {
  for (const value of ['', '0', 'abc', '-1', '1.5']) {
    const app = loadApp(value);
    assert.equal(app.get('trust proxy'), false, `TRUST_PROXY=${JSON.stringify(value)}`);
    const ip = await ipBehind(app, { 'X-Forwarded-For': '203.0.113.7' });
    assert.equal(ip, '127.0.0.1', `TRUST_PROXY=${JSON.stringify(value)}`);
  }
  delete process.env.TRUST_PROXY;
});

// Khoi's code (09/11/2026): dạng header thật trên Render: "khách, Cloudflare, cân bằng tải nội bộ".
const RENDER_CHAIN = '81.97.145.24, 172.71.195.123, 10.226.90.65';

test('Render (RENDER=true, chưa đặt TRUST_PROXY): tự tin 3 lớp → lấy đúng IP khách', async () => {
  const app = loadApp(undefined, 'true');
  assert.equal(app.get('trust proxy'), 3);
  assert.equal(await ipBehind(app, { 'X-Forwarded-For': RENDER_CHAIN }), '81.97.145.24');
  delete process.env.RENDER;
});

test('Render còn để TRUST_PROXY=1 vẫn dùng 3 lớp (để 1 thì mọi khách ra cùng IP 10.x)', async () => {
  const app = loadApp('1', 'true');
  assert.equal(app.get('trust proxy'), 3);
  assert.equal(await ipBehind(app, { 'X-Forwarded-For': RENDER_CHAIN }), '81.97.145.24');
  delete process.env.RENDER;
  delete process.env.TRUST_PROXY;
});

test('Render: khách tự chèn IP giả vào X-Forwarded-For không đổi được req.ip', async () => {
  const app = loadApp(undefined, 'true');
  const ip = await ipBehind(app, { 'X-Forwarded-For': `1.2.3.4, ${RENDER_CHAIN}` });
  assert.equal(ip, '81.97.145.24');
  delete process.env.RENDER;
});
