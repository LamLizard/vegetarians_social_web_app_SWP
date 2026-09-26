// Page cho login + register
import { useState } from 'react';
import useAuth from '../hooks/useAuth';
import './AuthPage.css';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthPage({ initialMode = 'login', onAuthenticated }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (isRegister && form.fullName.trim().length < 2) return setError('Vui lòng nhập họ và tên.');
    if (!emailPattern.test(form.email.trim())) return setError('Vui lòng nhập email hợp lệ.');
    if (form.password.length < 8) return setError('Mật khẩu cần ít nhất 8 ký tự.');
    if (isRegister && form.password !== form.confirmPassword) return setError('Mật khẩu nhập lại chưa khớp.');

    setIsSubmitting(true);
    try {
      const payload = isRegister
        ? { fullName: form.fullName.trim(), email: form.email.trim(), password: form.password }
        : { email: form.email.trim(), password: form.password };
      const result = isRegister ? await register(payload) : await login(payload);
      onAuthenticated?.(result);
    } catch (submitError) {
      setError(submitError.message || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Đăng nhập</button>
          <button type="button" className={isRegister ? 'active' : ''} onClick={() => switchMode('register')}>Đăng ký</button>
        </div>

        <h1 id="auth-title">{isRegister ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
        <p className="auth-subtitle">{isRegister ? 'Tạo tài khoản để bắt đầu.' : 'Đăng nhập để tiếp tục.'}</p>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <form onSubmit={submit} noValidate>
          {isRegister && (
            <label>
              Họ và tên
              <input name="fullName" value={form.fullName} onChange={update} autoComplete="name" required />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />
          </label>
          <label>
            Mật khẩu
            <input name="password" type="password" value={form.password} onChange={update} autoComplete={isRegister ? 'new-password' : 'current-password'} required />
          </label>
          {isRegister && (
            <label>
              Nhập lại mật khẩu
              <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} autoComplete="new-password" required />
            </label>
          )}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang xử lý...' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </main>
  );
}