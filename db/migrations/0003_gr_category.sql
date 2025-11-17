-- AlphaScent Migration 0003: GR Category Table
-- Creates table and FTS for cs.GR (Computer Science - Graphics) papers

-- ============================================================================
-- CS.GR - Graphics Papers
-- ============================================================================
CREATE TABLE papers_cs_gr (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT NOT NULL,
  categories TEXT NOT NULL,
  primary_category TEXT,
  abstract TEXT,
  submitted_date TEXT NOT NULL,
  announce_date TEXT,
  scraped_date TEXT NOT NULL,
  pdf_url TEXT,
  code_url TEXT,
  project_url TEXT,
  comments TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_papers_cs_gr_submitted ON papers_cs_gr(submitted_date DESC);

-- ============================================================================
-- Full-Text Search Table (FTS5 with Porter Stemming)
-- ============================================================================

-- FTS for cs.GR papers
CREATE VIRTUAL TABLE papers_cs_gr_fts USING fts5(
  title, 
  abstract, 
  authors, 
  content=papers_cs_gr, 
  content_rowid=rowid,
  tokenize='porter unicode61'
);

-- ============================================================================
-- Triggers to Keep FTS5 in Sync with papers_cs_gr
-- ============================================================================
CREATE TRIGGER papers_cs_gr_ai AFTER INSERT ON papers_cs_gr BEGIN
  INSERT INTO papers_cs_gr_fts(rowid, title, abstract, authors)
  VALUES (new.rowid, new.title, new.abstract, new.authors);
END;

CREATE TRIGGER papers_cs_gr_ad AFTER DELETE ON papers_cs_gr BEGIN
  DELETE FROM papers_cs_gr_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER papers_cs_gr_au AFTER UPDATE ON papers_cs_gr BEGIN
  UPDATE papers_cs_gr_fts 
  SET title = new.title, abstract = new.abstract, authors = new.authors
  WHERE rowid = new.rowid;
END;

