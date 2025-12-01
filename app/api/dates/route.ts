import { NextRequest, NextResponse } from 'next/server';
import { getDB, D1Session, createSession } from '@/app/lib/db';
import { getCategoryTable, isValidCategory } from '@/app/lib/categoryHelpers';

export const runtime = 'edge';

interface DateInfo {
  date: string;
  count: number;
}

interface DatesResponse {
  dates: DateInfo[];
  accessible_dates: string[] | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  
  let session: D1Session | null = null;

  try {
    const dbRaw = getDB();
    const bookmark = request.headers.get("x-d1-bookmark");
    session = await createSession(dbRaw, bookmark, 'Dates API');
    const db = session;
    
    if (!category) {
      return NextResponse.json({ error: 'category parameter required' }, { status: 400 });
    }
    
    if (!isValidCategory(category)) {
      return NextResponse.json({ error: 'invalid category' }, { status: 400 });
    }
    
    const tableName = getCategoryTable(category);

    const query = `
      SELECT submitted_date as date, COUNT(*) as count 
      FROM ${tableName}
      GROUP BY submitted_date 
      ORDER BY submitted_date DESC
    `;

    const result = await db.prepare(query).all<{ date: string; count: number }>();
    const allDates = result.results || [];

    const response: DatesResponse = {
      dates: allDates,
      accessible_dates: null,
    };

    const jsonResponse = NextResponse.json(response);
    if (session) {
      jsonResponse.headers.set("x-d1-bookmark", session.getBookmark() ?? "first-unconstrained");
    }
    return jsonResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Dates API error:', errorMessage);
    console.error('Stack:', errorStack);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dates', 
        details: errorMessage,
        category: category || null,
        tableName: category ? getCategoryTable(category) : null,
      },
      { status: 500 }
    );
  }
}

