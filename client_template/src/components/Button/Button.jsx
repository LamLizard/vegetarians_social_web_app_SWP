import cx from '../cx';

// variant → class Bootstrap (màu đã được theme.scss đổi sang A + C)
const VARIANTS = {
  primary: 'btn-primary',          // xanh rêu – hành động chính, mỗi khu vực chỉ 1 nút
  outline: 'btn-outline-primary',  // viền xanh – hành động phụ
  subtle:  'btn-light',            // nền be – hành động nhẹ (Hủy, Đóng)
  alert:   'btn-danger',           // đất nung – chỉ cho hành động quan trọng / cảnh báo
};

/**
 * Nút bấm.
 * @param {'primary'|'outline'|'subtle'|'alert'} variant
 * @param {'sm'|'lg'} size
 * @param {string} icon  tên Bootstrap Icon, vd "plus-lg"
 * @param {boolean} iconOnly  nút chỉ có icon → BẮT BUỘC truyền aria-label
 */
export default function Button({
  variant = 'primary',
  size,
  icon,
  iconOnly = false,
  className,
  children,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx(
        'btn d-inline-flex align-items-center justify-content-center gap-2',
        VARIANTS[variant],
        size && `btn-${size}`,
        iconOnly && 'px-2',
        className,
      )}
      {...rest}
    >
      {icon && <i className={`bi bi-${icon}`} aria-hidden="true" />}
      {!iconOnly && children}
    </button>
  );
}
