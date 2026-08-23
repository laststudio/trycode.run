import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnvelopeIcon, ArrowRightIcon } from '../../utils/icons.ts';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores';
import clsx from 'clsx';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const { addToast } = useUIStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email, captchaToken);
      setSent(true);
      addToast({ type: 'success', title: 'Reset link sent! Check your email.' });
    } catch (error: any) {
      addToast({ type: 'success', title: 'If the email exists, a reset link has been sent' });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">{sent ? 'Check your email' : 'Forgot password?'}</h1>
          <p className="text-muted-foreground mt-2">
            {sent 
              ? 'We\'ve sent a password reset link to your email' 
              : 'Enter your email and we\'ll send you a reset link'}
          </p>
        </div>

        {!sent && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
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

            {/* CAPTCHA placeholder */}
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-2">CAPTCHA verification required</p>
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
                'Send Reset Link'
              )}
            </button>
          </form>
        )}

        {sent && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold">Reset link sent!</h3>
            <p className="text-muted-foreground">
              We've sent a password reset link to <strong>{email}</strong>.
              The link expires in 1 hour.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              <ArrowRightIcon className="w-4 h-4" />
              Back to login
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Remember your password?{' '}
            <button onClick={() => navigate('/login')} className="text-primary hover:underline font-medium">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}