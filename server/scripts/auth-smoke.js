// Smoke test tầng auth — chạy: node scripts/auth-smoke.js
// Cần: BE đang chạy (npm start ở server/) + Node 18+ (có fetch sẵn).
// Đổi URL khi cần: set SMOKE_BASE_URL=http://localhost:5000/api/auth
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5000/api/auth';

const email = `smoke+${Date.now()}@test.com`;
const password = '12345678';
const newPassword = '87654321';

let token = null;
let failed = 0;

const pass = (step, note = '') => console.log(`PASS  ${step}${note ? ` — ${note}` : ''}`);
const fail = (step, note = '') => { failed += 1; console.error(`FAIL  ${step}${note ? ` — ${note}` : ''}`); };
const check = (step, ok, note = '') => (ok ? pass(step, note) : fail(step, note));

/** Gọi API, trả { status, data } — không throw để mỗi bước tự quyết định PASS/FAIL */
async function call(method, path, body, withToken = false) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(withToken ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

/** Không bao giờ được trả hash mật khẩu ra API */
const leaksHash = (user) => !user || user.passwordHash !== undefined || user.password_hash !== undefined;

async function main() {
  console.log(`==> Smoke test ${BASE_URL}\n    email: ${email}\n`);

  // 1 · Đăng ký → 201 + token luôn
  const registered = await call('POST', '/register', { fullName: 'Smoke Test', email, password });
  check('1. register → 201', registered.status === 201, `status=${registered.status} ${JSON.stringify(registered.data)}`);
  check('1b. register trả token + không lộ password_hash', Boolean(registered.data?.token) && !leaksHash(registered.data?.user));
  token = registered.data?.token ?? null;

  // 2 · Đăng nhập bằng mật khẩu vừa đăng ký
  const loggedIn = await call('POST', '/login', { email, password });
  check('2. login → 200', loggedIn.status === 200, `status=${loggedIn.status} ${JSON.stringify(loggedIn.data)}`);
  token = loggedIn.data?.token ?? token;

  // 3 · Lấy thông tin tài khoản từ token
  const me = await call('GET', '/me', null, true);
  check('3. me → 200 đúng email', me.status === 200 && me.data?.user?.email === email, `status=${me.status} user=${JSON.stringify(me.data?.user)}`);
  check('3b. me không lộ password_hash', !leaksHash(me.data?.user));

  // 4 · Đổi mật khẩu
  const changed = await call('POST', '/change-password', { currentPassword: password, newPassword }, true);
  check('4. change-password → 200', changed.status === 200, `status=${changed.status} ${JSON.stringify(changed.data)}`);

  // 5 · Đăng nhập lại bằng mật khẩu mới
  const reLogin = await call('POST', '/login', { email, password: newPassword });
  check('5. login lại bằng mật khẩu mới → 200', reLogin.status === 200, `status=${reLogin.status} ${JSON.stringify(reLogin.data)}`);

  // 6 · Mật khẩu cũ phải hỏng (chứng minh bước 4 có tác dụng thật)
  const oldPassword = await call('POST', '/login', { email, password });
  check('6. login bằng mật khẩu CŨ → 401', oldPassword.status === 401, `status=${oldPassword.status}`);

  console.log(failed === 0 ? '\n✅ Tất cả bước PASS' : `\n❌ ${failed} bước FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\n❌ Không chạy được smoke test: ${error.message}`);
  console.error('   Kiểm tra BE đã chạy chưa (npm start) và DATABASE_URL trong server/.env.');
  process.exit(1);
});
