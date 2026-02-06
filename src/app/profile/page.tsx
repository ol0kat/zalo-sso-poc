'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserProfile = Record<string, any>;

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [provider, setProvider] = useState<'zalo' | 'google' | null>(null);

  useEffect(() => {
    const zaloStored = localStorage.getItem('zalo_user');
    const googleStored = localStorage.getItem('google_user');

    if (googleStored) {
      setProfile(JSON.parse(googleStored));
      setProvider('google');
    } else if (zaloStored) {
      setProfile(JSON.parse(zaloStored));
      setProvider('zalo');
    } else {
      router.push('/');
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem('zalo_user');
    localStorage.removeItem('google_user');
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    router.push('/');
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isGoogle = provider === 'google';
  const avatarUrl = isGoogle ? profile.picture : profile.picture?.data?.url;
  const name = profile.name || 'Unknown';
  const subtitle = isGoogle
    ? profile.email
    : `Zalo ID: ${profile.id}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-800 p-4 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Profile Header with Avatar */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-8 text-center">
            <div className="relative inline-block mb-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center border-4 border-white shadow-lg">
                  <span className="text-white text-3xl font-bold">
                    {name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-400 rounded-full flex items-center justify-center border-3 border-white">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">{name}</h1>
            <p className="text-white/80 text-sm mt-1">{subtitle}</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
              isGoogle ? 'bg-white/20 text-white' : 'bg-blue-400/30 text-white'
            }`}>
              {isGoogle ? 'Google' : 'Zalo'}
            </span>
          </div>

          <div className="p-6 space-y-4">
            {/* Full API Response */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Full {isGoogle ? 'Google' : 'Zalo'} API Response
              </p>
              <pre className="text-xs text-gray-700 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {JSON.stringify(profile, null, 2)}
              </pre>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-3 px-6 rounded-xl transition-all"
            >
              Đăng xuất
            </button>
          </div>

          <div className="px-6 pb-6">
            <p className="text-xs text-gray-400 text-center">
              POC - Zalo SSO + Google One Tap
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
