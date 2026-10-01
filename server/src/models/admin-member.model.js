const pool = require('../config/db');

// Duy's code: bảng đầu hiển thị tài khoản độc lập với hàng chờ báo cáo.
async function findMembers() {
  const { rows } = await pool.query(
    `SELECT a.account_id AS id,
            a.full_name AS "fullName",
            a.email,
            a.status::text AS status,
            a.created_at AS "createdAt"
     FROM public.account a
     JOIN public.role role ON role.role_id = a.role_id
     WHERE role.name = 'member' AND a.status <> 'deleted'
     ORDER BY a.created_at DESC`,
  );

  return rows;
}

// Duy's code: lấy report_case account đang chờ cùng từng phiếu report trong case.
async function listPendingAccountReports({ keyword = '' } = {}) {
  const { rows } = await pool.query(
    `SELECT rc.case_id AS "caseId",
            target.account_id AS id,
            target.full_name AS "fullName",
            target.email,
            COUNT(r.report_id)::int AS "reportedCount",
            json_agg(
              json_build_object(
                'id', r.report_id,
                'reasonCode', r.reason_code::text,
                'reasonText', r.reason_text,
                'createdAt', r.created_at
              ) ORDER BY r.created_at DESC, r.report_id DESC
            ) AS reports,
            MAX(r.created_at) AS "latestReportAt"
     FROM public.report_case rc
     JOIN public.account target ON target.account_id = rc.target_id
     JOIN public.role role ON role.role_id = target.role_id AND role.name = 'member'
     JOIN public.report r ON r.case_id = rc.case_id
       AND r.target_type = rc.target_type AND r.target_id = rc.target_id
       AND r.status = 'pending'
     WHERE rc.target_type = 'account' AND rc.status = 'pending'
       AND target.status <> 'deleted'
       AND ($1::text = '' OR target.full_name ILIKE '%' || $1 || '%' OR target.email ILIKE '%' || $1 || '%')
     GROUP BY rc.case_id, target.account_id, target.full_name, target.email
     ORDER BY MAX(r.created_at) DESC, rc.case_id DESC`,
    [keyword],
  );

  return rows;
}

// Duy's code: quyết định theo case và đồng bộ trạng thái mọi phiếu trong case.
async function decideAccountReportCase({ caseId, action, adminId }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const caseResult = await client.query(
      `SELECT case_id AS id, target_id AS "targetId", status::text AS status
       FROM public.report_case
       WHERE case_id = $1 AND target_type = 'account'
       FOR UPDATE`,
      [caseId],
    );
    const reportCase = caseResult.rows[0];
    if (!reportCase) {
      const error = new Error('Không tìm thấy báo cáo tài khoản.');
      error.status = 404;
      throw error;
    }
    if (reportCase.status !== 'pending') {
      const error = new Error('Báo cáo tài khoản đã được xử lý. Hãy tải lại danh sách.');
      error.status = 409;
      throw error;
    }

    const accountResult = await client.query(
      `SELECT a.account_id AS id, a.status::text AS status
       FROM public.account a
       JOIN public.role role ON role.role_id = a.role_id
       WHERE a.account_id = $1 AND role.name = 'member' AND a.status <> 'deleted'
       FOR UPDATE OF a`,
      [reportCase.targetId],
    );
    const account = accountResult.rows[0];
    if (!account) {
      const error = new Error('Không tìm thấy tài khoản thành viên bị báo cáo.');
      error.status = 404;
      throw error;
    }

    const reportsResult = await client.query(
      `SELECT report_id AS id, status::text AS status
       FROM public.report
       WHERE case_id = $1 AND target_type = 'account' AND target_id = $2
       ORDER BY report_id
       FOR UPDATE`,
      [caseId, reportCase.targetId],
    );
    if (!reportsResult.rows.length || reportsResult.rows.some((report) => report.status !== 'pending')) {
      const error = new Error('Các phiếu báo cáo không còn đồng nhất trạng thái. Hãy tải lại danh sách.');
      error.status = 409;
      throw error;
    }

    const nextReportStatus = action === 'accept' ? 'accepted' : 'rejected';
    const nextAccountStatus = action === 'accept'
      ? 'locked'
      : account.status === 'reported' ? 'active' : account.status;
    if (nextAccountStatus !== account.status) {
      await client.query(
        `UPDATE public.account SET status = $2::account_status_enum, updated_at = NOW()
         WHERE account_id = $1`,
        [account.id, nextAccountStatus],
      );
      await client.query(
        `INSERT INTO public.admin_log (admin_id, action, target_type, target_id, before_value, after_value)
         VALUES ($1, $2, 'account', $3, $4::jsonb, $5::jsonb)`,
        [adminId, 'account_locked', account.id, JSON.stringify({ status: account.status }), JSON.stringify({ status: nextAccountStatus })],
      );
    }

    await client.query(
      `UPDATE public.report_case
       SET status = $2::report_status_enum, handled_by = $3, handled_at = NOW()
       WHERE case_id = $1`,
      [caseId, nextReportStatus, adminId],
    );
    await client.query(
      `UPDATE public.report
       SET status = $2::report_status_enum, handled_by = $3, handled_at = NOW()
       WHERE case_id = $1 AND target_type = 'account' AND target_id = $4 AND status = 'pending'`,
      [caseId, nextReportStatus, adminId, reportCase.targetId],
    );
    await client.query(
      `INSERT INTO public.admin_log (admin_id, action, target_type, target_id, before_value, after_value)
       VALUES ($1, $2, 'report', $3, $4::jsonb, $5::jsonb)`,
      [adminId, action === 'accept' ? 'ACCEPT' : 'REJECT', caseId,
        JSON.stringify({ status: reportCase.status }), JSON.stringify({ status: nextReportStatus })],
    );

    await client.query('COMMIT');
    return { accountId: account.id, status: nextAccountStatus, reportStatus: nextReportStatus };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateMemberStatus({ adminId, accountId, status }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT a.status::text AS status
       FROM public.account a
       JOIN public.role role ON role.role_id = a.role_id
       WHERE a.account_id = $1 AND role.name = 'member' AND a.status <> 'deleted'
       FOR UPDATE OF a`,
      [accountId],
    );

    if (!currentResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const previousStatus = currentResult.rows[0].status;
    if (status === 'locked' && previousStatus === 'locked') {
      await client.query('COMMIT');
      return { account_id: accountId, status: previousStatus };
    }
    if (status === 'active' && previousStatus !== 'locked') {
      await client.query('ROLLBACK');
      return { account_id: accountId, status: previousStatus };
    }

    const nextStatus = status; // Duy's code: mở khóa về active, không khôi phục cờ report từ audit log.

    const { rows } = await client.query(
      `UPDATE public.account
       SET status = $2, updated_at = NOW()
       WHERE account_id = $1
       RETURNING account_id, status::text AS status`,
      [accountId, nextStatus],
    );
    const action = status === 'locked' ? 'account_locked' : status === 'deleted' ? 'account_deleted' : 'account_unlocked'; // Duy's code: ghi riêng audit cho xóa mềm.
    // Duy's code: Ghi trạng thái trước và sau vào nhật ký Admin.
    await client.query(
      `INSERT INTO public.admin_log
         (admin_id, action, target_type, target_id, before_value, after_value)
      VALUES ($1, $2, 'account', $3, jsonb_build_object('status', $4::text), jsonb_build_object('status', $5::text)) -- Duy's code: ép kiểu để PostgreSQL ghi JSONB.`,
      [adminId, action, accountId, previousStatus, nextStatus],
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { findMembers, listPendingAccountReports, decideAccountReportCase, updateMemberStatus };