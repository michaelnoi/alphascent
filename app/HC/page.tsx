import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDB } from '@/app/lib/db';
import CategoryPage from '@/app/components/CategoryPage';

async function validateToken(keyHash: string): Promise<boolean> {
  try {
    const db = getDB();
    
    const query = `
      SELECT id, expires_at, is_revoked
      FROM access_keys 
      WHERE key_hash = ?
    `;
    
    const result = await db.prepare(query).bind(keyHash).first<{
      id: string;
      expires_at: string | null;
      is_revoked: number;
    }>();
    
    if (!result || result.is_revoked) {
      return false;
    }
    
    if (result.expires_at) {
      const expiryDate = new Date(result.expires_at);
      if (expiryDate < new Date()) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

export default async function HCPage() {
  const cookieStore = await cookies();
  const keyHash = cookieStore.get('hc_access_token')?.value;
  
  if (!keyHash) {
    redirect('/HC/auth');
  }
  
  const isValid = await validateToken(keyHash);
  
  if (!isValid) {
    redirect('/HC/auth');
  }
  
  return <CategoryPage category="cs.HC" displayName="Human-Computer Interaction" />;
}

