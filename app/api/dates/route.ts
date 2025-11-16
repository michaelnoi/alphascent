import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/app/lib/db';
import { getAccessibleDateRanges, isDateAccessible } from '@/app/lib/auth';
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
  
  try {
    const db = getDB();
    
    if (!category) {
      return NextResponse.json({ error: 'category parameter required' }, { status: 400 });
    }
    
    if (!isValidCategory(category)) {
      return NextResponse.json({ error: 'invalid category' }, { status: 400 });
    }
    
    const tableName = getCategoryTable(category);
    const accessibleDates = await getAccessibleDateRanges(request);

    const query = `
      SELECT submitted_date as date, COUNT(*) as count 
      FROM ${tableName}
      GROUP BY submitted_date 
      ORDER BY submitted_date DESC
    `;

    const result = await db.prepare(query).all<{ date: string; count: number }>();
    const allDates = result.results || [];

    const filteredDates = allDates.filter(d => {
      if (accessibleDates === null) return true;
      return isDateAccessible(d.date, accessibleDates);
    });

    const response: DatesResponse = {
      dates: filteredDates,
      accessible_dates: accessibleDates,
    };

    return NextResponse.json(response);
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

