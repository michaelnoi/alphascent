import { getRequestContext } from '@cloudflare/next-on-pages';

export interface R2Bucket {
  head(key: string): Promise<R2Object | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string): Promise<R2Object>;
  delete(key: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  checksums: R2Checksums;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
}

export interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  startAfter?: string;
  include?: ('httpMetadata' | 'customMetadata')[];
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

export interface R2Checksums {
  md5?: ArrayBuffer;
  sha1?: ArrayBuffer;
  sha256?: ArrayBuffer;
  sha384?: ArrayBuffer;
  sha512?: ArrayBuffer;
}

export interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  withSession(token: string): D1Session;
}

export type D1Session = D1Database & { getBookmark(): string | null };

export async function createSession(db: D1Database, bookmark: string | null, source: string): Promise<{ session: D1Session, region?: string, isPrimary?: boolean }> {
  const session = db.withSession(bookmark ?? "first-unconstrained");
  let region: string | undefined;
  let isPrimary: boolean | undefined;
  
  // Diagnostic check
  try {
    const check = await session.prepare('select 1').run();
    region = check.meta.served_by_region;
    isPrimary = check.meta.served_by_primary;
    
    console.log(`D1 Session (${source}):`, {
      servedByRegion: region,
      servedByPrimary: isPrimary,
    });
  } catch (e) {
    console.error(`Failed to run D1 session check (${source}):`, e);
  }
  
  return { session, region, isPrimary };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: {
    duration: number;
    rows_read: number;
    rows_written: number;
    served_by_region?: string;
    served_by_primary?: boolean;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface CloudflareEnv {
  DB: D1Database;
  R2: R2Bucket;
  ENVIRONMENT?: string;
  R2_BUCKET_URL?: string;
  ACCESS_KEY_SECRET?: string;
}

export function getDB(): D1Database {
  try {
    const context = getRequestContext();
    const env = context.env as CloudflareEnv;
    
    if (!env?.DB) {
      throw new Error('D1 database binding not found. Make sure DB is bound in wrangler.toml');
    }
    
    return env.DB;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get D1 database: ${errorMessage}`);
  }
}

export function getEnv(): CloudflareEnv {
  try {
    const context = getRequestContext();
    const env = context.env as CloudflareEnv;
    if (!env) {
      throw new Error('Environment not available');
    }
    return env;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get environment: ${errorMessage}`);
  }
}

export interface Paper {
  id: string;
  title: string;
  authors: string;
  categories: string;
  primary_category: string | null;
  abstract: string | null;
  submitted_date: string;
  announce_date: string | null;
  scraped_date: string;
  pdf_url: string | null;
  code_url: string | null;
  project_url: string | null;
  comments: string | null;
  created_at: string;
}

export interface Figure {
  id: string;
  paper_id: string;
  kind: string;
  r2_key: string;
  thumb_key: string | null;
  width: number | null;
  height: number | null;
}

export interface PaperWithFigures extends Paper {
  figures: Figure[];
}

