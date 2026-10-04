const bcrypt = require('bcrypt');
const {
  findProfileById, findPasswordHashById, updateProfile, updateAvatar,
} = require('../models/user.model');
const {
  CloudinaryConfigurationError, createAvatarUploadSignature, deleteAvatar, getAvatarAsset, getAvatarPublicId,
} = require('../utils/cloudinary');
const healthProfileModel = require('../models/health-profile.model');
const { calculateHealth } = require('../utils/health');

const FULL_NAME_REGEX = /^[\p{L}\p{M}]+(?:[ .,'’\-]+[\p{L}\p{M}]+)*$/u; /* Duy's code: Cho phép chữ Unicode, dấu tiếng Việt, khoảng trắng và dấu phân cách tên. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/; /* Duy's code: Áp dụng cùng định dạng email đã thống nhất ở client. */

const normalizeFullName = (value) => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' '); /* Duy's code: Chuẩn hoá tên trước khi kiểm tra và lưu DB. */
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase(); /* Duy's code: Chuẩn hoá email trước khi kiểm tra và lưu DB. */
const HEALTH_CONSENT = {
  version: 'health-profile-v1',
  text: 'Tôi đồng ý cung cấp và lưu thông tin sức khỏe, chiều cao, cân nặng, ngày sinh, mục tiêu và dị ứng/kiêng để tạo hồ sơ riêng và hỗ trợ cá nhân hóa. Hồ sơ chỉ được dùng cho tài khoản của tôi. Tôi có thể thu hồi đồng ý; khi thu hồi, hồ sơ sức khỏe và danh sách dị ứng/kiêng sẽ bị xóa.',
};

async function getMyProfile(req, res, next) {
  try {
    const profile = await findProfileById(req.account.id); /* Duy's code: Middleware lưu tài khoản đăng nhập trong req.account. */
    if (!profile) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

async function saveMyProfile(req, res, next) {
  try {
    const fullName = normalizeFullName(req.body?.fullName); /* Duy's code: Nhận đúng trường fullName của account. */
    const email = normalizeEmail(req.body?.email); /* Duy's code: Nhận email mới từ trang hồ sơ. */
    const { password, confirmPassword, currentPassword } = req.body; /* Duy's code: Nhận cả hai giá trị để backend xác thực mật khẩu mới. */
    if (email.length > 30) {
      return res.status(400).json({ message: 'Email không được vượt quá 30 ký tự.' });
    }
    if (!EMAIL_REGEX.test(email)) { /* Duy's code: Từ chối email không khớp định dạng đã chốt. */
      return res.status(400).json({ message: 'Email chưa đúng định dạng, ví dụ ten@gmail.com' }); /* Duy's code: Trả lỗi xác thực email rõ ràng. */
    }
    if ([...fullName].length < 2 || [...fullName].length > 20 || !FULL_NAME_REGEX.test(fullName)) { /* Duy's code: Khớp giới hạn tên 2-20 ký tự và dạng tên người. */
      return res.status(400).json({ message: 'Họ và tên phải dài 2-20 ký tự, chỉ gồm chữ, khoảng trắng và dấu phân cách tên hợp lệ.' }); /* Duy's code: Thông báo lỗi theo quy tắc họ tên mới. */
    }
    const currentProfile = await findProfileById(req.account.id); /* Duy's code: Lấy đúng hồ sơ của tài khoản đã xác thực. */
    if (!currentProfile) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
    const emailChanged = email !== currentProfile.email.toLowerCase(); /* Duy's code: Phát hiện thay đổi email để yêu cầu xác nhận mật khẩu. */
    if (password && /\s/u.test(password)) { /* Duy's code: Không cho lưu mật khẩu mới có ký tự khoảng trắng. */
      return res.status(400).json({ message: 'Mật khẩu mới không được chứa khoảng trắng.' }); /* Duy's code: Áp dụng ràng buộc cả khi gọi API trực tiếp. */
    }
    if (confirmPassword && /\s/u.test(confirmPassword)) { /* Duy's code: Kiểm tra whitespace độc lập trên trường xác nhận. */
      return res.status(400).json({ message: 'Mật khẩu xác nhận không được chứa khoảng trắng.' }); /* Duy's code: Không cho xác nhận có whitespace lọt qua API. */
    }
    if (password && (password.length < 8 || password.length > 20 || password.toLowerCase() === email)) { /* Duy's code: So password mới với email sau cập nhật. */
      return res.status(400).json({ message: 'Mật khẩu mới phải dài 8-20 ký tự và không được trùng email đăng nhập.' });
    }
    if (password && password !== confirmPassword) { /* Duy's code: Không cho cập nhật nếu xác nhận mật khẩu mới không khớp. */
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' }); /* Duy's code: Trả lỗi rõ ràng cho client. */
    }
    if (!password && confirmPassword) { /* Duy's code: Không nhận xác nhận mật khẩu nếu người dùng không nhập mật khẩu mới. */
      return res.status(400).json({ message: 'Hãy nhập mật khẩu mới trước khi xác nhận.' }); /* Duy's code: Giữ cặp mật khẩu mới nhất quán. */
    }
    if (emailChanged || password || currentPassword) { /* Duy's code: Xác thực khi đổi email, mật khẩu mới hoặc đã nhập mật khẩu hiện tại. */
      const passwordHash = await findPasswordHashById(req.account.id); /* Duy's code: Đọc hash mật khẩu của đúng tài khoản. */
      if (!passwordHash || !currentPassword || !(await bcrypt.compare(currentPassword, passwordHash))) {
        return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });
      }
      if (password && password === currentPassword) { /* Duy's code: Chặn mật khẩu mới nếu trùng chính xác mật khẩu cũ đã xác thực. */
        return res.status(400).json({ message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.' }); /* Duy's code: Phân biệt đúng trường hợp trùng hoàn toàn. */
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const profile = await updateProfile(req.account.id, { /* Duy's code: Cập nhật hồ sơ theo id từ middleware auth. */
      fullName, /* Duy's code: Lưu họ tên vào cột account.full_name. */
      email, /* Duy's code: Lưu email đã chuẩn hoá vào DB. */
      passwordHash,
    });
    if (!profile) return res.status(404).json({ message: 'Không thể cập nhật hồ sơ của tài khoản này.' });
    return res.json(profile);
  } catch (error) {
    if (error?.code === '23505') { /* Duy's code: Chuyển lỗi unique email thành phản hồi có thể xử lý ở UI. */
      return res.status(409).json({ message: 'Email này đã được sử dụng.' }); /* Duy's code: Không để email trùng thành lỗi 500. */
    }
    return next(error);
  }
}

function getMyAvatarUploadSignature(req, res, next) {
  try {
    return res.json(createAvatarUploadSignature(req.account.id));
  } catch (error) {
    if (error instanceof CloudinaryConfigurationError) {
      return res.status(503).json({ message: error.message });
    }
    return next(error);
  }
}

async function saveMyAvatar(req, res, next) {
  try {
    const asset = await getAvatarAsset(req.body?.avatarUrl, req.account.id);
    if (!asset) {
      return res.status(400).json({ message: 'Ảnh phải được tải lên Cloudinary trong thư mục ảnh của tài khoản này.' });
    }

    const currentProfile = await findProfileById(req.account.id);
    if (!currentProfile) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
    if (currentProfile.avatar === asset.secureUrl) return res.json(currentProfile);

    const profile = await updateAvatar(req.account.id, asset.secureUrl);
    if (!profile) return res.status(404).json({ message: 'Không thể cập nhật ảnh cho tài khoản này.' });

    try {
      const oldPublicId = getAvatarPublicId(currentProfile.avatar, req.account.id);
      if (oldPublicId && oldPublicId !== asset.publicId) {
        await deleteAvatar(oldPublicId, req.account.id);
      }
    } catch (error) {
      console.error('[users.avatar.cleanup]', error.code || error.name || 'UnexpectedError');
      return res.json({
        ...profile,
        cleanupWarning: 'Ảnh mới đã lưu, nhưng ảnh cũ chưa thể xóa khỏi Cloudinary.',
      });
    }

    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

async function removeMyAvatar(req, res, next) {
  try {
    const currentProfile = await findProfileById(req.account.id);
    if (!currentProfile) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
    if (!currentProfile.avatar) return res.json(currentProfile);

    const profile = await updateAvatar(req.account.id, null);
    if (!profile) return res.status(404).json({ message: 'Không thể cập nhật ảnh cho tài khoản này.' });

    try {
      const oldPublicId = getAvatarPublicId(currentProfile.avatar, req.account.id);
      if (oldPublicId) {
        await deleteAvatar(oldPublicId, req.account.id);
      }
    } catch (error) {
      console.error('[users.avatar.cleanup]', error.code || error.name || 'UnexpectedError');
      return res.json({
        ...profile,
        cleanupWarning: 'Ảnh đại diện đã được gỡ, nhưng ảnh cũ chưa thể xóa khỏi Cloudinary.',
      });
    }

    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

function parseOptionalNumber(value, label, errors) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 999.99) {
    errors.push(`${label} phải là số lớn hơn 0 và không vượt quá 999,99.`);
    return null;
  }
  return number;
}

function normalizeHealthProfile(body) {
  const errors = [];
  const gender = body?.gender || null;
  const activityLevel = body?.activityLevel || null;
  const healthGoal = body?.healthGoal || null;
  if (gender && !['male', 'female', 'other'].includes(gender)) errors.push('Giới tính không hợp lệ.');
  if (activityLevel && !['sedentary', 'light', 'moderate', 'active'].includes(activityLevel)) {
    errors.push('Mức vận động không hợp lệ.');
  }
  if (healthGoal && !['lose_weight', 'gain_muscle', 'maintain'].includes(healthGoal)) {
    errors.push('Mục tiêu sức khỏe không hợp lệ.');
  }

  const dateOfBirth = body?.dateOfBirth || null;
  if (dateOfBirth) {
    const parsedDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
      || Number.isNaN(parsedDate.getTime())
      || parsedDate.toISOString().slice(0, 10) !== dateOfBirth
      || parsedDate > new Date(new Date().toISOString().slice(0, 10))) {
      errors.push('Ngày sinh không hợp lệ hoặc đang ở tương lai.');
    }
  }

  const heightCm = parseOptionalNumber(body?.heightCm, 'Chiều cao', errors);
  const weightKg = parseOptionalNumber(body?.weightKg, 'Cân nặng', errors);
  const allergyInput = body?.allergies ?? [];
  if (!Array.isArray(allergyInput) || allergyInput.length > 50) {
    errors.push('Danh sách dị ứng/kiêng không hợp lệ (tối đa 50 mục).');
  }
  if (Array.isArray(allergyInput) && allergyInput.some((item) => typeof item !== 'string')) {
    errors.push('Mỗi dị ứng/kiêng phải là nội dung dạng chữ.');
  }
  const allergies = Array.isArray(allergyInput)
    ? allergyInput.map((item) => (typeof item === 'string'
      ? item.normalize('NFC').trim().replace(/\s+/gu, ' ')
      : ''))
      .filter(Boolean)
      .filter((item, index, items) => items.findIndex(
        (candidate) => candidate.toLocaleLowerCase('vi') === item.toLocaleLowerCase('vi'),
      ) === index)
    : [];
  if (allergies.some((name) => [...name].length > 120)) errors.push('Mỗi dị ứng/kiêng không được vượt quá 120 ký tự.');
  if (body?.consentAccepted !== true) errors.push('Bạn cần đồng ý trước khi lưu hồ sơ sức khỏe.');

  return {
    errors,
    value: { gender, dateOfBirth, heightCm, weightKg, activityLevel, healthGoal, allergies },
  };
}

async function getMyHealthProfile(req, res, next) {
  try {
    return res.json(await healthProfileModel.getHealthProfile(req.account.id));
  } catch (error) {
    return next(error);
  }
}

async function saveMyHealthProfile(req, res, next) {
  try {
    const { errors, value } = normalizeHealthProfile(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const calculated = calculateHealth(value);
    return res.json(await healthProfileModel.saveHealthProfile(
      req.account.id,
      value,
      calculated,
      HEALTH_CONSENT,
    ));
  } catch (error) {
    return next(error);
  }
}

async function withdrawMyHealthConsent(req, res, next) {
  try {
    return res.json(await healthProfileModel.withdrawHealthConsent(req.account.id, HEALTH_CONSENT));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMyProfile, saveMyProfile, getMyAvatarUploadSignature, saveMyAvatar, removeMyAvatar,
  getMyHealthProfile, saveMyHealthProfile, withdrawMyHealthConsent,
};