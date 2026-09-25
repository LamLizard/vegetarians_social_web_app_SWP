import cx from '../cx';
import Spinner from '../Spinner/Spinner';

// variant → class Bootstrap (màu đã được theme.scss đổi sang theme của app)
const VARIANTS = {
  primary: 'btn-primary',          // xanh rêu – hành động chính, mỗi khu vực chỉ 1 nút
  outline: 'btn-outline-primary',  // viền xanh – hành động phụ
  subtle:  'btn-light',            // nền be – hành động nhẹ (Hủy, Đóng)
  alert:   'btn-danger',           // đất nung – hành động nguy hiểm (Xoá, Khoá tài khoản)
};

/**
 * Nút bấm có chữ.
 *
 * @param {'primary'|'outline'|'subtle'|'alert'} [variant='primary']
 * @param {'sm'|'md'|'lg'} [size='md']
 * @param {string}  [icon]      tên Bootstrap Icon, vd "plus-lg" (không cần tiền tố bi-)
 * @param {'start'|'end'} [iconPosition='start']
 * @param {boolean} [iconOnly]  chỉ hiện icon → BẮT BUỘC có aria-label. Nút tròn thì dùng IconButton.
 * @param {boolean} [loading]   đang gửi → hiện vòng xoay, khoá nút, giữ nguyên bề rộng
 * @param {boolean} [block]     chiếm hết bề ngang
 * @param {React.ElementType} [as='button']  đổi thẻ gốc, vd `as={Link} to="/posts"` để làm link
 *
 * Mọi prop khác (onClick, disabled, form, aria-*) truyền thẳng xuống thẻ gốc.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  iconOnly = false,
  loading = false,
  block = false,
  as: Tag = 'button',
  type,
  disabled,
  className,
  children,
  ...rest
}) {
  const isButton = Tag === 'button';
  const iconEl = loading
    ? <Spinner size="sm" label={null} />
    : icon && <i className={`bi bi-${icon}`} aria-hidden="true" />;

  return (
    <Tag
      type={isButton ? (type ?? 'button') : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && (disabled || loading) ? true : undefined}
      aria-busy={loading || undefined}
      className={cx(
        'btn d-inline-flex align-items-center justify-content-center gap-2',
        VARIANTS[variant],
        size !== 'md' && `btn-${size}`,
        iconOnly && 'px-2',
        block && 'w-100',
        !isButton && (disabled || loading) && 'disabled',
        className,
      )}
      {...rest}
    >
      {iconPosition === 'start' && iconEl}
      {!iconOnly && children}
      {iconPosition === 'end' && iconEl}
    </Tag>
  );
}
