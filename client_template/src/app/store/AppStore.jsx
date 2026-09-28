import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  seedUsers, seedPosts, seedRestaurants, seedNotifications, seedActivity, COVERS,
} from './mockData';
import useAuth from '../hooks/useAuth';

// =====================================================================
//  STORE của bản demo: giữ dữ liệu (bài viết, quán, thông báo...) trong React + localStorage.
//  ĐĂNG NHẬP đã chạy thật qua server: ai đang đăng nhập lấy từ AuthContext (useAuth),
//  store chỉ "ghép" tài khoản đó vào danh sách users mẫu (khớp theo email) để các trang dùng tiếp.
//  Khi các nghiệp vụ khác có API: thay phần thân các hàm trong `actions` bằng lời gọi API.
// =====================================================================

const STORAGE_KEY = 'anchay-vuon-v1'; // khác bản trước để 2 app chạy chung localhost không lẫn dữ liệu
const uid = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();

const seed = () => ({
  users: seedUsers(),
  posts: seedPosts(),
  restaurants: seedRestaurants(),
  notifications: seedNotifications(),
  activity: seedActivity(),
});

const TABLES = ['users', 'posts', 'restaurants', 'notifications', 'activity'];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Chỉ dùng dữ liệu đã lưu khi đủ các bảng; dữ liệu cũ / hỏng → quay về dữ liệu mẫu
    if (saved && TABLES.every((k) => Array.isArray(saved[k]))) return saved;
  } catch { /* trình duyệt chặn localStorage → dùng dữ liệu mẫu */ }
  return seed();
}

const sameEmail = (a = '', b = '') => a.toLowerCase() === b.toLowerCase();

/** Tài khoản từ server → hình dạng user mà các trang demo đang dùng */
const localUserFrom = (account) => ({
  id: `acc${account.id}`, fullName: account.fullName, email: account.email,
  role: account.role, status: account.status, diet: '', city: '', bio: account.bio ?? '',
  joinedAt: account.createdAt ?? now(), cover: COVERS[0], following: [], followers: [], savedDishes: [], streak: 0,
});

const toggleIn = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const mapById = (list, id, fn) => list.map((x) => (x.id === id ? fn(x) : x));

function reducer(state, { type, ...a }) {
  switch (type) {
    // Tài khoản thật vừa đăng nhập → cập nhật user mẫu cùng email, chưa có thì thêm mới
    case 'SYNC_ACCOUNT': {
      const idx = state.users.findIndex((u) => sameEmail(u.email, a.account.email));
      const fromServer = {
        fullName: a.account.fullName, email: a.account.email, role: a.account.role, status: a.account.status,
      };
      if (idx >= 0) {
        const cur = state.users[idx];
        if (Object.keys(fromServer).every((k) => cur[k] === fromServer[k])) return state;
        return { ...state, users: mapById(state.users, cur.id, (u) => ({ ...u, ...fromServer })) };
      }
      return { ...state, users: [...state.users, localUserFrom(a.account)] };
    }
    case 'RESET':
      return seed();

    case 'CREATE_POST':
      return { ...state, posts: [a.post, ...state.posts] };
    case 'DELETE_POST':
      return { ...state, posts: state.posts.filter((p) => p.id !== a.postId) };
    case 'TOGGLE_LIKE':
      return { ...state, posts: mapById(state.posts, a.postId, (p) => ({ ...p, likes: toggleIn(p.likes, a.userId) })) };
    case 'TOGGLE_SAVE':
      return { ...state, posts: mapById(state.posts, a.postId, (p) => ({ ...p, savedBy: toggleIn(p.savedBy, a.userId) })) };
    case 'TOGGLE_COOKED':
      return { ...state, posts: mapById(state.posts, a.postId, (p) => ({ ...p, cookedBy: toggleIn(p.cookedBy ?? [], a.userId) })) };
    case 'TOGGLE_DISH':
      return { ...state, users: mapById(state.users, a.userId, (u) => ({ ...u, savedDishes: toggleIn(u.savedDishes ?? [], a.dishId) })) };
    case 'SHARE':
      return { ...state, posts: mapById(state.posts, a.postId, (p) => ({ ...p, shares: p.shares + 1 })) };
    case 'ADD_COMMENT':
      return { ...state, posts: mapById(state.posts, a.postId, (p) => ({ ...p, comments: [...p.comments, a.comment] })) };

    case 'UPDATE_PROFILE':
      return { ...state, users: mapById(state.users, a.userId, (u) => ({ ...u, ...a.patch })) };
    case 'TOGGLE_FOLLOW':
      return {
        ...state,
        users: state.users.map((u) => {
          if (u.id === a.userId) return { ...u, following: toggleIn(u.following, a.targetId) };
          if (u.id === a.targetId) return { ...u, followers: toggleIn(u.followers, a.userId) };
          return u;
        }),
      };
    case 'MARK_NOTIFICATIONS_READ':
      return { ...state, notifications: state.notifications.map((n) => (n.userId === a.userId ? { ...n, read: true } : n)) };

    // ---- Quản trị ----
    case 'MODERATE_POST':
      return {
        ...state,
        posts: mapById(state.posts, a.postId, (p) => ({
          ...p,
          status: a.approve ? 'public' : 'rejected',
          rejectReason: a.approve ? undefined : a.reason,
          moderatedAt: now(),
          // Bài được duyệt thì lên đầu bảng tin
          createdAt: a.approve ? now() : p.createdAt,
        })),
        notifications: [a.notification, ...state.notifications],
        activity: [a.activity, ...state.activity],
      };
    case 'MODERATE_RESTAURANT':
      return {
        ...state,
        restaurants: mapById(state.restaurants, a.id, (r) => ({
          ...r,
          status: a.approve ? 'verified' : 'rejected',
          rejectReason: a.approve ? undefined : a.reason,
          verifiedAt: a.approve ? now() : undefined,
          moderatedAt: now(),
        })),
        notifications: [a.notification, ...state.notifications],
        activity: [a.activity, ...state.activity],
      };
    case 'SET_USER_STATUS':
      return {
        ...state,
        users: mapById(state.users, a.userId, (u) => ({
          ...u,
          status: a.status,
          lockReason: a.status === 'locked' ? a.reason : undefined,
          lockedAt: a.status === 'locked' ? now() : undefined,
        })),
        activity: [a.activity, ...state.activity],
      };
    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const auth = useAuth();
  const account = auth.user;

  // Người đang đăng nhập = user mẫu cùng email (vd. khoi@anchay.vn → u1), không có thì acc<id>
  const sessionUserId = account
    ? state.users.find((u) => sameEmail(u.email, account.email))?.id ?? `acc${account.id}`
    : null;

  useEffect(() => {
    if (account) dispatch({ type: 'SYNC_ACCOUNT', account });
  }, [account]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* hết dung lượng / bị chặn → bỏ qua, app vẫn chạy trong phiên này */ }
  }, [state]);

  const userById = useCallback((id) => state.users.find((u) => u.id === id), [state.users]);

  const actions = useMemo(() => ({
    // Đăng nhập / đăng ký nằm ở AuthContext (useAuth). Giữ logout ở đây để các menu cũ gọi được.
    logout: auth.logout,
    resetDemo: () => dispatch({ type: 'RESET' }),

    /** Bài mới luôn ở trạng thái "pending" – chờ quản trị viên duyệt */
    createPost(fields) {
      const post = {
        id: uid('p'), authorId: sessionUserId, status: 'pending', createdAt: now(),
        likes: [], savedBy: [], cookedBy: [], shares: 0, comments: [], image: null, ...fields,
      };
      dispatch({ type: 'CREATE_POST', post });
      return post;
    },
    deletePost: (postId) => dispatch({ type: 'DELETE_POST', postId }),
    toggleLike: (postId) => dispatch({ type: 'TOGGLE_LIKE', postId, userId: sessionUserId }),
    toggleSave: (postId) => dispatch({ type: 'TOGGLE_SAVE', postId, userId: sessionUserId }),
    /** "Đã nấu theo" – phản ứng riêng cho bài công thức */
    toggleCooked: (postId) => dispatch({ type: 'TOGGLE_COOKED', postId, userId: sessionUserId }),
    /** Lưu / bỏ lưu món từ thẻ khám phá */
    toggleDish: (dishId) => dispatch({ type: 'TOGGLE_DISH', dishId, userId: sessionUserId }),
    share: (postId) => dispatch({ type: 'SHARE', postId }),
    addComment: (postId, content) => dispatch({
      type: 'ADD_COMMENT', postId,
      comment: { id: uid('c'), authorId: sessionUserId, content: content.trim(), createdAt: now() },
    }),
    updateProfile: (patch) => dispatch({ type: 'UPDATE_PROFILE', userId: sessionUserId, patch }),
    toggleFollow: (targetId) => dispatch({ type: 'TOGGLE_FOLLOW', userId: sessionUserId, targetId }),
    markNotificationsRead: () => dispatch({ type: 'MARK_NOTIFICATIONS_READ', userId: sessionUserId }),

    // ---- Quản trị ----
    moderatePost(postId, approve, reason = '') {
      const post = state.posts.find((p) => p.id === postId);
      const author = userById(post.authorId);
      const name = post.recipe?.title ?? post.restaurant?.name ?? `${post.content.slice(0, 40)}…`;
      dispatch({
        type: 'MODERATE_POST', postId, approve, reason,
        notification: {
          id: uid('n'), userId: post.authorId, createdAt: now(), read: false, link: `/profile/${post.authorId}`,
          icon: approve ? 'check2-circle' : 'x-circle', tone: approve ? 'ok' : 'bad',
          text: approve ? `Bài "${name}" của bạn đã được duyệt và hiển thị công khai.` : `Bài "${name}" bị từ chối: ${reason}`,
        },
        activity: {
          id: uid('a'), createdAt: now(), icon: approve ? 'check2-circle' : 'x-circle', tone: approve ? 'ok' : 'bad',
          text: `Đã ${approve ? 'duyệt' : 'từ chối'} bài "${name}" của ${author?.fullName}`,
        },
      });
    },
    moderateRestaurant(id, approve, reason = '') {
      const r = state.restaurants.find((x) => x.id === id);
      dispatch({
        type: 'MODERATE_RESTAURANT', id, approve, reason,
        notification: {
          id: uid('n'), userId: r.submittedBy, createdAt: now(), read: false, link: '/',
          icon: approve ? 'patch-check' : 'x-circle', tone: approve ? 'ok' : 'bad',
          text: approve ? `Quán "${r.name}" bạn gửi đã được xác minh.` : `Quán "${r.name}" chưa được xác minh: ${reason}`,
        },
        activity: {
          id: uid('a'), createdAt: now(), icon: approve ? 'patch-check' : 'x-circle', tone: approve ? 'ok' : 'bad',
          text: `Đã ${approve ? 'xác minh' : 'từ chối'} quán ${r.name}`,
        },
      });
    },
    setUserStatus(userId, status, reason = '') {
      const u = userById(userId);
      dispatch({
        type: 'SET_USER_STATUS', userId, status, reason,
        activity: {
          id: uid('a'), createdAt: now(), icon: status === 'locked' ? 'lock' : 'unlock', tone: status === 'locked' ? 'bad' : 'ok',
          text: `Đã ${status === 'locked' ? 'khoá' : 'mở khoá'} tài khoản ${u?.fullName}`,
        },
      });
    },
  }), [state.posts, state.restaurants, sessionUserId, userById, auth.logout]);

  // sessionUserId vẫn nằm trong `state` như trước để code cũ không phải sửa
  const value = useMemo(
    () => ({ state: { ...state, sessionUserId }, actions, userById, account }),
    [state, sessionUserId, actions, userById, account],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Toàn bộ dữ liệu + hành động. */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải nằm trong <AppStoreProvider>');
  return ctx;
}

/** Người đang đăng nhập (hoặc null). */
export function useCurrentUser() {
  const { state, userById, account } = useApp();
  if (!account) return null;
  // Lần render đầu sau khi đăng nhập, SYNC_ACCOUNT chưa kịp chạy → tạm dựng từ dữ liệu server
  return userById(state.sessionUserId) ?? localUserFrom(account);
}
