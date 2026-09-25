'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, KeyRound, AlertCircle } from 'lucide-react';

export default function AdminSetupPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    fetch('/api/admin/status')
      .then((res) => res.json())
      .then((data) => {
        if (!data.setupRequired) {
          router.replace('/login');
        } else {
          setIsChecking(false);
        }
      })
      .catch(() => setIsChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to configure admin password.');
      } else {
        if (data.token) {
          sessionStorage.setItem('admin_token', data.token);
        }
        router.replace('/');
      }
    } catch (err) {
      setError('Network error during setup.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] flex flex-col justify-center items-center p-4 selection:bg-indigo-500">
      <div className="max-w-md w-full bg-[#12141c] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center mx-auto text-white mb-3 shadow-lg shadow-emerald-500/20">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">First-Time Admin Setup</h1>
          <p className="text-xs text-slate-400">
            Create an administrator password. This will be required to broadcast and moderate.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs rounded-xl flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Create Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoFocus
              required
              minLength={6}
              className="w-full bg-[#181b26] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              minLength={6}
              className="w-full bg-[#181b26] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Initialize Admin Account</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
