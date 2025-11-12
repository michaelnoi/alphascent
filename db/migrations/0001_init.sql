-- AlphaScent Database Schema
-- Migration 0001: Initial schema with papers, figures, FTS5 search, and access keys

-- ============================================================================
-- Papers Table (denormalized for simplicity)
-- ============================================================================
CREATE TABLE papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT NOT NULL,                 -- JSON array as text, e.g. ["John Doe", "Jane Smith"]
  categories TEXT NOT NULL,              -- JSON array as text, e.g. ["cs.CV", "cs.AI"]
  primary_category TEXT,
  abstract TEXT,
  published_date TEXT,                   -- YYYY-MM-DD format
  scraped_date TEXT NOT NULL,            -- YYYY-MM-DD format (used for date-based access control)
  pdf_url TEXT,
  code_url TEXT,
  project_url TEXT,
  comments TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_papers_scraped ON papers(scraped_date DESC);
CREATE INDEX idx_papers_published ON papers(published_date DESC);
CREATE INDEX idx_papers_primary_category ON papers(primary_category);

-- ============================================================================
-- Figures Table
-- ============================================================================
CREATE TABLE figures (
  id TEXT PRIMARY KEY,                   -- e.g., "2510.14230-teaser"
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                    -- 'teaser' or 'architecture'
  r2_key TEXT NOT NULL,                  -- e.g., "figures/2510.14230/teaser.webp"
  thumb_key TEXT,                        -- e.g., "figures/2510.14230/teaser_thumb.webp"
  width INTEGER,
  height INTEGER
);

CREATE INDEX idx_figures_paper ON figures(paper_id);

-- ============================================================================
-- Full-Text Search (FTS5)
-- ============================================================================
CREATE VIRTUAL TABLE papers_fts USING fts5(
  paper_id UNINDEXED,
  title,
  abstract,
  content=papers,
  content_rowid=rowid
);

-- Triggers to keep FTS5 in sync with papers table
CREATE TRIGGER papers_ai AFTER INSERT ON papers BEGIN
  INSERT INTO papers_fts(rowid, paper_id, title, abstract)
  VALUES (new.rowid, new.id, new.title, new.abstract);
END;

CREATE TRIGGER papers_ad AFTER DELETE ON papers BEGIN
  DELETE FROM papers_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER papers_au AFTER UPDATE ON papers BEGIN
  UPDATE papers_fts 
  SET title = new.title, abstract = new.abstract
  WHERE rowid = new.rowid;
END;

-- ============================================================================
-- Access Keys (Authentication)
-- ============================================================================
CREATE TABLE access_keys (
  id TEXT PRIMARY KEY,                   -- UUID
  key_hash TEXT UNIQUE NOT NULL,         -- SHA256 hash of the actual key
  user_name TEXT,
  user_email TEXT,
  accessible_dates TEXT NOT NULL,        -- JSON array of date ranges, e.g., ["2025-10-01:2025-12-31"] or ["*"] for all
  issued_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,                       -- ISO 8601 datetime
  last_used_at TEXT,
  last_used_ip TEXT,
  request_count INTEGER DEFAULT 0,
  is_revoked BOOLEAN DEFAULT 0,
  notes TEXT
);

CREATE INDEX idx_access_keys_hash ON access_keys(key_hash);
CREATE INDEX idx_access_keys_expires ON access_keys(expires_at);

