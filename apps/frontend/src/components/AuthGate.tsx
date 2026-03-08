import React, { useState, useEffect } from 'react';
import { useFirebaseAuthContext } from '../hooks/useFirebaseAuth';
import { sendPasswordReset, resendEmailVerification } from '../services/firebaseAuth';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const {
    user,
    isLoading,
    errorMessage,
    login,
    loginWithGoogleProvider,
    register,
  } = useFirebaseAuthContext();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string>('');
  const [verificationMessage, setVerificationMessage] = useState<string>('');
  const [showEmailVerificationAlert, setShowEmailVerificationAlert] = useState<boolean>(false);

  // Check if user needs email verification
  useEffect(() => {
    if (user && !user.emailVerified && user.email && !user.email.includes('google')) {
      setShowEmailVerificationAlert(true);
    } else {
      setShowEmailVerificationAlert(false);
    }
  }, [user]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setResetMessage('');
    setVerificationMessage('');

    if (mode === 'reset') {
      if (!email) {
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await sendPasswordReset(email);
        if (result.errorMessage) {
          setResetMessage(`Error: ${result.errorMessage}`);
        } else {
          setResetMessage('Password reset email sent! Check your inbox for further instructions.');
          setEmail('');
          // Switch back to login after 3 seconds
          setTimeout(() => {
            setMode('login');
            setResetMessage('');
          }, 3000);
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!email || !password) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        const result = await register(email, password);
        if (result.user) {
          setVerificationMessage('Account created! A verification email has been sent to your inbox.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setIsSubmitting(true);
    setResetMessage('');
    setVerificationMessage('');
    try {
      await loginWithGoogleProvider();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const result = await resendEmailVerification(user);
      if (result.success) {
        setVerificationMessage('Verification email sent! Check your inbox.');
      } else {
        setVerificationMessage(`Error: ${result.errorMessage}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg bg-white px-6 py-4 shadow">
          <p className="text-sm text-slate-600">Checking your session. This will only take a moment.</p>
        </div>
      </div>
    );
  }

  // Show email verification alert if user is logged in but email not verified
  if (user && showEmailVerificationAlert) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
          <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-yellow-900 mb-2">
              ⚠️ Please Verify Your Email
            </h2>
            <p className="text-xs text-yellow-800 mb-3">
              We've sent a verification email to <strong>{user.email}</strong>.
              Please check your inbox and click the verification link to activate your account.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleResendVerification}
                disabled={isSubmitting}
                className="text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Resend Email'}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-300"
              >
                I've Verified
              </button>
            </div>
            {verificationMessage && (
              <p className="mt-2 text-xs text-yellow-800">
                {verificationMessage}
              </p>
            )}
          </div>

          {/* Skip verification for now */}
          <button
            onClick={() => setShowEmailVerificationAlert(false)}
className="w-full text-xs text-slate-600 hover:text-slate-900 underline"
          >
            Continue anyway (not recommended)
          </button>
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h1 className="mb-2 text-center text-xl font-semibold text-slate-900">
          System Design Simulator
        </h1>
        <p className="mb-4 text-center text-sm text-slate-600">
          Build a system. Scale it. Watch it break. Fix it.
        </p>

        {mode !== 'reset' && (
          <div className="mb-4 flex justify-center gap-3 text-xs">
            <button
              type="button"
              className={`rounded-full px-3 py-1 ${mode === 'login' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => {
                setMode('login');
                setResetMessage('');
                setVerificationMessage('');
              }}
              disabled={isSubmitting}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 ${mode === 'register' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => {
                setMode('register');
                setResetMessage('');
                setVerificationMessage('');
              }}
              disabled={isSubmitting}
            >
              Create account
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Reset Password</h2>
            <p className="text-xs text-slate-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoComplete="email"
              required
              disabled={isSubmitting}
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                disabled={isSubmitting}
              />
              {mode === 'register' && (
                <p className="mt-1 text-xs text-slate-500">
                  Use at least 8 characters with uppercase, lowercase and a number.
                </p>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          {resetMessage && (
            <div className={`rounded-md px-2 py-1.5 text-xs ${resetMessage.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {resetMessage}
            </div>
          )}

          {verificationMessage && (
            <div className="rounded-md bg-blue-50 px-2 py-1.5 text-xs text-blue-700">
              {verificationMessage}
            </div>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? (mode === 'login' ? 'Signing in…' : mode === 'register' ? 'Creating account…' : 'Sending…')
              : (mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send Reset Link')}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setPassword('');
              }}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
              disabled={isSubmitting}
            >
              Forgot password?
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setResetMessage('');
              }}
              className="text-xs text-slate-600 hover:text-slate-900 underline"
              disabled={isSubmitting}
            >
              Back to sign in
            </button>
          </div>
        )}

        {mode !== 'reset' && (
          <>
            <div className="my-4 flex items-center gap-2 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleClick}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
