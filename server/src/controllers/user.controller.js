const bcrypt = require('bcrypt');
const { findProfileById, findPasswordHashById, updateProfile } = require('../models/user.model');

const PROFILE_VALUE_REGEX = /^[A-Za-z0-9_.]{8,20}$/;

async function getMyProfile(req, res, next) {
  try {
    const profile = await findProfileById(req.auth.accountId);
    if (!profile) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

async function saveMyProfile(req, res, next) {
  try {
    const { displayName, password, currentPassword } = req.body;
    if (!PROFILE_VALUE_REGEX.test(displayName ?? '')) {
      return res.status(400).json({ message: 'Tên hiển thị phải dài 8-20 ký tự, chỉ gồm chữ, số, dấu gạch dưới hoặc dấu chấm.' });
    }
    const currentProfile = await findProfileById(req.auth.accountId);
    if (!currentProfile) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
    if (password && (password.length < 8 || password.length > 20 || password.toLowerCase() === currentProfile.email.toLowerCase())) {
      return res.status(400).json({ message: 'Mật khẩu mới phải dài 8-20 ký tự và không được trùng email đăng nhập.' });
    }
    if (password) {
      const passwordHash = await findPasswordHashById(req.auth.accountId);
      if (!passwordHash || !currentPassword || !(await bcrypt.compare(currentPassword, passwordHash))) {
        return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const profile = await updateProfile(req.auth.accountId, {
      displayName,
      passwordHash,
    });
    if (!profile) return res.status(404).json({ message: 'Không thể cập nhật hồ sơ của tài khoản này.' });
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMyProfile, saveMyProfile };