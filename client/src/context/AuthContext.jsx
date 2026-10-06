// "bộ não phiên": giữ user+token, lưu localStorage, logout, check phiên
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/auth.service';
import { apiFetch, ApiError, AUTH_TOKEN_KEY, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);
const AUTH_USER_KEY = 'auth_user';

const getToken = (payload) => payload?.token ?? payload?.accessToken ?? payload?.data?.token ?? null;
const getUser = (payload) => payload?.user ?? payload?.data?.user ?? payload?.data ?? payload;

function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [user, setUser] = useState(getCachedUser);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const saveUser = useCallback((nextUser) => {
    setUser(nextUser);
    if (nextUser) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
    else localStorage.removeItem(AUTH_USER_KEY);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    saveUser(null);
  }, [saveUser]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    apiFetch('/health').catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      if (!token) {
        setIsCheckingSession(false);
        return;
      }

      try {
        const payload = await authService.getMe();
        if (active) saveUser(getUser(payload));
      } catch (error) {
        if (active && error instanceof ApiError && error.status === 401) logout();
      } finally {
        if (active) setIsCheckingSession(false);
      }
    }

    checkSession();
    return () => { active = false; };
  }, [logout, saveUser, token]);

  const login = useCallback(async (credentials) => {
    const payload = await authService.login(credentials);
    const nextToken = getToken(payload);
    if (!nextToken) throw new Error('Login response did not include an access token.');
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
    setToken(nextToken);
    saveUser(getUser(payload));
    return payload;
  }, [saveUser]);

  const register = useCallback(async (details) => {
    const payload = await authService.register(details);
    return payload;
  }, []);

  const verifyRegisterOtp = useCallback(async (details) => {
    const payload = await authService.verifyRegisterOtp(details);
    const nextToken = getToken(payload);
    if (!nextToken) throw new Error('Verification response did not include an access token.');
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
    setToken(nextToken);
    saveUser(getUser(payload));
    return payload;
  }, [saveUser]);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isCheckingSession,
    login,
    register,
    verifyRegisterOtp,
    logout,
  }), [isCheckingSession, login, logout, register, token, user, verifyRegisterOtp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used inside AuthProvider.');
  return context;
}

export default AuthContext;