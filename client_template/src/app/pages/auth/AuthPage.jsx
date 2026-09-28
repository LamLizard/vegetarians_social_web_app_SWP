import { useId, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button, FormField, IconButton, Notice, Photo, useToast } from '../../../components';
import cx from '../../../components/cx';
import useAuth from '../../hooks/useAuth';
import Logo from '../../layouts/Logo';
import { DEMO_ACCOUNTS, PHOTOS } from '../../store/mockData';
import { firstName } from '../../utils/format';
import { useTheme } from '../../utils/theme';
import './AuthPage.css';

// =====================================================================
//  ID02 – Trang Đăng nhập + Đăng ký (1 trang, 2 chế độ)
//    /login    → <AuthPage mode="login" />
//    /register → <AuthPage mode="register" />
//  Bên trái: form · Bên phải: panel "khu vườn" ảnh món chay trôi chậm.
//  Gọi server qua useAuth() → AuthContext → auth.service.js → api.js
// =====================================================================

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RULE = 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.';
const isStrongPassword = (pw) => pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw);

/** Trang chính sau khi vào: quay lại trang đang xem dở (nếu có quyền), không thì theo vai trò. */
function homeFor(user, from) {
  const isAdmin = user.role === 'admin';
  if (from && (isAdmin || !from.startsWith('/admin'))) return from;
  return isAdmin ? '/admin' : '/';
}

export default function AuthPage({ mode = 'login' }) {
  const { user } = useAuth();
  const location = useLocation();
  const [theme, toggleTheme] = useTheme();

  // Đã đăng nhập (hoặc vừa đăng nhập xong) mà vẫn ở /login, /register → đưa về trang chính
  if (user) return <Navigate to={homeFor(user, location.state?.from)} replace />;

  return (
    <div className="auth">
      <section className="auth-form-side">
        <div className="auth-form-top">
          <Logo showName size={40} to="/login" />
          <IconButton
            variant="ghost"
            icon={theme === 'dark' ? 'sun' : 'moon-stars'}
            label={theme === 'dark' ? 'Chế độ Ngày' : 'Chế độ Đêm'}
            onClick={toggleTheme}
          />
        </div>
        <motion.div
          className="auth-form-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {mode === 'register' ? <RegisterForm /> : <LoginForm />}
        </motion.div>
        <p className="auth-legal">Ứng dụng cộng đồng ăn chay · Dự án SWP391</p>
      </section>

      <VisualPanel />
    </div>
  );
}

/* ─────────────────────────── Form Đăng nhập ─────────────────────────── */

function LoginForm() {
  const { login, notice, clearNotice } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null); // { title, text, locked? }
  const [submitting, setSubmitting] = useState(false);

  const doLogin = async (creds) => {
    setFailure(null);
    clearNotice();
    setSubmitting(true);
    try {
      const me = await login({ ...creds, remember });
      toast(`Chào mừng trở lại, ${firstName(me.fullName)}!`);
      navigate(homeFor(me, from), { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err.data?.locked) {
        setFailure({ title: err.message, text: <>Liên hệ <b>hotro@anchay.vn</b> nếu bạn cho rằng đây là nhầm lẫn.</> });
      } else if (err.status === 401) {
        setFailure({ title: err.message, text: 'Kiểm tra lại email và mật khẩu, lưu ý chữ hoa, chữ thường.' });
      } else {
        setFailure({ title: 'Chưa đăng nhập được', text: err.message });
      }
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!email.trim()) next.email = 'Vui lòng nhập email.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Email chưa đúng định dạng, vd: ten@gmail.com';
    if (!password) next.password = 'Vui lòng nhập mật khẩu.';
    setErrors(next);
    if (Object.keys(next).length === 0) doLogin({ email, password });
  };

  const loginDemo = (role) => doLogin(DEMO_ACCOUNTS[role]);

  return (
    <>
      <h2 className="auth-title">Đăng nhập</h2>
      <p className="auth-sub">Chào mừng bạn quay lại với cộng đồng 🌿</p>

      {location.state?.loggedOut && !failure && !notice && (
        <Notice tone="success" title="Bạn đã đăng xuất" className="mb-3">Hẹn sớm gặp lại bạn!</Notice>
      )}
      {notice && !failure && (
        <Notice tone={notice.tone} title={notice.title} className="mb-3">{notice.text}</Notice>
      )}
      {failure && (
        <Notice tone="alert" title={failure.title} className="mb-3">{failure.text}</Notice>
      )}

      <form onSubmit={submit} noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="ten@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField
          label="Mật khẩu"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="form-check mb-0">
            <input id="remember" type="checkbox" className="form-check-input" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <label htmlFor="remember" className="form-check-label small">Ghi nhớ đăng nhập</label>
          </div>
          <button type="button" className="auth-text-link" onClick={() => toast('Tính năng khôi phục mật khẩu sẽ gửi email, chưa có trong bản demo', { tone: 'info' })}>
            Quên mật khẩu?
          </button>
        </div>

        <SubmitButton loading={submitting}>Đăng nhập</SubmitButton>
      </form>

      <div className="auth-divider"><span>hoặc</span></div>
      <Link to="/register" className="btn btn-outline-primary btn-lg w-100">Tạo tài khoản mới</Link>

      <div className="auth-demo">
        <div className="auth-demo-head">
          <i className="bi bi-lightning-charge" aria-hidden="true" /> Vào nhanh bằng tài khoản demo
        </div>
        <div className="auth-demo-btns">
          <Button variant="subtle" size="sm" icon="person" disabled={submitting} onClick={() => loginDemo('member')}>Thành viên</Button>
          <Button variant="subtle" size="sm" icon="shield-check" disabled={submitting} onClick={() => loginDemo('admin')}>Quản trị viên</Button>
        </div>
        <small>
          {DEMO_ACCOUNTS.member.email} / {DEMO_ACCOUNTS.member.password} · {DEMO_ACCOUNTS.admin.email} / {DEMO_ACCOUNTS.admin.password}
        </small>
      </div>
    </>
  );
}

/* ─────────────────────────── Form Đăng ký ─────────────────────────── */

// 0 = trống, 1 yếu, 2 trung bình, 3 mạnh
function strengthOf(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) score += 1;
  if (pw.length >= 12 || /[^a-zA-Z0-9]/.test(pw)) score += 1;
  return Math.max(1, score);
}
const STRENGTH = ['', 'Yếu', 'Trung bình', 'Mạnh'];

function RegisterForm() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '', agree: false });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const strength = strengthOf(form.password);

  const validate = () => {
    const e = {};
    if (form.fullName.trim().length < 2) e.fullName = 'Vui lòng nhập họ và tên.';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Email chưa đúng định dạng, vd: ten@gmail.com';
    if (!isStrongPassword(form.password)) e.password = PASSWORD_RULE;
    if (form.confirm !== form.password) e.confirm = 'Mật khẩu nhập lại chưa khớp.';
    if (!form.agree) e.agree = 'Bạn cần đồng ý với quy tắc cộng đồng để tiếp tục.';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const me = await register(form);
      toast(`Chào mừng ${firstName(me.fullName)} đến với cộng đồng! 🌱`);
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitting(false);
      // Lỗi gắn với 1 ô (vd. email đã đăng ký) → hiện ngay dưới ô đó
      if (err.data?.field) setErrors({ [err.data.field]: err.message });
      else setFailure(err.message);
    }
  };

  return (
    <>
      <h2 className="auth-title">Tạo tài khoản</h2>
      <p className="auth-sub">Miễn phí, chỉ mất chưa tới 1 phút.</p>

      {failure && <Notice tone="alert" title="Chưa tạo được tài khoản" className="mb-3">{failure}</Notice>}

      <form onSubmit={submit} noValidate>
        <FormField label="Họ và tên" required autoComplete="name" placeholder="Vd: Lâm Anh Khôi" value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
        <FormField label="Email" required type="email" autoComplete="email" placeholder="ten@gmail.com" value={form.email} onChange={set('email')} error={errors.email} />

        <div className="row g-2">
          <div className="col-sm-6">
            <PasswordField
              label="Mật khẩu"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              hint="Ít nhất 8 ký tự, có chữ và số."
            >
              {form.password && (
                <div className="auth-strength" aria-live="polite">
                  <div className="auth-strength-bar">
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={cx(i <= strength && `is-s${strength}`)} />
                    ))}
                  </div>
                  <small>Độ mạnh: {STRENGTH[strength]}</small>
                </div>
              )}
            </PasswordField>
          </div>
          <div className="col-sm-6">
            <PasswordField label="Nhập lại mật khẩu" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
          </div>
        </div>

        <div className="form-check mb-3">
          <input id="agree" type="checkbox" className={cx('form-check-input', errors.agree && 'is-invalid')} checked={form.agree} onChange={set('agree')} />
          <label htmlFor="agree" className="form-check-label small">
            Tôi đồng ý với <a href="#dieu-khoan" onClick={(e) => e.preventDefault()}>Điều khoản sử dụng</a> và <a href="#quy-tac" onClick={(e) => e.preventDefault()}>Quy tắc cộng đồng</a>
          </label>
          {errors.agree && <div className="invalid-feedback d-block">{errors.agree}</div>}
        </div>

        <SubmitButton loading={submitting}>Tạo tài khoản</SubmitButton>
      </form>

      <p className="auth-switch">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </>
  );
}

/* ─────────────────────────── Phần dùng chung ─────────────────────────── */

function SubmitButton({ loading, children }) {
  return (
    <Button type="submit" size="lg" className="w-100" disabled={loading} aria-busy={loading}>
      {loading && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
      {children}
    </Button>
  );
}

/**
 * Ô mật khẩu có nút hiện/ẩn – cùng giao diện với FormField.
 * Mọi prop còn lại (value, onChange, autoComplete...) truyền thẳng vào <input>.
 */
function PasswordField({ label, hint, error, required, className, children, ...inputProps }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = error || hint ? `${id}-desc` : undefined;

  return (
    <div className={cx('mb-3', className)}>
      <label htmlFor={id} className="form-label fw-semibold small mb-1">
        {label}
        {required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
      </label>
      <div className="auth-pw-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={cx('form-control auth-pw-input', error && 'is-invalid')}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          required={required}
          {...inputProps}
        />
        <button
          type="button"
          className="auth-pw-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
        >
          <i className={`bi bi-${visible ? 'eye-slash' : 'eye'}`} aria-hidden="true" />
        </button>
      </div>
      {children}
      {error ? (
        <div id={describedBy} className="invalid-feedback d-block">{error}</div>
      ) : (
        hint && <div id={describedBy} className="form-text">{hint}</div>
      )}
    </div>
  );
}

// 3 cột ảnh trôi chậm – mỗi cột lặp 2 lần để cuộn liền mạch
const COLUMNS = [
  [PHOTOS.buddhaBowl, PHOTOS.noodleSoup, PHOTOS.smoothie, PHOTOS.tofuSteam],
  [PHOTOS.acaiBowl, PHOTOS.tofuFried, PHOTOS.currySoup, PHOTOS.saladBowl],
  [PHOTOS.avocadoBowl, PHOTOS.pumpkinSoup, PHOTOS.avoToast, PHOTOS.greenPlate],
];

/** Panel bên phải: "khu vườn" ảnh món chay + khẩu hiệu. */
function VisualPanel() {
  return (
    <section className="auth-visual" aria-hidden="true">
      <div className="auth-columns">
        {COLUMNS.map((col, i) => (
          <div key={i} className="auth-column" data-dir={i % 2 ? 'down' : 'up'} style={{ '--dur': `${48 + i * 9}s` }}>
            {[...col, ...col].map((src, j) => (
              <Photo key={j} src={src.replace('w=900', 'w=600')} className="auth-tile" />
            ))}
          </div>
        ))}
      </div>
      <div className="auth-scrim" />

      <div className="auth-visual-copy">
        <h1 className="display auth-headline">
          Ăn chay dễ hơn khi <em>có nhau.</em>
        </h1>
        <p className="auth-lead">Công thức, review quán, lịch ngày chay và trợ lý Mầm. Tất cả ở một nơi.</p>
      </div>
    </section>
  );
}
