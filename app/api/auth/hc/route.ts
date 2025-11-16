import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/app/lib/db';

export const runtime = 'edge';

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    
    const db = getDB();
    const keyHash = await hashToken(token);
    
    const query = `
      SELECT id, user_name, expires_at, is_revoked, accessible_dates
      FROM access_keys 
      WHERE key_hash = ?
    `;
    
    const result = await db.prepare(query).bind(keyHash).first<{
      id: string;
      user_name: string | null;
      expires_at: string | null;
      is_revoked: number;
      accessible_dates: string;
    }>();
    
    if (!result) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    if (result.is_revoked) {
      return NextResponse.json({ error: 'Token has been revoked' }, { status: 401 });
    }
    
    if (result.expires_at) {
      const expiresAtStr = String(result.expires_at).trim();
      if (expiresAtStr) {
        const expiryDate = new Date(expiresAtStr);
        if (isNaN(expiryDate.getTime())) {
          return NextResponse.json({ error: 'Invalid expiration date format' }, { status: 401 });
        }
        const now = new Date();
        if (expiryDate <= now) {
          return NextResponse.json({ error: 'Token has expired' }, { status: 401 });
        }
      }
    }
    
    const updateQuery = `
      UPDATE access_keys 
      SET last_used_at = CURRENT_TIMESTAMP,
          last_used_ip = ?,
          request_count = request_count + 1
      WHERE id = ?
    `;
    
    const ip = request.headers.get('cf-connecting-ip') || 
               request.headers.get('x-forwarded-for') || 
               'unknown';
    
    await db.prepare(updateQuery).bind(ip, result.id).run();
    
    const response = NextResponse.json({ 
      success: true,
      user_name: result.user_name 
    });
    
    response.cookies.set('hc_access_token', keyHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' }, 
      { status: 500 }
    );
  }
}

