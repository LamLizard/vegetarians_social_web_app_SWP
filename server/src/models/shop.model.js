// server/src/models/shop.model.js

// Dùng pool kết nối chung của team.
// Không tạo một kết nối database riêng cho feature.
const pool = require('../config/db');

// Các cột cần trả cho giao diện.
// Không lấy password_hash hoặc thông tin nhạy cảm của tài khoản.
const shopSelectColumns = `
  shop.shop_id,
  shop.name,
  shop.address,
  shop.phone,
  shop.open_time,
  shop.close_time,
  shop.open_days,
  shop.status,
  shop.owner_account_id,
  shop.verification_status,
  shop.verification_note,
  shop.verified_by,
  shop.verified_at,
  shop.created_at,
  shop.updated_at,
  owner.full_name AS owner_name,
  owner.email AS owner_email,
  verifier.full_name AS verifier_name
`;

/**
 * Tạo lỗi có mã HTTP và mã nghiệp vụ.
 * Controller sẽ chuyển tiếp lỗi cho error handler.
 */
function createModelError(message, statusCode, code) {
    const error = new Error(message);

    error.statusCode = statusCode;
    error.code = code;

    return error;
}

/**
 * Lấy danh sách quán phục vụ trang Admin Verification.
 *
 * Controller có trách nhiệm kiểm tra đầu vào trước khi gọi model:
 * - verificationStatus: pending, verified hoặc rejected.
 * - search: chuỗi tìm kiếm.
 * - page: số nguyên dương.
 * - limit: số nguyên dương, tối đa 100.
 */
async function findShopsForVerification({
    verificationStatus = 'pending',
    search = '',
    page = 1,
    limit = 10,
} = {}) {
    const offset = (page - 1) * limit;

    // Escape ký tự đặc biệt của LIKE:
    // người dùng nhập "%" hoặc "_" sẽ tìm đúng ký tự đó,
    // thay vì coi chúng là ký tự đại diện.
    const escapedSearch = search.replace(/[\\%_]/g, '\\$&');
    const searchPattern = `%${escapedSearch}%`;

    // Dùng cùng điều kiện lọc cho truy vấn đếm và lấy danh sách.
    const filterSql = `
    WHERE shop.verification_status = $1
      AND shop.name ILIKE $2
  `;

    const countSql = `
    SELECT COUNT(*) AS total
    FROM shop
    ${filterSql}
  `;

    const countResult = await pool.query(countSql, [
        verificationStatus,
        searchPattern,
    ]);

    // PostgreSQL trả COUNT(*) dưới dạng chuỗi.
    // Chuyển sang Number để frontend tính số trang.
    const total = Number(countResult.rows[0].total);

    const listSql = `
    SELECT ${shopSelectColumns}
    FROM shop
    INNER JOIN account AS owner
      ON owner.account_id = shop.owner_account_id
    LEFT JOIN account AS verifier
      ON verifier.account_id = shop.verified_by
    ${filterSql}
    ORDER BY shop.created_at ASC, shop.shop_id ASC
    LIMIT $3
    OFFSET $4
  `;

    const listResult = await pool.query(listSql, [
        verificationStatus,
        searchPattern,
        limit,
        offset,
    ]);

    return {
        shops: listResult.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Lấy thông tin chi tiết của một quán.
 * Trả null nếu không tìm thấy.
 *
 * Giữ shopId ở dạng chuỗi vì database dùng BIGINT.
 * Không ép ID sang Number để tránh mất độ chính xác.
 */
async function findShopById(shopId) {
    const sql = `
    SELECT ${shopSelectColumns}
    FROM shop
    INNER JOIN account AS owner
      ON owner.account_id = shop.owner_account_id
    LEFT JOIN account AS verifier
      ON verifier.account_id = shop.verified_by
    WHERE shop.shop_id = $1
  `;

    const result = await pool.query(sql, [shopId]);

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

/**
 * Xác minh hoặc từ chối một quán.
 *
 * adminId phải được lấy từ middleware xác thực,
 * không lấy từ body do frontend gửi lên.
 *
 * Transaction gồm:
 * 1. Kiểm tra Admin.
 * 2. Khóa dòng quán và kiểm tra trạng thái pending.
 * 3. Cập nhật kết quả.
 * 4. Ghi AdminLog.
 * 5. Tạo Notification cho chủ quán.
 *
 * Nếu một bước thất bại, toàn bộ thay đổi được rollback.
 */
async function updateShopVerification({
    shopId,
    adminId,
    verificationStatus,
    verificationNote = '',
    ipAddress = null,
}) {
    // Kiểm tra trước khi mở transaction.
    const allowedStatuses = ['verified', 'rejected'];

    if (!allowedStatuses.includes(verificationStatus)) {
        throw createModelError(
            'Kết quả xác minh phải là verified hoặc rejected.',
            400,
            'INVALID_VERIFICATION_STATUS'
        );
    }

    if (typeof verificationNote !== 'string') {
        throw createModelError(
            'Ghi chú xác minh phải là chuỗi.',
            400,
            'INVALID_VERIFICATION_NOTE'
        );
    }

    const trimmedNote = verificationNote.trim();

    if (
        verificationStatus === 'rejected' &&
        trimmedNote.length === 0
    ) {
        throw createModelError(
            'Vui lòng nhập lý do từ chối.',
            400,
            'REJECTION_REASON_REQUIRED'
        );
    }

    // Đếm ký tự Unicode để khớp giới hạn VARCHAR(255).
    if (Array.from(trimmedNote).length > 255) {
        throw createModelError(
            'Ghi chú xác minh không được vượt quá 255 ký tự.',
            400,
            'VERIFICATION_NOTE_TOO_LONG'
        );
    }

    const storedNote = trimmedNote.length > 0 ? trimmedNote : null;

    // Lấy một connection riêng từ pool cho transaction.
    // Mọi truy vấn trong transaction phải dùng cùng connection này.
    const databaseClient = await pool.connect();
    let transactionStarted = false;
    let connectionReleased = false;
    try {
        await databaseClient.query('BEGIN');
        transactionStarted = true;

        // Middleware vẫn phải kiểm tra quyền trước khi vào controller.
        // Kiểm tra tại đây bổ sung bảo vệ cho thao tác ghi dữ liệu.
        const adminSql = `
      SELECT account.account_id
      FROM account
      INNER JOIN role
        ON role.role_id = account.role_id
      WHERE account.account_id = $1
        AND account.status = 'active'
        AND role.name = 'admin'
      FOR SHARE OF account, role
    `;

        const adminResult = await databaseClient.query(adminSql, [
            adminId,
        ]);

        if (adminResult.rows.length === 0) {
            throw createModelError(
                'Tài khoản không có quyền xác minh quán.',
                403,
                'ADMIN_PERMISSION_REQUIRED'
            );
        }

        // FOR UPDATE khóa dòng quán đến khi transaction kết thúc.
        // Admin thứ hai xử lý cùng quán sẽ phải chờ.
        const findShopSql = `
      SELECT
        shop_id,
        name,
        owner_account_id,
        verification_status,
        verification_note,
        verified_by,
        verified_at
      FROM shop
      WHERE shop_id = $1
      FOR UPDATE
    `;

        const shopResult = await databaseClient.query(findShopSql, [
            shopId,
        ]);

        if (shopResult.rows.length === 0) {
            throw createModelError(
                'Không tìm thấy quán.',
                404,
                'SHOP_NOT_FOUND'
            );
        }

        const currentShop = shopResult.rows[0];

        // Kiểm tra sau khi khóa dòng để tránh hai Admin cùng duyệt.
        if (currentShop.verification_status !== 'pending') {
            throw createModelError(
                'Quán đã được xử lý. Vui lòng tải lại dữ liệu.',
                409,
                'SHOP_ALREADY_PROCESSED'
            );
        }

        const updateSql = `
      UPDATE shop
      SET
        verification_status = $1,
        verification_note = $2,
        verified_by = $3,
        verified_at = NOW(),
        updated_at = NOW()
      WHERE shop_id = $4
      RETURNING
        shop_id,
        name,
        owner_account_id,
        verification_status,
        verification_note,
        verified_by,
        verified_at,
        updated_at
    `;

        const updateResult = await databaseClient.query(updateSql, [
            verificationStatus,
            storedNote,
            adminId,
            shopId,
        ]);

        const updatedShop = updateResult.rows[0];

        // Chỉ lưu các trường liên quan đến quyết định vào log.
        const beforeValue = {
            verification_status: currentShop.verification_status,
            verification_note: currentShop.verification_note,
            verified_by: currentShop.verified_by,
            verified_at: currentShop.verified_at,
        };

        const afterValue = {
            verification_status: updatedShop.verification_status,
            verification_note: updatedShop.verification_note,
            verified_by: updatedShop.verified_by,
            verified_at: updatedShop.verified_at,
        };

        let logAction;
        let notificationType;
        let notificationTitle;
        let notificationContent;

        if (verificationStatus === 'verified') {
            logAction = 'verify_shop';
            notificationType = 'shop_verified';
            notificationTitle = 'Quán của bạn đã được xác minh';
            notificationContent =
                `Quán "${currentShop.name}" đã được xác minh ` +
                'và được hiển thị công khai.';
        } else {
            logAction = 'reject_shop';
            notificationType = 'shop_rejected';
            notificationTitle = 'Đăng ký quán của bạn bị từ chối';
            notificationContent =
                `Quán "${currentShop.name}" bị từ chối. ` +
                `Lý do: ${trimmedNote}`;
        }

        const insertLogSql = `
      INSERT INTO admin_log (
        admin_id,
        action,
        target_type,
        target_id,
        reason,
        before_value,
        after_value,
        ip_address
      )
      VALUES ($1, $2, 'shop', $3, $4, $5::jsonb, $6::jsonb, $7)
    `;

        await databaseClient.query(insertLogSql, [
            adminId,
            logAction,
            shopId,
            storedNote,
            JSON.stringify(beforeValue),
            JSON.stringify(afterValue),
            ipAddress,
        ]);

        const insertNotificationSql = `
      INSERT INTO notification (
        account_id,
        type,
        title,
        content,
        ref_type,
        ref_id
      )
      VALUES ($1, $2, $3, $4, 'shop', $5)
    `;

        await databaseClient.query(insertNotificationSql, [
            currentShop.owner_account_id,
            notificationType,
            notificationTitle,
            notificationContent,
            shopId,
        ]);

        await databaseClient.query('COMMIT');
        transactionStarted = false;

        return updatedShop;
    } catch (error) {
        if (transactionStarted) {
            try {
                await databaseClient.query('ROLLBACK');
            } catch (rollbackError) {
                // Connection rollback lỗi không nên đưa lại vào pool.
                databaseClient.release(rollbackError);
                connectionReleased = true;
                throw error;
            }
        }

        throw error;
    } finally {
        // Chỉ trả connection về pool nếu chưa release ở nhánh rollback lỗi.
        // Biến kiểm soát release được bổ sung ở đoạn thay thế bên dưới.
        // Trả connection về pool để request khác tiếp tục sử dụng.
        if (!connectionReleased) {
            databaseClient.release();
        }
    }
}

module.exports = {
    findShopsForVerification,
    findShopById,
    updateShopVerification,
};