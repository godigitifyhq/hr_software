'use client';

import React, { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';

export function ProtectedRoute({
  children,
  requiredRoles = []
}: {
  children: ReactNode;
  requiredRoles?: string[];
}) {
  const router = useRouter();
  const { session, hasRole } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }

    if (requiredRoles.length > 0) {
      const hasPermission = requiredRoles.some(role => hasRole(role));
      if (!hasPermission) {
        router.push('/unauthorized');
        return;
      }
    }

    setLoading(false);
  }, [session, requiredRoles, router, hasRole]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
