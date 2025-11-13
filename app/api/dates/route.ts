import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/app/lib/db';
import { getAccessibleDateRanges, isDateAccessible } from '@/app/lib/auth';

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
  try {
    const db = getDB();
    
    const accessibleDates = await getAccessibleDateRanges(request);

    const query = `
      SELECT submitted_date as date, COUNT(*) as count 
      FROM papers 
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
    console.error('Dates API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

