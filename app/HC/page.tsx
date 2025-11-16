'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CategoryPage from '@/app/components/CategoryPage';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default function HCPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    const token = getCookie('hc_access_token');
    if (!token) {
      router.replace('/hc/auth');
    } else {
      setIsChecking(false);
    }
  }, [router]);
  
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Checking access...</div>
      </div>
    );
  }
  
  return <CategoryPage category="cs.HC" displayName="Human-Computer Interaction" />;
}

