'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const APP_ID = process.env.NEXT_PUBLIC_ZALO_APP_ID!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI!;

// PKCE helpers
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => chars[b % chars.length]).join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

type Status = 'idle' | 'loading' | 'error';

export default function ZaloSSO() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(false);

  function clearZaloData() {
    localStorage.removeItem('zalo_user');
    localStorage.removeItem('zalo_code_verifier');
    localStorage.removeItem('zalo_state');
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const stateParam = params.get('state');
    const errorParam = params.get('error');
    const storedVerifier = localStorage.getItem('zalo_code_verifier');
    const storedState = localStorage.getItem('zalo_state');

    // OAuth callback (in the popup) — process it
    if (code && storedVerifier) {
      if (!stateParam || stateParam !== storedState) {
        clearZaloData();
        setError('Invalid state parameter');
        setStatus('error');
        setIsGenerating(false);
        return;
      }

      setStatus('loading');
      handleOAuthCallback(code, storedVerifier);
      return;
    }

    // Error from Zalo
    if (errorParam) {
      clearZaloData();
      setError(errorParam);
      setStatus('error');
      setIsGenerating(false);
      return;
    }

    // Already logged in
    if (localStorage.getItem('zalo_user')) {
      router.push('/profile');
      return;
    }

    // Fresh start — listen for login from popup, generate login URL
    function onStorage(e: StorageEvent) {
      if (e.key === 'zalo_user' && e.newValue) {
        router.push('/profile');
      }
    }
    window.addEventListener('storage', onStorage);

    clearZaloData();
    generateLoginUrl();

    return () => window.removeEventListener('storage', onStorage);
  }, [router]);

  async function generateLoginUrl() {
    const verifier = generateRandomString(43);
    const challenge = await generateCodeChallenge(verifier);
    const state = generateRandomString(16);

    localStorage.setItem('zalo_code_verifier', verifier);
    localStorage.setItem('zalo_state', state);

    const url = `https://oauth.zaloapp.com/v4/permission?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code_challenge=${challenge}&state=${state}`;
    setLoginUrl(url);
    setIsGenerating(false);
  }

  function openZaloLogin() {
    const w = 500;
    const h = 600;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(loginUrl, 'zalo_login', `width=${w},height=${h},left=${left},top=${top}`);

    // Detect when popup is closed without completing auth
    const checker = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checker);
        if (!localStorage.getItem('zalo_user')) {
          setShowEmailForm(true);
        }
      }
    }, 500);
  }

  async function handleOAuthCallback(code: string, codeVerifier: string) {
    try {
      const tokenResponse = await fetch('/api/zalo/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || tokenData.error) {
        throw new Error(tokenData.error || 'Token exchange failed');
      }

      const profileResponse = await fetch('/api/zalo/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const profile = await profileResponse.json();

      if (!profileResponse.ok || profile.error) {
        throw new Error(profile.error || 'Failed to fetch profile');
      }

      // Store profile, cleanup, close popup — main window picks it up via storage event
      localStorage.setItem('zalo_user', JSON.stringify(profile));
      localStorage.removeItem('zalo_code_verifier');
      localStorage.removeItem('zalo_state');
      window.close();
    } catch (err) {
      console.error('Zalo auth error:', err);
      setError(err instanceof Error ? err.message : 'Failed to authenticate');
      setStatus('error');
    }
  }

  function handleRetry() {
    clearZaloData();
    setStatus('idle');
    setError(null);
    setShowEmailForm(false);
    setIsGenerating(true);
    generateLoginUrl();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-800 p-4 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white text-xl font-bold">NH</span>
            </div>
            <h1 className="text-xl font-bold text-white">Next Health</h1>
            <p className="text-white/80 text-sm mt-1">Zalo SSO Demo</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Idle State */}
            {status === 'idle' && (
              <div className="space-y-4">
                {isGenerating ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-500 text-sm mt-2">Preparing login...</p>
                  </div>
                ) : (
                  <>
                    {/* Zalo SSO Button */}
                    <button
                      onClick={openZaloLogin}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-lg transition-all cursor-pointer"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 48 48" fill="currentColor">
                        <circle cx="24" cy="24" r="20" fill="white" fillOpacity="0.2" />
                        <text x="24" y="30" textAnchor="middle" fontSize="20" fill="white">
                          Z
                        </text>
                      </svg>
                      Đăng nhập với Zalo
                    </button>

                    {!showEmailForm && (
                      <p className="text-center text-sm text-gray-400">
                        Đăng nhập an toàn qua Zalo OAuth
                      </p>
                    )}

                    {/* Email form — revealed after Zalo popup is closed */}
                    {showEmailForm && (
                      <>
                        <div className="flex items-center gap-3 my-2">
                          <div className="flex-1 h-px bg-gray-200"></div>
                          <span className="text-xs text-gray-400">hoặc</span>
                          <div className="flex-1 h-px bg-gray-200"></div>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            alert('Email/password auth is not implemented in this POC.');
                          }}
                          className="space-y-3"
                        >
                          <input
                            type="email"
                            placeholder="Email"
                            required
                            className="w-full border border-gray-200 rounded-xl py-3 px-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                          />
                          <input
                            type="password"
                            placeholder="Mật khẩu"
                            required
                            className="w-full border border-gray-200 rounded-xl py-3 px-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                          />
                          <button
                            type="submit"
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                          >
                            Đăng nhập với Email
                          </button>
                        </form>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Loading State */}
            {status === 'loading' && (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Đang đăng nhập...</p>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <div className="text-red-400 text-3xl mb-2">⚠️</div>
                  <p className="font-medium text-red-800">Đăng nhập thất bại</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>

                <button
                  onClick={handleRetry}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                >
                  Thử lại
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <p className="text-xs text-gray-400 text-center">
              POC - Zalo SSO with PKCE Flow
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
