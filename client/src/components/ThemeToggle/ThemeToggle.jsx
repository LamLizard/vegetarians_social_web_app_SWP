import IconButton from '../IconButton/IconButton';
import RadioGroup from '../RadioGroup/RadioGroup';
import cx from '../cx';
import { useTheme, setTheme } from '../../utils/theme';
import styles from './ThemeToggle.module.css';

const OPTIONS = [
  { value: 'light', label: 'Sáng', icon: 'sun' },
  { value: 'dark', label: 'Tối', icon: 'moon-stars' },
  { value: 'system', label: 'Theo máy', icon: 'laptop' },
];

/**
 * Đổi nền Sáng / Tối. Tự đọc và lưu lựa chọn (utils/theme.js), trang KHÔNG cần truyền state.
 *
 *  - variant="icon"      : nút tròn mặt trăng / mặt trời, bấm là đảo. Dùng ở góc trang không có khung
 *                          (Đăng nhập / Đăng ký M-17, trang lỗi 404). AppShell, AdminLayout đã có sẵn nút riêng.
 *  - variant="segmented" : 3 lựa chọn Sáng · Tối · Theo máy. Dùng ở trang Cài đặt / Hồ sơ.
 *
 * @param {'icon'|'segmented'} [variant='icon']
 * @param {'soft'|'ghost'|'solid'} [buttonVariant='soft']   kiểu nút khi variant="icon"
 * @param {'sm'|'md'|'lg'} [size='md']                        cỡ nút khi variant="icon"
 * @param {string} [label='Giao diện']                        nhãn nhóm khi variant="segmented"
 * @param {boolean} [showHint=true]                           segmented: dòng "Máy của bạn đang để chế độ tối"
 */
export default function ThemeToggle({
  variant = 'icon', buttonVariant = 'soft', size = 'md', label = 'Giao diện', showHint = true, className,
}) {
  const [theme, toggle, preference] = useTheme();

  if (variant === 'segmented') {
    return (
      <RadioGroup
        variant="segmented"
        label={label}
        options={OPTIONS}
        value={preference}
        onChange={setTheme}
        hint={showHint ? (preference === 'system'
          ? `Đang đi theo máy của bạn (hiện là chế độ ${theme === 'dark' ? 'tối' : 'sáng'}).`
          : 'Lựa chọn được nhớ trên trình duyệt này.') : undefined}
        className={cx(styles.segmented, className)}
      />
    );
  }

  const dark = theme === 'dark';
  return (
    <IconButton
      icon={dark ? 'sun' : 'moon-stars'}
      label={dark ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
      variant={buttonVariant}
      size={size}
      onClick={toggle}
      className={cx(styles.icon, className)}
    />
  );
}
