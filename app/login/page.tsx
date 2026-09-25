'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, ArrowRight, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    fetch('/api/admin/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.setupRequired) {
          router.replace('/setup');
        } else if (data.authenticated) {
          router.replace('/');
        } else {
          setIsChecking(false);
        }
      })
      .catch(() => setIsChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.setupRequired) {
          router.replace('/setup');
          return;
        }
        setError(data.error || 'Access Denied: Invalid admin password.');
      } else {
        if (data.token) {
          sessionStorage.setItem('admin_token', data.token);
        }
        router.replace('/');
      }
    } catch (err) {
      setError('Network error connecting to server.');
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
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 mb-3 shadow-lg shadow-indigo-600/10">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Streamer Studio Authentication</h1>
          <p className="text-xs text-slate-400">
            Enter your administrator password to access broadcast controls and live chat moderation.
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
              Admin Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoFocus
                required
                className="w-full bg-[#181b26] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Authenticate</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
