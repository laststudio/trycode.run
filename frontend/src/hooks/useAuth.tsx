import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../utils/api';
import type { User, AuthResponse } from '../types/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<AuthResponse>;
  register: (email: string, password: string, name: string, captchaToken?: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<AuthResponse>;
  resendVerification: (email: string, captchaToken?: string) => Promise<void>;
  forgotPassword: (email: string, captchaToken?: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const response = await api.get<AuthResponse>('/api/auth/me');
      setUser(response.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, captchaToken?: string) => {
    const response = await api.post<AuthResponse>('/api/auth/login', { email, password, captcha_token: captchaToken });
    setUser(response.data.user);
    return response.data;
  };

  const register = async (email: string, password: string, name: string, captchaToken?: string) => {
    const response = await api.post<AuthResponse>('/api/auth/register', { email, password, name, captcha_token: captchaToken });
    if (response.data.user) {
      setUser(response.data.user);
    }
    return response.data;
  };

  const logout = async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  };

  const refresh = async () => {
    const response = await api.post<AuthResponse>('/api/auth/refresh');
    setUser(response.data.user);
  };

  const verifyEmail = async (email: string, code: string) => {
    const response = await api.post<AuthResponse>('/api/auth/verify', { email, code });
    if (response.data.user) {
      setUser(response.data.user);
    }
    return response.data;
  };

  const resendVerification = async (email: string, captchaToken?: string) => {
    await api.post('/api/auth/resend-verification', { email, captcha_token: captchaToken });
  };

  const forgotPassword = async (email: string, captchaToken?: string) => {
    await api.post('/api/auth/forgot-password', { email, captcha_token: captchaToken });
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    await api.post('/api/auth/reset-password', { email, code, new_password: newPassword });
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await api.post('/api/auth/change-password', { current_password: currentPassword, new_password: newPassword });
  };

  const updateProfile = async (data: Partial<User>) => {
    const response = await api.put<User>('/api/auth/me', data);
    setUser(response.data);
    return response.data;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      changePassword,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}