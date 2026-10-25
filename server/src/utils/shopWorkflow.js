// Tùng — Sprint 2: hợp đồng lỗi, dữ liệu và quyền cho ba module Shop.
class ShopError extends Error {
  constructor(status, code, message, fieldErrors) {
    super(message);
    this.name = 'ShopError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function invalid(field, message) {
  throw new ShopError(400, 'SHOP_VALIDATION', message, { [field]: message });
}

function parseId(value, field = 'id') {
  if (typeof value !== 'string' || value.length > 19 || !/^[1-9]\d*$/.test(value)
    || BigInt(value) > 9223372036854775807n) invalid(field, 'Mã dữ liệu không hợp lệ.');
  return value;
}

function whitelist(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid('body', 'Dữ liệu gửi lên phải là một đối tượng.');
  }
  const unknown = Object.keys(value).find(key => !allowed.includes(key));
  if (unknown) invalid(unknown, 'Trường dữ liệu không được phép gửi.');
  return value;
}

function text(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) invalid(field, 'Vui lòng nhập thông tin hợp lệ.');
  const result = value.trim();
  if (Array.from(result).length > max) invalid(field, `Tối đa ${max} ký tự.`);
  return result;
}

function requireActor(actor, role) {
  if (!actor?.id) throw new ShopError(401, 'SHOP_UNAUTHENTICATED', 'Vui lòng đăng nhập.');
  if (actor.role !== role) throw new ShopError(403, 'SHOP_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
  return parseId(String(actor.id), 'accountId');
}

function conflict(message = 'Dữ liệu đã thay đổi. Vui lòng tải lại trước khi tiếp tục.') {
  throw new ShopError(409, 'SHOP_CONFLICT', message);
}

function parsePagination(query = {}) {
  const integer = (raw, fallback, max, key) => {
    if (raw === undefined) return fallback;
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || Number(raw) > max) invalid(key, 'Phân trang không hợp lệ.');
    return Number(raw);
  };
  return { page: integer(query.page, 1, 1000000, 'page'), pageSize: integer(query.pageSize, 20, 100, 'pageSize') };
}

function pageResult(items, total, page, pageSize) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// Tùng — Sprint 2: không trả SQL, cấu hình kết nối hoặc lỗi nội bộ ra client/log.
function handle(work, successStatus = 200) {
  return async (req, res) => {
    try { return res.status(successStatus).json(await work(req)); }
    catch (error) {
      if (error instanceof ShopError) {
        return res.status(error.status).json({ message: error.message, code: error.code,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) });
      }
      console.error('[shopWorkflow]', error.code || error.name || 'UnexpectedError');
      return res.status(500).json({ message: 'Không thể xử lý yêu cầu quán. Vui lòng thử lại sau.', code: 'SHOP_INTERNAL' });
    }
  };
}

const actorFrom = req => ({ id: req.account.id, role: req.account.role, ip: req.ip });
const requireMember = (req, res, next) => {
  if (req.account?.role !== 'member') return res.status(403).json({ message: 'Chỉ thành viên được đăng ký và quản lý quán.', code: 'SHOP_FORBIDDEN' });
  return next();
};

module.exports = { ShopError, invalid, parseId, whitelist, text, requireActor, conflict, parsePagination, pageResult, handle, actorFrom, requireMember };
