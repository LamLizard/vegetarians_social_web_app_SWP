const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findAccountByEmail } = require('../models/auth.model');

async function login(req, res, next) {
  try {
    const email = String(req.body.email ?? '').trim();
    const password = String(req.body.password ?? '');
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const account = await findAccountByEmail(email);
    const passwordMatches = account && await bcrypt.compare(password, account.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }
    if (account.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản hiện không thể đăng nhập.' });
    }

    const token = jwt.sign(
      { role: account.role },
      process.env.JWT_SECRET,
      { subject: String(account.account_id), expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    return res.json({
      token,
      user: {
        id: account.account_id,
        email: account.email,
        displayName: account.full_name,
        avatar: account.avatar_url,
        role: account.role,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { login };