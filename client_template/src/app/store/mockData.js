// =====================================================================
//  DỮ LIỆU MẪU — bản demo giao diện, CHƯA nối backend.
//  Hình dạng dữ liệu bám theo database (post.status, restaurant.status,
//  user.status, chat_message.status) để sau này thay bằng API dễ dàng.
// =====================================================================

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const HOUR = 60;
const DAY = 24 * HOUR;

// Ảnh từ Unsplash (miễn phí). Mất mạng → component tự dùng nền thay thế.
export const photo = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const PHOTOS = {
  saladBowl:   photo('photo-1512621776951-a57141f2eefd'),
  buddhaBowl:  photo('photo-1623428187969-5da2dcea5ebf'),
  avoToast:    photo('photo-1540914124281-342587941389'),
  tofuSteam:   photo('photo-1758293121435-396ed31ebcf4'),
  tofuFried:   photo('photo-1788535284819-87436fcaef2f'),
  noodleSoup:  photo('photo-1579856896394-07dfa10d7c5b'),
  currySoup:   photo('photo-1613844237701-8f3664fc2eff'),
  acaiBowl:    photo('photo-1627308594190-a057cd4bfac8'),
  smoothie:    photo('photo-1610970881699-44a5587cabec'),
  pumpkinSoup: photo('photo-1547592166-23ac45744acd'),
  tableBowls:  photo('photo-1680173073730-852e0ec93bec'),
  avocadoBowl: photo('photo-1547496502-affa22d38842'),
  greenPlate:  photo('photo-1591522913962-3ecfa6b271f1'),
  vegFlatlay:  photo('photo-1598449426314-8b02525e8733', 1600),
  vegBowlDark: photo('photo-1511690656952-34342bb7c2f2', 1600),
};

// Chế độ ăn - dùng chung cho đăng ký, hồ sơ, quản lý thành viên
export const DIETS = {
  vegan:     { label: 'Thuần chay',        icon: 'flower3' },
  lacto_ovo: { label: 'Chay có trứng sữa', icon: 'egg' },
  periodic:  { label: 'Ăn chay kỳ',        icon: 'moon-stars' }, // mùng 1, rằm
  beginner:  { label: 'Đang tập ăn chay',  icon: 'tree' },
};

// Loại bài đăng
export const POST_TYPES = {
  share:    { label: 'Chia sẻ',     icon: 'chat-heart' },
  recipe:   { label: 'Công thức',   icon: 'journal-richtext' },
  review:   { label: 'Review quán', icon: 'shop' },
  question: { label: 'Hỏi đáp',     icon: 'question-circle' },
};

// Ảnh bìa có sẵn cho trang cá nhân
export const COVERS = [PHOTOS.vegFlatlay, PHOTOS.vegBowlDark, PHOTOS.avocadoBowl, PHOTOS.tableBowls];

// ⚠ Mật khẩu để dạng chữ thường CHỈ vì đây là dữ liệu demo chạy trên trình duyệt.
export const DEMO_ACCOUNTS = {
  member: { email: 'khoi@anchay.vn', password: 'anchay123' },
  admin:  { email: 'admin@anchay.vn', password: 'admin123' },
};

const baseUsers = () => [
  {
    id: 'u1', fullName: 'Lâm Anh Khôi', email: DEMO_ACCOUNTS.member.email, password: DEMO_ACCOUNTS.member.password,
    role: 'member', status: 'active', diet: 'lacto_ovo', city: 'TP. Hồ Chí Minh', joinedAt: ago(210 * DAY),
    bio: 'Sinh viên FPTU, tập ăn chay từ năm nhất. Thích nấu bún riêu chay và săn quán chay ngon quanh Thủ Đức.',
    cover: PHOTOS.vegFlatlay, following: ['u2', 'u4'], followers: ['u2', 'u3', 'u5', 'u7'],
  },
  {
    id: 'admin', fullName: 'Trần Minh Thư', email: DEMO_ACCOUNTS.admin.email, password: DEMO_ACCOUNTS.admin.password,
    role: 'admin', status: 'active', diet: 'vegan', city: 'TP. Hồ Chí Minh', joinedAt: ago(400 * DAY),
    bio: 'Quản trị viên cộng đồng.', cover: PHOTOS.vegBowlDark, following: [], followers: [],
  },
  {
    id: 'u2', fullName: 'Nguyễn Minh Thắng', email: 'thang.nm@gmail.com', password: 'demo1234',
    role: 'member', status: 'active', diet: 'vegan', city: 'Hà Nội', joinedAt: ago(320 * DAY),
    bio: 'Thuần chay 5 năm. Chia sẻ công thức đạm thực vật cho người tập gym.',
    cover: PHOTOS.avocadoBowl, following: ['u1', 'u4'], followers: ['u1', 'u4', 'u5'],
  },
  {
    id: 'u3', fullName: 'Vi Lâm', email: 'vilam@gmail.com', password: 'demo1234',
    role: 'member', status: 'active', diet: 'periodic', city: 'Đà Nẵng', joinedAt: ago(95 * DAY),
    bio: 'Ăn chay mùng 1 và rằm cùng mẹ. Đang học nấu thêm món mới.',
    cover: PHOTOS.tableBowls, following: ['u1'], followers: [],
  },
  {
    id: 'u4', fullName: 'Phạm Thảo Vy', email: 'thaovy.pham@gmail.com', password: 'demo1234',
    role: 'member', status: 'active', diet: 'vegan', city: 'TP. Hồ Chí Minh', joinedAt: ago(180 * DAY),
    bio: 'Food blogger 🌿 Review quán chay Sài Gòn mỗi cuối tuần.',
    cover: PHOTOS.vegBowlDark, following: ['u2'], followers: ['u1', 'u2', 'u5', 'u6'],
  },
  {
    id: 'u5', fullName: 'Lê Gia Huy', email: 'giahuy.le@gmail.com', password: 'demo1234',
    role: 'member', status: 'active', diet: 'beginner', city: 'Cần Thơ', joinedAt: ago(12 * DAY),
    bio: 'Mới tập ăn chay được 2 tuần, mong được mọi người chỉ giáo!',
    cover: PHOTOS.vegFlatlay, following: ['u1', 'u2', 'u4'], followers: [],
  },
  {
    id: 'u6', fullName: 'Hoàng Bảo Ngọc', email: 'baongoc.h@gmail.com', password: 'demo1234',
    role: 'member', status: 'active', diet: 'lacto_ovo', city: 'Huế', joinedAt: ago(60 * DAY),
    bio: 'Chuyên gia dinh dưỡng. Hỏi gì về vi chất cứ tag mình.',
    cover: PHOTOS.avocadoBowl, following: ['u4'], followers: [],
  },
  {
    id: 'u7', fullName: 'Đỗ Quốc Tuấn', email: 'tuan.dq@gmail.com', password: 'demo1234',
    role: 'member', status: 'locked', diet: 'beginner', city: 'Bình Dương', joinedAt: ago(40 * DAY),
    bio: '', cover: PHOTOS.tableBowls, following: [], followers: [],
    lockReason: 'Đăng quảng cáo thực phẩm chức năng nhiều lần sau khi đã nhắc nhở.', lockedAt: ago(3 * DAY),
  },
  {
    id: 'u8', fullName: 'Võ Thanh Tâm', email: 'thanhtam.vo@gmail.com', password: 'demo1234',
    role: 'member', status: 'active', diet: 'periodic', city: 'Vũng Tàu', joinedAt: ago(2 * DAY),
    bio: '', cover: PHOTOS.vegFlatlay, following: [], followers: [],
  },
];

const basePosts = () => [
  {
    id: 'p1', authorId: 'u4', type: 'review', status: 'public', createdAt: ago(55),
    content: 'Cuối tuần ghé "Mộc Chay" ở quận 3, không gian nhiều cây xanh, nhạc nhẹ. Bún Huế chay nước dùng ngọt thanh từ củ quả, chả nấm dai giòn rất vừa miệng. Giá 45-70k/món, hợp túi tiền sinh viên!',
    image: PHOTOS.noodleSoup,
    restaurant: { name: 'Mộc Chay', address: '12 Trần Quốc Thảo, Quận 3, TP.HCM', rating: 4.5 },
    likes: ['u1', 'u2', 'u5', 'u6'], savedBy: [], shares: 3,
    comments: [
      { id: 'c1', authorId: 'u2', content: 'Quán này có món nào thuần chay không bạn, mình không ăn trứng sữa.', createdAt: ago(40) },
      { id: 'c2', authorId: 'u4', content: '@Minh Thắng có nha, menu đánh dấu lá xanh là thuần chay hết đó.', createdAt: ago(32) },
    ],
  },
  {
    id: 'p2', authorId: 'u2', type: 'recipe', status: 'public', createdAt: ago(3 * HOUR),
    content: 'Đậu hũ kho nấm cho ngày mưa ☔ Đạm thực vật cao, ăn với cơm gạo lứt là đủ chất cho bữa tối. Bí quyết: chiên đậu vàng đều rồi mới kho để đậu thấm mà không bị bở.',
    image: PHOTOS.tofuFried,
    recipe: {
      title: 'Đậu hũ kho nấm rơm', cookTime: '35 phút', kcal: 420,
      tag: 'Giàu đạm thực vật', ingredientsNote: 'Thuần chay: không trứng, không sữa. Dùng nước tương và đường thốt nốt.',
    },
    likes: ['u1', 'u4', 'u5', 'u6', 'u3'], savedBy: ['u1'], shares: 12,
    comments: [
      { id: 'c3', authorId: 'u5', content: 'Tối nay em làm thử liền, cảm ơn anh!', createdAt: ago(2 * HOUR) },
    ],
  },
  {
    id: 'p3', authorId: 'u6', type: 'share', status: 'public', createdAt: ago(6 * HOUR),
    content: 'Nhắc nhẹ cả nhà ăn chay lâu năm: vitamin B12 gần như không có trong thực vật. Nên dùng sữa hạt, ngũ cốc có bổ sung B12 hoặc hỏi bác sĩ về viên uống. Thiếu B12 lâu ngày dễ mệt mỏi, tê bì tay chân.',
    image: null,
    likes: ['u1', 'u2', 'u3', 'u4', 'u5'], savedBy: ['u1'], shares: 28,
    comments: [
      { id: 'c4', authorId: 'u3', content: 'Ăn chay kỳ như mình có cần bổ sung không chị?', createdAt: ago(5 * HOUR) },
      { id: 'c5', authorId: 'u6', content: 'Ăn chay kỳ thì thường vẫn đủ từ các bữa mặn em nhé.', createdAt: ago(4 * HOUR) },
    ],
  },
  {
    id: 'p4', authorId: 'u5', type: 'question', status: 'public', createdAt: ago(9 * HOUR),
    content: 'Mọi người ơi, mình mới ăn chay 2 tuần mà hay đói bụng về chiều. Có món ăn vặt nào vừa no lâu vừa healthy không ạ? 🙏',
    image: null,
    likes: ['u2'], savedBy: [], shares: 0,
    comments: [
      { id: 'c6', authorId: 'u1', content: 'Bạn thử hạt điều rang + 1 quả chuối, hoặc sữa đậu nành không đường. Mình hay mang theo đi học.', createdAt: ago(8 * HOUR) },
      { id: 'c7', authorId: 'u4', content: 'Bánh yến mạch chuối nướng nè, làm 1 lần ăn cả tuần!', createdAt: ago(7 * HOUR) },
    ],
  },
  {
    id: 'p5', authorId: 'u1', type: 'recipe', status: 'public', createdAt: ago(1 * DAY + 2 * HOUR),
    content: 'Bữa sáng 10 phút trước giờ học: smoothie bowl yến mạch, chuối, việt quất. Làm tối hôm trước để sẵn trong tủ lạnh, sáng chỉ cần rắc granola lên là xong.',
    image: PHOTOS.acaiBowl,
    recipe: {
      title: 'Smoothie bowl yến mạch việt quất', cookTime: '10 phút', kcal: 380,
      tag: 'Ăn sáng nhanh', ingredientsNote: 'Có sữa chua (sữa bò). Thay bằng sữa chua dừa nếu ăn thuần chay.',
    },
    likes: ['u2', 'u3', 'u4', 'u5', 'u6'], savedBy: ['u5'], shares: 6,
    comments: [],
  },
  {
    id: 'p6', authorId: 'u3', type: 'share', status: 'public', createdAt: ago(1 * DAY + 8 * HOUR),
    content: 'Rằm tháng này cả nhà mình nấu mâm cơm chay: canh bí đỏ, nộm rau, đậu hũ sốt cà. Đơn giản mà ấm cúng lắm 🌕',
    image: PHOTOS.tableBowls,
    likes: ['u1', 'u6'], savedBy: [], shares: 1,
    comments: [],
  },
  {
    id: 'p7', authorId: 'u4', type: 'recipe', status: 'public', createdAt: ago(2 * DAY + 3 * HOUR),
    content: 'Salad quinoa chanh dây, món mình ăn trưa cả tuần mà không ngán. Vị chua ngọt, nhiều chất xơ, mang đi làm tiện.',
    image: PHOTOS.avocadoBowl,
    recipe: {
      title: 'Salad quinoa chanh dây', cookTime: '20 phút', kcal: 350,
      tag: 'Nhiều chất xơ', ingredientsNote: 'Thuần chay: không trứng, không sữa. Sốt dùng dầu oliu và chanh dây.',
    },
    likes: ['u2', 'u5'], savedBy: [], shares: 4,
    comments: [],
  },

  // ---- Bài đang CHỜ DUYỆT (hiện ở trang Admin) ----
  {
    id: 'p8', authorId: 'u8', type: 'recipe', status: 'pending', createdAt: ago(25),
    content: 'Canh rong biển đậu non, món ruột mỗi lần ăn chay kỳ. Nấu 15 phút là xong, ngọt nước tự nhiên.',
    image: PHOTOS.tofuSteam,
    recipe: {
      title: 'Canh rong biển đậu non', cookTime: '15 phút', kcal: 160,
      tag: 'Nhẹ bụng', ingredientsNote: 'Không trứng, không sữa.',
    },
    likes: [], savedBy: [], shares: 0, comments: [],
  },
  {
    id: 'p9', authorId: 'u5', type: 'share', status: 'pending', createdAt: ago(70),
    content: 'Mua được lô viên uống "detox thải độc chay" giảm 5kg/tuần, ai cần inbox mình nha!!!',
    image: null,
    likes: [], savedBy: [], shares: 0, comments: [],
  },
  {
    id: 'p10', authorId: 'u2', type: 'recipe', status: 'pending', createdAt: ago(2 * HOUR),
    content: 'Bánh mì bơ trứng chay cho ngày tập nặng: bánh mì đen, bơ nghiền, cà chua bi.',
    image: PHOTOS.avoToast,
    recipe: {
      title: 'Bánh mì bơ cà chua', cookTime: '8 phút', kcal: 410,
      tag: 'Giàu chất béo tốt', ingredientsNote: 'Đầy đủ dinh dưỡng, ngon miệng.',
    },
    likes: [], savedBy: [], shares: 0, comments: [],
  },
  {
    id: 'p11', authorId: 'u1', type: 'review', status: 'pending', createdAt: ago(3 * HOUR),
    content: 'Quán cơm chay Tịnh Tâm gần FPTU: cơm phần 35k, nhiều món, chủ quán dễ thương. Chỉ tiếc hơi đông giờ trưa.',
    image: PHOTOS.buddhaBowl,
    restaurant: { name: 'Cơm chay Tịnh Tâm', address: 'Lô E2a-7, Đường D1, TP. Thủ Đức', rating: 4 },
    likes: [], savedBy: [], shares: 0, comments: [],
  },

  // ---- Bài BỊ TỪ CHỐI ----
  {
    id: 'p12', authorId: 'u1', type: 'recipe', status: 'rejected', createdAt: ago(3 * DAY),
    content: 'Chè đậu xanh nước cốt dừa nấu nhanh bằng nồi cơm điện.',
    image: null,
    recipe: { title: 'Chè đậu xanh nước cốt dừa', cookTime: '40 phút', kcal: 290, tag: 'Đồ ngọt', ingredientsNote: 'Ngon, dễ làm.' },
    rejectReason: 'Ghi chú thành phần chưa nêu rõ có trứng/sữa hay không (BR-01). Bạn sửa lại rồi đăng lại nhé.',
    moderatedAt: ago(2 * DAY + 20 * HOUR),
    likes: [], savedBy: [], shares: 0, comments: [],
  },
];

// Quán chay gửi lên để xác minh (ID05)
export const seedRestaurants = () => [
  {
    id: 'r1', name: 'Nhà Hàng Chay Sen Hồng', address: '98 Nguyễn Trãi, Quận 1, TP.HCM', status: 'pending_verification',
    submittedBy: 'u4', submittedAt: ago(40), kind: 'vegan', phone: '0283 822 1199', openHours: '09:00 - 21:30',
    image: PHOTOS.tableBowls, priceRange: '60.000 - 150.000đ',
    documents: [
      { name: 'Giấy chứng nhận đăng ký kinh doanh', ok: true },
      { name: 'Ảnh mặt tiền quán', ok: true },
      { name: 'Thực đơn (ảnh chụp)', ok: true },
    ],
    note: 'Quán thuần chay 100%, bếp riêng không dùng chung dụng cụ với đồ mặn.',
  },
  {
    id: 'r2', name: 'Bếp Chay Mẹ Nấu', address: '45/3 Lê Văn Việt, TP. Thủ Đức', status: 'pending_verification',
    submittedBy: 'u1', submittedAt: ago(5 * HOUR), kind: 'lacto_ovo', phone: '0909 123 456', openHours: '06:30 - 14:00',
    image: PHOTOS.currySoup, priceRange: '30.000 - 55.000đ',
    documents: [
      { name: 'Giấy chứng nhận đăng ký kinh doanh', ok: true },
      { name: 'Ảnh mặt tiền quán', ok: false },
      { name: 'Thực đơn (ảnh chụp)', ok: true },
    ],
    note: 'Cơm phần, bún, mì chay. Một số món có trứng gà.',
  },
  {
    id: 'r3', name: 'Chay Garden Coffee', address: '7 Hoà Mỹ, Hải Châu, Đà Nẵng', status: 'pending_verification',
    submittedBy: 'u3', submittedAt: ago(1 * DAY), kind: 'vegan', phone: '0236 355 7788', openHours: '07:00 - 22:00',
    image: PHOTOS.smoothie, priceRange: '35.000 - 90.000đ',
    documents: [
      { name: 'Giấy chứng nhận đăng ký kinh doanh', ok: true },
      { name: 'Ảnh mặt tiền quán', ok: true },
      { name: 'Thực đơn (ảnh chụp)', ok: true },
    ],
    note: 'Cà phê kết hợp đồ ăn nhẹ thuần chay, sữa hạt tự làm.',
  },
  {
    id: 'r4', name: 'Mộc Chay', address: '12 Trần Quốc Thảo, Quận 3, TP.HCM', status: 'verified',
    submittedBy: 'u4', submittedAt: ago(20 * DAY), verifiedAt: ago(18 * DAY), kind: 'vegan', rating: 4.6,
    phone: '0283 930 1122', openHours: '10:00 - 21:00', image: PHOTOS.noodleSoup, priceRange: '45.000 - 70.000đ', documents: [],
  },
  {
    id: 'r5', name: 'Hoa Đăng', address: '38 Huỳnh Khương Ninh, Quận 1, TP.HCM', status: 'verified',
    submittedBy: 'u2', submittedAt: ago(40 * DAY), verifiedAt: ago(38 * DAY), kind: 'lacto_ovo', rating: 4.4,
    phone: '0283 820 8888', openHours: '10:00 - 22:00', image: PHOTOS.greenPlate, priceRange: '80.000 - 200.000đ', documents: [],
  },
  {
    id: 'r6', name: 'Thiện Duyên', address: '112 Ngọc Hà, Ba Đình, Hà Nội', status: 'verified',
    submittedBy: 'u2', submittedAt: ago(60 * DAY), verifiedAt: ago(59 * DAY), kind: 'vegan', rating: 4.7,
    phone: '0243 733 5566', openHours: '09:00 - 21:00', image: PHOTOS.pumpkinSoup, priceRange: '50.000 - 120.000đ', documents: [],
  },
  {
    id: 'r7', name: 'Quán Ăn Vặt Chay 24h', address: 'Không rõ địa chỉ', status: 'rejected',
    submittedBy: 'u7', submittedAt: ago(6 * DAY), kind: 'beginner', documents: [],
    rejectReason: 'Không cung cấp địa chỉ và giấy phép kinh doanh.', moderatedAt: ago(5 * DAY),
  },
];

export const seedNotifications = () => [
  { id: 'n1', userId: 'u1', icon: 'heart-fill', text: 'Nguyễn Minh Thắng và 4 người khác đã thích công thức Smoothie bowl của bạn.', createdAt: ago(3 * HOUR), read: false, link: '/profile/u1' },
  { id: 'n2', userId: 'u1', icon: 'x-circle', tone: 'bad', text: 'Bài "Chè đậu xanh nước cốt dừa" bị từ chối: thiếu ghi chú trứng/sữa (BR-01).', createdAt: ago(2 * DAY + 20 * HOUR), read: false, link: '/profile/u1' },
  { id: 'n3', userId: 'u1', icon: 'person-plus', text: 'Lê Gia Huy đã bắt đầu theo dõi bạn.', createdAt: ago(5 * DAY), read: true, link: '/profile/u5' },
];

// Nhật ký hoạt động của quản trị (trang Admin)
export const seedActivity = () => [
  { id: 'a1', icon: 'check2-circle', tone: 'ok', text: 'Đã duyệt bài "Salad quinoa chanh dây" của Phạm Thảo Vy', createdAt: ago(2 * DAY) },
  { id: 'a2', icon: 'lock', tone: 'bad', text: 'Đã khoá tài khoản Đỗ Quốc Tuấn', createdAt: ago(3 * DAY) },
  { id: 'a3', icon: 'x-circle', tone: 'bad', text: 'Đã từ chối bài "Chè đậu xanh nước cốt dừa" của Lâm Anh Khôi', createdAt: ago(2 * DAY + 20 * HOUR) },
  { id: 'a4', icon: 'patch-check', tone: 'ok', text: 'Đã xác minh quán Mộc Chay', createdAt: ago(18 * DAY) },
];

// Số bài đăng 7 ngày qua (biểu đồ trang Admin) - t: nhãn ngày, posts: bài mới, approved: đã duyệt
export const WEEKLY_POSTS = [
  { t: 'T5', posts: 18, approved: 15 },
  { t: 'T6', posts: 24, approved: 21 },
  { t: 'T7', posts: 31, approved: 27 },
  { t: 'CN', posts: 36, approved: 30 },
  { t: 'T2', posts: 22, approved: 19 },
  { t: 'T3', posts: 27, approved: 22 },
  { t: 'Hôm nay', posts: 14, approved: 9 },
];

// Thực đơn hôm nay - dải thẻ đầu bảng tin (giống "Tin" của Facebook)
export const TODAY_MEALS = [
  { slot: 'breakfast', time: '07:00', title: 'Smoothie yến mạch & chuối', kcal: 380, image: PHOTOS.smoothie },
  { slot: 'lunch', time: '12:00', title: 'Cơm gạo lứt, đậu hũ kho nấm', kcal: 620, image: PHOTOS.buddhaBowl },
  { slot: 'snack', time: '15:30', title: 'Salad rau củ chanh dây', kcal: 260, image: PHOTOS.saladBowl },
  { slot: 'dinner', time: '19:00', title: 'Bún riêu chay chả nấm', kcal: 540, image: PHOTOS.pumpkinSoup },
];

// Vi chất tuần này - bối cảnh cho trợ lý AI
export const MY_MICROS = [
  { name: 'Vitamin B12', short: 'B12', amount: '0,8 / 2,4 µg', status: 'lacking' },
  { name: 'Sắt', short: 'Fe', amount: '14 / 18 mg', status: 'low' },
  { name: 'Canxi', short: 'Ca', amount: '1.020 / 1.000 mg', status: 'enough' },
  { name: 'Omega-3 (ALA)', short: 'Ω3', amount: '1,7 / 1,6 g', status: 'enough' },
];

// =====================================================================
//  BỔ SUNG CHO GIAO DIỆN "VƯỜN" - chuỗi ngày chay, "đã nấu theo", macro món,
//  thẻ khám phá (quẹt), dinh dưỡng hôm nay, thực đơn AI gợi ý.
// =====================================================================

// Chuỗi ngày ăn chay liên tục (ngày) & món đã "muốn nấu" từ thẻ khám phá
const USER_EXTRA = {
  u1: { streak: 42, savedDishes: ['d3'] },
  admin: { streak: 400 },
  u2: { streak: 312 },
  u3: { streak: 3 },
  u4: { streak: 128 },
  u5: { streak: 14 },
  u6: { streak: 67 },
  u7: { streak: 0 },
  u8: { streak: 2 },
};
export const seedUsers = () => baseUsers().map((u) => ({ savedDishes: [], streak: 0, ...u, ...USER_EXTRA[u.id] }));

// Macro (gram/phần) cho bài công thức + ai "đã nấu theo"
const RECIPE_MACROS = {
  p2: { protein: 24, carb: 38, fat: 18 },
  p5: { protein: 14, carb: 52, fat: 12 },
  p7: { protein: 12, carb: 44, fat: 15 },
  p8: { protein: 9, carb: 12, fat: 7 },
  p10: { protein: 13, carb: 46, fat: 22 },
  p12: { protein: 8, carb: 52, fat: 9 },
};
const COOKED_BY = { p2: ['u1', 'u5', 'u3'], p5: ['u5', 'u2'], p7: ['u1'] };

export const seedPosts = () => basePosts().map((p) => ({
  ...p,
  cookedBy: COOKED_BY[p.id] ?? [],
  ...(p.recipe && { recipe: { ...p.recipe, macros: RECIPE_MACROS[p.id] } }),
}));

// Thẻ "Hôm nay nấu gì?" - quẹt phải: muốn nấu, quẹt trái: bỏ qua
export const DISCOVER_DISHES = [
  { id: 'd1', title: 'Bún riêu chay đậu hũ chiên', image: PHOTOS.noodleSoup, time: '40 phút', kcal: 480, diet: 'vegan', tag: 'Món nước', note: 'Nước dùng cà chua chua thanh, đậu hũ chiên giòn, rau thơm.', macros: { protein: 21, carb: 62, fat: 14 } },
  { id: 'd2', title: 'Buddha bowl đậu gà nướng', image: PHOTOS.buddhaBowl, time: '25 phút', kcal: 540, diet: 'vegan', tag: 'Giàu đạm thực vật', note: 'Quinoa, đậu gà nướng, bơ, đậu Hà Lan, sốt mè.', macros: { protein: 24, carb: 58, fat: 22 } },
  { id: 'd3', title: 'Cà ri bí đỏ nước cốt dừa', image: PHOTOS.currySoup, time: '35 phút', kcal: 420, diet: 'vegan', tag: 'Ấm bụng', note: 'Bí đỏ, khoai lang, sả, nước cốt dừa, ăn với bánh mì.', macros: { protein: 9, carb: 48, fat: 21 } },
  { id: 'd4', title: 'Đậu hũ non hấp hành', image: PHOTOS.tofuSteam, time: '15 phút', kcal: 210, diet: 'vegan', tag: 'Nhẹ bụng', note: 'Đậu hũ non hấp, rưới xì dầu nấm và mỡ hành chay.', macros: { protein: 16, carb: 8, fat: 12 } },
  { id: 'd5', title: 'Bánh mì bơ chuối việt quất', image: PHOTOS.avoToast, time: '8 phút', kcal: 390, diet: 'vegan', tag: 'Ăn sáng nhanh', note: 'Bánh mì đen, bơ nghiền, chuối, việt quất, hạt bí.', macros: { protein: 11, carb: 54, fat: 16 } },
  { id: 'd6', title: 'Súp cà chua hạt bí', image: PHOTOS.pumpkinSoup, time: '30 phút', kcal: 260, diet: 'lacto_ovo', tag: 'Có kem sữa', note: 'Cà chua nướng xay mịn, một thìa kem tươi, hạt bí rang.', macros: { protein: 8, carb: 30, fat: 12 } },
  { id: 'd7', title: 'Salad bơ đậu nành Nhật', image: PHOTOS.avocadoBowl, time: '12 phút', kcal: 360, diet: 'vegan', tag: 'Nhiều chất xơ', note: 'Bơ, edamame, dưa leo, đậu phộng rang, chanh.', macros: { protein: 15, carb: 22, fat: 24 } },
  { id: 'd8', title: 'Sinh tố cải kale táo xanh', image: PHOTOS.smoothie, time: '5 phút', kcal: 180, diet: 'vegan', tag: 'Uống liền', note: 'Cải kale, táo xanh, chuối, hạt chia, sữa hạnh nhân.', macros: { protein: 5, carb: 34, fat: 4 } },
];

// Dinh dưỡng đã nạp hôm nay (vòng tròn tiến độ ở cột "Hôm nay")
export const TODAY_NUTRITION = {
  kcal: 1240,
  kcalTarget: 2000,
  items: [
    { key: 'protein', value: 46, target: 75 },
    { key: 'carb', value: 168, target: 260 },
    { key: 'fat', value: 38, target: 60 },
    { key: 'fiber', value: 21, target: 30 },
  ],
};

// Thực đơn 1 ngày - trợ lý Mầm trả về dạng thẻ MealCard (kit)
export const PLAN_MEALS = [
  { slot: 'breakfast', time: '07:00', kcal: 390, tag: 'Ăn sáng nhanh', cookTime: '8 phút', title: 'Bánh mì bơ chuối việt quất', description: 'Chất béo tốt từ bơ, năng lượng từ chuối cho buổi sáng đi học.', macros: { protein: 11, carb: 54, fat: 16 }, image: PHOTOS.avoToast },
  { slot: 'lunch', time: '12:00', kcal: 540, tag: 'Giàu đạm thực vật', cookTime: '25 phút', title: 'Buddha bowl đậu gà nướng', description: 'Quinoa và đậu gà cho đủ axit amin thiết yếu.', macros: { protein: 24, carb: 58, fat: 22 }, image: PHOTOS.buddhaBowl },
  { slot: 'snack', time: '15:30', kcal: 180, tag: 'Uống liền', cookTime: '5 phút', title: 'Sinh tố cải kale táo xanh', description: 'Vitamin C giúp hấp thu sắt từ rau xanh.', macros: { protein: 5, carb: 34, fat: 4 }, image: PHOTOS.smoothie },
  { slot: 'dinner', time: '19:00', kcal: 480, tag: 'Món nước', cookTime: '40 phút', title: 'Bún riêu chay đậu hũ chiên', description: 'Bữa tối ấm bụng, nước dùng từ cà chua và nấm.', macros: { protein: 21, carb: 62, fat: 14 }, image: PHOTOS.noodleSoup },
];

// Mức ăn chay 1 ngày (khu vườn trên trang cá nhân): 0 không, 1 một bữa, 2 hai bữa, 3 cả ngày
export const GARDEN_LEVELS = ['Chưa ghi nhận', 'Một bữa chay', 'Hai bữa chay', 'Chay cả ngày'];

/** Sinh dữ liệu khu vườn cố định theo người dùng (cùng người → cùng kết quả). */
export function gardenFor(user, days = 84, today = new Date()) {
  let seed = [...user.id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) % 2147483647;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    let level;
    if (i < (user.streak ?? 0)) level = rand() < 0.55 ? 3 : 2;
    else if (user.diet === 'periodic') level = rand() < 0.12 ? 1 : 0;
    else level = rand() < 0.5 ? 0 : 1 + Math.floor(rand() * 3);
    out.push({ date, level });
  }
  return out;
}
