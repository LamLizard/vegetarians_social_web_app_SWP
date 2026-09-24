// =====================================================================
//  THƯ VIỆN COMPONENT – App Ăn Chay (SWP391)
//  Import gọn:  import { Button, StatusBadge } from '@/components';
//  (hoặc đường dẫn tương đối '../../components')
//
//  Quy tắc vàng: component ở đây KHÔNG gọi API, KHÔNG đọc store.
//  Trang của ai thì người đó lấy dữ liệu rồi truyền vào qua props.
// =====================================================================

// ---- Đợt 1 · Nền tảng & phản hồi -------------------------------------
export { default as Button } from './Button/Button';
export { default as IconButton } from './IconButton/IconButton';
export { default as Spinner } from './Spinner/Spinner';
export { default as Skeleton, SkeletonCard } from './Skeleton/Skeleton';
export { default as Avatar } from './Avatar/Avatar';
export { default as Photo } from './Photo/Photo';
export { default as StatusBadge } from './StatusBadge/StatusBadge';
export { default as Chip } from './Chip/Chip';
export { default as HighlightChip } from './HighlightChip/HighlightChip';
export { default as Notice } from './Notice/Notice';
export { ToastProvider, useToast } from './Toast/Toast';
export { default as Modal } from './Modal/Modal';
export { default as ConfirmDialog } from './ConfirmDialog/ConfirmDialog';
export { default as Menu } from './Menu/Menu';
export { default as Tabs } from './Tabs/Tabs';
export { default as Panel } from './Panel/Panel';
export { default as EmptyState } from './EmptyState/EmptyState';

// ---- Đợt 2 · Form (mọi ô nhập: onChange nhận THẲNG giá trị) -----------
export { default as Field, useFieldId } from './Field/Field';
export { default as TextField } from './TextField/TextField';
export { default as TextArea } from './TextArea/TextArea';
export { default as PasswordField } from './PasswordField/PasswordField';
export { default as Select } from './Select/Select';
export { default as RadioGroup } from './RadioGroup/RadioGroup';
export { default as Checkbox } from './Checkbox/Checkbox';
export { default as CategoryPicker } from './CategoryPicker/CategoryPicker';
export { default as ChipInput } from './ChipInput/ChipInput';
export { default as NumberStepper } from './NumberStepper/NumberStepper';
export { default as ImageUpload } from './ImageUpload/ImageUpload';
export { default as SearchInput } from './SearchInput/SearchInput';
export { default as Pagination } from './Pagination/Pagination';

// ---- Đợt 3 · Bài đăng ------------------------------------------------
export { default as PostCard } from './PostCard/PostCard';
export { default as YouTubeEmbed } from './YouTubeEmbed/YouTubeEmbed';
export { default as VoteButton } from './VoteButton/VoteButton';
export { default as CommentSection } from './Comment/CommentSection';
export { default as CommentItem } from './Comment/CommentItem';
export { default as CommentComposer } from './Comment/CommentComposer';
export { default as ReportDialog } from './ReportDialog/ReportDialog';
export { default as LoginPrompt } from './LoginPrompt/LoginPrompt';
export { default as PostComposer, COMPOSER_PROMPTS } from './PostComposer/PostComposer';

// ---- Đợt 4 · Món, công thức, quán ------------------------------------
export { default as DishCard } from './DishCard/DishCard';
export { default as RecipeCard } from './RecipeCard/RecipeCard';
export { RecipeFacts, IngredientList, RecipeSteps } from './RecipeView/RecipeView';
export { default as IngredientEditor } from './IngredientEditor/IngredientEditor';
export { default as StepEditor } from './StepEditor/StepEditor';
export { default as ShopCard, mapsSearchUrl } from './ShopCard/ShopCard';
export { default as ShopMenuItem } from './ShopMenuItem/ShopMenuItem';

// ---- Đợt 5 · AI, Admin, khung trang ---------------------------------
export { default as ChatBubble } from './ChatBubble/ChatBubble';
export { default as ChatThread } from './ChatThread/ChatThread';
export { default as ChatComposer } from './ChatComposer/ChatComposer';
export { default as PromptChip } from './PromptChip/PromptChip';
export { default as AiTip } from './AiTip/AiTip';
export { default as AiProgress, MEAL_PLAN_STEPS } from './AiProgress/AiProgress';
export { default as DayTabs, dayLabel } from './DayTabs/DayTabs';
export { default as MealCard } from './MealCard/MealCard';
export { default as CalorieSummary } from './CalorieSummary/CalorieSummary';
export { default as StatCard } from './StatCard/StatCard';
export { default as DataTable } from './DataTable/DataTable';
export { default as NotificationList } from './NotificationList/NotificationList';
export { default as PageHeader } from './PageHeader/PageHeader';
export { default as AppShell } from './AppShell/AppShell';
export { default as Logo } from './AppShell/Logo';
export { default as AdminLayout } from './AdminLayout/AdminLayout';

// ---- Hằng số nghiệp vụ dùng chung -------------------------------------
export * from '../constants/domain';
export { STATUS, ENTITY_LABEL, getStatus } from '../constants/status';
export { rules, validate, hasErrors, getYouTubeId } from '../utils/validate';
export { timeAgo, formatDate, formatCount, formatNumber, formatPrice } from '../utils/format';
export { getOpenState, formatHours, formatDuration } from '../utils/time';
export {
  newIngredientRow, parseAmount, formatAmount, scaleAmount, validateIngredients, cleanIngredients, isNoAmountUnit,
} from '../utils/ingredient';
export { calcBmi, bmiCategory, calcBmr, calcHealth, ACTIVITY_FACTOR, GOAL_ADJUST } from '../utils/health';
export { useTheme, setTheme } from '../utils/theme';
