import React, { useState } from 'react';

import {
  BrainCircuit,
  Lock,
  Mail,
  User,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

import { registerApi } from "../services/api";

interface RegisterViewProps {
  onBackToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onBackToLogin,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError(null);
    setSuccess(null);

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // -----------------------------
    // Frontend validation
    // -----------------------------

    if (
      !normalizedName ||
      !normalizedEmail ||
      !password ||
      !confirmPassword
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // -----------------------------
    // Backend registration
    // -----------------------------

    try {
      setIsSubmitting(true);

      await registerApi(
        normalizedName,
        normalizedEmail,
        password
      );

      setSuccess(
        'Account created successfully. Redirecting to sign in...'
      );

      // Clear form
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      // Give the success message a moment to display
      setTimeout(() => {
        onBackToLogin();
      }, 1200);
    } catch (err) {
      console.error('Registration failed:', err);

      const message =
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.';

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-900/20">
            <BrainCircuit className="h-7 w-7 text-white" />
          </div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
            Customer Support Assistant
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Support knowledge and agent assistance workspace
          </p>
        </div>

        {/* Register Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">

          <div className="mb-7">
            <h2 className="text-xl font-semibold text-white">
              Create account
            </h2>

            <p className="mt-1.5 text-sm text-slate-400">
              Create your account to access the support workspace.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />

              <div>
                <p className="font-medium text-rose-300">
                  Registration failed
                </p>

                <p className="mt-0.5 text-rose-400/90">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />

              <div>
                <p className="font-medium text-emerald-300">
                  Registration successful
                </p>

                <p className="mt-0.5 text-emerald-400/90">
                  {success}
                </p>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* Full Name */}
            <div>
              <label
                htmlFor="register-name"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Full name
              </label>

              <div className="relative">
                <User
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                />

                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setName(e.target.value);

                    if (error) {
                      setError(null);
                    }
                  }}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="register-email"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Email address
              </label>

              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                />

                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setEmail(e.target.value);

                    if (error) {
                      setError(null);
                    }
                  }}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="register-password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Password
              </label>

              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                />

                <input
                  id="register-password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  autoComplete="new-password"
                  required
                  value={password}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setPassword(e.target.value);

                    if (error) {
                      setError(null);
                    }
                  }}
                  placeholder="Create a password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-11 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                />

                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  disabled={isSubmitting}
                  onClick={() =>
                    setShowPassword(
                      (previous) => !previous
                    )
                  }
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="mt-1.5 text-xs text-slate-500">
                Use at least 8 characters.
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="register-confirm-password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Confirm password
              </label>

              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                />

                <input
                  id="register-confirm-password"
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setConfirmPassword(
                      e.target.value
                    );

                    if (error) {
                      setError(null);
                    }
                  }}
                  placeholder="Re-enter your password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-11 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                />

                <button
                  type="button"
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                  disabled={isSubmitting}
                  onClick={() =>
                    setShowConfirmPassword(
                      (previous) => !previous
                    )
                  }
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition disabled:opacity-50"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Create Account */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?
            </p>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onBackToLogin}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Sign in
            </button>
          </div>

          {/* Security */}
          <div className="mt-7 border-t border-slate-800 pt-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-slate-800 p-2">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-300">
                  Secure account access
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Account permissions are assigned by the
                  authenticated system and are not selected during
                  public registration.
                </p>
              </div>
            </div>
          </div>

        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Customer Support Assistant
        </p>

      </div>
    </div>
  );
};