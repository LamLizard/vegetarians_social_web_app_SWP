import { useEffect, useRef, useState } from 'react';
import {
  Button, ConfirmDialog, ImageUpload, Modal, Notice, PasswordField, Select, Tabs, TextField,
} from '../components'; /* Duy's code: Dùng component kit cho hồ sơ tài khoản và sức khỏe. */
import {
  deleteHealthProfile, getHealthProfile, getProfile, removeAvatar, saveHealthProfile, updateProfile, uploadAvatar,
} from '../services/user.service';
import Avatar from '../components/Avatar/Avatar';
import AllergyIngredientPicker from '../components/AllergyIngredientPicker/AllergyIngredientPicker';
import { hasErrors } from '../utils/validate';
import { calcHealth } from '../utils/health';
import styles from './UserProfilePage.module.css'; /* Duy's code: Áp dụng màu theme riêng cho hồ sơ. */

const FULL_NAME_REGEX = /^[\p{L}\p{M}]+(?:[ .,'’-]+[\p{L}\p{M}]+)*$/u; /* Duy's code: Cho phép họ tên có chữ Unicode và dấu tiếng Việt. */

const normalizeFullName = (value) => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' '); /* Duy's code: Chuẩn hoá khoảng trắng và dấu trước khi gửi API. */
const DATE_OF_BIRTH_MIN = '1900-01-01';
const DATE_OF_BIRTH_ERROR = 'Ngày sinh phải từ 01/01/1900 đến hôm nay.';
const DATE_OF_BIRTH_PARTIAL_ERROR = 'Nhập đầy đủ ngày, tháng và năm sinh.';
const emptyDateOfBirthParts = { day: '', month: '', year: '' };

function todayInHoChiMinh() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function validateDateOfBirth(value, today) {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return 'Ngày sinh không hợp lệ.';

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12) return 'Ngày sinh không hợp lệ.';
  if (day < 1 || day > daysInMonth[month - 1]) {
    return `Ngày sinh không hợp lệ: tháng ${month} năm ${year} không có ngày ${day}.`;
  }
  if (value < DATE_OF_BIRTH_MIN || value > today) return DATE_OF_BIRTH_ERROR;
  return '';
}

function splitDateOfBirth(value) {
  if (!value) return emptyDateOfBirthParts;
  const [year = '', month = '', day = '', ...remaining] = String(value).split('-');
  if (remaining.length || !/^\d{4}$/u.test(year) || !/^\d{2}$/u.test(month) || !/^\d{2}$/u.test(day)) {
    return emptyDateOfBirthParts;
  }
  return { day: String(Number(day)), month: String(Number(month)), year };
}

function dateOfBirthValue(parts) {
  if (!parts.day || !parts.month || !parts.year) return '';
  return `${parts.year}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}`;
}

function validateDateOfBirthParts(parts, today) {
  const { day, month, year } = parts;
  if (!day && !month && !year) return { error: '', focusField: null };

  const firstMissing = ['day', 'month', 'year'].find((field) => !parts[field]);
  if (firstMissing) return { error: DATE_OF_BIRTH_PARTIAL_ERROR, focusField: firstMissing };
  if (!/^\d{4}$/u.test(year)) return { error: 'Năm sinh phải gồm 4 chữ số.', focusField: 'year' };

  const value = dateOfBirthValue(parts);
  const error = validateDateOfBirth(value, today);
  if (!error) return { error: '', focusField: null };
  const focusField = error === DATE_OF_BIRTH_ERROR ? 'year' : 'day';
  return { error, focusField };
}

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

// Duy's code: Tính tuổi đủ năm từ chuỗi ngày sinh để preview khớp ngày hiện tại tại Việt Nam.
function ageFromDate(dateOfBirth, today) {
  if (!dateOfBirth) return null;
  if (validateDateOfBirth(dateOfBirth, today)) return null;
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  let age = todayYear - birthYear;
  if (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay)) age -= 1;
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

function scrollToSavedBanner(bannerRef) {
  const frameId = window.requestAnimationFrame(() => {
    const banner = bannerRef.current;
    if (!banner) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    banner.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    banner.focus({ preventScroll: true });
  });
  return () => window.cancelAnimationFrame(frameId);
}

function summarizeErrors(messages, fallback = '') {
  const errors = Array.isArray(messages)
    ? messages.filter((message) => typeof message === 'string' && message.trim())
    : [];
  const allErrors = errors.length ? errors : (fallback ? [fallback] : []);
  const visibleErrors = allErrors.slice(0, 3);
  const summary = visibleErrors.join(' ');
  const remaining = allErrors.length - visibleErrors.length;
  return remaining > 0 ? `${summary} và ${remaining} lỗi khác.` : summary;
}

function normalizeOptionalMeasurement(value) {
  const text = String(value ?? '').trim();
  return text ? text.replace(',', '.') : '';
}

function validateMeasurement(value, label, unit, min, max) {
  const normalized = normalizeOptionalMeasurement(value);
  if (!normalized) return '';
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(normalized)) {
    return `${label} phải là số từ ${min} đến ${max} ${unit}.`;
  }
  const number = Number(normalized);
  return Number.isFinite(number) && number >= min && number <= max
    ? ''
    : `${label} phải là số từ ${min} đến ${max} ${unit}.`;
}

function normalizeAllergies(allergies = []) {
  return allergies
    .map((name) => (typeof name === 'string' ? name.normalize('NFC').trim().replace(/\s+/gu, ' ') : ''))
    .filter(Boolean)
    .filter((name, index, items) => items.findIndex(
      (candidate) => candidate.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'),
    ) === index);
}

function validateAllergies(allergies) {
  if (!Array.isArray(allergies) || allergies.length > 50) return 'Chọn tối đa 50 mục dị ứng.';
  if (allergies.some((name) => typeof name !== 'string')) return 'Tên dị ứng phải là nội dung dạng chữ.';
  if (allergies.some((name) => [...name].length > 120)) return 'Tên dị ứng không được vượt quá 120 ký tự.';
  return '';
}

function validateProfile(values) { /* Duy's code: Chỉ xác thực các trường tài khoản được phép chỉnh sửa. */
  const errors = {};

  const fullName = normalizeFullName(values.fullName); /* Duy's code: Kiểm tra tên sau khi chuẩn hoá. */
  if ([...fullName].length < 2 || [...fullName].length > 30 || !FULL_NAME_REGEX.test(fullName)) { /* Duy's code: Kiểm tra độ dài và định dạng theo quy tắc tên. */
    errors.fullName = 'Họ và tên phải dài 2-30 ký tự, chỉ gồm chữ, khoảng trắng và dấu phân cách tên hợp lệ.'; /* Duy's code: Hiển thị lỗi phù hợp với tên đầy đủ. */
  }

  if (values.password) {
    if (/\s/u.test(values.password)) {
      errors.password = 'Mật khẩu mới không được chứa khoảng trắng.';
    } else if (values.password.length < 8 || values.password.length > 20) {
      errors.password = 'Password phải có độ dài 8-20 ký tự';
    } else if (values.password.toLowerCase() === String(values.email ?? '').toLowerCase()) {
      errors.password = 'Password không được trùng với email đăng nhập';
    } else if (values.currentPassword && values.password === values.currentPassword) {
      errors.password = 'Mật khẩu mới không được trùng với mật khẩu hiện tại.';
    }

    if (!values.currentPassword) errors.currentPassword = 'Nhập mật khẩu hiện tại để xác nhận thay đổi';
  }

  if (values.confirmPassword) {
    if (/\s/u.test(values.confirmPassword)) {
      errors.confirmPassword = 'Mật khẩu xác nhận không được chứa khoảng trắng.';
    } else if (!values.password) {
      errors.confirmPassword = 'Hãy nhập mật khẩu trước khi xác nhận';
    } else if (values.password !== values.confirmPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }
  } else if (values.password) {
    errors.confirmPassword = 'Vui lòng xác nhận lại mật khẩu';
  }

  return errors;
}

function validateHealthProfile(values, dateParts, today) {
  const errors = {};
  const dateOfBirthError = validateDateOfBirthParts(dateParts, today).error;
  const heightError = validateMeasurement(values.heightCm, 'Chiều cao', 'cm', 50, 250);
  const weightError = validateMeasurement(values.weightKg, 'Cân nặng', 'kg', 10, 500);
  const allergiesError = validateAllergies(values.allergies);
  if (dateOfBirthError) errors.dateOfBirth = dateOfBirthError;
  if (heightError) errors.heightCm = heightError;
  if (weightError) errors.weightKg = weightError;
  if (allergiesError) errors.allergies = allergiesError;
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
  // Meal Plan trỏ thẳng tới tab hồ sơ sức khỏe bằng /profile?tab=health
  const [activeTab, setActiveTab] = useState(() => (
    new URLSearchParams(window.location.search).get('tab') === 'health' ? 'health' : 'account'
  ));
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [form, setForm] = useState(defaultValues);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [savedProfile, setSavedProfile] = useState(defaultValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountSaveResultCount, setAccountSaveResultCount] = useState(0);
  const [accountSaveFeedback, setAccountSaveFeedback] = useState(null);
  const accountFeedbackBannerRef = useRef(null);
  const [requestError, setRequestError] = useState('');
  const [avatarNotice, setAvatarNotice] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [healthForm, setHealthForm] = useState(emptyHealthForm);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthLoadFailed, setHealthLoadFailed] = useState(false);
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthSaveResultCount, setHealthSaveResultCount] = useState(0);
  const [healthSaveFeedback, setHealthSaveFeedback] = useState(null);
  const healthFeedbackBannerRef = useRef(null);
  const [healthDeleting, setHealthDeleting] = useState(false);
  const [healthDeleteOpen, setHealthDeleteOpen] = useState(false);
  const [healthError, setHealthError] = useState('');
  const [healthFieldErrors, setHealthFieldErrors] = useState({});
  const [healthDateParts, setHealthDateParts] = useState(emptyDateOfBirthParts);
  const [healthNotice, setHealthNotice] = useState('');
  const [ageWarningOpen, setAgeWarningOpen] = useState(false);
  const [ageWarningAcceptedDob, setAgeWarningAcceptedDob] = useState('');

  const today = todayInHoChiMinh();
  const healthPreview = calcHealth({
    gender: healthForm.gender,
    age: ageFromDate(healthForm.dateOfBirth, today),
    heightCm: healthForm.heightCm,
    weightKg: healthForm.weightKg,
    activityLevel: healthForm.activityLevel,
    goal: healthForm.healthGoal,
  });

  useEffect(() => {
    if (!accountSaveResultCount || saving || !accountSaveFeedback) return undefined;
    return scrollToSavedBanner(accountFeedbackBannerRef);
  }, [accountSaveResultCount, saving, accountSaveFeedback]);

  useEffect(() => {
    if (!healthSaveResultCount || healthSaving || !healthSaveFeedback) return undefined;
    return scrollToSavedBanner(healthFeedbackBannerRef);
  }, [healthSaveResultCount, healthSaving, healthSaveFeedback]);

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
        setHealthLoadFailed(false);
        if (result.profile) {
          const values = toHealthForm(result.profile);
          setHealthForm(values);
          setHealthDateParts(splitDateOfBirth(values.dateOfBirth));
        }
      })
      .catch((error) => {
        if (active) {
          setHealthLoadFailed(true);
          setHealthError(error.message);
        }
      })
      .finally(() => {
        if (active) setHealthLoading(false);
      });
    return () => { active = false; };
  }, []);

  const retryLoadHealthProfile = async () => {
    setHealthLoading(true);
    setHealthLoadFailed(false);
    setHealthError('');
    try {
      const result = await getHealthProfile();
      const values = result.profile ? toHealthForm(result.profile) : emptyHealthForm;
      setHealthForm(values);
      setHealthDateParts(splitDateOfBirth(values.dateOfBirth));
    } catch (error) {
      setHealthLoadFailed(true);
      setHealthError(error.message);
    } finally {
      setHealthLoading(false);
    }
  };

  const updateField = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitted(false);
    setRequestError('');
    setAccountSaveFeedback(null);
  };

  const validateAccountFieldOnBlur = (field) => {
    const normalizedForm = { ...form, fullName: normalizeFullName(form.fullName) };
    const nextErrors = validateProfile(normalizedForm);
    const fields = field === 'fullName'
      ? ['fullName']
      : ['password', 'confirmPassword', 'currentPassword'];
    setErrors((current) => {
      const next = { ...current };
      fields.forEach((name) => { next[name] = nextErrors[name]; });
      return next;
    });
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
    setHealthFieldErrors((current) => ({ ...current, [field]: undefined }));
    setHealthError('');
    setHealthNotice('');
    setHealthSaveFeedback(null);
  };

  const updateDateOfBirthPart = (field) => (value) => {
    const nextParts = { ...healthDateParts, [field]: value };
    setHealthDateParts(nextParts);
    setHealthForm((current) => ({ ...current, dateOfBirth: dateOfBirthValue(nextParts) }));
    setHealthFieldErrors((current) => ({ ...current, dateOfBirth: undefined }));
    setHealthError('');
    setHealthNotice('');
    setHealthSaveFeedback(null);
  };

  const handleDateOfBirthBlur = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    const { error } = validateDateOfBirthParts(healthDateParts, today);
    setHealthFieldErrors((current) => ({ ...current, dateOfBirth: error || undefined }));
  };

  const validateHealthFieldOnBlur = (field) => {
    const errorsForForm = validateHealthProfile(healthForm, healthDateParts, today);
    setHealthFieldErrors((current) => ({ ...current, [field]: errorsForForm[field] }));
  };

  const confirmDeleteHealthProfile = async () => {
    setHealthDeleting(true);
    setHealthError('');
    setHealthNotice('');
    setHealthSaveFeedback(null);
    try {
      await deleteHealthProfile();
      setHealthForm(emptyHealthForm);
      setHealthDateParts(emptyDateOfBirthParts);
      setHealthFieldErrors({});
      setHealthDeleteOpen(false);
      setHealthNotice('Hồ sơ sức khỏe và danh sách dị ứng đã được xóa.');
    } catch (error) {
      setHealthError(error.message);
    } finally {
      setHealthDeleting(false);
    }
  };

  // Duy's code: Lưu hồ sơ sau khi hoàn tất xác nhận cảnh báo tuổi nếu cần.
  const saveHealthForm = async (ageWarningAccepted = false) => {
    setHealthError('');
    setHealthNotice('');
    setHealthSaveFeedback(null);
    setHealthSaving(true);
    try {
      const result = await saveHealthProfile({
        ...healthForm,
        heightCm: normalizeOptionalMeasurement(healthForm.heightCm),
        weightKg: normalizeOptionalMeasurement(healthForm.weightKg),
        allergies: normalizeAllergies(healthForm.allergies),
        ageWarningAccepted,
      });
      const values = toHealthForm(result.profile);
      setHealthForm(values);
      setHealthDateParts(splitDateOfBirth(values.dateOfBirth));
      setHealthNotice('Hồ sơ sức khỏe đã được lưu.');
      setHealthSaveFeedback({ type: 'success' });
      setHealthSaveResultCount((count) => count + 1);
    } catch (error) {
      const summary = summarizeErrors(error.details?.errors, error.message);
      const serverField = error.details?.field;
      if (['dateOfBirth', 'heightCm', 'weightKg', 'allergies'].includes(serverField)) {
        const fieldMessage = serverField === 'dateOfBirth'
          ? error.message
          : (Array.isArray(error.details?.errors) ? error.details.errors[0] : error.message);
        setHealthFieldErrors((current) => ({ ...current, [serverField]: fieldMessage || error.message }));
      }
      setHealthError(summary || error.message);
      setHealthSaveFeedback({ type: 'error' });
      setHealthSaveResultCount((count) => count + 1);
    } finally {
      setHealthSaving(false);
    }
  };

  // Duy's code: Yêu cầu người dưới 18 xác nhận cảnh báo trước khi gửi hồ sơ lên server.
  const handleHealthSubmit = async (event) => {
    event.preventDefault();
    setHealthError('');
    setHealthNotice('');
    setHealthSaveFeedback(null);
    const nextErrors = validateHealthProfile(healthForm, healthDateParts, today);
    setHealthFieldErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      setHealthError(summarizeErrors(Object.values(nextErrors)));
      setHealthSaveFeedback({ type: 'error' });
      setHealthSaveResultCount((count) => count + 1);
      return;
    }
    const age = ageFromDate(healthForm.dateOfBirth, today);
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
    setAccountSaveFeedback(null);
    const normalizedForm = { ...form, fullName: normalizeFullName(form.fullName) }; /* Duy's code: Chuẩn hoá họ tên trước khi validate và lưu. */
    const nextErrors = validateProfile(normalizedForm); /* Duy's code: Kiểm tra các trường hồ sơ có thể thay đổi. */
    setErrors(nextErrors);
    setSubmitted(true);
    setRequestError('');

    if (hasErrors(nextErrors)) {
      setAccountSaveFeedback({ type: 'error', message: summarizeErrors(Object.values(nextErrors)) });
      setAccountSaveResultCount((count) => count + 1);
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
      setAccountSaveFeedback({ type: 'success' });
      setAccountSaveResultCount((count) => count + 1);
    } catch (error) {
      setRequestError(error.message);
      setAccountSaveFeedback({ type: 'error', message: summarizeErrors(error.details?.errors, error.message) });
      setAccountSaveResultCount((count) => count + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(savedProfile);
    setErrors({});
    setRequestError('');
    setSubmitted(false);
    setAccountSaveFeedback(null);
  };

  if (loading) return (
    <div className={`${styles.page} py-4`}>
      <ProfileBackNavigation /> {/* Duy's code: Luôn hiển thị đường quay lại khi dữ liệu đang tải. */}
      <div className="py-4 text-center">Đang tải hồ sơ...</div>
    </div>
  );

  return (
    <div className={`${styles.page} py-4`}>
      <ProfileBackNavigation /> {/* Duy's code: Hiển thị thanh quay lại phía trên trang hồ sơ. */}
          <div className={`card shadow-sm border-0 ${styles.card}`}>
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
                <div>
                  <p className={`text-uppercase small mb-1 ${styles.eyebrow}`}>Profile</p>
                  <h2 className={`mb-0 ${styles.title}`}>User Profile</h2>
                </div>
                <div className={`d-flex align-items-center gap-3 ${styles.profileIdentity}`}>
                  <Button
                    type="button"
                    variant="outline"
                    icon="camera"
                    className={styles.avatarButton}
                    onClick={() => setAvatarModalOpen(true)}
                    aria-haspopup="dialog"
                  >
                    Tải ảnh đại diện
                  </Button>
                  <Avatar src={form.avatar} name={form.fullName} size={72} className={styles.profileAvatar} />
                  <div>
                    <div className="fw-semibold">{form.fullName}</div> {/* Duy's code: Hiển thị full name lấy từ DB. */}
                    <div className={`small ${styles.muted}`}>{form.email}</div>
                  </div>
                </div>
              </div>

              {/* Duy's code: Chuyển giữa thông tin tài khoản và hồ sơ sức khỏe. */}
              <Tabs
                items={[
                  { key: 'account', label: 'Thông tin tài khoản', icon: 'person', id: 'profile-account-tab', controls: 'profile-account-panel' },
                  { key: 'health', label: 'Hồ sơ sức khỏe', icon: 'heart-pulse', id: 'profile-health-tab', controls: 'profile-health-panel' },
                ]}
                value={activeTab}
                onChange={setActiveTab}
                label="Các phần hồ sơ"
              />

              {/* Duy's code: Tab tài khoản chứa ảnh đại diện và thông tin đăng nhập. */}
              {activeTab === 'account' && (
              <section id="profile-account-panel" role="tabpanel" aria-labelledby="profile-account-tab" tabIndex="0">
              {accountSaveFeedback && submitted && (accountSaveFeedback.type === 'error' || !requestError) && (
                <div
                  ref={accountFeedbackBannerRef}
                  className={`alert mt-3 mb-3 ${accountSaveFeedback.type === 'error' ? styles.errorAlert : styles.successAlert}`}
                  role={accountSaveFeedback.type === 'error' ? 'alert' : 'status'}
                  aria-live={accountSaveFeedback.type === 'error' ? 'assertive' : 'polite'}
                  tabIndex={-1}
                  style={{ scrollMarginTop: '80px' }}
                >
                  {accountSaveFeedback.type === 'error' ? accountSaveFeedback.message : 'Thông tin hồ sơ đã được lưu.'}
                </div>
              )}
              {requestError && accountSaveFeedback?.type !== 'error' && (
                <div className={`alert mt-3 mb-3 ${styles.errorAlert}`} role="alert">{requestError}</div>
              )}
              {avatarNotice && <Notice tone="info" className="mt-3">{avatarNotice}</Notice>}

              <form className={styles.accountForm} onSubmit={handleSubmit} noValidate>
                <section className={`${styles.accountSection} ${styles.accountInformation}`} aria-labelledby="profile-account-info-title">
                  <h3 id="profile-account-info-title" className={styles.accountSectionTitle}>Thông tin tài khoản</h3>
                  <div className={styles.accountFields}>
                    <div className={styles.accountName}>
                      <TextField
                        id="profile-full-name"
                        label="Họ và tên hiển thị" /* Duy's code: Thể hiện đây là tên thật hiển thị, không phải email đăng nhập. */
                        value={form.fullName} /* Duy's code: Liên kết ô tên với account.full_name. */
                        onChange={updateField('fullName')} /* Duy's code: Cập nhật trường fullName trong form. */
                        maxLength={30} /* Duy's code: Giới hạn tên theo quy tắc hồ sơ 2-30 ký tự. */
                        error={errors.fullName} /* Duy's code: Hiển thị lỗi xác thực họ tên. */
                        placeholder="Ví dụ: Nguyễn Thảo Linh" /* Duy's code: Minh hoạ họ tên có dấu và khoảng trắng. */
                        onBlur={() => validateAccountFieldOnBlur('fullName')}
                      />
                    </div>
                    <div className={styles.accountEmail}>
                      <TextField
                        className={styles.readOnlyEmail}
                        label="Email đăng nhập"
                        type="email"
                        value={form.email}
                        readOnly
                        autoComplete="email"
                        hint="Email được cố định từ khi tạo tài khoản và không thể chỉnh sửa tại Hồ sơ."
                      /> {/* Duy's code: Chỉ hiển thị email tài khoản; không cho sửa từ trang Profile. */}
                    </div>
                  </div>
                </section>

                <section className={styles.accountSection} aria-labelledby="profile-password-title">
                  <div className={styles.passwordSectionHeading}>
                    <h3 id="profile-password-title" className={styles.accountSectionTitle}>Đổi mật khẩu</h3>
                    <span className={styles.optionalLabel}>Không bắt buộc</span>
                  </div>
                  <p className={styles.passwordSectionHint}>
                    Bỏ trống nếu không đổi mật khẩu. Mật khẩu 8 đến 20 ký tự, không chứa khoảng trắng, không trùng email.
                  </p>
                  <div className={styles.accountPasswordFields}>
                    <div className={styles.currentPasswordField}>
                      <PasswordField
                        id="profile-current-password"
                        label="Mật khẩu hiện tại (bắt buộc khi đổi mật khẩu)"
                        value={form.currentPassword}
                        onChange={updateField('currentPassword')}
                        autoComplete="current-password"
                        error={errors.currentPassword}
                        onBlur={() => validateAccountFieldOnBlur('currentPassword')}
                      />
                    </div>
                    <div className={styles.newPasswordField}>
                      <PasswordField
                        id="profile-new-password"
                        label="Mật khẩu mới"
                        value={form.password}
                        onChange={updateField('password')}
                        autoComplete="new-password"
                        error={errors.password}
                        onBlur={() => validateAccountFieldOnBlur('password')}
                      />
                    </div>
                    <div className={styles.confirmPasswordField}>
                      <PasswordField
                        id="profile-confirm-password"
                        label="Xác nhận mật khẩu mới"
                        value={form.confirmPassword}
                        onChange={updateField('confirmPassword')}
                        autoComplete="new-password"
                        error={errors.confirmPassword}
                        onBlur={() => validateAccountFieldOnBlur('confirmPassword')}
                      />
                    </div>
                  </div>
                </section>

                <div className={styles.accountFooter}>
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={handleCancel} disabled={saving}>Huỷ</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
                  </div>
                </div>
              </form>
              </section>
              )}

              {/* Duy's code: Tab sức khỏe cho Member quản lý thông tin và chỉ số cá nhân. */}
              {activeTab === 'health' && (
              <section id="profile-health-panel" role="tabpanel" aria-labelledby="profile-health-tab" tabIndex="0" className="pt-4">
                <h3 className="h5">Hồ sơ sức khỏe</h3>
                <p className="text-body-secondary">
                  Thông tin này là riêng tư, chỉ dùng cho tài khoản của bạn. Trường không bắt buộc; chỉ số sẽ không được ước tính nếu thiếu dữ liệu cần thiết.
                </p>
                {healthError && (healthSaveFeedback?.type === 'error' ? (
                  <div
                    ref={healthFeedbackBannerRef}
                    aria-label={healthError}
                    role="alert"
                    aria-live="assertive"
                    tabIndex={-1}
                    style={{ scrollMarginTop: '80px' }}
                  >
                    <Notice tone="alert" title="Không thể xử lý hồ sơ sức khỏe" className="mb-3">{healthError}</Notice>
                  </div>
                ) : <Notice tone="alert" title="Không thể xử lý hồ sơ sức khỏe" className="mb-3">{healthError}</Notice>)}
                {healthNotice && (healthSaveFeedback?.type === 'success' ? (
                  <div
                    ref={healthFeedbackBannerRef}
                    aria-label={healthNotice}
                    role="status"
                    aria-live="polite"
                    tabIndex={-1}
                    style={{ scrollMarginTop: '80px' }}
                  >
                    <Notice tone="success" className="mb-3">{healthNotice}</Notice>
                  </div>
                ) : <Notice tone="success" className="mb-3">{healthNotice}</Notice>)}
                {/* Duy's code: Hiển thị form sức khỏe sau khi tải xong hồ sơ. */}
                {healthLoading ? (
                  <p role="status">Đang tải hồ sơ sức khỏe...</p>
                ) : healthLoadFailed ? (
                  <div>
                    <p>Chưa tải được dữ liệu hồ sơ sức khỏe. Hãy thử lại trước khi chỉnh sửa hoặc lưu để tránh ghi đè dữ liệu hiện có.</p>
                    <Button type="button" variant="outline" onClick={retryLoadHealthProfile}>Thử tải lại</Button>
                  </div>
                ) : (
                  <form className={styles.healthFormLayout} onSubmit={handleHealthSubmit} noValidate>
                    <div className={styles.healthLayout}>
                      <section className={styles.healthPanel} aria-labelledby="health-basics-title">
                        <h4 id="health-basics-title" className="h6 mb-3">Thông tin cơ bản</h4>
                        <fieldset className={`border-0 p-0 m-0 ${styles.healthFieldsGrid}`}>
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
                          <div className={`${styles.healthFieldRow} ${styles.dateOfBirthRow}`}>
                            <span className={styles.healthFieldLabel} id="health-date-of-birth-label">Ngày sinh</span>
                            <fieldset
                              className="border-0 p-0 m-0 w-100"
                              role="group"
                              aria-labelledby="health-date-of-birth-label"
                              aria-invalid={healthFieldErrors.dateOfBirth ? 'true' : undefined}
                              aria-describedby={healthFieldErrors.dateOfBirth ? 'health-date-of-birth-error' : undefined}
                              onBlur={handleDateOfBirthBlur}
                            >
                              <div className={styles.dateOfBirthFields}>
                                <div>
                                  <select
                                    className={`form-select ${styles.dateOfBirthSelect}`}
                                    id="health-date-of-birth-day"
                                    aria-label="Ngày sinh — ngày"
                                    value={healthDateParts.day}
                                    onChange={(event) => updateDateOfBirthPart('day')(event.target.value)}
                                  >
                                    <option value="">Ngày</option>
                                    {Array.from({ length: 31 }, (_, index) => (
                                      <option key={index + 1} value={String(index + 1)}>{index + 1}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <select
                                    className={`form-select ${styles.dateOfBirthSelect}`}
                                    id="health-date-of-birth-month"
                                    aria-label="Ngày sinh — tháng"
                                    value={healthDateParts.month}
                                    onChange={(event) => updateDateOfBirthPart('month')(event.target.value)}
                                  >
                                    <option value="">Tháng</option>
                                    {Array.from({ length: 12 }, (_, index) => (
                                      <option key={index + 1} value={String(index + 1)}>Tháng {index + 1}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className={styles.dateOfBirthYear}>
                                  <TextField
                                    id="health-date-of-birth-year"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={4}
                                    aria-label="Ngày sinh — năm"
                                    value={healthDateParts.year}
                                    onChange={(value) => updateDateOfBirthPart('year')(value.replace(/\D/gu, '').slice(0, 4))}
                                    placeholder="Năm"
                                  />
                                </div>
                              </div>
                              {healthFieldErrors.dateOfBirth && (
                                <div id="health-date-of-birth-error" className="invalid-feedback d-block" role="alert">
                                  {healthFieldErrors.dateOfBirth}
                                </div>
                              )}
                            </fieldset>
                          </div>
                          <div className={styles.healthFieldRow}>
                            <label className={styles.healthFieldLabel} htmlFor="health-height">Chiều cao</label>
                            <TextField
                              id="health-height"
                              type="text"
                              inputMode="decimal"
                              value={healthForm.heightCm}
                              onChange={updateHealthField('heightCm')}
                              onBlur={() => validateHealthFieldOnBlur('heightCm')}
                              error={healthFieldErrors.heightCm}
                              suffix="cm"
                              hint="Nhập giá trị từ 50 đến 250 cm."
                            />
                          </div>
                          <div className={styles.healthFieldRow}>
                            <label className={styles.healthFieldLabel} htmlFor="health-weight">Cân nặng</label>
                            <TextField
                              id="health-weight"
                              type="text"
                              inputMode="decimal"
                              value={healthForm.weightKg}
                              onChange={updateHealthField('weightKg')}
                              onBlur={() => validateHealthFieldOnBlur('weightKg')}
                              error={healthFieldErrors.weightKg}
                              suffix="kg"
                              hint="Nhập giá trị từ 10 đến 500 kg."
                            />
                          </div>
                        </fieldset>

                        <div className="border-top mt-3 pt-3">
                          <h5 className="h6">Vận động và mục tiêu</h5>
                          <p className="small text-body-secondary">
                            Chọn mức gần với sinh hoạt thường ngày; đây chỉ là ước lượng, không cần tính số buổi thật chính xác.
                          </p>
                          <div className={styles.healthFieldsGrid}>
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
                          </div>
                          <div
                            className={styles.allergyGroup}
                            role="group"
                            aria-labelledby="health-allergies-label"
                            aria-invalid={healthFieldErrors.allergies ? 'true' : undefined}
                            aria-describedby={healthFieldErrors.allergies ? 'health-allergies-error' : undefined}
                            onBlur={(event) => {
                              if (!event.currentTarget.contains(event.relatedTarget)) validateHealthFieldOnBlur('allergies');
                            }}
                          >
                            {/* Duy's Code : Tìm ingredient có sẵn hoặc gửi tên mới vào hàng duyệt Admin. */}
                            <div className="d-flex flex-wrap align-items-baseline gap-2 mb-1">
                              <span id="health-allergies-label" className="form-label fw-semibold mb-0">Dị ứng</span>
                              <span className="small text-body-secondary">Không bắt buộc</span>
                            </div>
                            <p className="small text-body-secondary mb-2">
                              Chỉ nhập nếu bạn có nguyên liệu bị dị ứng. Nếu không, bạn có thể bỏ qua mục này.
                            </p>
                            <AllergyIngredientPicker
                              value={healthForm.allergies}
                              onChange={updateHealthField('allergies')}
                              max={50}
                            />
                            {healthFieldErrors.allergies && (
                              <div id="health-allergies-error" className="invalid-feedback d-block" role="alert">
                                {healthFieldErrors.allergies}
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      <section className={styles.healthPanel} aria-labelledby="health-results-title" aria-live="polite">
                        <h4 id="health-results-title" className="h6 mb-1">Chỉ số sức khỏe ước tính</h4>
                        <p className="small text-body-secondary mb-3">
                          Các kết quả thay đổi theo thông tin bạn nhập.
                        </p>
                        {healthForm.gender === 'other' && (
                          <Notice tone="info" className="mb-3">
                            BMI vẫn tính được khi đủ chiều cao và cân nặng. Ứng dụng không tự chọn công thức nam/nữ nên BMR, TDEE và mục tiêu calo sẽ để trống.
                          </Notice>
                        )}
                        <div className={styles.healthResultsLayout}>
                          <div>
                            <div className={styles.healthMetricRow}>
                              <strong>BMI</strong>
                              <p className={styles.healthMetricValue}>
                                {healthPreview.bmi == null
                                  ? 'Chưa tính được: cần chiều cao và cân nặng.'
                                  : ageFromDate(healthForm.dateOfBirth, today) !== null && ageFromDate(healthForm.dateOfBirth, today) < 18
                                    ? `${healthPreview.bmi} — chỉ số BMI; không phân loại theo ngưỡng người lớn.`
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
                      </section>
                    </div>

                    <Notice tone="info" title="Thông tin hồ sơ sức khỏe" className={styles.healthInfoNotice}>
                      Thông tin bạn lưu sẽ được giữ trong hồ sơ tài khoản để hiển thị và tính các chỉ số tham khảo; các chỉ số này không thay thế tư vấn y tế.
                    </Notice>

                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
                      <Button
                        type="button"
                        variant="alert"
                        disabled={healthSaving || healthDeleting}
                        onClick={() => setHealthDeleteOpen(true)}
                      >
                        Xóa hồ sơ sức khỏe
                      </Button>
                      <Button
                        type="submit"
                        loading={healthSaving || healthDeleting}
                        disabled={healthSaving || healthDeleting}
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
              <ConfirmDialog
                open={healthDeleteOpen}
                title="Xóa hồ sơ sức khỏe?"
                message="Thông tin sức khỏe và toàn bộ danh sách dị ứng sẽ bị xóa khỏi hồ sơ của bạn. Thao tác này không thể hoàn tác."
                confirmLabel="Xóa hồ sơ"
                cancelLabel="Giữ lại"
                loading={healthDeleting}
                onConfirm={confirmDeleteHealthProfile}
                onCancel={() => setHealthDeleteOpen(false)}
              />
              <Modal
                open={avatarModalOpen}
                onClose={() => setAvatarModalOpen(false)}
                title="Ảnh đại diện"
                description="Tải ảnh JPG, PNG hoặc WebP tối đa 5 MB. Thay đổi được lưu ngay."
                size="md"
                dismissible={!avatarBusy}
                footer={<Button variant="subtle" onClick={() => setAvatarModalOpen(false)} disabled={avatarBusy}>Đóng</Button>}
              >
                <ImageUpload
                  label="Ảnh hiện tại"
                  value={form.avatar}
                  onChange={handleAvatarChange}
                  onUpload={handleAvatarUpload}
                  maxSizeMB={5}
                  accept="image/jpeg,image/png,image/webp"
                  ratio="1/1"
                  disabled={avatarBusy}
                  showTooltips
                />
                {requestError && <Notice tone="alert" className="mt-3">{requestError}</Notice>}
                {avatarNotice && <Notice tone="info" className="mt-3">{avatarNotice}</Notice>}
              </Modal>
            </div>
          </div>
    </div>
  );
}
