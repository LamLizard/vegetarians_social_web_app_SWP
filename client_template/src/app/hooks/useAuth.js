import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * const { user, isAuthenticated, ready, login, register, logout, changePassword } = useAuth();
 * - user: { id, email, fullName, role, status, ... } | null
 * - ready: false khi đang kiểm tra phiên cũ lúc mở app
 */
export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}
