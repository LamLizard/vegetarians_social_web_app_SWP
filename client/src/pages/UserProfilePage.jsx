import { useEffect, useState } from 'react';
import {
  Avatar, Button, ChipInput, ConfirmDialog, ImageUpload, Notice, PasswordField, Select, Tabs, TextField,
} from '../components'; /* Duy's code: Dùng component kit cho hồ sơ tài khoản và sức khỏe. */
import {
  getHealthProfile, getProfile, removeAvatar, saveHealthProfile, updateProfile, uploadAvatar,
} from '../services/user.service';
import { hasErrors } from '../utils/validate';
import { calcHealth } from '../utils/health';
import styles from './UserProfilePage.module.css'; /* Duy's code: Áp dụng màu theme riêng cho hồ sơ. */

const FULL_NAME_REGEX = /^[\p{L}\p{M}]+(?:[ .,'’-]+[\p{L}\p{M}]+)*$/u; /* Duy's code: Cho phép họ tên có chữ Unicode và dấu tiếng Việt. */

const normalizeFullName = (value) => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' '); /* Duy's code: Chuẩn hoá khoảng trắng và dấu trước khi gửi API. */
const emptyHealthForm = {
  gender: '',
  dateOfBirth: '',
  heightCm: '',
  weightKg: '',
  activityLevel: '',
  healthGoal: '',
  allergies: [],
};

// Duy's code: Chuyển hồ sơ API về dạng input editable, gồm cả dị ứng dạng chip.
const toHealthForm = (profile) => ({
  ...emptyHealthForm,
  ...profile,
  dateOfBirth: profile?.dateOfBirth?.slice(0, 10) || '',
  heightCm: profile?.heightCm ?? '',
  weightKg: profile?.weightKg ?? '',
  allergies: (profile?.allergies || []).map((allergy) => allergy.name),
});

// Duy's code: Tính tuổi đủ năm theo sinh nhật để gửi đầu vào nhất quán lên preview.
function ageFromDate(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth()
    || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

const defaultValues = {
  fullName: '', /* Duy's code: Dùng fullName tương ứng với account.full_name. */
  avatar: '',
  email: '',
  currentPassword: '',
  password: '',
  confirmPassword: '',
};

function validateProfile(values) { /* Duy's code: Chỉ xác thực các trường tài khoản được phép chỉnh sửa. */
  const errors = {};

  const fullName = normalizeFullName(values.fullName); /* Duy's code: Kiểm tra tên sau khi chuẩn hoá. */
  if ([...fullName].length < 2 || [...fullName].length > 20 || !FULL_NAME_REGEX.test(fullName)) { /* Duy's code: Kiểm tra độ dài và định dạng theo quy tắc tên. */
    errors.fullName = 'Họ và tên phải dài 2-20 ký tự, chỉ gồm chữ, khoảng trắng và dấu phân cách tên hợp lệ.'; /* Duy's code: Hiển thị lỗi phù hợp với tên đầy đủ. */
  }

  if (values.password && values.password.toLowerCase() === String(values.email ?? '').toLowerCase()) { /* Duy's code: Không cho mật khẩu mới trùng email đăng nhập đã khóa. */
    errors.password = 'Password không được trùng với email đăng nhập';
  }

  if (values.password && /\s/u.test(values.password)) { /* Duy's code: Cấm khoảng trắng trong mật khẩu mới. */
    errors.password = 'Mật khẩu mới không được chứa khoảng trắng.'; /* Duy's code: Báo lỗi ngay tại ô mật khẩu mới. */
  }

  if (values.confirmPassword && /\s/u.test(values.confirmPassword)) { /* Duy's code: Cấm khoảng trắng trong ô xác nhận mật khẩu mới. */
    errors.confirmPassword = 'Mật khẩu xác nhận không được chứa khoảng trắng.'; /* Duy's code: Báo lỗi ngay tại ô xác nhận. */
  }

  if (values.password && !values.currentPassword) { /* Duy's code: Chỉ yêu cầu xác nhận mật khẩu khi đổi mật khẩu. */
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

function ProfileBackNavigation() { /* Duy's code: Thanh điều hướng quay lại Bảng tin User. */
  return (
    <nav className="mb-3" aria-label="Điều hướng User"> {/* Duy's code: Cung cấp landmark điều hướng có thể truy cập. */}
      <Button as="a" href="/feed" variant="outline" icon="arrow-left">Quay lại bảng tin</Button> {/* Duy's code: Mở lại trang Bảng tin User. */}
    </nav>
  );
}

export default function UserProfilePage() {
  const [activeTab, setActiveTab] = useState('account');
  const [form, setForm] = useState(defaultValues);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [savedProfile, setSavedProfile] = useState(defaultValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [avatarNotice, setAvatarNotice] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [healthForm, setHealthForm] = useState(emptyHealthForm);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthError, setHealthError] = useState('');
  const [healthNotice, setHealthNotice] = useState('');
  const [ageWarningOpen, setAgeWarningOpen] = useState(false);
  const [ageWarningAcceptedDob, setAgeWarningAcceptedDob] = useState('');

  const healthPreview = calcHealth({
    gender: healthForm.gender,
    age: ageFromDate(healthForm.dateOfBirth),
    heightCm: healthForm.heightCm,
    weightKg: healthForm.weightKg,
    activityLevel: healthForm.activityLevel,
    goal: healthForm.healthGoal,
  });

  // Duy's code: Tải hồ sơ tài khoản khi mở trang và bỏ qua cập nhật khi unmount.
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

  // Duy's code: Tải hồ sơ sức khỏe cho tab User Profile.
  useEffect(() => {
    let active = true;
    getHealthProfile()
      .then((result) => {
        if (!active) return;
        if (result.profile) {
          setHealthForm(toHealthForm(result.profile));
        }
      })
      .catch((error) => {
        if (active) setHealthError(error.message);
      })
      .finally(() => {
        if (active) setHealthLoading(false);
      });
    return () => { active = false; };
  }, []);

  const updateField = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Duy's code: Gọi service upload Cloudinary rồi đồng bộ avatar mới vào state trang.
  const handleAvatarUpload = async (file, options) => {
    setAvatarBusy(true);
    setRequestError('');
    setAvatarNotice('');
    try {
      const result = await uploadAvatar(file, options);
      setForm((current) => ({ ...current, avatar: result.avatar }));
      setSavedProfile((current) => ({ ...current, avatar: result.avatar }));
      if (result.cleanupWarning) setAvatarNotice(result.cleanupWarning);
      return result.avatar;
    } finally {
      setAvatarBusy(false);
    }
  };

  // Duy's code: Gọi backend gỡ avatar khi người dùng xóa ảnh hiện tại.
  const handleAvatarChange = async (avatar) => {
    if (avatar) return;
    setAvatarBusy(true);
    setRequestError('');
    setAvatarNotice('');
    try {
      const updated = await removeAvatar();
      setForm((current) => ({ ...current, avatar: updated.avatar || '' }));
      setSavedProfile((current) => ({ ...current, avatar: updated.avatar || '' }));
      if (updated.cleanupWarning) setAvatarNotice(updated.cleanupWarning);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setAvatarBusy(false);
    }
  };

  // Duy's code: Cập nhật trường sức khỏe và xóa thông báo lỗi cũ khi sửa dữ liệu.
  const updateHealthField = (field) => (value) => {
    setHealthForm((current) => ({ ...current, [field]: value }));
    setHealthError('');
    setHealthNotice('');
  };

  // Duy's code: Lưu hồ sơ sau khi hoàn tất xác nhận cảnh báo tuổi nếu cần.
  const saveHealthForm = async (ageWarningAccepted = false) => {
    setHealthError('');
    setHealthNotice('');
    setHealthSaving(true);
    try {
      const result = await saveHealthProfile({
        ...healthForm,
        ageWarningAccepted,
      });
      setHealthForm(toHealthForm(result.profile));
      setHealthNotice('Hồ sơ sức khỏe đã được lưu.');
    } catch (error) {
      setHealthError(error.message);
    } finally {
      setHealthSaving(false);
    }
  };

  // Duy's code: Yêu cầu người dưới 18 xác nhận cảnh báo trước khi gửi hồ sơ lên server.
  const handleHealthSubmit = async (event) => {
    event.preventDefault();
    setHealthError('');
    setHealthNotice('');
    const age = ageFromDate(healthForm.dateOfBirth);
    const isMinor = age !== null && age < 18;
    if (isMinor && ageWarningAcceptedDob !== healthForm.dateOfBirth) {
      setAgeWarningOpen(true);
      return;
    }
    await saveHealthForm(isMinor);
  };

  // Duy's code: Chỉ cho tiếp tục lưu sau khi người dùng xác nhận cảnh báo dưới 18 tuổi.
  const handleAgeWarningConfirm = async () => {
    const dateOfBirth = healthForm.dateOfBirth;
    setAgeWarningAcceptedDob(dateOfBirth);
    setAgeWarningOpen(false);
    await saveHealthForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedForm = { ...form, fullName: normalizeFullName(form.fullName) }; /* Duy's code: Chuẩn hoá họ tên trước khi validate và lưu. */
    const nextErrors = validateProfile(normalizedForm); /* Duy's code: Kiểm tra các trường hồ sơ có thể thay đổi. */
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
        currentPassword: form.currentPassword,
        password: form.password,
        confirmPassword: form.confirmPassword, /* Duy's code: Gửi mật khẩu xác nhận để backend cũng kiểm tra. */
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

  if (loading) return (
    <div className={`container py-4 ${styles.page}`}>
      <ProfileBackNavigation /> {/* Duy's code: Luôn hiển thị đường quay lại khi dữ liệu đang tải. */}
      <div className="py-4 text-center">Đang tải hồ sơ...</div>
    </div>
  );

  return (
    <div className={`container py-4 ${styles.page}`}>
      <ProfileBackNavigation /> {/* Duy's code: Hiển thị thanh quay lại phía trên trang hồ sơ. */}
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className={`card shadow-sm border-0 ${styles.card}`}>
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
                <div>
                  <p className={`text-uppercase small mb-1 ${styles.eyebrow}`}>Profile</p>
                  <h2 className={`mb-0 ${styles.title}`}>User Profile</h2>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <Avatar src={form.avatar} name={form.fullName} size={56} className={styles.avatar} />
                  <div>
                    <div className="fw-semibold">{form.fullName}</div> {/* Duy's code: Hiển thị full name lấy từ DB. */}
                    <div className={`small ${styles.muted}`}>{form.email}</div>
                  </div>
                </div>
              </div>

              {/* Duy's code: Chuyển giữa thông tin tài khoản và hồ sơ sức khỏe. */}
              <Tabs
                items={[
                  { key: 'account', label: 'Thông tin tài khoản', icon: 'person' },
                  { key: 'health', label: 'Hồ sơ sức khỏe', icon: 'heart-pulse' },
                ]}
                value={activeTab}
                onChange={setActiveTab}
                label="Các phần hồ sơ"
              />

              {/* Duy's code: Tab tài khoản chứa ảnh đại diện và thông tin đăng nhập. */}
              {activeTab === 'account' && (
              <section role="tabpanel" aria-label="Thông tin tài khoản">
              <ImageUpload
                label="Ảnh đại diện"
                value={form.avatar}
                onChange={handleAvatarChange}
                onUpload={handleAvatarUpload}
                maxSizeMB={5}
                accept="image/jpeg,image/png,image/webp"
                ratio="1/1"
                disabled={avatarBusy}
                className="mt-4 mb-4"
              />
              {avatarNotice && <Notice tone="info" className="mb-3">{avatarNotice}</Notice>}

              <form onSubmit={handleSubmit} noValidate>
                <div className="row g-3">
                  <div className="col-md-6">
                    <TextField
                      label="Họ và tên hiển thị" /* Duy's code: Thể hiện đây là tên thật hiển thị, không phải email đăng nhập. */
                      value={form.fullName} /* Duy's code: Liên kết ô tên với account.full_name. */
                      onChange={updateField('fullName')} /* Duy's code: Cập nhật trường fullName trong form. */
                      maxLength={20} /* Duy's code: Giới hạn tên theo quy tắc hồ sơ 2-20 ký tự. */
                      error={errors.fullName} /* Duy's code: Hiển thị lỗi xác thực họ tên. */
                      placeholder="Ví dụ: Nguyễn Thảo Linh" /* Duy's code: Minh hoạ họ tên có dấu và khoảng trắng. */
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <TextField
                    label="Email đăng nhập"
                    type="email"
                    value={form.email}
                    readOnly
                    autoComplete="email"
                    hint="Email được cố định từ khi tạo tài khoản và không thể chỉnh sửa tại Hồ sơ."
                  /> {/* Duy's code: Chỉ hiển thị email tài khoản; không cho sửa từ trang Profile. */}
                </div>

                <div className="d-flex flex-column gap-3 mt-3">
                  <div>
                    <PasswordField
                      label="Mật khẩu mới"
                      value={form.password}
                      onChange={updateField('password')}
                      autoComplete="new-password"
                      hint="Không dùng khoảng trắng. Bỏ trống nếu không đổi mật khẩu"
                      error={errors.password}
                    />
                  </div>
                  <div>
                    <PasswordField
                      label="Xác nhận mật khẩu mới"
                      value={form.confirmPassword}
                      onChange={updateField('confirmPassword')}
                      autoComplete="new-password"
                      hint="Không dùng khoảng trắng. Chỉ bắt buộc khi đổi mật khẩu"
                      error={errors.confirmPassword}
                    />
                  </div>
                  <div>
                    <PasswordField
                      label="Mật khẩu hiện tại"
                      value={form.currentPassword}
                      onChange={updateField('currentPassword')}
                      autoComplete="current-password"
                      hint="Bắt buộc khi đổi mật khẩu"
                      error={errors.currentPassword}
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="button" className="btn btn-outline-secondary" onClick={handleCancel} disabled={saving}>Huỷ</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
                </div>

                {requestError && <div className={`alert mt-4 mb-0 ${styles.errorAlert}`} role="alert">{requestError}</div>}
                {submitted && Object.keys(errors).length === 0 && (
                  !requestError && !saving && <div className={`alert mt-4 mb-0 ${styles.successAlert}`}>Thông tin hồ sơ đã được lưu.</div>
                )}
              </form>
              </section>
              )}

              {/* Duy's code: Tab sức khỏe cho Member quản lý thông tin và chỉ số cá nhân. */}
              {activeTab === 'health' && (
              <section role="tabpanel" aria-label="Hồ sơ sức khỏe" className="pt-4">
                <h3 className="h5">Hồ sơ sức khỏe</h3>
                <p className="text-body-secondary">
                  Thông tin này là riêng tư, chỉ dùng cho tài khoản của bạn. Trường không bắt buộc; chỉ số sẽ không được ước tính nếu thiếu dữ liệu cần thiết.
                </p>
                {healthError && <Notice tone="alert" title="Không thể xử lý hồ sơ sức khỏe" className="mb-3">{healthError}</Notice>}
                {healthNotice && <Notice tone="success" className="mb-3">{healthNotice}</Notice>}
                {/* Duy's code: Hiển thị form sức khỏe sau khi tải xong hồ sơ. */}
                {healthLoading ? (
                  <p role="status">Đang tải hồ sơ sức khỏe...</p>
                ) : (
                  <form className={styles.healthFormLayout} onSubmit={handleHealthSubmit} noValidate>
                    <div className={styles.healthLayout}>
                      <section className={styles.healthPanel} aria-labelledby="health-basics-title">
                        <h4 id="health-basics-title" className="h6 mb-3">Thông tin cơ bản</h4>
                        <fieldset className="border-0 p-0 m-0">
                          <div className={styles.healthFieldRow}>
                            <label className={styles.healthFieldLabel} htmlFor="health-gender">Giới tính</label>
                            <Select
                              id="health-gender"
                              value={healthForm.gender}
                              onChange={updateHealthField('gender')}
                              placeholder="Chọn"
                              options={[
                                { value: 'male', label: 'Nam' },
                                { value: 'female', label: 'Nữ' },
                                { value: 'other', label: 'Khác / không muốn chọn công thức' },
                              ]}
                              hint="Chỉ dùng để chọn công thức ước tính năng lượng."
                            />
                          </div>
                          <div className={styles.healthFieldRow}>
                            <label className={styles.healthFieldLabel} htmlFor="health-date-of-birth">Ngày sinh</label>
                            <TextField
                              id="health-date-of-birth"
                              type="date"
                              value={healthForm.dateOfBirth}
                              onChange={updateHealthField('dateOfBirth')}
                              max={new Date().toISOString().slice(0, 10)}
                            />
                          </div>
                          <div className={styles.healthFieldRow}>
                            <label className={styles.healthFieldLabel} htmlFor="health-height">Chiều cao</label>
                            <TextField
                              id="health-height"
                              type="number"
                              value={healthForm.heightCm}
                              onChange={updateHealthField('heightCm')}
                              min="0.01"
                              max="999.99"
                              step="0.01"
                              suffix="cm"
                            />
                          </div>
                          <div className={styles.healthFieldRow}>
                            <label className={styles.healthFieldLabel} htmlFor="health-weight">Cân nặng</label>
                            <TextField
                              id="health-weight"
                              type="number"
                              value={healthForm.weightKg}
                              onChange={updateHealthField('weightKg')}
                              min="0.01"
                              max="999.99"
                              step="0.01"
                              suffix="kg"
                            />
                          </div>
                        </fieldset>

                        <div className="border-top mt-3 pt-3">
                          <h5 className="h6">Vận động và mục tiêu</h5>
                          <p className="small text-body-secondary">
                            Chọn mức gần với sinh hoạt thường ngày; đây chỉ là ước lượng, không cần tính số buổi thật chính xác.
                          </p>
                          <Select
                            label="Mức vận động"
                            value={healthForm.activityLevel}
                            onChange={updateHealthField('activityLevel')}
                            placeholder="Chọn mức vận động"
                            options={[
                              { value: 'sedentary', label: 'Ít — chủ yếu ngồi, ít đi bộ/tập' },
                              { value: 'light', label: 'Nhẹ — hoạt động nhẹ hoặc tập nhẹ vài buổi/tuần' },
                              { value: 'moderate', label: 'Vừa — tập vừa khoảng 3–5 buổi/tuần' },
                              { value: 'active', label: 'Cao — tập nặng thường xuyên hoặc làm việc thể lực' },
                            ]}
                          />
                          <Select
                            className="mt-3"
                            label="Mục tiêu"
                            value={healthForm.healthGoal}
                            onChange={updateHealthField('healthGoal')}
                            placeholder="Chọn mục tiêu"
                            options={[
                              { value: 'lose_weight', label: 'Giảm cân' },
                              { value: 'maintain', label: 'Duy trì cân nặng' },
                              { value: 'gain_muscle', label: 'Tăng cơ' },
                            ]}
                          />
                          <div className="mt-3">
                            <ChipInput
                              label="Dị ứng / thực phẩm cần kiêng"
                              value={healthForm.allergies}
                              onChange={updateHealthField('allergies')}
                              max={50}
                              maxLength={120}
                              placeholder="Nhập tên rồi nhấn Enter"
                              hint="Được lưu trong hồ sơ; hiện chưa tự động lọc món ăn."
                            />
                          </div>
                        </div>
                      </section>

                      <section className={styles.healthPanel} aria-labelledby="health-results-title" aria-live="polite">
                        <h4 id="health-results-title" className="h6 mb-1">Chỉ số sức khỏe ước tính</h4>
                        <p className="small text-body-secondary mb-3">
                          Các kết quả thay đổi theo thông tin bạn nhập.
                        </p>
                        <div className={styles.healthResultsLayout}>
                          <div>
                            <div className={styles.healthMetricRow}>
                              <strong>BMI</strong>
                              <p className={styles.healthMetricValue}>
                                {healthPreview.bmi == null
                                  ? 'Chưa tính được: cần chiều cao và cân nặng.'
                                  : `${healthPreview.bmi} — ${({
                                    underweight: 'thấp',
                                    normal: 'trong khoảng tham khảo',
                                    overweight: 'cao',
                                    obese: 'rất cao',
                                  })[healthPreview.bmiCategory]}`}
                              </p>
                            </div>
                            <div className={styles.healthMetricRow}>
                              <strong>BMR</strong>
                              <p className={styles.healthMetricValue}>
                                {healthPreview.bmr == null
                                  ? 'Chưa tính được: cần ngày sinh và thông tin cơ thể phù hợp.'
                                  : `Khoảng ${healthPreview.bmr} kcal/ngày`}
                              </p>
                            </div>
                            <div className={styles.healthMetricRow}>
                              <strong>TDEE</strong>
                              <p className={styles.healthMetricValue}>
                                {healthPreview.tdee == null
                                  ? 'Chưa tính được: cần BMR và mức vận động.'
                                  : `Khoảng ${healthPreview.tdee} kcal/ngày`}
                              </p>
                            </div>
                            <div className={styles.healthMetricRow}>
                              <strong>Mục tiêu calo</strong>
                              <p className={styles.healthMetricValue}>
                                {healthPreview.targetCalories == null
                                  ? 'Chưa tính được: cần TDEE và mục tiêu.'
                                  : `Khoảng ${healthPreview.targetCalories} kcal/ngày`}
                              </p>
                            </div>
                          </div>

                          <aside className={styles.healthExplanation} aria-label="Giải thích các chỉ số">
                            <h5 className="h6">Giải thích đơn giản</h5>
                            <p className="small">
                              <strong>BMI</strong> so sánh cân nặng với chiều cao. Nhóm BMI chỉ để tham khảo cho người lớn, không phải chẩn đoán.
                            </p>
                            <p className="small">
                              <strong>BMR</strong> là năng lượng cơ thể ước tính cần khi nghỉ ngơi.
                            </p>
                            <p className="small">
                              <strong>TDEE</strong> là năng lượng ước tính tiêu hao trong ngày, đã tính mức vận động; không có nghĩa bạn bắt buộc phải ăn đúng con số đó.
                            </p>
                            <p className="small mb-0">
                              <strong>Mục tiêu calo</strong> là TDEE được điều chỉnh theo lựa chọn của bạn: giảm cân giảm 15%, duy trì giữ nguyên, tăng cơ cộng 200 kcal. Đây là ước tính, không cam kết kết quả.
                            </p>
                          </aside>
                        </div>
                        {healthForm.gender === 'other' && (
                          <Notice tone="info" className="mt-3">
                            BMI vẫn tính được khi đủ chiều cao và cân nặng. Ứng dụng không tự chọn công thức nam/nữ nên BMR, TDEE và mục tiêu calo sẽ để trống.
                          </Notice>
                        )}
                      </section>
                    </div>

                    <Notice tone="info" title="Thông tin hồ sơ sức khỏe" className="mt-3">
                      Thông tin bạn lưu sẽ được giữ trong hồ sơ tài khoản để hiển thị và tính các chỉ số tham khảo; các chỉ số này không thay thế tư vấn y tế.
                    </Notice>

                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
                      <Button
                        type="submit"
                        loading={healthSaving}
                        disabled={healthSaving}
                      >
                        Lưu hồ sơ sức khỏe
                      </Button>
                    </div>
                  </form>
                )}
              </section>
              )}

              <ConfirmDialog
                open={ageWarningOpen}
                title="Lưu ý về chỉ số sức khỏe"
                message="Bạn chưa đủ 18 tuổi , công thức năng lượng và chỉ số BMI có thể bị áp dụng sai cho trẻ vị thành niên . Thông tin chỉ mang tính tham khảo !"
                confirmLabel="Tôi đã hiểu, tiếp tục"
                cancelLabel="Quay lại chỉnh sửa"
                tone="primary"
                loading={healthSaving}
                onConfirm={handleAgeWarningConfirm}
                onCancel={() => setAgeWarningOpen(false)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
