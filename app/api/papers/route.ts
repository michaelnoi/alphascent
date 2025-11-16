import { NextRequest, NextResponse } from 'next/server';
import { getDB, getEnv, Paper, Figure, PaperWithFigures } from '@/app/lib/db';
import { getAccessibleDateRanges, isDateAccessible } from '@/app/lib/auth';
import { getCategoryTable, getFTSTable, isValidCategory } from '@/app/lib/categoryHelpers';

export const runtime = 'edge';

interface PapersResponse {
  papers: Array<{
    id: string;
    title: string;
    authors: string[];
    categories: string[];
    primary_category: string | null;
    abstract: string | null;
    submitted_date: string;
    announce_date: string | null;
    scraped_date: string;
    pdf_url: string | null;
    code_url: string | null;
    project_url: string | null;
    comments: string | null;
    figures: Array<{
      kind: string;
      url: string;
      thumb: string | null;
      width: number | null;
      height: number | null;
    }>;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    date?: string;
    from?: string;
    to?: string;
    search?: string;
    searchScope?: string;
  };
}

function transformPaper(paper: Paper, figures: Figure[], r2BaseUrl: string) {
  return {
    id: paper.id,
    title: paper.title,
    authors: JSON.parse(paper.authors),
    categories: JSON.parse(paper.categories),
    primary_category: paper.primary_category,
    abstract: paper.abstract,
    submitted_date: paper.submitted_date,
    announce_date: paper.announce_date,
    scraped_date: paper.scraped_date,
    pdf_url: paper.pdf_url,
    code_url: paper.code_url,
    project_url: paper.project_url,
    comments: paper.comments,
    figures: figures.map(f => ({
      kind: f.kind,
      url: `${r2BaseUrl}/${f.r2_key}`,
      thumb: f.thumb_key ? `${r2BaseUrl}/${f.thumb_key}` : null,
      width: f.width,
      height: f.height,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const db = getDB();
    const env = getEnv();
    
    const r2BaseUrl = env.R2_BUCKET_URL || process.env.R2_BUCKET_URL || '';
    
    const category = searchParams.get('category');
    if (!category) {
      return NextResponse.json({ error: 'category parameter required' }, { status: 400 });
    }
    
    if (!isValidCategory(category)) {
      return NextResponse.json({ error: 'invalid category' }, { status: 400 });
    }
    
    const tableName = getCategoryTable(category);
    const ftsTable = getFTSTable(category);
    
    const date = searchParams.get('date');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');
    const searchScope = searchParams.get('searchScope') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);
    const offset = (page - 1) * limit;

    const accessibleDates = await getAccessibleDateRanges(request);

    let whereConditions: string[] = [];
    let bindings: unknown[] = [];

    if (search) {
      const searchQuery = search.split(/\s+/).map(term => `${term}*`).join(' ');
      whereConditions.push(`${tableName}.rowid IN (SELECT rowid FROM ${ftsTable} WHERE ${ftsTable} MATCH ?)`);
      bindings.push(searchQuery);
      
      if (searchScope === 'current' && date) {
        whereConditions.push(`${tableName}.submitted_date = ?`);
        bindings.push(date);
      } else if (searchScope === 'current' && from && to) {
        whereConditions.push(`${tableName}.submitted_date >= ? AND ${tableName}.submitted_date <= ?`);
        bindings.push(from, to);
      }
    } else {
      if (date) {
        whereConditions.push(`${tableName}.submitted_date = ?`);
        bindings.push(date);
      } else if (from && to) {
        whereConditions.push(`${tableName}.submitted_date >= ? AND ${tableName}.submitted_date <= ?`);
        bindings.push(from, to);
      }
    }

    if (accessibleDates && !date && !(from && to)) {
      const dateAccessConditions: string[] = [];
      for (const range of accessibleDates) {
        if (range.includes(':')) {
          const [start, end] = range.split(':');
          dateAccessConditions.push(`(${tableName}.submitted_date >= ? AND ${tableName}.submitted_date <= ?)`);
          bindings.push(start, end);
        } else {
          dateAccessConditions.push(`${tableName}.submitted_date = ?`);
          bindings.push(range);
        }
      }
      if (dateAccessConditions.length > 0) {
        whereConditions.push(`(${dateAccessConditions.join(' OR ')})`);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...bindings).first<{ total: number }>();
    const total = countResult?.total || 0;

    const papersQuery = `
      SELECT * FROM ${tableName}
      ${whereClause}
      ORDER BY ${search ? 'rank,' : ''} ${tableName}.submitted_date DESC, ${tableName}.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const papersResult = await db
      .prepare(papersQuery)
      .bind(...bindings, limit, offset)
      .all<Paper>();

    const papers = papersResult.results || [];

    if (papers.length === 0) {
      return NextResponse.json({
        papers: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
        filters: {
          date: date || undefined,
          from: from || undefined,
          to: to || undefined,
          search: search || undefined,
          searchScope: searchScope || undefined,
        },
      });
    }

    const paperIds = papers.map(p => p.id);
    const placeholders = paperIds.map(() => '?').join(',');
    const figuresQuery = `SELECT * FROM figures WHERE paper_id IN (${placeholders})`;
    const figuresResult = await db.prepare(figuresQuery).bind(...paperIds).all<Figure>();
    const figures = figuresResult.results || [];

    const figuresByPaper = figures.reduce((acc, fig) => {
      if (!acc[fig.paper_id]) acc[fig.paper_id] = [];
      acc[fig.paper_id].push(fig);
      return acc;
    }, {} as Record<string, Figure[]>);

    const transformedPapers = papers.map(paper => 
      transformPaper(paper, figuresByPaper[paper.id] || [], r2BaseUrl)
    );

    const response: PapersResponse = {
      papers: transformedPapers,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + papers.length < total,
      },
      filters: {
        date: date || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
        searchScope: searchScope || undefined,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Papers API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch papers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
