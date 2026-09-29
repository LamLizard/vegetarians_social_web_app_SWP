import { useState } from 'react';
import { PasswordField, TextField } from '../components';
import { login } from '../services/auth.service';

export default function LoginPage({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLoggedIn(await login({ email, password }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-sm-10 col-md-7 col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4 p-lg-5">
              <p className="text-uppercase text-muted small mb-1">Vegetarian Social</p>
              <h1 className="h3 mb-4">Đăng nhập</h1>
              <form onSubmit={handleSubmit}>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="username"
                  required
                />
                <div className="mt-3">
                  <PasswordField
                    label="Mật khẩu"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    required
                  />
                </div>
                {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
                <button type="submit" className="btn btn-primary w-100 mt-4" disabled={busy}>
                  {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}