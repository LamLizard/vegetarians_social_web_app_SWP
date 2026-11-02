const nodemailer = require('nodemailer');

// Render **free** chặn outbound tới port 25/465/587 (SMTP) nên nodemailer treo tới
// connectionTimeout mặc định 120s. Đặt timeout ngắn để request fail nhanh, báo lỗi rõ.
const MAIL_TIMEOUT_MS = Number(process.env.MAIL_TIMEOUT_MS || 8000);
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
      connectionTimeout: MAIL_TIMEOUT_MS,
      greetingTimeout: MAIL_TIMEOUT_MS,
      socketTimeout: MAIL_TIMEOUT_MS * 2,
    });
  }

  return transporter;
}

/**
 * Gửi qua HTTP API (Resend) — chạy được trên Render free vì dùng HTTPS 443.
 * Bật bằng RESEND_API_KEY (key thật bắt đầu bằng "re_"). Trả {ok, reason} thay vì throw.
 */
async function sendViaResend({ from, to, subject, html }) {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  if (!/^re_[A-Za-z0-9]{8,}$/.test(key)) {
    return { ok: false, reason: 'chưa cấu hình RESEND_API_KEY hợp lệ' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(MAIL_TIMEOUT_MS * 2),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { ok: false, reason: `resend HTTP ${response.status} ${body.slice(0, 140)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `resend ${error.message}` };
  }
}

/**
 * Gửi qua Brevo HTTPS API — free 300 mail/ngày, chạy được trên Render free (443).
 * Bật bằng BREVO_API_KEY (key v3, bắt đầu bằng "xkeysib-"). Sender phải là địa chỉ
 * đã verify trong Brevo (Settings → Senders), nếu không Brevo trả 400.
 */
async function sendViaBrevo({ from, to, subject, html }) {
  const key = String(process.env.BREVO_API_KEY || '').trim();
  if (!key.startsWith('xkeysib-')) {
    return { ok: false, reason: 'chưa cấu hình BREVO_API_KEY' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: from, name: process.env.MAIL_SENDER_NAME || 'Green Bowl' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(MAIL_TIMEOUT_MS * 2),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { ok: false, reason: `brevo HTTP ${response.status} ${body.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `brevo ${error.message}` };
  }
}

async function sendRegisterOtpEmail(to, otp) {
  const email = String(to ?? '').trim();
  if (!email) throw new Error('Email người nhận không hợp lệ.');

  // SMTP có thể không cấu hình được (Render free chặn port SMTP) — không throw ở đây,
  // nhánh Resend bên dưới vẫn còn cơ hội gửi.
  let config = null;
  try { config = getSmtpConfig(); } catch { config = null; }
  const from = process.env.MAIL_FROM || config?.user || 'onboarding@resend.dev';
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

  const subject = '[Vegetarian Social] Mã xác minh đăng ký của bạn';

  // 1) Brevo HTTPS (ưu tiên — free 300/ngày, sender đã verify).
  const viaBrevo = await sendViaBrevo({ from, to: email, subject, html });
  if (viaBrevo.ok) return { via: 'brevo' };

  // 2) HTTPS API khác (Resend) — chạy được trên Render free (chỉ chặn port SMTP).
  const viaApi = await sendViaResend({ from, to: email, subject, html });
  if (viaApi.ok) return { via: 'resend' };

  // 3) SMTP — chỉ thành công trên instance trả phí / khi chạy local.
  let smtpError = null;
  if (config) {
    try {
      await getTransporter().sendMail({ from, to: email, subject, html });
      return { via: 'smtp' };
    } catch (error) {
      smtpError = error;
    }
  }

  const failure = new Error(
    `Không gửi được email: ${viaBrevo.reason}; ${viaApi.reason}; smtp: ${smtpError ? smtpError.message : 'chưa cấu hình'}`,
  );
  failure.code = 'MAIL_SEND_FAILED';
  throw failure;
}

module.exports = { sendRegisterOtpEmail };
