// Trang Đăng nhập / Đăng ký (M-17) — 1 trang, 2 chế độ, KHÔNG dùng react-router.
//   initialMode="login"    → chế độ Đăng nhập
//   initialMode="register" → chế độ Đăng ký
// Bố cục khu vườn: lớp cảnh trang trí và form xác thực.
// Luồng gọi server giữ NGUYÊN: useAuth() → AuthContext → auth.service.js → api.js
import { useEffect, useState } from 'react';
import { Button, Checkbox, Logo, Notice, PasswordField, TextField, ThemeToggle } from '../components';
import useAuth from '../hooks/useAuth';
import styles from './AuthPage.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const STRENGTH = ['', 'Yếu', 'Trung bình', 'Mạnh'];

// Rèm lá: mỗi bên 3 tầng (sau → giữa → trước) để lá hai bên chen vào nhau ở giữa.
const CURTAIN_SIDES = ['left', 'right'];
const CURTAIN_DEPTHS = ['back', 'mid', 'front'];

// Lá rơi khi rèm vén ra: vị trí, cỡ, màu, thời lượng, độ lắc và góc xoay ban đầu.
const FALLING_LEAVES = [
  { x: '44%', s: '24px', c: '#4d9358', d: '3.9s', delay: '.75s', sway: '-70px', r: '-25deg' },
  { x: '53%', s: '18px', c: '#8bbf5f', d: '3.5s', delay: '.95s', sway: '55px', r: '30deg' },
  { x: '38%', s: '20px', c: '#2f6b45', d: '4.1s', delay: '1.2s', sway: '80px', r: '10deg' },
  { x: '60%', s: '26px', c: '#6aa35a', d: '4.2s', delay: '1.05s', sway: '-90px', r: '-40deg' },
  { x: '49%', s: '15px', c: '#a9cc6e', d: '3.6s', delay: '1.45s', sway: '40px', r: '60deg' },
  { x: '33%', s: '17px', c: '#5c9e63', d: '3.7s', delay: '.85s', sway: '-45px', r: '15deg' },
  { x: '66%', s: '21px', c: '#3e7f52', d: '3.8s', delay: '1.35s', sway: '65px', r: '-15deg' },
  { x: '56%', s: '13px', c: '#c6dc8a', d: '3.4s', delay: '1.6s', sway: '-35px', r: '45deg' },
];

function strengthOf(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (password.length >= 12 || /[^a-zA-Z0-9]/.test(password)) score += 1;
  return Math.max(1, score);
}

export default function AuthPage({ initialMode = 'login', onAuthenticated }) {
  const { login, register, verifyRegisterOtp, resendRegisterOtp } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '', agree: false });
  const [registerStep, setRegisterStep] = useState('form');
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState(null);
  const [resendLeft, setResendLeft] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpSubmitting, setIsOtpSubmitting] = useState(false);

  const isRegister = mode === 'register';
  const otpEmail = otpInfo?.email || form.email.trim().toLowerCase();

  useEffect(() => {
    if (!isRegister || registerStep !== 'otp' || resendLeft <= 0) return undefined;

    const timer = window.setInterval(() => {
      setResendLeft((current) => (current > 1 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRegister, registerStep, resendLeft]);

  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const resetRegisterOtpState = () => {
    setRegisterStep('form');
    setOtp('');
    setOtpInfo(null);
    setResendLeft(0);
    setNotice('');
    setError('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    if (nextMode !== 'register') {
      resetRegisterOtpState();
    } else {
      setRegisterStep('form');
      setOtp('');
      setOtpInfo(null);
      setResendLeft(0);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (isRegister && form.fullName.trim().length < 2) return setError('Vui lòng nhập họ và tên.');
    if (isRegister && form.email.trim().length > 30) return setError('Email đăng ký không được vượt quá 30 ký tự.');
    if (!EMAIL_RE.test(form.email.trim())) return setError('Vui lòng nhập email hợp lệ.');
    if (isRegister && (form.password.length < 8 || form.password.length > 20)) {
      return setError('Mật khẩu cần từ 8 đến 20 ký tự.');
    }
    if (isRegister && form.password.toLowerCase() === form.email.trim().toLowerCase()) {
      return setError('Mật khẩu không được trùng với email.');
    }
    if (!isRegister && form.password.length < 8) return setError('Mật khẩu cần ít nhất 8 ký tự.');
    if (isRegister && form.password !== form.confirmPassword) return setError('Mật khẩu nhập lại chưa khớp.');
    if (isRegister && !form.agree) return setError('Bạn cần đồng ý với các chính sách để tiếp tục.');

    setIsSubmitting(true);
    try {
      const payload = isRegister
        ? { fullName: form.fullName.trim(), email: form.email.trim(), password: form.password }
        : { email: form.email.trim(), password: form.password };
      const result = isRegister ? await register(payload) : await login(payload);

      if (isRegister) {
        const nextEmail = payload.email.trim().toLowerCase();
        setNotice(`Mã xác minh đã được gửi tới ${nextEmail}. Mã có hiệu lực 5 phút.`);
        setOtpInfo({ email: nextEmail, retryAfterSeconds: result.retryAfterSeconds ?? 60 });
        setResendLeft(result.retryAfterSeconds ?? 60);
        setRegisterStep('otp');
        setOtp('');
        setError('');
        return;
      }

      onAuthenticated?.(result);
    } catch (submitError) {
      setError(submitError.message || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (nextValue) => {
    const sanitized = nextValue.replace(/\D/g, '').slice(0, 6);
    setOtp(sanitized);
  };

  const resendOtp = async () => {
    if (resendLeft > 0) return;
    setError('');
    setNotice('');

    try {
      const result = await resendRegisterOtp(otpEmail);
      setOtp('');
      setNotice('Đã gửi lại mã xác minh.');
      setOtpInfo((current) => ({ ...(current || { email: otpEmail }), email: otpEmail, retryAfterSeconds: result.retryAfterSeconds ?? 60 }));
      setResendLeft(result.retryAfterSeconds ?? 60);
    } catch (resendError) {
      setError(resendError.message || 'Không gửi lại được mã xác minh.');
      const retrySeconds = resendError?.details?.retryAfterSeconds ?? 0;
      if (retrySeconds > 0) setResendLeft(retrySeconds);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (otp.length !== 6) {
      return setError('Vui lòng nhập đủ 6 chữ số của mã xác minh.');
    }

    setIsOtpSubmitting(true);
    try {
      const result = await verifyRegisterOtp({ email: otpEmail, otp });
      onAuthenticated?.(result);
    } catch (otpError) {
      setError(otpError.message || 'Không thể xác minh mã xác minh.');
    } finally {
      setIsOtpSubmitting(false);
    }
  };

  const renderOtpStep = () => (
    <form className={styles['auth-otp']} onSubmit={handleOtpSubmit} noValidate>
      <div className={styles['auth-otp-header']}>
        <p className={styles['auth-otp-kicker']}>Xác minh email</p>
        <p className={styles['auth-otp-copy']}>
          Mã xác minh đã được gửi tới <strong>{otpEmail}</strong>. Mã có hiệu lực 5 phút.
        </p>
      </div>

      <TextField
        label="Mã xác minh"
        value={otp}
        onChange={handleOtpChange}
        maxLength={6}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
      />

      <div className={styles['auth-otp-actions']}>
        <Button type="submit" size="lg" block loading={isOtpSubmitting}>
          Xác minh
        </Button>

        <div className={styles['auth-otp-row']}>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setRegisterStep('form');
              setError('');
              setNotice('');
              setOtp('');
            }}
          >
            ← Quay lại
          </Button>

          <button
            type="button"
            className={styles['auth-otp-resend']}
            onClick={resendOtp}
            disabled={resendLeft > 0}
          >
            {resendLeft > 0 ? `Gửi lại mã (${resendLeft}s)` : 'Gửi lại mã'}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <main className={styles['auth']}>
      <div className={styles['garden']} aria-hidden="true">
        <div className={styles['garden-shade']} />
        <div className={styles['garden-glow']} />
        <span className={`${styles['garden-petal']} ${styles['garden-petal-one']}`} />
        <span className={`${styles['garden-petal']} ${styles['garden-petal-two']}`} />
        <span className={`${styles['garden-petal']} ${styles['garden-petal-three']}`} />
      </div>

      <div className={styles['garden-monkey']} aria-hidden="true">
        <img src="/auth/swinging-monkey.webp" alt="" />
      </div>

      <div className={styles['garden-curtain']} aria-hidden="true">
        <div className={styles['curtain-glow']} />
        {CURTAIN_SIDES.flatMap((side) => CURTAIN_DEPTHS.map((depth) => (
          <div
            key={`${side}-${depth}`}
            className={`${styles['curtain-layer']} ${styles[`curtain-${depth}`]} ${styles[`curtain-${side}`]}`}
          >
            {depth === 'mid' && <span className={styles['curtain-fringe']} />}
          </div>
        )))}
        <div className={styles['curtain-rays']} />
        {FALLING_LEAVES.map((leaf, index) => (
          <span
            key={index}
            className={styles['curtain-leaf']}
            style={{
              '--x': leaf.x, '--s': leaf.s, '--c': leaf.c, '--d': leaf.d,
              '--delay': leaf.delay, '--sway': leaf.sway, '--r': leaf.r,
            }}
          >
            <svg viewBox="0 0 24 34" focusable="false">
              <path className={styles['leaf-blade']} d="M12 1.5C5.2 7.6 2.6 15.4 5.1 23.2 6.6 28 9.4 31 12 32.5c2.6-1.5 5.4-4.5 6.9-9.3C21.4 15.4 18.8 7.6 12 1.5Z" />
              <path className={styles['leaf-vein']} d="M12 5.5V31M12 13l-3.6-3M12 18.5l4-3.4M12 24l-4.2-3.2" />
            </svg>
          </span>
        ))}
      </div>

      <div className={styles['garden-story']}>
        <h2 className={styles['garden-story-title']}>Ăn chay dễ hơn khi <em>có nhau.</em></h2>
        <p className={styles['garden-story-copy']}>Công thức, review quán, lịch ngày chay và trợ lý Mầm. Tất cả ở một nơi.</p>
      </div>

      <section className={styles['auth-form-side']}>
        <div className={styles['auth-form-top']}>
          <Logo href="/login" showName size={40} />
          <ThemeToggle variant="icon" />
        </div>

        <div className={styles['auth-form-card']}>
          <h1 className={styles['auth-title']}>{isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
          <p className={styles['auth-sub']}>
            {isRegister ? 'Miễn phí, chỉ mất chưa tới 1 phút.' : 'Chào mừng bạn quay lại với cộng đồng 🌿'}
          </p>

          {notice && (
            <Notice tone="info" title={isRegister ? 'Xác minh email' : 'Thông báo'} className={styles['auth-notice']}>
              {notice}
            </Notice>
          )}

          {error && (
            <Notice
              tone="alert"
              title={isRegister ? 'Chưa tạo được tài khoản' : 'Chưa đăng nhập được'}
              className={styles['auth-notice']}
            >
              {error}
            </Notice>
          )}

          {isRegister && registerStep === 'otp' ? renderOtpStep() : (
            <form className={styles['auth-form']} onSubmit={submit} noValidate>
              {isRegister && (
                <TextField
                  label="Họ và tên"
                  required
                  autoComplete="name"
                  placeholder="Vd: Lâm Anh Khôi"
                  value={form.fullName}
                  onChange={setField('fullName')}
                />
              )}

              <TextField
                label="Email"
                type="email"
                required={isRegister}
                autoComplete="email"
                placeholder="ten@gmail.com"
                maxLength={isRegister ? 30 : undefined}
                value={form.email}
                onChange={setField('email')}
              />

              <div className={styles['auth-pw-group']}>
                <PasswordField
                  label="Mật khẩu"
                  required={isRegister}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder={isRegister ? undefined : 'Nhập mật khẩu'}
                  hint={isRegister ? 'Từ 8 đến 20 ký tự; không được trùng với email.' : undefined}
                  value={form.password}
                  onChange={setField('password')}
                />
                {isRegister && form.password && <StrengthMeter value={form.password} />}
              </div>

              {isRegister && (
                <PasswordField
                  label="Nhập lại mật khẩu"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={setField('confirmPassword')}
                />
              )}

              {isRegister && (
                <>
                  <details className={styles['auth-policies']}>
                    <summary>Xem 6 chính sách của cộng đồng</summary>
                    <ol>
                      <li><a href="#">Điều khoản sử dụng</a> — Quy định điều kiện tham gia cộng đồng, hành vi được/không được phép, quyền của admin.</li>
                      <li><a href="#">Chính sách quyền riêng tư</a> — Hệ thống thu thập, dùng, lưu, chia sẻ và bảo vệ dữ liệu cá nhân thế nào.</li>
                      <li><a href="#">Chính sách cộng đồng</a> — Quản lý bài viết, bình luận, tranh cãi về ăn chay, quảng cáo, nội dung gây hại.</li>
                      <li><a href="#">Chính sách cookie</a> — Cookie đăng nhập, cookie phân tích, cookie quảng cáo (nếu có).</li>
                      <li><a href="#">Chính sách xóa tài khoản/dữ liệu</a> — Cách yêu cầu xóa hoặc chỉnh sửa thông tin.</li>
                      <li><a href="#">Chính sách nội dung &amp; báo cáo vi phạm</a> — Cách report bài viết/tài khoản, quy trình xử lý của admin.</li>
                    </ol>
                  </details>
                  <Checkbox
                    className={styles['auth-agree']}
                    checked={form.agree}
                    onChange={(_checked, event) => setField('agree')(event.target.checked)}
                    required
                  >
                    Tôi đồng ý với các chính sách trên, bao gồm việc thu thập và chia sẻ dữ liệu cá nhân theo Chính sách quyền riêng tư.
                  </Checkbox>
                </>
              )}

              <Button type="submit" size="lg" block loading={isSubmitting}>
                {isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
              </Button>
            </form>
          )}

          {!isRegister || registerStep !== 'otp' ? (
            <>
              <div className={styles['auth-divider']}><span>hoặc</span></div>

              {isRegister ? (
                <p className={styles['auth-switch']}>
                  Đã có tài khoản?{' '}
                  <button type="button" className={styles['auth-text-link']} onClick={() => switchMode('login')}>
                    Đăng nhập
                  </button>
                </p>
              ) : (
                <Button variant="outline" size="lg" block onClick={() => switchMode('register')}>
                  Tạo tài khoản mới
                </Button>
              )}
            </>
          ) : null}
        </div>

        <p className={styles['auth-legal']}>Ứng dụng cộng đồng ăn chay · Dự án SWP391</p>
      </section>
    </main>
  );
}

function StrengthMeter({ value }) {
  const strength = strengthOf(value);
  return (
    <div className={styles['auth-strength']} aria-live="polite">
      <div className={styles['auth-strength-bar']}>
        {[1, 2, 3].map((level) => (
          <span key={level} className={level <= strength ? styles[`is-s${strength}`] : undefined} />
        ))}
      </div>
      <small>Độ mạnh: {STRENGTH[strength]}</small>
    </div>
  );
}
