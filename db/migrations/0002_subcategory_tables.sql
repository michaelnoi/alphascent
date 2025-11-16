-- AlphaScent Migration 0002: Subcategory Tables
-- Creates separate tables per arXiv subcategory for optimal row-read efficiency

-- ============================================================================
-- CS.CV - Computer Vision Papers
-- ============================================================================
CREATE TABLE papers_cs_cv (
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

CREATE INDEX idx_papers_cs_cv_submitted ON papers_cs_cv(submitted_date DESC);

-- ============================================================================
-- CS.HC - Human-Computer Interaction Papers
-- ============================================================================
CREATE TABLE papers_cs_hc (
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

CREATE INDEX idx_papers_cs_hc_submitted ON papers_cs_hc(submitted_date DESC);

-- ============================================================================
-- Full-Text Search Tables (FTS5 with Porter Stemming)
-- ============================================================================

-- FTS for cs.CV papers (searches title, abstract, and authors)
CREATE VIRTUAL TABLE papers_cs_cv_fts USING fts5(
  title, 
  abstract, 
  authors, 
  content=papers_cs_cv, 
  content_rowid=rowid,
  tokenize='porter unicode61'
);

-- FTS for cs.HC papers
CREATE VIRTUAL TABLE papers_cs_hc_fts USING fts5(
  title, 
  abstract, 
  authors,
  content=papers_cs_hc,
  content_rowid=rowid,
  tokenize='porter unicode61'
);

-- ============================================================================
-- Triggers to Keep FTS5 in Sync with papers_cs_cv
-- ============================================================================
CREATE TRIGGER papers_cs_cv_ai AFTER INSERT ON papers_cs_cv BEGIN
  INSERT INTO papers_cs_cv_fts(rowid, title, abstract, authors)
  VALUES (new.rowid, new.title, new.abstract, new.authors);
END;

CREATE TRIGGER papers_cs_cv_ad AFTER DELETE ON papers_cs_cv BEGIN
  DELETE FROM papers_cs_cv_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER papers_cs_cv_au AFTER UPDATE ON papers_cs_cv BEGIN
  UPDATE papers_cs_cv_fts 
  SET title = new.title, abstract = new.abstract, authors = new.authors
  WHERE rowid = new.rowid;
END;

-- ============================================================================
-- Triggers to Keep FTS5 in Sync with papers_cs_hc
-- ============================================================================
CREATE TRIGGER papers_cs_hc_ai AFTER INSERT ON papers_cs_hc BEGIN
  INSERT INTO papers_cs_hc_fts(rowid, title, abstract, authors)
  VALUES (new.rowid, new.title, new.abstract, new.authors);
END;

CREATE TRIGGER papers_cs_hc_ad AFTER DELETE ON papers_cs_hc BEGIN
  DELETE FROM papers_cs_hc_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER papers_cs_hc_au AFTER UPDATE ON papers_cs_hc BEGIN
  UPDATE papers_cs_hc_fts 
  SET title = new.title, abstract = new.abstract, authors = new.authors
  WHERE rowid = new.rowid;
END;
