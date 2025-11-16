-- AlphaScent Database Schema
-- Migration 0001: Initial schema with papers, figures, FTS5 search, and access keys

-- ============================================================================
-- Figures Table (shared across all categories)
-- ============================================================================
CREATE TABLE figures (
  id TEXT PRIMARY KEY,                   -- e.g., "2510.14230-teaser"
  paper_id TEXT NOT NULL,                -- References papers across all category tables
  kind TEXT NOT NULL,                    -- 'teaser' or 'architecture'
  r2_key TEXT NOT NULL,                  -- e.g., "figures/2510.14230/teaser.webp"
  thumb_key TEXT,                        -- e.g., "figures/2510.14230/teaser_thumb.webp"
  width INTEGER,
  height INTEGER
);

CREATE INDEX idx_figures_paper ON figures(paper_id);

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

