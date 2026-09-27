// server/src/utils/createAdminToken.js

const path = require('node:path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { createHash, randomUUID } = require('node:crypto');

// File nằm trong server/src/utils.
// Đi lên hai cấp để đọc server/.env.
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

// Import kết nối DB sau khi load biến môi trường.
const pool = require('../config/db');

/**
 * Tạo token và phiên đăng nhập tạm cho Admin có sẵn.
 *
 * Cách chạy tại thư mục server:
 * node src/utils/createAdminToken.js admin@example.com
 */
async function createAdminToken() {
  try {
    // Công cụ này chỉ dành cho môi trường phát triển.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Không được sử dụng công cụ tạo token tạm trong production.'
      );
    }

    // Tham số đầu tiên sau tên file là email của Admin.
    const emailArgument = process.argv[2];

    if (
      typeof emailArgument !== 'string' ||
      emailArgument.trim().length === 0
    ) {
      throw new Error(
        'Hãy truyền email Admin. Ví dụ: ' +
        'node src/utils/createAdminToken.js admin@example.com'
      );
    }

    const email = emailArgument.trim();
    const jwtSecret = process.env.JWT_SECRET;

    if (
      typeof jwtSecret !== 'string' ||
      jwtSecret.trim().length === 0
    ) {
      throw new Error('Chưa cấu hình JWT_SECRET trong server/.env.');
    }

    // Chỉ tìm Admin đang active.
    // Không chỉnh role hoặc trạng thái của tài khoản.
    const findAdminSql = `
      SELECT
        account.account_id,
        account.email,
        account.full_name
      FROM account
      INNER JOIN role
        ON role.role_id = account.role_id
      WHERE account.email = $1
        AND account.status = 'active'
        AND role.name = 'admin'
    `;

    const adminResult = await pool.query(findAdminSql, [email]);

    if (adminResult.rows.length === 0) {
      throw new Error(
        'Không tìm thấy tài khoản Admin đang active với email này.'
      );
    }

    const admin = adminResult.rows[0];

    // Giữ ID dạng chuỗi vì database dùng BIGINT.
    const accountId = String(admin.account_id);

    // UUID giúp mỗi token khác nhau, kể cả khi chạy nhiều lần
    // trong cùng một giây.
    const tokenId = randomUUID();

    const accessToken = jwt.sign(
      {},
      jwtSecret,
      {
        algorithm: 'HS256',
        subject: accountId,
        expiresIn: '1h',
        jwtid: tokenId,
      }
    );

    // Đọc thời hạn từ chính JWT vừa ký để thời hạn phiên khớp token.
    // verify cũng xác nhận chữ ký của token vừa tạo.
    const tokenPayload = jwt.verify(accessToken, jwtSecret, {
      algorithms: ['HS256'],
    });

    const expiresAt = new Date(tokenPayload.exp * 1000);

    // Phải dùng cùng cách hash với middleware auth.js.
    const tokenHash = createHash('sha256')
      .update(accessToken, 'utf8')
      .digest('hex');

    // Chỉ lưu hash, không lưu JWT nguyên bản vào database.
    const insertSessionSql = `
      INSERT INTO auth_session (
        account_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3)
      RETURNING session_id, expires_at
    `;

    const sessionResult = await pool.query(insertSessionSql, [
      accountId,
      tokenHash,
      expiresAt,
    ]);

    const session = sessionResult.rows[0];

    console.log('Đã tạo phiên Admin tạm.');
    console.log('Email:', admin.email);
    console.log('Session ID:', session.session_id);
    console.log('Hết hạn:', session.expires_at.toISOString());

    // Chủ động in token để sử dụng trong Postman ở môi trường local.
    console.log('\nAccess token:');
    console.log(accessToken);
  } catch (error) {
    // Không in lỗi SQL thô vì có thể chứa dữ liệu nhạy cảm.
    if (error.code) {
      console.error(
        'Không tạo được phiên Admin. Kiểm tra database và schema.',
        'Mã lỗi:',
        error.code
      );
    } else {
      console.error('Không tạo được phiên Admin:', error.message);
    }

    process.exitCode = 1;
  } finally {
    // Script kết thúc phải đóng pool để Node thoát.
    // Không gọi pool.end() trong request của server đang chạy.
    await pool.end();
  }
}

createAdminToken();

//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3OTA0OTIxMjAsImV4cCI6MTc5MDQ5NTcyMCwic3ViIjoiMSIsImp0aSI6IjE2ZTMwYTNjLTJmZTItNDk0ZC05ZGRkLWVjNjU0YTI3OTY5YSJ9.EbyTtfyQfq8nAz9ObYVkvn1GssJAh7eL_6-vDdCpbQM

//