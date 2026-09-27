import { useEffect, useState } from 'react';
import { PasswordField, TextField } from '../components';
import { getProfile, updateProfile } from '../services/user.service';
import { hasErrors } from '../utils/validate';

const DISPLAY_NAME_REGEX = /^[A-Za-z0-9_.]{8,20}$/;

const defaultValues = {
  displayName: '',
  avatar: '',
  email: '',
  currentPassword: '',
  password: '',
  confirmPassword: '',
};

function validateProfile(values) {
  const errors = {};

  if (!DISPLAY_NAME_REGEX.test(values.displayName)) {
    errors.displayName = 'Display name phải dài 8-20 ký tự và chỉ chứa chữ, số, _ hoặc .';
  }

  if (values.password && values.password.toLowerCase() === values.email.toLowerCase()) {
    errors.password = 'Password không được trùng với email đăng nhập';
  }

  if (values.password && !values.currentPassword) {
    errors.currentPassword = 'Nhập mật khẩu hiện tại để xác nhận đổi mật khẩu';
  }

  if (values.password && (values.password.length < 8 || values.password.length > 20)) {
    errors.password = 'Password phải có độ dài 8-20 ký tự';
  }

  if (values.password && !values.confirmPassword) {
    errors.confirmPassword = 'Vui lòng xác nhận lại mật khẩu';
  }

  if (values.password && values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
  }

  if (!values.password && values.confirmPassword) {
    errors.confirmPassword = 'Hãy nhập mật khẩu trước khi xác nhận';
  }

  return errors;
}

export default function UserProfilePage() {
  const [form, setForm] = useState(defaultValues);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [savedProfile, setSavedProfile] = useState(defaultValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    let active = true;
    getProfile()
      .then((profile) => {
        if (!active) return;
        const values = { ...defaultValues, ...profile };
        setForm(values);
        setSavedProfile(values);
      })
      .catch((error) => {
        if (active) setRequestError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const updateField = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateProfile(form);
    setErrors(nextErrors);
    setSubmitted(true);
    setRequestError('');

    if (hasErrors(nextErrors)) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        displayName: form.displayName,
        currentPassword: form.currentPassword,
        password: form.password,
      });
      const nextProfile = { ...defaultValues, ...updated };
      setSavedProfile(nextProfile);
      setForm(nextProfile);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(savedProfile);
    setErrors({});
    setRequestError('');
    setSubmitted(false);
  };

  if (loading) return <div className="container py-5 text-center">Đang tải hồ sơ...</div>;

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
                <div>
                  <p className="text-uppercase text-muted small mb-1">Profile</p>
                  <h2 className="mb-0">User Profile</h2>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                    {form.avatar
                      ? <img src={form.avatar} alt="" className="rounded-circle w-100 h-100 object-fit-cover" />
                      : <span className="fw-bold text-secondary">{form.displayName.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div>
                    <div className="fw-semibold">{form.displayName}</div>
                    <div className="text-muted small">{form.email}</div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="row g-3">
                  <div className="col-md-6">
                    <TextField
                      label="Display name"
                      value={form.displayName}
                      onChange={updateField('displayName')}
                      maxLength={20}
                      error={errors.displayName}
                      placeholder="Nhập display name"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <TextField label="Email" type="email" value={form.email} disabled />
                </div>

                <div className="row g-3 mt-1">
                  <div className="col-md-6">
                    <PasswordField
                      label="Mật khẩu hiện tại"
                      value={form.currentPassword}
                      onChange={updateField('currentPassword')}
                      autoComplete="current-password"
                      hint="Bắt buộc khi đổi mật khẩu"
                      error={errors.currentPassword}
                    />
                  </div>
                  <div className="col-md-6">
                    <PasswordField
                      label="Password"
                      value={form.password}
                      onChange={updateField('password')}
                      autoComplete="new-password"
                      hint="Bỏ trống nếu không đổi mật khẩu"
                      error={errors.password}
                    />
                  </div>
                  <div className="col-md-6">
                    <PasswordField
                      label="Confirm password"
                      value={form.confirmPassword}
                      onChange={updateField('confirmPassword')}
                      autoComplete="new-password"
                      hint="Chỉ bắt buộc khi đổi mật khẩu"
                      error={errors.confirmPassword}
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="button" className="btn btn-outline-secondary" onClick={handleCancel} disabled={saving}>Huỷ</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
                </div>

                {requestError && <div className="alert alert-danger mt-4 mb-0" role="alert">{requestError}</div>}
                {submitted && Object.keys(errors).length === 0 && (
                  !requestError && !saving && <div className="alert alert-success mt-4 mb-0">Thông tin hồ sơ đã được lưu.</div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
