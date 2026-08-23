import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LockClosedIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon, ArrowRightIcon } from '../../utils/icons.ts';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores';
import clsx from 'clsx';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword } = useAuth();
  const { addToast } = useUIStore();
  
  const email = searchParams.get('email') || '';
  const code = searchParams.get('code') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return;
    }
    if (password.length < 8) return;
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      setSubmitted(true);
      addToast({ type: 'success', title: 'Password reset successful!' });
    } catch (error: any) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">{submitted ? 'Password Reset!' : 'Set new password'}</h1>
          <p className="text-muted-foreground mt-2">
            {submitted 
              ? 'Your password has been successfully reset' 
              : 'Enter your new password below'}
          </p>
        </div>

        {!submitted && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">New Password</label>
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
              <p className="mt-1 text-xs text-muted-foreground">At least 8 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">Confirm Password</label>
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

            <button
              type="submit"
              disabled={loading || password !== confirmPassword || password.length < 8}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <svg className="w-5 h-5 mx-auto animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}

        {submitted && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold">Password Reset!</h3>
            <p className="text-muted-foreground">Your password has been successfully reset.</p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium mt-4"
            >
              <ArrowRightIcon className="w-4 h-4" />
              Go to Login
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