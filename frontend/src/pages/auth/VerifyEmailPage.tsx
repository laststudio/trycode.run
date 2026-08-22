import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, EnvelopeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores';
import clsx from 'clsx';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyEmail, resendVerification } = useAuth();
  const { addToast } = useUIStore();
  
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await verifyEmail(email, code);
      addToast({ type: 'success', title: 'Email verified! Welcome to TryCode.' });
      navigate('/');
    } catch (error: any) {
      addToast({ 
        type: 'error', 
        title: 'Verification failed', 
        message: error.response?.data?.message || 'Invalid code' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification(email, captchaToken);
      addToast({ type: 'success', title: 'Verification code sent' });
    } catch (error: any) {
      addToast({ type: 'error', title: 'Failed to resend', message: error.message });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
            <EnvelopeIcon className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold">Verify your email</h1>
          <p className="text-muted-foreground mt-2">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Verification Code</label>
            <div className="flex gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  value={code[i] || ''}
                  onChange={(e) => {
                    const newCode = code.split('');
                    newCode[i] = e.target.value.toUpperCase();
                    setCode(newCode.join(''));
                    if (e.target.value && i < 5) {
                      (document.getElementById(`code-${i + 1}`) as HTMLInputElement)?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !e.target.value && i > 0) {
                      (document.getElementById(`code-${i - 1}`) as HTMLInputElement)?.focus();
                    }
                  }}
                  id={`code-${i}`}
                  className="w-10 h-12 text-center text-2xl font-mono bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  maxLength={1}
                  autoComplete="one-time-code"
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <svg className="w-5 h-5 mx-auto animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              'Verify Email'
            )}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full py-2 text-sm text-primary hover:underline disabled:opacity-50"
          >
            {resending ? (
              <>
                <ArrowPathIcon className="w-4 h-4 inline animate-spin mr-1" />
                Resending...
              </>
            ) : (
              'Didn\'t receive the code? Resend'
            )}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Didn't receive the email? Check your spam folder or{' '}
          <button onClick={handleResend} disabled={resending} className="text-primary hover:underline">
            request a new code
          </button>
        </p>

        {email && (
          <div className="mt-6 p-3 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground">
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
        )}
      </div>
    </div>
  );
}