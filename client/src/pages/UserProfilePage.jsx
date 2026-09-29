import { useEffect, useState } from 'react';
import { PasswordField, TextField } from '../components';
import { getProfile, updateProfile } from '../services/user.service';
import { hasErrors } from '../utils/validate';

const FULL_NAME_REGEX = /^[\p{L}\p{M}]+(?:[ .,'’\-]+[\p{L}\p{M}]+)*$/u; /* Duy's code: Cho phép họ tên có chữ Unicode và dấu tiếng Việt. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/; /* Duy's code: Áp dụng đúng định dạng email đã thống nhất. */

const normalizeFullName = (value) => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' '); /* Duy's code: Chuẩn hoá khoảng trắng và dấu trước khi gửi API. */
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase(); /* Duy's code: Chuẩn hoá email để so sánh và lưu nhất quán. */

const defaultValues = {
  fullName: '', /* Duy's code: Dùng fullName tương ứng với account.full_name. */
  avatar: '',
  email: '',
  currentPassword: '',
  password: '',
  confirmPassword: '',
};

function validateProfile(values, savedEmail) { /* Duy's code: So sánh email mới với email hiện đang lưu. */
  const errors = {};
  const email = normalizeEmail(values.email); /* Duy's code: Xác thực email sau khi bỏ khoảng trắng. */
  const emailChanged = email !== normalizeEmail(savedEmail); /* Duy's code: Chỉ yêu cầu mật khẩu khi email thực sự đổi. */

  if (!EMAIL_REGEX.test(email)) { /* Duy's code: Kiểm tra email theo regex đã yêu cầu. */
    errors.email = 'Email chưa đúng định dạng, ví dụ ten@gmail.com'; /* Duy's code: Báo lỗi định dạng email. */
  }

  const fullName = normalizeFullName(values.fullName); /* Duy's code: Kiểm tra tên sau khi chuẩn hoá. */
  if ([...fullName].length < 2 || [...fullName].length > 120 || !FULL_NAME_REGEX.test(fullName)) { /* Duy's code: Kiểm tra độ dài và định dạng theo cột full_name. */
    errors.fullName = 'Họ và tên phải dài 2-120 ký tự, chỉ gồm chữ, khoảng trắng và dấu phân cách tên hợp lệ.'; /* Duy's code: Hiển thị lỗi phù hợp với tên đầy đủ. */
  }

  if (values.password && values.password.toLowerCase() === email) { /* Duy's code: Không cho mật khẩu mới trùng email đã chuẩn hoá. */
    errors.password = 'Password không được trùng với email đăng nhập';
  }

  if ((emailChanged || values.password) && !values.currentPassword) { /* Duy's code: Xác nhận mật khẩu khi đổi email hoặc mật khẩu. */
    errors.currentPassword = 'Nhập mật khẩu hiện tại để xác nhận thay đổi'; /* Duy's code: Hiển thị yêu cầu xác nhận. */
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
    const normalizedForm = { ...form, fullName: normalizeFullName(form.fullName), email: normalizeEmail(form.email) }; /* Duy's code: Chuẩn hoá tên và email trước khi validate và lưu. */
    const nextErrors = validateProfile(normalizedForm, savedProfile.email); /* Duy's code: Kiểm tra email đổi so với hồ sơ đã lưu. */
    setErrors(nextErrors);
    setSubmitted(true);
    setRequestError('');

    if (hasErrors(nextErrors)) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        fullName: normalizedForm.fullName, /* Duy's code: Gửi fullName thay vì displayName/username. */
        email: normalizedForm.email, /* Duy's code: Gửi email mới để backend cập nhật DB. */
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
                      : <span className="fw-bold text-secondary">{form.fullName.slice(0, 1).toUpperCase()}</span> /* Duy's code: Lấy chữ đầu từ họ tên để tạo avatar dự phòng. */}
                  </div>
                  <div>
                    <div className="fw-semibold">{form.fullName}</div> {/* Duy's code: Hiển thị full name lấy từ DB. */}
                    <div className="text-muted small">{form.email}</div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="row g-3">
                  <div className="col-md-6">
                    <TextField
                      label="Họ và tên hiển thị" /* Duy's code: Thể hiện đây là tên thật hiển thị, không phải email đăng nhập. */
                      value={form.fullName} /* Duy's code: Liên kết ô tên với account.full_name. */
                      onChange={updateField('fullName')} /* Duy's code: Cập nhật trường fullName trong form. */
                      maxLength={120} /* Duy's code: Khớp giới hạn cột full_name VARCHAR(120). */
                      error={errors.fullName} /* Duy's code: Hiển thị lỗi xác thực họ tên. */
                      placeholder="Ví dụ: Nguyễn Thảo Linh" /* Duy's code: Minh hoạ họ tên có dấu và khoảng trắng. */
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <TextField label="Email" type="email" value={form.email} onChange={updateField('email')} error={errors.email} autoComplete="email" /> {/* Duy's code: Cho phép cập nhật email trong hồ sơ. */}
                </div>

                <div className="row g-3 mt-1">
                  <div className="col-md-6">
                    <PasswordField
                      label="Mật khẩu hiện tại"
                      value={form.currentPassword}
                      onChange={updateField('currentPassword')}
                      autoComplete="current-password"
                      hint="Bắt buộc khi đổi email hoặc mật khẩu"
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
