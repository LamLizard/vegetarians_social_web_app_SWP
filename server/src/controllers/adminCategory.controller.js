const categoryModel = require('../models/category.model');

const INVALID_ID_MESSAGE = 'ID danh mục không hợp lệ.';
const INVALID_NAME_MESSAGE = 'Tên danh mục phải có từ 2 đến 120 ký tự.';
const SERVER_ERROR_MESSAGE = 'Không thể xử lý danh mục. Vui lòng thử lại.';
const MAX_BIGINT = 9223372036854775807n;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseId(value) {
  if (!/^\d+$/.test(value)) throw new RequestError(400, INVALID_ID_MESSAGE);
  const id = BigInt(value);
  if (id <= 0n || id > MAX_BIGINT) throw new RequestError(400, INVALID_ID_MESSAGE);
  return value;
}

function validateName(value) {
  if (typeof value !== 'string') throw new RequestError(400, INVALID_NAME_MESSAGE);
  const name = value.trim();
  if (name.length < 2 || name.length > 120) throw new RequestError(400, INVALID_NAME_MESSAGE);
  return name;
}

function respondWithError(res, error) {
  if (error.status && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error.code === '23505') {
    return res.status(409).json({ message: 'Danh mục đã tồn tại.' });
  }
  return res.status(500).json({ message: SERVER_ERROR_MESSAGE });
}

async function list(req, res) {
  try {
    const items = await categoryModel.findAllWithUsage();
    const active = items.filter((item) => item.isActive).length;
    return res.json({
      items,
      counts: { all: items.length, active, inactive: items.length - active },
    });
  } catch (error) {
    return respondWithError(res, error);
  }
}

async function create(req, res) {
  try {
    const name = validateName(req.body?.name);
    const item = await categoryModel.createCategory(name, { id: req.account.id, ip: req.ip });
    return res.status(201).json(item);
  } catch (error) {
    return respondWithError(res, error);
  }
}

async function rename(req, res) {
  try {
    const id = parseId(req.params.id);
    const name = validateName(req.body?.name);
    const item = await categoryModel.renameCategory(id, name, { id: req.account.id, ip: req.ip });
    return res.json(item);
  } catch (error) {
    return respondWithError(res, error);
  }
}

async function setStatus(req, res) {
  try {
    const id = parseId(req.params.id);
    if (typeof req.body?.isActive !== 'boolean') {
      throw new RequestError(400, 'Trạng thái danh mục không hợp lệ.');
    }
    const item = await categoryModel.setCategoryStatus(
      id,
      req.body.isActive,
      { id: req.account.id, ip: req.ip },
    );
    return res.json(item);
  } catch (error) {
    return respondWithError(res, error);
  }
}

module.exports = { list, create, rename, setStatus };
