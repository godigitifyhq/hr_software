'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';

export function Header() {
  const router = useRouter();
  const { session, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Always clear the local session even if the network request fails.
    }
    logout();
    router.push('/login');
  };

  return (
    <header className="bg-primary text-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold text-xl">
            SVGOI Appraisal
          </Link>
          {session && (
            <nav className="flex gap-4 ml-8">
              <Link href="/dashboard" className="hover:text-gray-200">
                Dashboard
              </Link>
              <Link href="/appraisals" className="hover:text-gray-200">
                Appraisals
              </Link>
            </nav>
          )}
        </div>

        <div>
          {session ? (
            <div className="flex items-center gap-4">
              <span className="text-sm">{session.user.firstName} {session.user.lastName}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link href="/login" className="hover:text-gray-200">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
