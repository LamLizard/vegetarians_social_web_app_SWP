// Trang Đăng nhập / Đăng ký / Quên mật khẩu (M-17) — 1 trang, nhiều chế độ, KHÔNG dùng react-router.
//   initialMode="login"    → chế độ Đăng nhập
//   initialMode="register" → chế độ Đăng ký
//   (chế độ "forgot" mở từ link "Quên mật khẩu?" trong form Đăng nhập)
// Luồng Quên mật khẩu 3 bước, dùng lại đúng cơ chế OTP của luồng đăng ký:
//   email → OTP (server cấp resetToken) → mật khẩu mới → vào thẳng trang chính.
// Bố cục port từ template: trái = form · phải = panel "khu vườn" ảnh món chay trôi chậm.
// Luồng gọi server giữ NGUYÊN: useAuth() → AuthContext → auth.service.js → api.js
import { useEffect, useState } from 'react';
import { Button, Checkbox, Logo, Notice, PasswordField, Photo, TextField, ThemeToggle } from '../components';
import useAuth from '../hooks/useAuth';
import styles from './AuthPage.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const photo = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

const PHOTOS = {
  saladBowl: photo('photo-1512621776951-a57141f2eefd'),
  buddhaBowl: photo('photo-1623428187969-5da2dcea5ebf'),
  avoToast: photo('photo-1540914124281-342587941389'),
  tofuSteam: photo('photo-1758293121435-396ed31ebcf4'),
  tofuFried: photo('photo-1788535284819-87436fcaef2f'),
  noodleSoup: photo('photo-1579856896394-07dfa10d7c5b'),
  currySoup: photo('photo-1613844237701-8f3664fc2eff'),
  acaiBowl: photo('photo-1627308594190-a057cd4bfac8'),
  smoothie: photo('photo-1610970881699-44a5587cabec'),
  pumpkinSoup: photo('photo-1547592166-23ac45744acd'),
  tableBowls: photo('photo-1680173073730-852e0ec93bec'),
  avocadoBowl: photo('photo-1547496502-affa22d38842'),
  greenPlate: photo('photo-1591522913962-3ecfa6b271f1'),
  vegFlatlay: photo('photo-1598449426314-8b02525e8733', 1600),
  vegBowlDark: photo('photo-1511690656952-34342bb7c2f2', 1600),
};

const COLUMNS = [
  [PHOTOS.buddhaBowl, PHOTOS.noodleSoup, PHOTOS.smoothie, PHOTOS.tofuSteam],
  [PHOTOS.acaiBowl, PHOTOS.tofuFried, PHOTOS.currySoup, PHOTOS.saladBowl],
  [PHOTOS.avocadoBowl, PHOTOS.pumpkinSoup, PHOTOS.avoToast, PHOTOS.greenPlate],
];

const STRENGTH = ['', 'Yếu', 'Trung bình', 'Mạnh'];

function strengthOf(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (password.length >= 12 || /[^a-zA-Z0-9]/.test(password)) score += 1;
  return Math.max(1, score);
}

const EMPTY_FORM = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  agree: false,
  newPassword: '',
  confirmNewPassword: '',
};

export default function AuthPage({ initialMode = 'login', onAuthenticated }) {
  const {
    login,
    register,
    verifyRegisterOtp,
    resendRegisterOtp,
    forgotPassword,
    verifyResetOtp,
    resendResetOtp,
    resetPassword,
  } = useAuth();
  const [mode, setMode] = useState(initialMode); // login | register | forgot
  const [form, setForm] = useState(EMPTY_FORM);
  const [registerStep, setRegisterStep] = useState('form'); // form | otp
  const [forgotStep, setForgotStep] = useState('email'); // email | otp | password
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState(null);
  const [resendLeft, setResendLeft] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpSubmitting, setIsOtpSubmitting] = useState(false);

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const registerOtpStep = isRegister && registerStep === 'otp';
  const forgotOtpStep = isForgot && forgotStep === 'otp';
  const forgotPasswordStep = isForgot && forgotStep === 'password';
  const otpStep = registerOtpStep || forgotOtpStep;
  // Bước OTP / mật khẩu mới là bước phụ: ẩn khối "hoặc … / tạo tài khoản" bên dưới.
  const isFlowStep = otpStep || forgotPasswordStep;
  const otpEmail = otpInfo?.email || form.email.trim().toLowerCase();

  useEffect(() => {
    if (!otpStep || resendLeft <= 0) return undefined;

    const timer = window.setInterval(() => {
      setResendLeft((current) => (current > 1 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [otpStep, resendLeft]);

  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const resetRegisterOtpState = () => {
    setRegisterStep('form');
    setOtp('');
    setOtpInfo(null);
    setResendLeft(0);
    setNotice('');
    setError('');
  };

  const resetForgotState = () => {
    setForgotStep('email');
    setResetToken('');
    setOtp('');
    setOtpInfo(null);
    setResendLeft(0);
    setNotice('');
    setError('');
    setForm((current) => ({ ...current, newPassword: '', confirmNewPassword: '' }));
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setOtp('');
    setOtpInfo(null);
    setResendLeft(0);
    if (nextMode === 'register') setRegisterStep('form');
    else if (nextMode === 'forgot') setForgotStep('email');
    else {
      setRegisterStep('form');
      setForgotStep('email');
      setResetToken('');
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

  // ── Bước 1 của Quên mật khẩu: chỉ 1 ô email ──────────────────────────────
  const submitForgotEmail = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const email = form.email.trim();
    if (!EMAIL_RE.test(email)) return setError('Vui lòng nhập email hợp lệ.');

    setIsSubmitting(true);
    try {
      const result = await forgotPassword(email);
      const nextEmail = email.toLowerCase();
      // Không set notice ở đây: bước OTP đã có dòng copy "Mã xác minh đã được gửi tới ..." (tránh lặp 2 lần).
      setNotice('');
      setOtpInfo({ email: nextEmail, retryAfterSeconds: result?.retryAfterSeconds ?? 60 });
      setResendLeft(result?.retryAfterSeconds ?? 60);
      setOtp('');
      setForgotStep('otp');
    } catch (forgotError) {
      // Server trả 404 "Email chưa được đăng ký." khi email không có trong DB.
      setError(forgotError.message || 'Không gửi được mã xác minh. Vui lòng thử lại.');
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
      const result = forgotOtpStep
        ? await resendResetOtp(otpEmail)
        : await resendRegisterOtp(otpEmail);
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
      if (forgotOtpStep) {
        // Đúng OTP → server cấp resetToken (hạn 10 phút) rồi mới cho đặt mật khẩu mới.
        const result = await verifyResetOtp({ email: otpEmail, otp });
        setResetToken(result.resetToken);
        setNotice('');
        setForm((current) => ({ ...current, newPassword: '', confirmNewPassword: '' }));
        setForgotStep('password');
        return;
      }

      const result = await verifyRegisterOtp({ email: otpEmail, otp });
      onAuthenticated?.(result);
    } catch (otpError) {
      setError(otpError.message || 'Không thể xác minh mã xác minh.');
    } finally {
      setIsOtpSubmitting(false);
    }
  };

  // ── Bước 3: đặt mật khẩu mới, xong vào thẳng trang chính ─────────────────
  const submitNewPassword = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (form.newPassword.length < 8 || form.newPassword.length > 20) {
      return setError('Mật khẩu cần từ 8 đến 20 ký tự.');
    }
    if (form.newPassword.toLowerCase() === otpEmail) {
      return setError('Mật khẩu không được trùng với email.');
    }
    if (form.newPassword !== form.confirmNewPassword) {
      return setError('Mật khẩu nhập lại chưa khớp.');
    }

    setIsSubmitting(true);
    try {
      const result = await resetPassword({ resetToken, password: form.newPassword });
      onAuthenticated?.(result);
    } catch (resetError) {
      setError(resetError.message || 'Không đặt lại được mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderOtpStep = () => (
    <form className={styles['auth-otp']} onSubmit={handleOtpSubmit} noValidate>
      <div className={styles['auth-otp-header']}>
        <p className={styles['auth-otp-kicker']}>{forgotOtpStep ? 'Đặt lại mật khẩu' : 'Xác minh email'}</p>
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
              if (forgotOtpStep) setForgotStep('email');
              else setRegisterStep('form');
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

  const renderNewPasswordStep = () => (
    <form className={styles['auth-form']} onSubmit={submitNewPassword} noValidate>
      <div className={styles['auth-otp-header']}>
        <p className={styles['auth-otp-kicker']}>Mật khẩu mới</p>
        <p className={styles['auth-otp-copy']}>
          Đã xác minh <strong>{otpEmail}</strong>. Đặt mật khẩu mới để vào lại tài khoản ngay.
        </p>
      </div>

      <div className={styles['auth-pw-group']}>
        <PasswordField
          label="Mật khẩu mới"
          required
          autoComplete="new-password"
          hint="Từ 8 đến 20 ký tự; không được trùng với email."
          value={form.newPassword}
          onChange={setField('newPassword')}
        />
        {form.newPassword && <StrengthMeter value={form.newPassword} />}
      </div>

      <PasswordField
        label="Nhập lại mật khẩu mới"
        required
        autoComplete="new-password"
        value={form.confirmNewPassword}
        onChange={setField('confirmNewPassword')}
      />

      <Button type="submit" size="lg" block loading={isSubmitting}>
        Đặt lại mật khẩu &amp; vào trang chính
      </Button>

      <div className={styles['auth-otp-row']}>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError('');
            setNotice('');
            setResetToken('');
            setForgotStep('email');
          }}
        >
          ← Nhập lại email
        </Button>
      </div>
    </form>
  );

  // Bước 1 của Quên mật khẩu: đúng 1 ô email
  const renderForgotEmailStep = () => (
    <form className={styles['auth-form']} onSubmit={submitForgotEmail} noValidate>
      <TextField
        label="Email"
        type="email"
        required
        autoComplete="email"
        placeholder="ten@gmail.com"
        value={form.email}
        onChange={setField('email')}
      />

      <Button type="submit" size="lg" block loading={isSubmitting}>
        Gửi mã xác minh
      </Button>

      <div className={styles['auth-otp-row']}>
        <button type="button" className={styles['auth-text-link']} onClick={() => switchMode('login')}>
          ← Quay lại đăng nhập
        </button>
      </div>
    </form>
  );

  const title = isForgot
    ? (forgotPasswordStep ? 'Mật khẩu mới' : 'Quên mật khẩu?')
    : (isRegister ? 'Tạo tài khoản' : 'Đăng nhập');
  const subtitle = isForgot
    ? (forgotPasswordStep
      ? 'Đặt mật khẩu mới rồi vào thẳng trang chính 🌿'
      : 'Nhập email đã đăng ký để nhận mã xác minh đặt lại mật khẩu.')
    : (isRegister ? 'Miễn phí, chỉ mất chưa tới 1 phút.' : 'Chào mừng bạn quay lại với cộng đồng 🌿');

  return (
    <main className={styles['auth']}>
      <section className={styles['auth-form-side']}>
        <div className={styles['auth-form-top']}>
          <Logo href="/login" showName size={40} />
          <ThemeToggle variant="icon" />
        </div>

        <div className={styles['auth-form-card']}>
          <h1 className={styles['auth-title']}>{title}</h1>
          <p className={styles['auth-sub']}>{subtitle}</p>

          {notice && (
            <Notice
              tone="info"
              title={isForgot ? 'Đặt lại mật khẩu' : (isRegister ? 'Xác minh email' : 'Thông báo')}
              className={styles['auth-notice']}
            >
              {notice}
            </Notice>
          )}

          {error && (
            <Notice
              tone="alert"
              title={isForgot ? 'Chưa đặt lại được mật khẩu' : (isRegister ? 'Chưa tạo được tài khoản' : 'Chưa đăng nhập được')}
              className={styles['auth-notice']}
            >
              {error}
            </Notice>
          )}

          {otpStep ? renderOtpStep() : forgotPasswordStep ? renderNewPasswordStep() : isForgot ? renderForgotEmailStep() : (
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

              {!isRegister && (
                <div className={styles['auth-helper-row']}>
                  <button type="button" className={styles['auth-text-link']} onClick={() => switchMode('forgot')}>
                    Quên mật khẩu?
                  </button>
                </div>
              )}

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

          {!isFlowStep && !isForgot ? (
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

      <VisualPanel />
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

function VisualPanel() {
  return (
    <section className={styles['auth-visual']} aria-hidden="true">
      <div className={styles['auth-columns']}>
        {COLUMNS.map((column, i) => (
          <div
            key={i}
            className={styles['auth-column']}
            data-dir={i % 2 ? 'down' : 'up'}
            style={{ '--dur': `${48 + i * 9}s` }}
          >
            {[...column, ...column].map((src, j) => (
              <Photo key={j} src={src.replace('w=900', 'w=600')} className={styles['auth-tile']} />
            ))}
          </div>
        ))}
      </div>
      <div className={styles['auth-scrim']} />
      <div className={styles['auth-visual-copy']}>
        <h1 className={styles['auth-headline']}>
          Ăn chay dễ hơn khi <em>có nhau.</em>
        </h1>
        <p className={styles['auth-lead']}>Công thức, review quán, lịch ngày chay và trợ lý Mầm. Tất cả ở một nơi.</p>
      </div>
    </section>
  );
}
