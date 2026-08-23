import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, EnvelopeIcon, LockClosedIcon, UserIcon } from '../../utils/icons.ts';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores';
import { useT } from '../../i18n';
import clsx from 'clsx';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { addToast } = useUIStore();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password, captchaToken);
      addToast({ type: 'success', title: t('auth.login.welcomeBack') });
      navigate(from, { replace: true });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: t('auth.login.failed'),
        message: error.response?.data?.message || t('auth.login.invalidCredentials')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">{t('auth.login.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('auth.login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">{t('auth.login.email')}</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">{t('auth.login.password')}</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-2.5 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* CAPTCHA placeholder */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-2">{t('auth.login.captchaRequired')}</p>
            <div className="w-full h-10 bg-background border border-border rounded flex items-center justify-center">
              <span className="text-sm text-muted-foreground">[CAPTCHA Widget - trycap.dev]</span>
            </div>
            <input
              type="hidden"
              value={captchaToken}
              onChange={(e) => setCaptchaToken(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <svg className="w-5 h-5 mx-auto animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              t('auth.login.submit')
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t('auth.login.noAccount')}{' '}
            <button onClick={() => navigate('/register')} className="text-primary hover:underline font-medium">
              {t('auth.login.toRegister')}
            </button>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <button onClick={() => navigate('/forgot-password')} className="text-primary hover:underline">
              {t('auth.login.forgotPassword')}
            </button>
          </p>
        </div>

        <div className="mt-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">{t('auth.login.orContinueWith')}</span>
            </div>
          </div>
          
          <button className="mt-4 w-full py-2.5 border border-border rounded-lg font-medium hover:bg-accent transition-colors flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.804 2.807 1.284 3.499 1.284 1.07 0 2.134-.744 3.499-1.284 1.07-1.804 1.839-1.804 1.839-1.839 0-.729.083-.729.083-.729-.546-1.387-1.333-1.756-1.333-1.756v-2.234c0-.316.201-.577.793-.577.599 0 .793.261.793.577v2.234c3.338-.726 4.033-1.416 4.033-1.416.546 1.387 1.333 1.756 1.333 1.756 1.089.745.083.729.083.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.804 2.807 1.284 3.499 1.284 1.07 0 2.134-.744 3.499-1.284 1.07-1.804 1.839-1.804 1.839-1.839 0-.729.083-.729.083-.729-.546-1.387-1.333-1.756-1.333-1.756v-2.234c0-.316.201-.577.793-.577.599 0 .793.261.793.577v2.234c3.338-.726 4.033-1.416 4.033-1.416.546 1.387 1.333 1.756 1.333 1.756 1.089.745.083.729.083.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.804 2.807 1.284 3.499 1.284 1.07 0 2.134-.744 3.499-1.284 1.07-1.804 1.839-1.804 1.839-1.839 0-.729.083-.729.083-.729-.546-1.387-1.333-1.756-1.333-1.756v-2.234c0-.316.201-.577.793-.577.599 0 .793.261.793.577v2.234c3.338-.726 4.033-1.416 4.033-1.416.546 1.387 1.333 1.756 1.333 1.756 1.089.745.083.729.083.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.804 2.807 1.284 3.499 1.284 1.07 0 2.134-.744 3.499-1.284 1.07-1.804 1.839-1.804 1.839-1.839 0-.729.083-.729.083-.729-.546-1.387-1.333-1.756-1.333-1.756v-2.234c0-.316.201-.577.793-.577.599 0 .793.261.793.577v2.234c3.338-.726 4.033-1.416 4.033-1.416.546 1.387 1.333 1.756 1.333 1.756 1.089.745.083.729.083.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.804 2.807 1.284 3.499 1.284 1.07 0 2.134-.744 3.499-1.284 1.07-1.804 1.839-1.804 1.839-1.839 0-.729.083-.729.083-.729-.546-1.387-1.333-1.756-1.333-1.756v-2.234c0-.316.201-.577.793-.577.599 0 .793.261.793.577v2.234c3.338-.726 4.033-1.416 4.033-1.416.546 1.387 1.333 1.756 1.333 1.756 1.089.745.083.729.083.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.804 2.807 1.284 3.499 1.284 1.07 0 2.134-.744 3.499-1.284 1.07-1.804 1.839-1.804 1.839-1.839 0-.729.083-.729.083-.729-.546-1.387-1.333-1.756-1.333-1.756" />
            </svg>
            <span>{t('auth.login.continueWithGithub')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}