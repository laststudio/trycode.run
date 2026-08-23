import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, EnvelopeIcon, LockClosedIcon, UserIcon } from '../../utils/icons.ts';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores';
import { useT } from '../../i18n';
import clsx from 'clsx';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { addToast } = useUIStore();
  const t = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      addToast({ type: 'error', title: t('auth.register.passwordMismatch') });
      return;
    }
    if (password.length < 8) {
      addToast({ type: 'error', title: t('auth.register.passwordTooShort') });
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name, captchaToken);
      addToast({ type: 'success', title: t('auth.register.successToast') });
      navigate('/verify');
    } catch (error: any) {
      addToast({
        type: 'error',
        title: t('auth.register.failed'),
        message: error.response?.data?.message || t('auth.register.failed')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">{t('auth.register.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('auth.register.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">{t('auth.register.name')}</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="John Doe"
                required
                autoComplete="name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">{t('auth.register.email')}</label>
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
            <label htmlFor="password" className="block text-sm font-medium mb-1">{t('auth.register.password')}</label>
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
                autoComplete="new-password"
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t('auth.register.passwordHint')}</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">{t('auth.register.confirmPassword')}</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* CAPTCHA placeholder */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-2">{t('auth.register.captchaRequired')}</p>
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
              t('auth.register.submit')
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t('auth.register.haveAccount')}{' '}
            <button onClick={() => navigate('/login')} className="text-primary hover:underline font-medium">
              {t('auth.register.toLogin')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}