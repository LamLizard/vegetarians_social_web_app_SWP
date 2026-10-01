const bcrypt = require('bcrypt');
const { findProfileById, findPasswordHashById, updateProfile } = require('../models/user.model');

const FULL_NAME_REGEX = /^[\p{L}\p{M}]+(?:[ .,'’\-]+[\p{L}\p{M}]+)*$/u; /* Duy's code: Cho phép chữ Unicode, dấu tiếng Việt, khoảng trắng và dấu phân cách tên. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/; /* Duy's code: Áp dụng cùng định dạng email đã thống nhất ở client. */

const normalizeFullName = (value) => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' '); /* Duy's code: Chuẩn hoá tên trước khi kiểm tra và lưu DB. */
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase(); /* Duy's code: Chuẩn hoá email trước khi kiểm tra và lưu DB. */

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

module.exports = { getMyProfile, saveMyProfile };