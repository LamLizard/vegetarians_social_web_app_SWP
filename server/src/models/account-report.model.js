const pool = require('../config/db');
const { getOrCreatePendingCase } = require('./reportCase.model');

class AccountReportError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function createAccountReport({ reporterId, accountId, reasonCode, reasonText }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const targetResult = await client.query(
      `SELECT a.account_id::text AS id
       FROM public.account a
       JOIN public.role role ON role.role_id = a.role_id AND role.name = 'member'
       WHERE a.account_id = $1 AND a.status <> 'deleted'
       FOR KEY SHARE OF a`,
      [accountId],
    );
    if (!targetResult.rows[0]) {
      throw new AccountReportError(404, 'Không tìm thấy tài khoản thành viên để báo cáo.');
    }
    if (String(reporterId) === targetResult.rows[0].id) {
      throw new AccountReportError(400, 'Bạn không thể báo cáo tài khoản của chính mình.');
    }

    const caseId = await getOrCreatePendingCase(client, 'account', accountId);
    const duplicate = await client.query(
      'SELECT 1 FROM public.report WHERE reporter_id = $1 AND case_id = $2',
      [reporterId, caseId],
    );
    if (duplicate.rows[0]) {
      throw new AccountReportError(409, 'Bạn đã báo cáo tài khoản này rồi, Admin đang xem xét.');
    }

    const result = await client.query(
      `INSERT INTO public.report (reporter_id, target_type, target_id, reason_code, reason_text, case_id)
       VALUES ($1, 'account', $2, $3::report_reason_code_enum, $4, $5)
       RETURNING report_id::text AS id`,
      [reporterId, accountId, reasonCode, reasonText, caseId],
    );

    await client.query('COMMIT');
    return { ...result.rows[0], caseId };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw new AccountReportError(409, 'Bạn đã báo cáo tài khoản này rồi, Admin đang xem xét.');
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createAccountReport };
