import { getDB, getEnv } from './db';

export interface AccessKey {
  id: string;
  key_hash: string;
  user_name: string | null;
  user_email: string | null;
  accessible_dates: string;
  issued_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  request_count: number;
  is_revoked: boolean;
  notes: string | null;
}

export async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function validateAccessKey(key: string | null): Promise<AccessKey | null> {
  if (!key) return null;

  const db = getDB();
  const keyHash = await hashKey(key);

  const result = await db
    .prepare('SELECT * FROM access_keys WHERE key_hash = ? AND is_revoked = 0')
    .bind(keyHash)
    .first<AccessKey>();

  if (!result) return null;

  if (result.expires_at) {
    const expiresAtStr = String(result.expires_at).trim();
    if (expiresAtStr) {
      const expiryDate = new Date(expiresAtStr);
      if (!isNaN(expiryDate.getTime())) {
        const now = new Date();
        if (expiryDate <= now) {
          return null;
        }
      }
    }
  }

  return result;
}

export async function updateKeyUsage(keyHash: string, ip: string): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString();

  await db
    .prepare(
      'UPDATE access_keys SET last_used_at = ?, last_used_ip = ?, request_count = request_count + 1 WHERE key_hash = ?'
    )
    .bind(now, ip, keyHash)
    .run();
}

export function parseAccessibleDates(accessKey: AccessKey | null): string[] | null {
  if (!accessKey) return null;

  try {
    const dates = JSON.parse(accessKey.accessible_dates);
    if (dates.includes('*')) return null;
    return dates;
  } catch {
    return null;
  }
}

export function isDateAccessible(date: string, accessibleDates: string[] | null): boolean {
  if (accessibleDates === null) return true;

  for (const range of accessibleDates) {
    if (range.includes(':')) {
      const [start, end] = range.split(':');
      if (date >= start && date <= end) return true;
    } else {
      if (date === range) return true;
    }
  }

  return false;
}

export async function getAccessibleDateRanges(request: Request): Promise<string[] | null> {
  const url = new URL(request.url);
  const keyParam = url.searchParams.get('key');
  const authHeader = request.headers.get('Authorization');
  const cookieHeader = request.headers.get('Cookie');
  
  let keyHash: string | null = null;
  let key: string | null = null;
  
  if (keyParam || authHeader) {
    key = keyParam || authHeader?.replace('Bearer ', '') || null;
  } else if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) acc[name] = decodeURIComponent(value);
      return acc;
    }, {} as Record<string, string>);
    
    keyHash = cookies['hc_access_token'] || null;
  }

  let accessKey: AccessKey | null = null;

  if (keyHash) {
    const db = getDB();
    const result = await db
      .prepare('SELECT * FROM access_keys WHERE key_hash = ? AND is_revoked = 0')
      .bind(keyHash)
      .first<AccessKey>();
    
    if (result) {
      let isValid = true;
      if (result.expires_at) {
        const expiresAtStr = String(result.expires_at).trim();
        if (expiresAtStr) {
          const expiryDate = new Date(expiresAtStr);
          if (!isNaN(expiryDate.getTime())) {
            const now = new Date();
            isValid = expiryDate > now;
          }
        }
      }
      
      if (isValid) {
        accessKey = result;
        const ip = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   'unknown';
        await updateKeyUsage(keyHash, ip);
      }
    }
  } else if (key) {
    accessKey = await validateAccessKey(key);
    if (accessKey) {
      const ip = request.headers.get('CF-Connecting-IP') || 
                 request.headers.get('X-Forwarded-For') || 
                 'unknown';
      await updateKeyUsage(await hashKey(key), ip);
    }
  }

  if (!accessKey) {
    return null;
  }

  return parseAccessibleDates(accessKey);
}

