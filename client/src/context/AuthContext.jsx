// "bộ não phiên": giữ user+token, lưu localStorage, logout, check phiên
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/auth.service';
import { ApiError, AUTH_TOKEN_KEY, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);

const getToken = (payload) => payload?.token ?? payload?.accessToken ?? payload?.data?.token ?? null;
const getUser = (payload) => payload?.user ?? payload?.data?.user ?? payload?.data ?? payload;

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      if (!token) {
        setIsCheckingSession(false);
        return;
      }

      try {
        const payload = await authService.getMe();
        if (active) setUser(getUser(payload));
      } catch (error) {
        if (active && !(error instanceof ApiError && error.status === 401)) logout();
      } finally {
        if (active) setIsCheckingSession(false);
      }
    }

    checkSession();
    return () => { active = false; };
  }, [logout, token]);

  const login = useCallback(async (credentials) => {
    const payload = await authService.login(credentials);
    const nextToken = getToken(payload);
    if (!nextToken) throw new Error('Login response did not include an access token.');
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(getUser(payload));
    return payload;
  }, []);

  const register = useCallback(async (details) => {
    const payload = await authService.register(details);
    const nextToken = getToken(payload);
    if (nextToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
      setToken(nextToken);
      setUser(getUser(payload));
    }
    return payload;
  }, []);

  const changePassword = useCallback((details) => authService.changePassword(details), []);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isCheckingSession,
    login,
    register,
    logout,
    changePassword,
  }), [changePassword, isCheckingSession, login, logout, register, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used inside AuthProvider.');
  return context;
}

export default AuthContext;