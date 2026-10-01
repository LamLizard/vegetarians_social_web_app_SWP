import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/auth.service';
import { setToken, setUnauthorizedHandler } from '../services/api';

// =====================================================================
//  "Bộ não phiên" đăng nhập
//  - giữ user + token, lưu vào trình duyệt để F5 không bị văng ra
//      · tick "Ghi nhớ đăng nhập" → localStorage (đóng trình duyệt vẫn còn)
//      · không tick              → sessionStorage (đóng tab là mất)
//  - mở app: gọi /me kiểm tra token còn sống không
//  - token hết hạn / bị thu hồi (401) → tự đăng xuất
//  Trang/Component dùng qua hook useAuth() (src/app/hooks/useAuth.js)
// =====================================================================

const STORAGE_KEY = 'anchay.auth';

function readSaved() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const saved = JSON.parse(store.getItem(STORAGE_KEY));
      if (saved?.token && saved?.user) return saved;
    } catch { /* bị chặn / dữ liệu hỏng → bỏ qua */ }
  }
  return null;
}

function save(session, remember) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (session) (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
  } catch { /* trình duyệt chặn lưu → phiên chỉ sống tới khi F5 */ }
}

const wasRemembered = () => {
  try { return Boolean(localStorage.getItem(STORAGE_KEY)); } catch { return false; }
};

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const saved = readSaved();
    setToken(saved?.token); // api.js cần token ngay từ lần gọi đầu tiên
    return saved; // { token, user } | null
  });
  // Có token cũ → chưa chắc còn hạn, phải hỏi server (/me) xong mới "ready"
  const [ready, setReady] = useState(() => !session);
  // Lý do bị đăng xuất ngoài ý muốn (hết phiên / bị khoá) – AuthPage hiển thị
  const [notice, setNotice] = useState(null);

  const clearSession = useCallback(() => {
    setToken(null);
    save(null);
    setSession(null);
  }, []);

  const startSession = useCallback(({ token, user }, remember) => {
    setToken(token);
    save({ token, user }, remember);
    setSession({ token, user });
    setNotice(null);
    return user;
  }, []);

  // 401 từ bất kỳ API nào (có gửi token) → đăng xuất + ghi lý do
  useEffect(() => {
    setUnauthorizedHandler((data) => {
      clearSession();
      setNotice(data?.locked
        ? { tone: 'alert', title: 'Tài khoản của bạn đang bị khoá.', text: 'Liên hệ hotro@anchay.vn nếu bạn cho rằng đây là nhầm lẫn.' }
        : { tone: 'info', title: 'Phiên đăng nhập đã hết hạn', text: 'Vui lòng đăng nhập lại để tiếp tục.' });
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Mở app: kiểm tra phiên đã lưu (1 lần)
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    authService.getMe()
      .then(({ user }) => {
        if (cancelled) return;
        // Cập nhật thông tin mới nhất (vd. vừa được đổi tên / đổi quyền)
        setSession((s) => {
          if (!s) return s;
          const next = { ...s, user };
          save(next, wasRemembered());
          return next;
        });
      })
      .catch(() => { /* 401 đã được handler ở trên xử lý; mất mạng → giữ phiên cũ */ })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async ({ email, password, remember = true }) => {
    const res = await authService.login({ email: email.trim(), password, remember });
    return startSession(res, remember);
  }, [startSession]);

  const register = useCallback(async ({ fullName, email, password }) => {
    const res = await authService.register({ fullName: fullName.trim(), email: email.trim(), password });
    return startSession(res, true);
  }, [startSession]);

  const logout = useCallback(() => {
    // Gọi API trước (api.js lấy token ngay lúc gọi), rồi xoá phiên phía trình duyệt luôn – không cần chờ
    if (session) authService.logout().catch(() => {});
    clearSession();
    setNotice(null);
  }, [session, clearSession]);

  const changePassword = useCallback(
    ({ currentPassword, newPassword }) => authService.changePassword({ currentPassword, newPassword }),
    [],
  );

  const value = useMemo(() => ({
    user: session?.user ?? null,
    token: session?.token ?? null,
    isAuthenticated: Boolean(session),
    ready,
    notice,
    clearNotice: () => setNotice(null),
    login,
    register,
    logout,
    changePassword,
  }), [session, ready, notice, login, register, logout, changePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
