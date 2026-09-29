// Smoke test tầng auth — register · login · me · chính sách mật khẩu — chạy: node scripts/auth-smoke.js
// Cần: BE đang chạy (npm start ở server/) + Node 18+ (có fetch sẵn).
// Đổi URL khi cần: set SMOKE_BASE_URL=http://localhost:5000/api/auth
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5000/api/auth';

const email = `smoke+${Date.now()}@test.com`;
const password = 'smoke1234';

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

  // 1 · Mật khẩu đăng ký ngắn hơn giới hạn → 400
  const tooShort = await call('POST', '/register', { fullName: 'Smoke Test', email, password: '1234567' });
  check(
    '1. register password 7 ký tự → 400',
    tooShort.status === 400 && tooShort.data?.message === 'Mật khẩu cần từ 8 đến 20 ký tự.',
    `status=${tooShort.status} ${JSON.stringify(tooShort.data)}`,
  );

  // 2 · Mật khẩu trùng email (không phân biệt hoa/thường) → 400
  const sameAsEmail = await call('POST', '/register', {
    fullName: 'Smoke Test', email: 'test@example.com', password: 'TEST@EXAMPLE.COM',
  });
  check(
    '2. register password trùng email → 400',
    sameAsEmail.status === 400 && sameAsEmail.data?.message === 'Mật khẩu không được trùng với email.',
    `status=${sameAsEmail.status} ${JSON.stringify(sameAsEmail.data)}`,
  );

  // 3 · Mật khẩu dài hơn giới hạn → 400
  const tooLong = await call('POST', '/register', { fullName: 'Smoke Test', email, password: '1'.repeat(21) });
  check(
    '3. register password 21 ký tự → 400',
    tooLong.status === 400 && tooLong.data?.message === 'Mật khẩu cần từ 8 đến 20 ký tự.',
    `status=${tooLong.status} ${JSON.stringify(tooLong.data)}`,
  );

  // 4 · Đăng ký với mật khẩu hợp lệ (8–20 ký tự) → 201 + token
  const registered = await call('POST', '/register', { fullName: 'Smoke Test', email, password });
  check('4. register password hợp lệ → 201', registered.status === 201, `status=${registered.status} ${JSON.stringify(registered.data)}`);
  check('4b. register trả token + không lộ password_hash', Boolean(registered.data?.token) && !leaksHash(registered.data?.user));
  token = registered.data?.token ?? null;

  // 5 · Đăng nhập bằng mật khẩu vừa đăng ký
  const loggedIn = await call('POST', '/login', { email, password });
  check('5. login → 200', loggedIn.status === 200, `status=${loggedIn.status} ${JSON.stringify(loggedIn.data)}`);
  token = loggedIn.data?.token ?? token;

  // 6 · Lấy thông tin tài khoản từ token
  const me = await call('GET', '/me', null, true);
  check('6. me → 200 đúng email', me.status === 200 && me.data?.user?.email === email, `status=${me.status} user=${JSON.stringify(me.data?.user)}`);
  check('6b. me không lộ password_hash', !leaksHash(me.data?.user));

  // 7 · Đổi mật khẩu không còn thuộc auth → 404
  const removedRoute = await call('POST', '/change-password', { currentPassword: password, newPassword: 'newpassword' }, true);
  check('7. POST /change-password → 404', removedRoute.status === 404, `status=${removedRoute.status}`);

  console.log(failed === 0 ? '\n✅ Tất cả bước PASS' : `\n❌ ${failed} bước FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\n❌ Không chạy được smoke test: ${error.message}`);
  console.error('   Kiểm tra BE đã chạy chưa (npm start) và DATABASE_URL trong server/.env.');
  process.exit(1);
});
