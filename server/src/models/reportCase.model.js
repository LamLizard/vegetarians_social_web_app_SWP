// Tung's code: Tìm/mở case của một post hoặc comment khi Member gửi report.
// Hàm nhận client của transaction bên gọi: tạo case và INSERT report phải cùng
// commit/rollback, tránh để lại case rỗng nếu việc tạo report thất bại.
async function getOrCreatePendingCase(client, targetType, targetId) {
  // Tung's code: Unique partial index uq_report_case_pending_target bảo đảm chỉ
  // một case pending cho mỗi đối tượng, kể cả hai người report cùng thời điểm.
  // UPDATE không đổi target; nó khóa case và trả ID của case đang tồn tại.
  // Case đã đóng không thuộc index này nên report tiếp theo sẽ mở case mới.
  const { rows } = await client.query(`
    INSERT INTO report_case (target_type, target_id)
    VALUES ($1::report_target_type_enum, $2)
    ON CONFLICT (target_type, target_id) WHERE status = 'pending'
    DO UPDATE SET target_id = EXCLUDED.target_id
    RETURNING case_id::text AS id
  `, [targetType, targetId]);
  return rows[0].id;
}

module.exports = { getOrCreatePendingCase };
