const nodemailer = require('nodemailer');

let transporter = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Thiếu cấu hình SMTP trong server/.env: SMTP_HOST, SMTP_USER, SMTP_PASS');
  }

  return { host, port, secure, user, pass };
}

function getTransporter() {
  if (!transporter) {
    const { host, port, secure, user, pass } = getSmtpConfig();
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  return transporter;
}

async function sendRegisterOtpEmail(to, otp) {
  const email = String(to ?? '').trim();
  if (!email) throw new Error('Email người nhận không hợp lệ.');

  const config = getSmtpConfig();
  const from = process.env.MAIL_FROM || config.user;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1b2a1d; line-height: 1.6;">
      <p>Xin chào,</p>
      <p>Để hoàn tất đăng ký tài khoản trên <strong>Vegetarian Social</strong>, vui lòng nhập mã xác minh sau:</p>
      <div style="margin: 18px 0; padding: 18px 20px; border-radius: 12px; background: #f4f7ef; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 10px; color: #1d4d2e;">
        ${otp}
      </div>
      <p>Mã có hiệu lực trong 5 phút.</p>
      <p>Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.</p>
    </div>
  `;

  return getTransporter().sendMail({
    from,
    to: email,
    subject: '[Vegetarian Social] Mã xác minh đăng ký của bạn',
    html,
  });
}

module.exports = { sendRegisterOtpEmail };
