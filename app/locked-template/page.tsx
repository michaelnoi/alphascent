import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDB } from '@/app/lib/db';
import CategoryPage from '@/app/components/CategoryPage';

export const runtime = 'edge';

async function validateToken(keyHash: string): Promise<boolean> {
  try {
    const db = getDB();
    
    const result = await db
      .prepare('SELECT id, expires_at, is_revoked FROM access_keys WHERE key_hash = ?')
      .bind(keyHash)
      .first<{
        id: string;
        expires_at: string | null;
        is_revoked: number;
      }>();
    
    if (!result) {
      return false;
    }
    
    if (result.is_revoked) {
      return false;
    }
    
    if (result.expires_at) {
      const expiresAtStr = String(result.expires_at).trim();
      if (expiresAtStr) {
        const expiryDate = new Date(expiresAtStr);
        if (isNaN(expiryDate.getTime())) {
          return false;
        }
        const now = new Date();
        if (expiryDate <= now) {
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

export default async function LockedTemplatePage() {
  const cookieStore = await cookies();
  // NOTE: Update cookie name to match what is set in the auth API route
  const keyHash = cookieStore.get('template_access_token')?.value;
  
  if (!keyHash) {
    // NOTE: Update redirect path to your auth page
    redirect('/locked-template/auth');
  }
  
  const isValid = await validateToken(keyHash);
  if (!isValid) {
    // NOTE: Update redirect path to your auth page
    redirect('/locked-template/auth');
  }
  
  // NOTE: Pass the correct category ID here
  return <CategoryPage category="cs.TEMPLATE" displayName="Locked Template Category" />;
}
