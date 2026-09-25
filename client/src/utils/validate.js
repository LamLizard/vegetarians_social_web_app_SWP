// =====================================================================
//  KIỂM TRA DỮ LIỆU FORM – câu báo lỗi tiếng Việt dùng chung cả nhóm
//
//  Mỗi luật là 1 hàm: nhận giá trị → trả '' nếu hợp lệ, hoặc câu báo lỗi.
//  Backend vẫn PHẢI kiểm tra lại; phần này chỉ để người dùng thấy lỗi sớm.
//
//  const errors = validate(form, {
//    title:      [rules.required(), rules.maxLength(200)],
//    categories: [rules.minItems(1, 'Chọn ít nhất 1 danh mục')],
//  });
//  if (hasErrors(errors)) return setErrors(errors);
// =====================================================================

const isEmpty = (v) => v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '');

export const rules = {
  /** Bắt buộc nhập (chuỗi rỗng, mảng rỗng, null đều tính là thiếu). */
  required: (msg = 'Vui lòng nhập thông tin này') => (v) => (isEmpty(v) ? msg : ''),

  /** Email hợp lệ. */
  email: (msg = 'Email chưa đúng định dạng, ví dụ ten@gmail.com') => (v) =>
    (isEmpty(v) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()) ? '' : msg),

  /** Ít nhất n ký tự. */
  minLength: (n, msg) => (v) =>
    (isEmpty(v) || String(v).trim().length >= n ? '' : msg ?? `Cần ít nhất ${n} ký tự`),

  /** Tối đa n ký tự (nên khớp độ dài cột VARCHAR trong database). */
  maxLength: (n, msg) => (v) =>
    (isEmpty(v) || String(v).length <= n ? '' : msg ?? `Tối đa ${n} ký tự (đang có ${String(v).length})`),

  /** Số trong khoảng [min, max]. unit: "cm", "kg"... */
  between: (min, max, unit = '') => (v) => {
    if (isEmpty(v)) return '';
    const n = Number(v);
    if (Number.isNaN(n)) return 'Vui lòng nhập số';
    return n < min || n > max ? `Nhập từ ${min} đến ${max}${unit ? ` ${unit}` : ''}` : '';
  },

  /** Mảng có ít nhất n phần tử (vd chọn ít nhất 1 Category – UC-03). */
  minItems: (n, msg) => (v) => ((v?.length ?? 0) >= n ? '' : msg ?? `Chọn ít nhất ${n} mục`),

  /** Mật khẩu. LƯU Ý: tài liệu chưa quy định độ mạnh, nhóm chốt rồi sửa ở đây. */
  password: (min = 8) => (v) =>
    (isEmpty(v) || String(v).length >= min ? '' : `Mật khẩu cần ít nhất ${min} ký tự`),

  /** Nhập lại giống ô khác (xác nhận mật khẩu). */
  sameAs: (getOther, msg = 'Mật khẩu nhập lại không khớp') => (v) => (v === getOther() ? '' : msg),

  /** Link YouTube hợp lệ (UC-04). */
  youtubeUrl: (msg = 'Link YouTube chưa đúng, ví dụ https://www.youtube.com/watch?v=...') => (v) =>
    (isEmpty(v) || getYouTubeId(v) ? '' : msg),
};

/**
 * Chạy nhiều luật cho cả form.
 * @param {Record<string, any>} values
 * @param {Record<string, ((v: any, values: object) => string)[]>} schema
 * @returns {Record<string, string>}  chỉ chứa ô bị lỗi (câu lỗi đầu tiên của mỗi ô)
 */
export function validate(values, schema) {
  const errors = {};
  Object.entries(schema).forEach(([field, list]) => {
    for (const rule of list) {
      const msg = rule(values[field], values);
      if (msg) { errors[field] = msg; break; }
    }
  });
  return errors;
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;

/**
 * Lấy mã video từ link YouTube. Không hợp lệ → null.
 * Nhận: youtube.com/watch?v=ID · youtu.be/ID · youtube.com/shorts/ID · youtube.com/embed/ID
 */
export function getYouTubeId(url) {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
