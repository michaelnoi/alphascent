import { NextRequest, NextResponse } from 'next/server';
import { getDB, getEnv, Paper, Figure, PaperWithFigures, D1Session, createSession } from '@/app/lib/db';
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
  let session: D1Session | null = null;
  let sessionMeta: { region?: string, isPrimary?: boolean } = {};
  
  try {
    const { searchParams } = new URL(request.url);
    const dbRaw = getDB();
    const bookmark = request.headers.get("x-d1-bookmark");
    
    const sessionResult = await createSession(dbRaw, bookmark, 'Papers API');
    session = sessionResult.session;
    sessionMeta = { region: sessionResult.region, isPrimary: sessionResult.isPrimary };
    
    const db = session;

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

    let whereConditions: string[] = [];
    let bindings: unknown[] = [];
    let searchQuery: string | null = null;

    if (search) {
      const terms = search.trim().split(/\s+/).filter(term => term.length > 0);
      if (terms.length > 0) {
        searchQuery = terms.map(term => {
          const escaped = term.replace(/"/g, '""');
          return `"${escaped}"*`;
        }).join(' ');
        whereConditions.push(`${tableName}.rowid IN (SELECT rowid FROM ${ftsTable} WHERE ${ftsTable} MATCH ?)`);
        bindings.push(searchQuery);
      }
      
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

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...bindings).first<{ total: number }>();
    const total = countResult?.total || 0;

    let papersQuery: string;
    let queryBindings: unknown[] = [];
    
    if (search && searchQuery && searchQuery.trim().length > 0) {
      const ftsWhereConditions: string[] = [`${ftsTable} MATCH ?`];
      queryBindings.push(searchQuery);
      
      if (searchScope === 'current' && date) {
        ftsWhereConditions.push(`${tableName}.submitted_date = ?`);
        queryBindings.push(date);
      } else if (searchScope === 'current' && from && to) {
        ftsWhereConditions.push(`${tableName}.submitted_date >= ? AND ${tableName}.submitted_date <= ?`);
        queryBindings.push(from, to);
      }
      
      const ftsWhereClause = ftsWhereConditions.length > 0 ? `WHERE ${ftsWhereConditions.join(' AND ')}` : '';
      
      papersQuery = `
        SELECT ${tableName}.*
        FROM ${tableName}
        INNER JOIN ${ftsTable} ON ${tableName}.rowid = ${ftsTable}.rowid
        ${ftsWhereClause}
        ORDER BY ${ftsTable}.rank, ${tableName}.submitted_date DESC, ${tableName}.created_at DESC
        LIMIT ? OFFSET ?
      `;
    } else {
      papersQuery = `
        SELECT * FROM ${tableName}
        ${whereClause}
        ORDER BY ${tableName}.submitted_date DESC, ${tableName}.created_at DESC
        LIMIT ? OFFSET ?
      `;
      queryBindings = [...bindings];
    }
    
    const papersResult = await db
      .prepare(papersQuery)
      .bind(...queryBindings, limit, offset)
      .all<Paper>();

    const papers = papersResult.results || [];

    if (papers.length === 0) {
      const response = NextResponse.json({
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
      if (session) {
        response.headers.set("x-d1-bookmark", session.getBookmark() ?? "first-unconstrained");
        if (sessionMeta.region) response.headers.set("x-d1-region", sessionMeta.region);
        if (sessionMeta.isPrimary !== undefined) response.headers.set("x-d1-primary", String(sessionMeta.isPrimary));
      }
      return response;
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

    const jsonResponse = NextResponse.json(response);
    if (session) {
      jsonResponse.headers.set("x-d1-bookmark", session.getBookmark() ?? "first-unconstrained");
      if (sessionMeta.region) jsonResponse.headers.set("x-d1-region", sessionMeta.region);
      if (sessionMeta.isPrimary !== undefined) jsonResponse.headers.set("x-d1-primary", String(sessionMeta.isPrimary));
    }
    return jsonResponse;
  } catch (error) {
    console.error('Papers API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch papers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
