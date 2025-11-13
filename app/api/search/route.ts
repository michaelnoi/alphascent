import { NextRequest, NextResponse } from 'next/server';
import { getDB, getEnv, Paper, Figure } from '@/app/lib/db';
import { getAccessibleDateRanges, isDateAccessible } from '@/app/lib/auth';

export const runtime = 'edge';

interface SearchResponse {
  results: Array<{
    id: string;
    title: string;
    authors: string[];
    abstract: string | null;
    recentview_date: string;
    rank: number;
  }>;
  query: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const db = getDB();
    
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = (page - 1) * limit;

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const accessibleDates = await getAccessibleDateRanges(request);

    let whereConditions: string[] = [];
    let bindings: unknown[] = [query];

    if (accessibleDates) {
      const dateAccessConditions: string[] = [];
      for (const range of accessibleDates) {
        if (range.includes(':')) {
          const [start, end] = range.split(':');
          dateAccessConditions.push('(papers.recentview_date >= ? AND papers.recentview_date <= ?)');
          bindings.push(start, end);
        } else {
          dateAccessConditions.push('papers.recentview_date = ?');
          bindings.push(range);
        }
      }
      if (dateAccessConditions.length > 0) {
        whereConditions.push(`(${dateAccessConditions.join(' OR ')})`);
      }
    }

    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM papers_fts 
      JOIN papers ON papers.id = papers_fts.paper_id 
      WHERE papers_fts MATCH ? ${whereClause}
    `;
    const countResult = await db.prepare(countQuery).bind(...bindings).first<{ total: number }>();
    const total = countResult?.total || 0;

    const searchQuery = `
      SELECT 
        papers.id,
        papers.title,
        papers.authors,
        papers.abstract,
        papers.recentview_date,
        papers_fts.rank
      FROM papers_fts
      JOIN papers ON papers.id = papers_fts.paper_id
      WHERE papers_fts MATCH ? ${whereClause}
      ORDER BY papers_fts.rank
      LIMIT ? OFFSET ?
    `;

    const result = await db
      .prepare(searchQuery)
      .bind(...bindings, limit, offset)
      .all<Paper & { rank: number }>();

    const results = (result.results || []).map(paper => ({
      id: paper.id,
      title: paper.title,
      authors: JSON.parse(paper.authors),
      abstract: paper.abstract,
      recentview_date: paper.recentview_date,
      rank: paper.rank,
    }));

    const response: SearchResponse = {
      results,
      query,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + results.length < total,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search papers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

